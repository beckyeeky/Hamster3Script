# 元书输入法脚本集（Yuanshu / Hamster v3 Scripts）

适用于 iOS 元书输入法（Hamster v3 Pro）的 JavaScript 脚本仓库，采用「独立 JS 源码 + `metadata.yaml` 清单 + 自动构建单文件 YAML」维护，便于版本控制、离线测试与一键导入。

## 脚本列表

所有脚本均为**单次手动触发**动作，按优先级 `$searchText` → `$selectedText` → `$pasteboardContent` 读取输入，并将结果返回到候选栏。

| 脚本名称 | 源码文件 | 联网 | 剪贴板默认 | 说明 |
|---|---|---|---|---|
| `Roll` | `scripts/roll.js` | 否 | 关闭 | 默认生成 `1-100` 随机数；支持输入上限（如 `20`）或骰子表达式（如 `2d6`） |
| `Base64 解码` | `scripts/base64-decode.js` | 否 | 关闭 | 纯 JS UTF-8 解码，兼容 URL-safe 变体，校验非法 Base64 / UTF-8 |
| `Base64 编码` | `scripts/base64-encode.js` | 否 | 关闭 | 纯 JS 按码位 UTF-8 编码，保留首尾空白，完整支持 emoji |
| `Unicode 查询` | `scripts/unicode.js` | 否 | 关闭 | 正向输出 `U+XXXX` 码位；输入全为 `U+XXXX` 序列时自动反查还原字符 |
| `快捷翻译` | `scripts/quick-translate.js` | 否 | 关闭 | 调用 iOS 26+ 系统离线 `$translater`，自动中英/日汉/韩汉互译，支持 `ja:` 等前缀指定目标语 |
| `谷歌中英互译` | `scripts/google-translate.js` | 是 | 关闭 | 免费在线翻译：支持直连 Google（`client=gtx` 失败自动回退 `batchexecute`）或走自建代理（兼容 `POST /api/translate`） |
| `DeepSeek` | `scripts/deepseek.js` | 是 | 关闭 | 调用 DeepSeek 或任意 OpenAI Chat Completions 兼容接口，支持自动重试与关闭思考模式 |
| `Webhook 发送` | `scripts/webhook-send.js` | 是 | 关闭 | 手动触发将当前文本以 JSON POST 到自定义 Webhook，并在候选栏返回状态码 |

## 快速使用

1. 获取构建好的导入文件：[dist/元输入法脚本.yaml](dist/元输入法脚本.yaml)。
2. 在元书主应用中进入「脚本」模块，导入该 YAML 文件。
3. 如使用联网脚本（`谷歌中英互译`、`DeepSeek`、`Webhook 发送`）：
   - 在 iOS「设置 → 键盘 → 元书」中开启**允许完全访问**。
   - 按 [docs/variables.md](docs/variables.md) 在元书「脚本 → `...` → 变量」中填入对应变量。
4. 如使用 `快捷翻译`（离线）：
   - 需 iOS 26+ 且元书商店版 `>= 1.12.1`（TF `>= 575`）。
   - 在 iOS「设置 → Apps → 翻译 → 语言」中预先下载源语言和目标语言包（如「中文（简体）」「英语」）。
5. 皮肤按键与工具栏绑定方式见 [docs/skin-integration.md](docs/skin-integration.md)。

## 目录结构

```text
.
├── README.md
├── LICENSE
├── metadata.yaml              # 脚本名称、图标与权限清单
├── scripts/                   # 各脚本独立源码（仅导出 async function output()）
├── dist/
│   └── 元输入法脚本.yaml      # 由 tools/build.py 自动生成的可导入文件
├── docs/
│   ├── variables.md           # 元书自定义变量与安全说明
│   └── skin-integration.md    # 皮肤长按/工具栏绑定与常见差异说明
└── tools/
    ├── build.py               # YAML 构建与一致性校验工具
    └── test_scripts.mjs       # Node.js 离线测试与作用域隔离检查
```

## 开发与验证

### 依赖

- Python 3 + `PyYAML`（用于构建 YAML）
- Node.js 18+（用于运行离线测试）

### 常用命令

```bash
# 修改 scripts/*.js 或 metadata.yaml 后重新构建 dist/元输入法脚本.yaml
python3 tools/build.py

# 校验构建产物与源码是否同步
python3 tools/build.py --check

# 运行全部脚本的离线测试（含共享全局作用域污染检查）
node tools/test_scripts.mjs
```

## 编写约定（适配元书 JavaScriptCore 环境）

1. **避免顶层全局变量污染**：元书在多个脚本间切换时不会清空全局作用域。所有脚本仅在顶层定义 `async function output()`，全部常量与辅助函数均封装在 `output()` 内部。
2. **不依赖 Web API**：JavaScriptCore 独立环境不提供 `atob`、`btoa`、`TextEncoder`、`TextDecoder`、`URL` 等浏览器全局对象，编解码与 URL 拼接均使用原生 JS 实现。
3. **无硬编码密钥**：API Key、Token 与自定义端点一律通过元书自定义变量注入，且不写入 `$log`。

## 参考文档

- [元书输入法脚本功能文档](https://ihsiao.com/apps/hamster/v3/docs/guides/scripts/)
- [元书输入法皮肤动作文档](https://ihsiao.com/apps/hamster/v3/docs/guides/skins/action/)
