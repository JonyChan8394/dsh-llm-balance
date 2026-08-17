// Host-half functional test: the provider set comes from
// ctx.llm.listProviders() (the user's configured LLMs); balance endpoints
// are looked up per route; providers with a key but no endpoint report
// 'no-api'; providers without a key are omitted.
//
// Run from inside a dsh profile (where @deepseek-ai/schemastery resolves) or
// after `npm i` in this repo:
//   node test/host.test.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { default: Schema } = await import('@deepseek-ai/schemastery')
const { Config, apply } = await import(pathToFileURL(path.join(repoRoot, 'lib/index.js')).href)

// 1. config defaults
const config = Schema.resolve({}, Config)[0]
const ids = config.endpoints.map((e) => e.id)
for (const expect of ['deepseek-official', 'deepseek', 'openrouter', 'siliconflow', 'moonshotai-cn', 'moonshotai', 'minimax', 'stepfun', 'zhipu']) {
  if (!ids.includes(expect)) throw new Error('missing endpoint preset ' + expect)
}
console.log('endpoints ok:', ids.join(', '), '| refreshMs', config.refreshMs)

// 2. route registration (apply takes webServer + llm + credentials + settings)
let captured = null
const webServer = { register(route) { captured = route; return () => {} } }
const llm = {
  // The user has configured deepseek-official (DeepSeek adapter) and
  // dashscope-vision (pi-ai settings route). Nothing else is registered.
  listProviders() {
    return [
      { id: 'deepseek-official', name: 'DeepSeek' },
      { id: 'dashscope-vision', name: 'DashScope Vision' },
    ]
  },
}
const settings = {
  get(ns) {
    if (ns !== 'llm-pi-ai') return undefined
    return {
      providers: {
        'dashscope-vision': {
          displayName: 'DashScope Vision',
          apiKeyEnv: 'DASHSCOPE_API_KEY',
          api: 'openai-completions',
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        },
      },
    }
  },
}
const credentials = {
  async resolve(ref) {
    const configured = new Set(['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY'])
    return configured.has(ref) ? { value: 'test-key', source: 'test' } : undefined
  },
}
const ctx = {
  webServer,
  llm,
  settings,
  credentials,
  effect: (fn) => fn(),
}
apply(ctx, config)
if (!captured || captured.kind !== 'exact' || captured.path !== '/llm-balance') throw new Error('route not registered as exact /llm-balance')
console.log('route ok:', captured.kind, captured.path)

// 3. handler: deepseek-official (endpoint -> fetch attempt) and
//    dashscope-vision (settings route, no endpoint -> no-api) appear; no
//    other provider shows.
const res = { status: 0, body: '', writeHead(s) { this.status = s }, end(b) { this.body = b } }
await captured.handler({}, res)
const json = JSON.parse(res.body)
if (res.status !== 200) throw new Error('handler status ' + res.status)
if (!Array.isArray(json.providers)) throw new Error('handler did not return providers array')
const byId = Object.fromEntries(json.providers.map((p) => [p.id, p]))
if (byId['deepseek-official'] === undefined) throw new Error('deepseek-official missing (configured, has endpoint)')
if (byId['dashscope-vision'] === undefined || byId['dashscope-vision'].error !== 'no-api') {
  throw new Error('dashscope-vision must report no-api (configured, no endpoint)')
}
if (Object.keys(byId).length !== 2) throw new Error('unexpected extra providers: ' + Object.keys(byId).join(','))
console.log('handler ok:', json.providers.map((p) => `${p.id}:${p.error ?? p.balance}`).join(', '))

// 4. live check against the real llm/settings/credentials — skipped when the
//    harness packages are unavailable, so it never fails a plain `npm i` run.
try {
  const settingsPath = path.join(os.homedir(), '.dsh', 'settings.yaml')
  const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml')
  const yamlText = fs.readFileSync(settingsPath, 'utf8')
  const yaml = (await import('yaml')).parse(yamlText)
  const liveSettings = { get(ns) { return ns === 'llm-pi-ai' ? yaml['llm-pi-ai'] : undefined } }
  const creds = fs.readFileSync(credPath, 'utf8')
  const keyOf = (ref) => { const m = creds.match(new RegExp(ref + ':\\s*["\']?([^"\'\n]+)')); return m ? m[1].trim() : undefined }
  const liveCredentials = { async resolve(ref) { const v = keyOf(ref); return v ? { value: v, source: 'test' } : undefined } }
  const liveLlm = {
    // Simulate the harness registry from the settings document: every
    // llm-pi-ai providers route plus deepseek-official.
    listProviders() {
      const routes = Object.keys(yaml['llm-pi-ai']?.providers ?? {})
      const out = routes.map((r) => ({ id: r, name: yaml['llm-pi-ai'].providers[r]?.displayName ?? r }))
      if (keyOf('DEEPSEEK_API_KEY') !== undefined) out.push({ id: 'deepseek-official', name: 'DeepSeek' })
      return out
    },
  }
  let liveCaptured = null
  const liveServer = { register(route) { liveCaptured = route; return () => {} } }
  const ctx2 = { webServer: liveServer, llm: liveLlm, settings: liveSettings, credentials: liveCredentials, effect: (fn) => fn() }
  apply(ctx2, config)
  const res2 = { status: 0, body: '', writeHead(s) { this.status = s }, end(b) { this.body = b } }
  await liveCaptured.handler({}, res2)
  const live = JSON.parse(res2.body)
  console.log('live providers:', live.providers.map((p) => `${p.name}:${p.error ?? `${p.currency ?? ''} ${p.balance}`.trim()}`).join(' | '))
} catch (e) {
  console.log('live check skipped:', e.message)
}

console.log('HOST TEST OK')
