# dsh-llm-balance

[English](README.md) | [中文](README.zh.md)

在聊天输入框正下方，显示你在 dsh 里**实际配置的**那些 LLM 账户的余额——不多不少。

- **输入框正下方** —— 输入卡片底部的 footer 条（统计行所在的座位），自动刷新（默认每 60 秒），带手动刷新链接。
- **点击直达充值** —— 点击任意 provider 的余额（或「未开放查询API」字样），会在新浏览器标签页打开该家 LLM 的充值/控制台页面。
- **跟随你的 dsh 配置** —— 余额条只显示 dsh 里已注册的 provider（Models 页面 / `llm-pi-ai` 设置 + 你在用的内置适配器）。在 dsh 里新增一个 LLM，下次刷新就出现；删掉就消失。无需重启、无需改插件配置。
- **没有公开余额 API？** —— Qwen/DashScope、OpenAI、Anthropic 等有公开 API key 但没有公开的余额查询接口。当这类 provider 配了 key 时，余额条会显示「未开放查询API」而不是隐藏它。
- **密钥留在宿主机** —— API key 只在宿主机侧从 DSH 凭据（或环境变量）解析，浏览器只会看到拉取到的余额。

## 安装

```sh
dsh plugin --profile web add github:JonyChan8394/dsh-llm-balance
```

重启 `dsh web`。只要至少一个配置的 provider 配了密钥，输入框下方就会出现余额条。

## 配置

无需配置——插件自动跟随你在 dsh 里已经配置好的 provider。以下 route 已知余额接口：

| Provider route | 余额 API |
| --- | --- |
| DeepSeek（`deepseek`、`deepseek-official`） | ✅ |
| OpenRouter（`openrouter`） | ✅ |
| SiliconFlow（`siliconflow`） | ✅ |
| Moonshot / Kimi（`moonshotai-cn`、`moonshotai`） | ✅ |
| MiniMax（`minimax`） | ✅ |
| StepFun（`stepfun`） | ✅ |
| Zhipu / GLM（`zhipu`） | ✅ |
| 其他已配置的 provider | ❌ 显示「未开放查询API」 |

每个预设都带 `rechargeUrl`（该家充值页）——点击余额条里的 provider 就在新标签页打开。想给列表之外的 provider（比如有自己的余额接口的聚合商 route）加余额端点，在 profile 的 `cordis.patch.yml` 里覆盖插件配置：

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

没配密钥的 provider 自动隐藏；请求失败的显示「获取失败」。

## 工作原理

- **宿主机半**（`lib/index.js`）在每次请求时读取 `ctx.llm.listProviders()`——即 dsh 中实际配置的 LLM route 集合。对每个有已知余额端点的 provider，通过 `ctx.credentials` 解析密钥并调用接口；对配置了密钥但没有余额端点的 provider 返回 `error: 'no-api'`。结果通过 webserver 路由注册表提供 `GET /llm-balance` JSON。
- **浏览器半**（`lib/client.js`）注册一个 `conversation.composer.dock` 条目（order 10），轮询 `/llm-balance` 并在输入卡片下方渲染余额条。

## License

MIT
