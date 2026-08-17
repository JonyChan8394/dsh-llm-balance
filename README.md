# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

Show the balances of exactly the LLM providers you have configured in dsh, right below the chat input box.

- **Below the chat input** — a compact readout in the composer's footer band (the seat under the input card, where the stats line lives) that refreshes automatically (default every 60 s) with a manual refresh link.
- **Click to recharge** — click any provider's balance (or "未开放查询API" label) to open its recharge/top-up page in a new browser tab.
- **Driven by your dsh configuration** — the strip shows exactly the providers registered in dsh (the Models page / `llm-pi-ai` settings + the built-in adapters you use). Configure a new LLM in dsh and it appears on the next refresh; remove it and it disappears. No restart, no config editing.
- **No public balance API?** — providers like Qwen/DashScope, OpenAI and Anthropic have a public API key but no public balance endpoint. When such a provider is configured with a key, the strip shows "未开放查询API / no balance API" instead of hiding it.
- **Keys stay on the host** — API keys are resolved from DSH credentials (or environment) host-side; the browser only ever sees the fetched balances.

## Install

```sh
dsh plugin --profile web add github:JonyChan8394/dsh-llm-balance
```

Restart `dsh web`. The balance readout appears under the chat input as soon as at least one configured provider has a key.

## Configure

Nothing to configure — the plugin follows the providers you already set up in dsh. Balance endpoints are known for these routes:

| Provider route | Balance API |
| --- | --- |
| DeepSeek (`deepseek`, `deepseek-official`) | ✅ |
| OpenRouter (`openrouter`) | ✅ |
| SiliconFlow (`siliconflow`) | ✅ |
| Moonshot / Kimi (`moonshotai-cn`, `moonshotai`) | ✅ |
| MiniMax (`minimax`) | ✅ |
| StepFun (`stepfun`) | ✅ |
| Zhipu / GLM (`zhipu`) | ✅ |
| Any other configured provider | ❌ shows "未开放查询API" |

Each preset also ships a `rechargeUrl` — the provider's top-up page — opened in a new tab when you click the balance in the strip. To add a balance endpoint for a provider not in the list (e.g. an aggregator route with its own balance endpoint), override the plugin config in your profile's `cordis.patch.yml`:

```yaml
- id: llm-balance
  config:
    refreshMs: 30000
    endpoints:
      - id: myprovider
        name: MyProvider
        apiKeyEnv: MYPROVIDER_API_KEY
        url: https://api.example.com/v1/balance
        balancePath: data.remaining
        currencyPath: data.currency
        rechargeUrl: https://console.example.com/recharge
```

A provider without a configured key is hidden from the strip; a provider whose request fails shows "获取失败 / fetch failed".

## How it works

- **Host half** (`lib/index.js`) reads `ctx.llm.listProviders()` — the exact set of LLM routes configured in dsh — on every request. For each provider with a known balance endpoint it resolves the key through `ctx.credentials` and calls the endpoint; for a configured provider with a key but no endpoint it reports `error: 'no-api'`. Results are served as `GET /llm-balance` JSON through the webserver route registry.
- **Browser half** (`lib/client.js`) registers a `conversation.composer.dock` entry (order 10) that polls `/llm-balance` and renders the readout under the input card.

## License

MIT
