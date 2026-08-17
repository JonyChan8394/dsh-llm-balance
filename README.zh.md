# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

在聊天输入框正下方显示你所有 LLM API 账户的余额。

- **聊天框下方** —— 输入区 dock 里的一条紧凑余额条，自动刷新（默认每 60 秒），带手动刷新链接。
- **任意 LLM API** —— provider 完全配置驱动。内置 DeepSeek、OpenRouter、SiliconFlow 预设；任何提供余额接口的服务都可以通过 JSON 点路径接入。
- **密钥留在宿主机** —— API key 只在宿主机侧从 DSH 凭据（或环境变量）解析，浏览器只会看到拉取到的余额。

## 安装

```sh
dsh plugin --profile web add dsh-llm-balance
```

重启 `dsh web`。只要至少一个配置的 provider 配了密钥，聊天输入框下方就会出现余额条。

## 配置

把 API key 加到 DSH 凭据（或环境变量）：

| Provider | 凭据引用 |
| --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| SiliconFlow | `SILICONFLOW_API_KEY` |

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

没配密钥的 provider 显示「未配置」；请求失败的显示「获取失败」。所有 provider 都没有密钥时整条余额条自动隐藏。

## 工作原理

- **宿主机半**（`lib/index.js`）通过 `ctx.credentials` 解析每个 provider 的 key，调用其余额接口，并通过 webserver 路由注册表提供 `GET /llm-balance` JSON。
- **浏览器半**（`lib/client.js`）注册一个 `conversation.input.dock` 条目（order 30），轮询 `/llm-balance` 并渲染余额条。

## License

MIT
