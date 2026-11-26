/**
 * 元书输入法 · 快捷翻译（系统离线翻译）
 *
 * 使用 iOS 26+ 内置 $translater，在设备本地完成翻译，无需网络。
 * 使用前需在 iPhone「设置 → Apps → 翻译 → 语言」下载对应语言包。
 *
 * 输入来源（按优先级）：脚本输入框 $searchText → 键盘选中文本 $selectedText → 剪贴板 $pasteboardContent
 *
 * 默认规则：
 * - 中文 → 英文（zh-Hans → en）
 * - 日文 / 韩文 / 英文及其他拉丁文本 → 简体中文（→ zh-Hans）
 *
 * 指定目标语言（可选前缀）：
 * - 输入 `ja:你好` → 翻译为日语
 * - 输入 `en:こんにちは` → 翻译为英语
 * - 支持前缀：zh / zh-Hans / zh-Hant / en / ja / ko / fr / de / es
 */

async function output() {
  function pickInput() {
    var sources = [
      typeof $searchText === "string" ? $searchText : "",
      typeof $selectedText === "string" ? $selectedText : "",
      typeof $pasteboardContent === "string" ? $pasteboardContent : "",
    ];
    for (var i = 0; i < sources.length; i++) {
      if (sources[i] && sources[i].trim().length > 0) {
        return sources[i].trim();
      }
    }
    return "";
  }

  function detectSourceLang(text) {
    if (/[\u3040-\u30ff]/.test(text)) {
      return "ja";
    }
    if (/[\uac00-\ud7af]/.test(text)) {
      return "ko";
    }
    if (/[\u4e00-\u9fff]/.test(text)) {
      return "zh-Hans";
    }
    return "en";
  }

  function normalizeTargetLang(code) {
    var map = {
      zh: "zh-Hans",
      "zh-cn": "zh-Hans",
      "zh-hans": "zh-Hans",
      "zh-tw": "zh-Hant",
      "zh-hant": "zh-Hant",
      en: "en",
      ja: "ja",
      jp: "ja",
      ko: "ko",
      kr: "ko",
      fr: "fr",
      de: "de",
      es: "es",
    };
    return map[code.toLowerCase()] || null;
  }

  function parseInput(raw) {
    var m = raw.match(/^([a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?)\s*[:：]\s*([\s\S]+)$/);
    if (m) {
      var explicitTarget = normalizeTargetLang(m[1]);
      if (explicitTarget) {
        var content = m[2].trim();
        var src = detectSourceLang(content);
        if (src === explicitTarget) {
          src = explicitTarget === "en" ? "zh-Hans" : "en";
        }
        return { text: content, source: src, target: explicitTarget };
      }
    }
    var autoSrc = detectSourceLang(raw);
    var autoTarget = autoSrc === "zh-Hans" ? "en" : "zh-Hans";
    return { text: raw, source: autoSrc, target: autoTarget };
  }

  if (typeof $translater !== "function") {
    return ["当前版本不支持 $translater（需 iOS 26+ 及元书 1.12.1+）"];
  }

  var raw = pickInput();
  if (!raw) {
    return ["请输入要翻译的文字，或选中文本后再运行"];
  }

  var parsed = parseInput(raw);
  if (!parsed.text) {
    return ["请输入要翻译的内容"];
  }

  try {
    $log("快捷翻译 " + parsed.source + " -> " + parsed.target);
    var result = await $translater(parsed.text, parsed.source, parsed.target);
    if (!result || !String(result).trim()) {
      return ["翻译结果为空"];
    }
    return [String(result).trim()];
  } catch (error) {
    var msg = error && error.message ? error.message : String(error);
    $log("快捷翻译失败: " + msg);
    return ["翻译失败：" + msg];
  }
}
