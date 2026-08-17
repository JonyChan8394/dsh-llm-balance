/**
 * dsh-llm-balance
 *
 * Host half: reads API keys from the credentials service, queries each
 * configured provider's balance endpoint, and serves the results over an
 * exact HTTP route (`/llm-balance`) that the browser half polls.
 *
 * Providers are auto-discovered: every request probes the known provider
 * table's credential refs (e.g. `DEEPSEEK_API_KEY`) through
 * `ctx.credentials`. A ref that resolves to a key activates that provider —
 * add or remove a key in the Models settings and the strip follows on the
 * next refresh, no restart needed (the credentials file is hot-watched).
 *
 * A provider whose key exists but has no public balance API (Qwen/DashScope,
 * OpenAI, Anthropic, …) reports `error: 'no-api'` so the browser can show
 * "未开放查询API" instead of silently hiding it. A provider whose key is
 * absent is omitted entirely.
 *
 * Custom providers can be added through `Config.providers` (url + dotted
 * balance path); entries there override the known table by id.
 */
import Schema from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

export const name = 'llm-balance'
export const inject = ['webServer']

/** A provider with a balance endpoint. */
const providerSchema = Schema.object({
  /** Stable id, also used as the dock display key. */
  id: Schema.string().required(),
  /** Human-readable provider name shown in the dock. */
  name: Schema.string().required(),
  /** Credential/env reference holding the API key, e.g. DEEPSEEK_API_KEY. */
  apiKeyRef: Schema.string().required(),
  /** Balance endpoint URL. */
  url: Schema.string().required(),
  /** Dotted path to the balance value in the JSON response (0 = array index). */
  balancePath: Schema.string().required(),
  /** Optional dotted path to the currency in the JSON response. */
  currencyPath: Schema.string(),
  /** Authorization scheme prefix; default Bearer. */
  auth: Schema.string().default('Bearer'),
})

/** A provider with a public API key but no public balance endpoint. */
const noApiProviderSchema = Schema.object({
  /** Stable id, also used as the dock display key. */
  id: Schema.string().required(),
  /** Human-readable provider name shown in the dock. */
  name: Schema.string().required(),
  /** Credential/env reference holding the API key, e.g. DASHSCOPE_API_KEY. */
  apiKeyRef: Schema.string().required(),
})

export const Config = Schema.object({
  /** How often the browser refreshes (ms). */
  refreshMs: Schema.number().default(60000),
  /**
   * Known providers whose credential refs are probed automatically on every
   * request. `noApi: true` marks providers with a public key but no public
   * balance endpoint. Custom providers added here override a known entry with
   * the same id.
   */
  providers: Schema.array(providerSchema).default([
    {
      id: 'deepseek',
      name: 'DeepSeek',
      apiKeyRef: 'DEEPSEEK_API_KEY',
      url: 'https://api.deepseek.com/user/balance',
      balancePath: 'balance_infos.0.total_balance',
      currencyPath: 'balance_infos.0.currency',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      apiKeyRef: 'OPENROUTER_API_KEY',
      url: 'https://openrouter.ai/api/v1/credits',
      balancePath: 'credits.remaining',
      currencyPath: 'credits.currency',
    },
    {
      id: 'siliconflow',
      name: 'SiliconFlow',
      apiKeyRef: 'SILICONFLOW_API_KEY',
      url: 'https://api.siliconflow.cn/v1/user/info',
      balancePath: 'data.balance',
    },
    {
      id: 'moonshot',
      name: 'Moonshot/Kimi',
      apiKeyRef: 'MOONSHOT_API_KEY',
      url: 'https://api.moonshot.cn/v1/users/me/balance',
      balancePath: 'available_balance',
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      apiKeyRef: 'MINIMAX_API_KEY',
      url: 'https://api.minimaxi.com/v1/token_plan/remains',
      balancePath: 'data.tokens',
    },
    {
      id: 'stepfun',
      name: 'StepFun',
      apiKeyRef: 'STEP_API_KEY',
      url: 'https://api.stepfun.com/v1/accounts',
      balancePath: 'data.credits_balance',
    },
    {
      id: 'zhipu',
      name: 'Zhipu/GLM',
      apiKeyRef: 'ZHIPU_API_KEY',
      url: 'https://open.bigmodel.cn/api/paas/v4/balance',
      balancePath: 'balance.0.total_balance',
      currencyPath: 'balance.0.currency',
    },
  ]),
  /**
   * Providers that have a public API key but no public balance endpoint.
   * When the credential ref is configured, the browser shows
   * "未开放查询API / no balance API" instead of hiding the provider.
   */
  noApiProviders: Schema.array(noApiProviderSchema).default([
    { id: 'dashscope', name: 'Qwen/DashScope', apiKeyRef: 'DASHSCOPE_API_KEY' },
    { id: 'openai', name: 'OpenAI', apiKeyRef: 'OPENAI_API_KEY' },
    { id: 'anthropic', name: 'Anthropic', apiKeyRef: 'ANTHROPIC_API_KEY' },
  ]).hidden(),
})

/** Resolve an API key from the credentials service, falling back to env. */
async function resolveKey(ctx, ref) {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const hit = await credentials.resolve(credentialRef(ref))
    if (hit !== undefined) return hit.value
  }
  return process.env[ref]
}

/** Read a dotted path (`a.0.b`) from a JSON value; missing paths yield undefined. */
function getPath(obj, path) {
  let cur = obj
  for (const key of path.split('.')) {
    if (cur == null) return undefined
    cur = cur[key]
  }
  return cur
}

/** Fetch one provider's balance; never throws — errors become provider fields. */
async function fetchBalance(ctx, provider) {
  const { id, name, url, balancePath, currencyPath, auth } = provider
  try {
    const res = await fetch(url, {
      headers: { Authorization: `${auth} ${provider.key}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { id, name, error: `http-${res.status}` }
    const json = await res.json()
    const balance = getPath(json, balancePath)
    if (balance === undefined) return { id, name, error: 'missing-path' }
    return {
      id,
      name,
      balance: typeof balance === 'number' ? balance : Number(balance),
      currency: currencyPath ? getPath(json, currencyPath) : undefined,
    }
  } catch (e) {
    return { id, name, error: String(e?.message ?? e) }
  }
}

export function apply(ctx, config) {
  const handler = async (req, res) => {
    try {
      const providers = []
      // Auto-discovery: probe every known ref; only providers with a
      // configured key are fetched — the rest are omitted entirely. Probing
      // is a local credentials read per request, so it is cheap and always
      // reflects the latest stored keys.
      for (const provider of config.providers) {
        const key = await resolveKey(ctx, provider.apiKeyRef)
        if (!key) continue
        providers.push(await fetchBalance(ctx, { ...provider, key }))
      }
      for (const provider of config.noApiProviders) {
        const key = await resolveKey(ctx, provider.apiKeyRef)
        if (key) providers.push({ id: provider.id, name: provider.name, error: 'no-api' })
      }
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ providers, refreshMs: config.refreshMs }))
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: String(e?.message ?? e) }))
    }
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/llm-balance', handler }), 'llm-balance: route')
}
