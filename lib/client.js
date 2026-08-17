/**
 * dsh-llm-balance — browser half.
 *
 * Registers a compact strip in the `conversation.input.dock` list slot (the
 * row of docks directly under the chat input) that polls the host's
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
		const DEFAULTS = { title: 'API 余额', notConfigured: '未配置', error: '获取失败', refresh: '刷新', loading: '加载中…' };

		/** Strip element shown under the chat input. */
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

			return react.createElement(
				'div',
				{
					style: {
						display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
						padding: '4px 16px 0', fontSize: '12px', lineHeight: '18px',
						color: 'var(--dsw-alias-label-tertiary, #8a8f98)',
					},
				},
				react.createElement('span', { style: { fontWeight: 600 } }, text('title')),
				state.loading && react.createElement('span', null, text('loading')),
				state.error !== null && !state.loading && react.createElement('span', { style: { color: 'var(--dsw-alias-state-error-primary, #e5484d)' } }, text('error')),
				state.providers.map((p) =>
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
							: react.createElement('span', { style: { opacity: 0.55 } }, p.error === 'no-key' ? text('notConfigured') : text('error'))
					)
				),
				react.createElement(
					'button',
					{
						type: 'button',
						onClick: load,
						style: {
							border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
							color: 'inherit', fontSize: '12px', textDecoration: 'underline',
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
				zh: { title: 'API 余额', notConfigured: '未配置', error: '获取失败', refresh: '刷新', loading: '加载中…' },
				en: { title: 'API balance', notConfigured: 'not configured', error: 'fetch failed', refresh: 'refresh', loading: 'loading…' },
			}), 'llm-balance: dicts');
			ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
				name: 'conversation.input.dock',
				id: 'llm-balance',
				order: 30,
				locale: NS,
			}, BalanceDock));
		}

		exports.apply = apply;
		exports.inject = ['slots', 'locale'];
		return module.exports;
	}
});
