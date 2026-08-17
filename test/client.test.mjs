// Client-half test: the bundle registers through window.__ModuleLoader__.load,
// apply() injects a conversation.composer.dock entry, the dock renders, and a
// provider with a rechargeUrl opens it via window.open when clicked.
// No DOM needed — react and fetch are stubbed.
// Run: node test/client.test.mjs
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

// --- react stub with a persistent useState so re-renders keep state ---
let persistentState = null
let setState = null
const reactStub = {
  useState: (init) => {
    if (persistentState === null) persistentState = { value: init }
    setState = (next) => {
      persistentState.value = typeof next === 'function' ? next(persistentState.value) : next
    }
    return [persistentState.value, setState]
  },
  useEffect: (fn) => { fn() },
  useCallback: (fn) => fn,
  // Match React semantics: flatten nested array children one level (the
  // renderer spreads `shown.map(...)` inline among other children).
  createElement: (type, props, ...children) => ({
    type, props,
    children: children.flatMap((c) => (Array.isArray(c) ? c : [c])),
  }),
}

let opened = []
globalThis.window = {
  __ModuleLoader__: { load(handoff) { registered = handoff } },
  open: (url) => opened.push(url),
}
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    providers: [
      { id: 'deepseek', name: 'DeepSeek', balance: 12.34, currency: 'CNY', rechargeUrl: 'https://platform.deepseek.com/top_up' },
      { id: 'dashscope', name: 'DashScope Vision', error: 'no-api', rechargeUrl: 'https://bailian.console.aliyun.com/' },
    ],
    refreshMs: 60000,
  }),
})

let registered = null
new Function('require', src)((spec) => {
  if (spec === 'react') return reactStub
  throw new Error('unexpected require: ' + spec)
})
if (!registered) throw new Error('bundle did not register')
if (registered.id !== 'dsh-llm-balance') throw new Error('wrong bundle id: ' + registered.id)

const mod = registered.factory((spec) => {
  if (spec === 'react') return reactStub
  throw new Error('unexpected require: ' + spec)
})
if (!mod.apply || !mod.inject) throw new Error('missing apply/inject exports')
if (!mod.inject.includes('slots')) throw new Error('slots not injected')

let injected = null
let dockComponent = null
const fakeSlots = {
  inject(slot, fn) { injected = { slot, fn } },
  register(opts, Component) {
    if (opts.name !== 'conversation.composer.dock') throw new Error('wrong slot: ' + opts.name)
    if (opts.order !== 10) throw new Error('wrong order: ' + opts.order)
    dockComponent = Component
    const rendered = Component({ t: (k) => k })
    if (!rendered || !rendered.children) throw new Error('dock did not render')
    return rendered
  },
}
mod.apply({ slots: fakeSlots, locale: { register() {} }, effect: (fn) => fn() })
if (!injected || injected.slot !== 'conversation.composer.dock') throw new Error('dock not injected')
injected.fn()

// Let the stub's fetch promise resolve into persistent state, then re-render
// to get the latest children with onClick handlers.
await new Promise((resolve) => setTimeout(resolve, 10))
const rendered = dockComponent({ t: (k) => k })
const children = rendered.children.filter((c) => c && c.props)
const item = children.find((c) => c.props.key === 'deepseek')
if (!item) throw new Error('deepseek item missing')
if (typeof item.props.onClick !== 'function') throw new Error('deepseek item has no onClick')
item.props.onClick()
if (opened.length !== 1 || opened[0] !== 'https://platform.deepseek.com/top_up') {
  throw new Error('click did not open recharge url: ' + JSON.stringify(opened))
}
console.log('click opened:', opened[0])
console.log('CLIENT TEST OK')
