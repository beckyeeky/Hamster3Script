# 皮肤按键与工具栏绑定指南

元书皮肤（`.cskin`）可以通过 `action` 直接调用脚本列表中的脚本。脚本名称必须与元书「脚本」页面中显示的名称完全一致。

## 官方动作字段

参考元书官方动作文档（`skins/action`）：

- `action: { runScript: '脚本名称' }`：打开脚本界面并运行指定脚本。
- `action: { runScriptSilently: '脚本名称' }`：后台静默执行指定脚本（需商店 >= 1.8.0 / TF >= 505；`$searchText` 会由光标前后文本与选中文本拼接替换）。

## 与常见皮肤（如「送你一朵小红花-元书」）的对应关系

该类皮肤默认在两处引用了外部脚本：

| 皮肤文件 | 触发方式 | 皮肤原始写法 | 本仓库对应脚本名 | 处理建议 |
|---|---|---|---|---|
| `jsonnet/lib/hintSymbolsData.libsonnet` | 长按 `j` 第 2 项 | `runTranslateScript: '谷歌中英互译'` | `谷歌中英互译` | 官方文档仅定义 `runScript` 与 `runScriptSilently`，建议改为 `runScript: '谷歌中英互译'` |
| `jsonnet/lib/hintSymbolsData.libsonnet` | 长按 `j` 第 3 项 | `runScript: 'DeepSeek'` | `DeepSeek` | 名称已匹配，直接生效 |
| `jsonnet/lib/hintSymbolsData.libsonnet` | 长按 `j` 第 4 项 | `runScript: 'Unicode'` | `Unicode 查询` | 将皮肤中的 `'Unicode'` 改为 `'Unicode 查询'`，或在元书中将脚本重命名为 `Unicode` |
| `jsonnet/lib/toolbar.libsonnet` | 工具栏翻译图标 | `runScript: '快捷翻译'` | `快捷翻译` | 名称已匹配，直接生效 |

### 修改示例（`jsonnet/lib/hintSymbolsData.libsonnet`）

```jsonnet
j: {
  selectedIndex: 1,
  list: [
    { action: { openURL: '#pasteboardContent' }, label: { systemImageName: 'link' }, fontSize: 14 },
    { action: { runScript: '谷歌中英互译' }, label: { systemImageName: 'translate' }, fontSize: 14 },
    { action: { runScript: 'DeepSeek' }, label: { systemImageName: 'message.fill' }, fontSize: 14 },
    { action: { runScript: 'Unicode 查询' }, label: { text: 'U编' }, fontSize: 14 },
  ],
},
```

如需将 `Webhook 发送` 也加入长按菜单，可在 `list` 中追加一项：

```jsonnet
{ action: { runScript: 'Webhook 发送' }, label: { systemImageName: 'paperplane' }, fontSize: 14 },
```

## 修改皮肤后如何生效

1. 在手机上编辑皮肤目录中的 `jsonnet/` 文件。
2. 回到元书「皮肤选择」界面，长按当前皮肤。
3. 选择「运行 `main.jsonnet`」重新编译配置。

或在电脑端皮肤根目录执行：

```bash
jsonnet -S -m . ./jsonnet/main.jsonnet
```

## 其他长按配置说明（`sendKeys`）

部分皮肤在 `d`、`m` 等按键上配置了 `sendKeys`（如 `/date`、`/fsj`、`/fjq`、`/sjh`、`/mail`）。这些属于向 Rime 引擎发送按键序列，依赖当前 Rime 输入方案中的自定义短语或 Lua 触发词；若方案未定义对应触发词，键盘会原样输入这些字符，与 JS 脚本无关。
