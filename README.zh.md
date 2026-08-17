# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

在聊天输入框正下方显示你所有 LLM API 账户的余额。

- **输入框正下方** —— 输入卡片底部的 footer 条（统计行所在的座位），自动刷新（默认每 60 秒），带手动刷新链接。
- **任意 LLM API** —— provider 完全配置驱动。内置 DeepSeek、OpenRouter、SiliconFlow、Moonshot/Kimi、MiniMax、StepFun、Zhipu/GLM 预设；任何提供余额接口的服务都可以通过 JSON 点路径接入。
- **只显示你配置的** —— 没配密钥的 provider 自动隐藏，余额条只展示你真正接入的账户。
- **密钥留在宿主机** —— API key 只在宿主机侧从 DSH 凭据（或环境变量）解析，浏览器只会看到拉取到的余额。

> **Qwen / 通义千问（阿里云百炼 DashScope）没有公开的余额 API**——余额只能在阿里云控制台查看，因此没有内置预设。如果你通过有余额接口的聚合商使用 Qwen（如 OpenRouter、SiliconFlow），请配置那个 provider 即可显示。

## 安装

```sh
dsh plugin --profile web add github:JonyChan8394/dsh-llm-balance
```

重启 `dsh web`。只要至少一个配置的 provider 配了密钥，输入框下方就会出现余额条。

## 配置

把 API key 加到 DSH 凭据（或环境变量）：

| Provider | 凭据引用 |
| --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| SiliconFlow | `SILICONFLOW_API_KEY` |
| Moonshot / Kimi | `MOONSHOT_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| StepFun | `STEP_API_KEY` |
| Zhipu / GLM | `ZHIPU_API_KEY` |

想增加或自定义 provider，在 profile 的 `cordis.patch.yml` 里覆盖插件配置：

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

没配密钥的 provider 自动隐藏；请求失败的显示「获取失败」。

## 工作原理

- **宿主机半**（`lib/index.js`）通过 `ctx.credentials` 解析每个 provider 的 key，调用其余额接口，并通过 webserver 路由注册表提供 `GET /llm-balance` JSON。
- **浏览器半**（`lib/client.js`）注册一个 `conversation.composer.dock` 条目（order 10），轮询 `/llm-balance` 并在输入卡片下方渲染余额条。

## License

MIT
