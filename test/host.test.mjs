// Host-half functional test: config defaults resolve, apply() registers the
// exact /llm-balance route, and the handler returns JSON per provider.
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
if (!ids.includes('deepseek')) throw new Error('missing deepseek preset')
console.log('config ok:', ids.join(', '), '| refreshMs', config.refreshMs)

// 2. route registration (apply now takes webServer via inject -> ctx.webServer)
let captured = null
const webServer = { register(route) { captured = route; return () => {} } }
const credentials = {
  async resolve() { return undefined },
}
const ctx = {
  webServer,
  effect: (fn) => fn(),
  get: (name) => (name === 'credentials' ? credentials : undefined),
}
apply(ctx, config)
if (!captured || captured.kind !== 'exact' || captured.path !== '/llm-balance') throw new Error('route not registered as exact /llm-balance')
console.log('route ok:', captured.kind, captured.path)

// 3. handler returns JSON (no keys configured -> no-key errors, never throws)
const res = { status: 0, body: '', writeHead(s) { this.status = s }, end(b) { this.body = b } }
await captured.handler({}, res)
const json = JSON.parse(res.body)
if (res.status !== 200) throw new Error('handler status ' + res.status)
if (!Array.isArray(json.providers)) throw new Error('handler did not return providers array')
if (!json.providers.every((p) => p.id && p.name && p.error === 'no-key')) throw new Error('unexpected provider rows')
console.log('handler ok:', json.providers.map((p) => `${p.id}:${p.error}`).join(', '))

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
  if (deepseek && deepseek.balance !== undefined) console.log('live deepseek balance:', deepseek.currency, deepseek.balance)
  else console.log('live check skipped (no DEEPSEEK_API_KEY in ~/.dsh/.credentials.yaml)')
} catch {
  console.log('live check skipped (no local credentials file)')
}

console.log('HOST TEST OK')
