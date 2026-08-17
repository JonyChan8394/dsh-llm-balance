/**
 * dsh-llm-balance
 *
 * Host half: shows the balance of exactly the LLM providers the user has
 * configured in dsh — nothing more. The provider set is read live from
 * `ctx.llm.listProviders()` — the routes with a registered adapter, which is
 * exactly the set the Models page manages (pi-ai registers an adapter only
 * for routes present in the `llm-pi-ai` settings section; the DeepSeek
 * adapter registers `deepseek-official`; nothing else appears). Results are
 * served over an exact HTTP route (`/llm-balance`) that the browser half
 * polls.
 *
 * For each configured provider:
 *  - a balance-endpoint spec is known (`Config.endpoints`, matched by
 *    provider id) and a credential key resolves → fetch the balance;
 *  - no endpoint spec but a configured key exists (Qwen/DashScope, OpenAI,
 *    Anthropic, …) → report `error: 'no-api'` so the browser shows
 *    "未开放查询API";
 *  - no key → omitted entirely (configured but not usable).
 *
 * The provider set is re-read from the llm service on every request, and the
 * settings section it mirrors is hot-watched, so adding or removing an LLM in
 * dsh updates the strip on the next refresh — no restart, no config editing.
 */
import Schema from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

export const name = 'llm-balance'
export const inject = ['webServer', 'llm', 'credentials', 'settings']

/** Balance-endpoint spec for one provider route. */
const endpointSchema = Schema.object({
  /** Provider route id as registered with the llm service (e.g. `deepseek-official`). */
  id: Schema.string().required(),
  /** Human-readable provider name shown in the dock. */
  name: Schema.string().required(),
  /** Credential/env reference holding the API key, e.g. DEEPSEEK_API_KEY. */
  apiKeyEnv: Schema.string().required(),
  /** Balance endpoint URL. */
  url: Schema.string().required(),
  /** Dotted path to the balance value in the JSON response (0 = array index). */
  balancePath: Schema.string().required(),
  /** Optional dotted path to the currency in the JSON response. */
  currencyPath: Schema.string(),
  /** Authorization scheme prefix; default Bearer. */
  auth: Schema.string().default('Bearer'),
})

export const Config = Schema.object({
  /** How often the browser refreshes (ms). */
  refreshMs: Schema.number().default(60000),
  /**
   * Balance-endpoint map keyed by provider route id. Only providers with an
   * entry here get their balance fetched; every other configured provider
   * with a key (no public balance API) reports `no-api`. Override to add or
   * correct an endpoint — this does NOT control which providers are shown;
   * the llm service's adapter registry does.
   */
  endpoints: Schema.array(endpointSchema).default([
    {
      id: 'deepseek-official',
      name: 'DeepSeek',
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      url: 'https://api.deepseek.com/user/balance',
      balancePath: 'balance_infos.0.total_balance',
      currencyPath: 'balance_infos.0.currency',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      url: 'https://api.deepseek.com/user/balance',
      balancePath: 'balance_infos.0.total_balance',
      currencyPath: 'balance_infos.0.currency',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      url: 'https://openrouter.ai/api/v1/credits',
      balancePath: 'credits.remaining',
      currencyPath: 'credits.currency',
    },
    {
      id: 'siliconflow',
      name: 'SiliconFlow',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      url: 'https://api.siliconflow.cn/v1/user/info',
      balancePath: 'data.balance',
    },
    {
      id: 'moonshotai-cn',
      name: 'Moonshot/Kimi',
      apiKeyEnv: 'MOONSHOT_API_KEY',
      url: 'https://api.moonshot.cn/v1/users/me/balance',
      balancePath: 'data.available_balance',
    },
    {
      id: 'moonshotai',
      name: 'Moonshot/Kimi',
      apiKeyEnv: 'MOONSHOT_API_KEY',
      url: 'https://api.moonshot.ai/v1/users/me/balance',
      balancePath: 'data.available_balance',
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      apiKeyEnv: 'MINIMAX_API_KEY',
      url: 'https://api.minimaxi.com/v1/token_plan/remains',
      balancePath: 'data.tokens',
    },
    {
      id: 'stepfun',
      name: 'StepFun',
      apiKeyEnv: 'STEP_API_KEY',
      url: 'https://api.stepfun.com/v1/accounts',
      balancePath: 'data.credits_balance',
    },
    {
      id: 'zhipu',
      name: 'Zhipu/GLM',
      apiKeyEnv: 'ZHIPU_API_KEY',
      url: 'https://open.bigmodel.cn/api/paas/v4/balance',
      balancePath: 'balance.0.total_balance',
      currencyPath: 'balance.0.currency',
    },
  ]),
})

/**
 * Resolve an API key from the credentials service, falling back to env.
 * @param ctx - plugin context carrying the credentials service.
 * @param ref - credential reference (env-shaped identifier).
 * @returns the key string, or undefined when unconfigured.
 */
async function resolveKey(ctx, ref) {
  const hit = await ctx.credentials.resolve(credentialRef(ref))
  if (hit !== undefined) return hit.value
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
async function fetchBalance(provider) {
  const { id, name, url, balancePath, currencyPath, auth, key } = provider
  try {
    const res = await fetch(url, {
      headers: { Authorization: `${auth} ${key}` },
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

/**
 * The credential ref for a provider route, from the `llm-pi-ai` settings
 * section when the route has a profile there, else undefined.
 * @param ctx - plugin context carrying the settings service.
 * @param route - provider route id.
 * @returns the apiKeyEnv string, or undefined.
 */
function settingsApiKeyEnv(ctx, route) {
  const section = ctx.settings.get('llm-pi-ai')
  const profile = section?.providers?.[route]
  if (typeof profile !== 'object' || profile === null) return undefined
  const env = profile.apiKeyEnv
  return typeof env === 'string' && env.length > 0 ? env : undefined
}

export function apply(ctx, config) {
  const handler = async (req, res) => {
    try {
      const endpoints = new Map(config.endpoints.map((e) => [e.id, e]))
      const providers = []
      // `listProviders()` is exactly the user's configured LLM set: pi-ai
      // registers an adapter only for routes in its settings section, and the
      // DeepSeek adapter registers `deepseek-official`. Nothing else appears.
      for (const provider of ctx.llm.listProviders()) {
        const spec = endpoints.get(provider.id)
        if (spec !== undefined) {
          const key = await resolveKey(ctx, spec.apiKeyEnv)
          if (key === undefined) continue // configured but no usable key -> hidden
          providers.push(await fetchBalance({ ...spec, name: spec.name, key }))
          continue
        }
        // Known provider without a balance endpoint (Qwen/DashScope, OpenAI,
        // Anthropic, ...): show "no-api" when its key is configured.
        const apiKeyEnv = settingsApiKeyEnv(ctx, provider.id)
        if (apiKeyEnv === undefined) continue // not a settings-managed route
        const key = await resolveKey(ctx, apiKeyEnv)
        if (key === undefined) continue
        providers.push({ id: provider.id, name: provider.name, error: 'no-api' })
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
