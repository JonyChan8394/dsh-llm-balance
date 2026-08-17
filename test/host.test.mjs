// Host-half functional test: config defaults resolve, apply() registers the
// exact /llm-balance route, the handler auto-discovers providers by probing
// credential refs, and no-api providers report error 'no-api'.
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
const ids = config.providers.map((p) => p.id)
for (const expect of ['deepseek', 'openrouter', 'siliconflow', 'moonshot', 'minimax', 'stepfun', 'zhipu']) {
  if (!ids.includes(expect)) throw new Error('missing preset ' + expect)
}
const noApiIds = config.noApiProviders.map((p) => p.id)
if (!noApiIds.includes('dashscope')) throw new Error('missing dashscope no-api preset')
console.log('config ok:', ids.join(', '), '| noApi:', noApiIds.join(', '))

// 2. route registration (apply now takes webServer via inject -> ctx.webServer)
let captured = null
const webServer = { register(route) { captured = route; return () => {} } }
const credentials = {
  async resolve(ref) {
    // Only DEEPSEEK_API_KEY and DASHSCOPE_API_KEY are "configured".
    const configured = new Set(['DEEPSEEK_API_KEY', 'DASHSCOPE_API_KEY'])
    return configured.has(ref) ? { value: 'test-key', source: 'test' } : undefined
  },
}
const ctx = {
  webServer,
  effect: (fn) => fn(),
  get: (name) => (name === 'credentials' ? credentials : undefined),
}
apply(ctx, config)
if (!captured || captured.kind !== 'exact' || captured.path !== '/llm-balance') throw new Error('route not registered as exact /llm-balance')
console.log('route ok:', captured.kind, captured.path)

// 3. handler with only deepseek+dashscope configured: every provider whose ref
//    is unset must be omitted (no-key rows are dropped), deepseek tries its
//    endpoint (network in test env fails -> http error), dashscope -> no-api.
const res = { status: 0, body: '', writeHead(s) { this.status = s }, end(b) { this.body = b } }
await captured.handler({}, res)
const json = JSON.parse(res.body)
if (res.status !== 200) throw new Error('handler status ' + res.status)
if (!Array.isArray(json.providers)) throw new Error('handler did not return providers array')
const byId = Object.fromEntries(json.providers.map((p) => [p.id, p]))
if (byId['deepseek'] === undefined) throw new Error('deepseek missing (ref configured, must appear)')
if (byId['dashscope'] === undefined || byId['dashscope'].error !== 'no-api') throw new Error('dashscope must report no-api')
for (const hidden of ['openrouter', 'siliconflow', 'moonshot', 'minimax', 'stepfun', 'zhipu', 'openai', 'anthropic']) {
  if (byId[hidden] !== undefined) throw new Error(hidden + ' should be omitted (no key configured)')
}
console.log('handler ok:', json.providers.map((p) => `${p.id}:${p.error ?? p.balance}`).join(', '))

// 4. live check (skips silently when the local credentials file has no key)
try {
  const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml')
  const yaml = fs.readFileSync(credPath, 'utf8')
  const keyOf = (ref) => { const m = yaml.match(new RegExp(ref + ':\\s*["\']?([^"\'\n]+)')); return m ? m[1].trim() : undefined }
  const liveCredentials = { async resolve(ref) { const v = keyOf(ref); return v ? { value: v, source: 'test' } : undefined } }
  let liveCaptured = null
  const liveServer = { register(route) { liveCaptured = route; return () => {} } }
  const ctx2 = { webServer: liveServer, effect: (fn) => fn(), get: (name) => (name === 'credentials' ? liveCredentials : undefined) }
  apply(ctx2, config)
  const res2 = { status: 0, body: '', writeHead(s) { this.status = s }, end(b) { this.body = b } }
  await liveCaptured.handler({}, res2)
  const live = JSON.parse(res2.body)
  const deepseek = live.providers.find((p) => p.id === 'deepseek')
  const dashscope = live.providers.find((p) => p.id === 'dashscope')
  if (deepseek && deepseek.balance !== undefined) console.log('live deepseek balance:', deepseek.currency, deepseek.balance)
  else console.log('live check skipped (no DEEPSEEK_API_KEY in ~/.dsh/.credentials.yaml)')
  if (dashscope) console.log('live dashscope:', dashscope.error ?? dashscope.balance)
} catch {
  console.log('live check skipped (no local credentials file)')
}

console.log('HOST TEST OK')
