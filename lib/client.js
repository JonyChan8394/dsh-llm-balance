/**
 * dsh-llm-balance — browser half.
 *
 * Registers a compact readout in the `conversation.composer.dock` list slot —
 * the band under the composer card (the same seat the shipped stats line
 * lives in, directly below the user's input box) — that polls the host's
 * `/llm-balance` route and shows every configured provider's balance.
 *
 * This file is served verbatim as the client bundle; it must stay plain JS
 * that registers through window.__ModuleLoader__.load (no imports, no JSX).
 */
window.__ModuleLoader__.load({
	id: 'dsh-llm-balance',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react = require('react');
		const { useState, useEffect, useCallback } = react;

		const NS = 'llmBalance';
		const DEFAULTS = { title: 'API 余额', notConfigured: '未配置', noApi: '未开放查询API', error: '获取失败', refresh: '刷新', loading: '加载中…' };

		/** Ambient readout rendered under the composer card (below the input box). */
		function BalanceDock({ t }) {
			const [state, setState] = useState({ loading: true, providers: [], error: null });
			const load = useCallback(() => {
				fetch('/llm-balance', { headers: { accept: 'application/json' } })
					.then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
					.then((data) => setState({ loading: false, providers: Array.isArray(data?.providers) ? data.providers : [], error: null }))
					.catch((e) => setState({ loading: false, providers: [], error: String((e && e.message) || e) }));
			}, []);
			useEffect(() => {
				load();
				const timer = setInterval(load, 60000);
				return () => clearInterval(timer);
			}, [load]);

			if (state.providers.length === 0 && !state.loading && !state.error) return null;

			const text = (key) => (t && typeof t === 'function' ? t(key) : (DEFAULTS[key] ?? key));
			// Show only providers the user actually configured a key for — a
			// `no-key` provider is not part of their setup and only adds noise.
			const shown = state.providers.filter((p) => p.error !== 'no-key');

			return react.createElement(
				'div',
				{
					style: {
						display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap',
						padding: '2px 12px 6px', fontSize: '12px', lineHeight: '16px',
						color: 'var(--dsw-alias-label-tertiary, #8a8f98)',
					},
				},
				react.createElement('span', { style: { fontWeight: 600, opacity: 0.85 } }, text('title')),
				state.loading && react.createElement('span', null, text('loading')),
				state.error !== null && !state.loading && react.createElement('span', { style: { color: 'var(--dsw-alias-state-error-primary, #e5484d)' } }, text('error')),
				shown.map((p) =>
					react.createElement(
						'span',
						{ key: p.id, style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
						react.createElement('span', { style: { opacity: 0.75 } }, p.name + ':'),
						p.error === undefined
							? react.createElement(
									'span',
									{ style: { fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-primary, #e6e6e6)' } },
									(p.currency ? p.currency + ' ' : '') + formatBalance(p.balance)
								)
							: react.createElement(
									'span',
									{ style: { opacity: p.error === 'no-api' ? 0.7 : 0.55 } },
									p.error === 'no-api' ? text('noApi') : text('error')
								)
					)
				),
				react.createElement(
					'button',
					{
						type: 'button',
						onClick: load,
						style: {
							border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
							color: 'inherit', fontSize: '12px', textDecoration: 'underline', opacity: 0.8,
						},
					},
					text('refresh')
				)
			);
		}

		function formatBalance(value) {
			if (typeof value !== 'number' || Number.isNaN(value)) return String(value ?? '—');
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
		}

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh: { title: 'API 余额', notConfigured: '未配置', noApi: '未开放查询API', error: '获取失败', refresh: '刷新', loading: '加载中…' },
				en: { title: 'API balance', notConfigured: 'not configured', noApi: 'no balance API', error: 'fetch failed', refresh: 'refresh', loading: 'loading…' },
			}), 'llm-balance: dicts');
			ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
				name: 'conversation.composer.dock',
				id: 'llm-balance',
				order: 10,
				locale: NS,
			}, BalanceDock));
		}

		exports.apply = apply;
		exports.inject = ['slots', 'locale'];
		return module.exports;
	}
});
