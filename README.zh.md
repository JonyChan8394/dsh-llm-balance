# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

在聊天输入框正下方显示你所有 LLM API 账户的余额。

- **输入框正下方** —— 输入卡片底部的 footer 条（统计行所在的座位），自动刷新（默认每 60 秒），带手动刷新链接。
- **凭据自动探测** —— 每次刷新自动探测已知 provider 的凭据引用（`DEEPSEEK_API_KEY`、`OPENROUTER_API_KEY` 等）。在 Models 设置里添加或删除 key，下次刷新余额条就自动跟随——无需重启、无需改配置。
- **没有公开余额 API？** —— Qwen/DashScope、OpenAI、Anthropic 等有公开 API key 但没有公开的余额查询接口。当它们的 key 被配置时，余额条会显示「未开放查询API」而不是隐藏它们。
- **密钥留在宿主机** —— API key 只在宿主机侧从 DSH 凭据（或环境变量）解析，浏览器只会看到拉取到的余额。

## 安装

```sh
dsh plugin --profile web add github:JonyChan8394/dsh-llm-balance
```

重启 `dsh web`。只要至少一个配置的 provider 配了密钥，输入框下方就会出现余额条。

## 配置

只需把 API key 加到 DSH 凭据（或环境变量）——其余全部自动：

| Provider | 凭据引用 | 余额 API |
| --- | --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` | ✅ |
| OpenRouter | `OPENROUTER_API_KEY` | ✅ |
| SiliconFlow | `SILICONFLOW_API_KEY` | ✅ |
| Moonshot / Kimi | `MOONSHOT_API_KEY` | ✅ |
| MiniMax | `MINIMAX_API_KEY` | ✅ |
| StepFun | `STEP_API_KEY` | ✅ |
| Zhipu / GLM | `ZHIPU_API_KEY` | ✅ |
| Qwen / DashScope | `DASHSCOPE_API_KEY` | ❌（仅控制台） |
| OpenAI | `OPENAI_API_KEY` | ❌ |
| Anthropic | `ANTHROPIC_API_KEY` | ❌ |

想接入列表之外的 provider（比如有自己的余额接口的聚合商），在 profile 的 `cordis.patch.yml` 里覆盖插件配置：

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

没配密钥的 provider 自动隐藏；请求失败的显示「获取失败」。

## 工作原理

- **宿主机半**（`lib/index.js`）在每次请求时通过 `ctx.credentials` 探测所有已知凭据引用，调用已配置 provider 的余额接口，并通过 webserver 路由注册表提供 `GET /llm-balance` JSON。有 key 但没有余额接口的 provider 返回 `error: 'no-api'`。
- **浏览器半**（`lib/client.js`）注册一个 `conversation.composer.dock` 条目（order 10），轮询 `/llm-balance` 并在输入卡片下方渲染余额条。

## License

MIT
