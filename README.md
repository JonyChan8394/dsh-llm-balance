# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

Show the balances of all your LLM API accounts right below the chat input box.

- **Below the chat input** — a compact readout in the composer's footer band (the seat under the input card, where the stats line lives) that refreshes automatically (default every 60 s) with a manual refresh link.
- **Any LLM API** — providers are config-driven. Presets ship for DeepSeek, OpenRouter, SiliconFlow, Moonshot/Kimi, MiniMax, StepFun and Zhipu/GLM; add any provider that exposes a balance endpoint via a dotted JSON path.
- **Only what you configured** — providers without an API key are hidden, so the strip shows exactly the accounts you set up.
- **Keys stay on the host** — API keys are resolved from DSH credentials (or environment) host-side; the browser only ever sees the fetched balances.

> **Qwen / DashScope (aliyun)** has no public balance API — balance is only visible in the Aliyun console, so there is no preset for it. If you access Qwen through an aggregator that exposes a balance endpoint (e.g. OpenRouter, SiliconFlow), configure that provider instead.

## Install

```sh
dsh plugin --profile web add github:JonyChan8394/dsh-llm-balance
```

Restart `dsh web`. The balance readout appears under the chat input as soon as at least one configured provider has a key.

## Configure

Add API keys to DSH credentials (or your environment):

| Provider | Credential ref |
| --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| SiliconFlow | `SILICONFLOW_API_KEY` |
| Moonshot / Kimi | `MOONSHOT_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| StepFun | `STEP_API_KEY` |
| Zhipu / GLM | `ZHIPU_API_KEY` |

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

Providers without a configured key are hidden from the strip; a provider whose request fails shows "获取失败 / fetch failed".

## How it works

- **Host half** (`lib/index.js`) resolves each provider's key through `ctx.credentials`, calls its balance endpoint, and serves `GET /llm-balance` as JSON through the webserver route registry.
- **Browser half** (`lib/client.js`) registers a `conversation.composer.dock` entry (order 10) that polls `/llm-balance` and renders the readout under the input card.

## License

MIT
