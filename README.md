# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

Show the balances of all your LLM API accounts right under the chat input box.

- **Under the chat input** — a compact strip in the composer dock that refreshes automatically (default every 60 s) with a manual refresh link.
- **Any LLM API** — providers are config-driven. Presets ship for DeepSeek, OpenRouter and SiliconFlow; add any provider that exposes a balance endpoint via a dotted JSON path.
- **Keys stay on the host** — API keys are resolved from DSH credentials (or environment) host-side; the browser only ever sees the fetched balances.

## Install

```sh
dsh plugin --profile web add dsh-llm-balance
```

Restart `dsh web`. The balance strip appears under the chat input as soon as at least one configured provider has a key.

## Configure

Add API keys to DSH credentials (or your environment):

| Provider | Credential ref |
| --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| SiliconFlow | `SILICONFLOW_API_KEY` |

To add or customize providers, override the plugin config in your profile's `cordis.patch.yml`:

```yaml
- id: llm-balance
  config:
    refreshMs: 30000
    providers:
      - id: deepseek
        name: DeepSeek
        apiKeyRef: DEEPSEEK_API_KEY
        url: https://api.deepseek.com/user/balance
        balancePath: balance_infos.0.total_balance
        currencyPath: balance_infos.0.currency
      - id: myprovider
        name: MyProvider
        apiKeyRef: MYPROVIDER_API_KEY
        url: https://api.example.com/v1/balance
        balancePath: data.remaining
        currencyPath: data.currency
```

A provider whose key is missing shows "未配置 / not configured"; a provider whose request fails shows "获取失败 / fetch failed". The whole strip hides when every provider lacks a key.

## How it works

- **Host half** (`lib/index.js`) resolves each provider's key through `ctx.credentials`, calls its balance endpoint, and serves `GET /llm-balance` as JSON through the webserver route registry.
- **Browser half** (`lib/client.js`) registers a `conversation.input.dock` entry (order 30) that polls `/llm-balance` and renders the strip.

## License

MIT
