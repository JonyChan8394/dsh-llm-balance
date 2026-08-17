// Client-half test: the bundle registers through window.__ModuleLoader__.load,
// apply() injects a conversation.input.dock entry, and the dock renders.
// No DOM needed — react is stubbed.
// Run: node test/client.test.mjs
import fs from 'node:fs'

const src = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

const reactStub = {
  useState: (init) => [init, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  createElement: (type, props, ...children) => ({ type, props, children }),
}

let registered = null
globalThis.window = { __ModuleLoader__: { load(handoff) { registered = handoff } } }

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
const fakeSlots = {
  inject(slot, fn) { injected = { slot, fn } },
  register(opts, Component) {
    if (opts.name !== 'conversation.input.dock') throw new Error('wrong slot: ' + opts.name)
    if (opts.order !== 30) throw new Error('wrong order: ' + opts.order)
    const rendered = Component({ t: (k) => k })
    if (!rendered || !rendered.children) throw new Error('dock did not render')
  },
}
mod.apply({ slots: fakeSlots, locale: { register() {} }, effect: (fn) => fn() })
if (!injected || injected.slot !== 'conversation.input.dock') throw new Error('dock not injected')
injected.fn()
console.log('CLIENT TEST OK')
