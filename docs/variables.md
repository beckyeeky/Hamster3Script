# 元书脚本变量配置说明

元书支持在应用内维护自定义变量，运行时会自动在变量名前加上 `$` 并注入脚本执行环境。API Key、Token 与自定义端点应通过变量配置，不要硬编码在脚本文件或公开仓库中。

## 配置入口

打开元书主应用 →「脚本」→ 右上角 `...` →「变量」→ 新增变量。

## 变量清单

| 变量名 | 脚本内引用 | 适用脚本 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `deepseek_api_key` | `$deepseek_api_key` | `DeepSeek` | 是 | 无 | DeepSeek 或 OpenAI 兼容接口的 API Key |
| `deepseek_base_url` | `$deepseek_base_url` | `DeepSeek` | 否 | `https://api.deepseek.com/chat/completions` | 支持填完整路径或仅填根路径（如 `https://api.example.com/v1`，脚本会自动补齐 `/chat/completions`） |
| `deepseek_model` | `$deepseek_model` | `DeepSeek` | 否 | `deepseek-chat` | 请求使用的模型名（如 `deepseek-chat`、`deepseek-v4-flash`） |
| `deepseek_system_prompt` | `$deepseek_system_prompt` | `DeepSeek` | 否 | 内置精简纯文本提示词 | 自定义系统提示词 |
| `deepseek_thinking` | `$deepseek_thinking` | `DeepSeek` | 否 | `disabled` | 仅对 `api.deepseek.com` 生效；默认关闭思考模式以降低延迟，填 `enabled` 可开启 |
| `translate_proxy_url` | `$translate_proxy_url` | `谷歌中英互译` | 否 | 无 | 自建翻译代理地址（兼容 `pixivReader` 的 `POST /api/translate` 协议：`{ engine: "google", text, to }`） |
| `google_translate_endpoint` | `$google_translate_endpoint` | `谷歌中英互译` | 否 | `https://translate.googleapis.com/translate_a/single` | 直连模式下覆盖默认 `client=gtx` 接口地址（未配代理时生效） |
| `webhook_url` | `$webhook_url` | `Webhook 发送` | 是 | 无 | 接收 POST JSON 的端点 URL，必须以 `http://` 或 `https://` 开头 |
| `webhook_token` | `$webhook_token` | `Webhook 发送` | 否 | 无 | 配置后自动附加 `Authorization: Bearer <token>` 请求头 |

## 权限与安全说明

1. **完全访问权限**：调用 `$http` 的脚本（`谷歌中英互译`、`DeepSeek`、`Webhook 发送`）需要在系统「设置 → 键盘 → 元书」中开启「允许完全访问」。
2. **剪贴板权限**：所有脚本在导入清单中默认将 `allowPasteboard` 设为 `false`。如需让某个脚本在未选中文本时回退读取剪贴板，请在元书脚本列表中单独为该脚本开启「允许访问剪贴板」。
3. **敏感内容**：开启剪贴板读取后，触发联网脚本前应确认剪贴板中不包含密码、验证码或凭证。
4. **日志脱敏**：脚本中的 `$log` 不输出 `deepseek_api_key` 与 `webhook_token`。
