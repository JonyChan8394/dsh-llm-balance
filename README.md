# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

Show the balances of all your LLM API accounts right below the chat input box.

- **Below the chat input** — a compact readout in the composer's footer band (the seat under the input card, where the stats line lives) that refreshes automatically (default every 60 s) with a manual refresh link.
- **Auto-discovery** — every refresh probes the known provider credential refs (`DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, …). Add or remove a key in Models settings and the strip follows on the next refresh — no restart, no config editing.
- **No public balance API?** — providers like Qwen/DashScope, OpenAI and Anthropic have a public API key but no public balance endpoint. When their key is configured, the strip shows "未开放查询API / no balance API" instead of hiding them.
- **Keys stay on the host** — API keys are resolved from DSH credentials (or environment) host-side; the browser only ever sees the fetched balances.

## Install

```sh
dsh plugin --profile web add github:JonyChan8394/dsh-llm-balance
```

Restart `dsh web`. The balance readout appears under the chat input as soon as at least one configured provider has a key.

## Configure

Just add API keys to DSH credentials (or your environment) — everything else is automatic:

| Provider | Credential ref | Balance API |
| --- | --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` | ✅ |
| OpenRouter | `OPENROUTER_API_KEY` | ✅ |
| SiliconFlow | `SILICONFLOW_API_KEY` | ✅ |
| Moonshot / Kimi | `MOONSHOT_API_KEY` | ✅ |
| MiniMax | `MINIMAX_API_KEY` | ✅ |
| StepFun | `STEP_API_KEY` | ✅ |
| Zhipu / GLM | `ZHIPU_API_KEY` | ✅ |
| Qwen / DashScope | `DASHSCOPE_API_KEY` | ❌ (console only) |
| OpenAI | `OPENAI_API_KEY` | ❌ |
| Anthropic | `ANTHROPIC_API_KEY` | ❌ |

To add a provider not in the list (e.g. an aggregator with its own balance endpoint), override the plugin config in your profile's `cordis.patch.yml`:

```yaml
- id: llm-balance
  config:
    refreshMs: 30000
    providers:
      - id: myprovider
        name: MyProvider
        apiKeyRef: MYPROVIDER_API_KEY
        url: https://api.example.com/v1/balance
        balancePath: data.remaining
        currencyPath: data.currency
```

Providers without a configured key are hidden from the strip; a provider whose request fails shows "获取失败 / fetch failed".

## How it works

- **Host half** (`lib/index.js`) probes every known credential ref through `ctx.credentials` on each request, calls the balance endpoint of each configured provider, and serves `GET /llm-balance` as JSON through the webserver route registry. Providers with a key but no balance endpoint report `error: 'no-api'`.
- **Browser half** (`lib/client.js`) registers a `conversation.composer.dock` entry (order 10) that polls `/llm-balance` and renders the readout under the input card.

## License

MIT
