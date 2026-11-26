/**
 * 元书输入法 · 谷歌中英互译（免费在线翻译）
 *
 * 参考 pixivReader 免费翻译链路，支持两种模式：
 * 1. 代理模式（配置变量 translate_proxy_url 时启用）：
 *    POST { engine: "google", text, to }，兼容 pixivReader 的 /api/translate 接口。
 * 2. 直连模式（默认）：
 *    优先调用 Google Translate client=gtx 免费接口，失败时自动回退到 batchexecute (MkEWBc) RPC 接口。
 *
 * 权限要求：需开启键盘「完全访问」权限。
 * 输入来源（按优先级）：脚本输入框 $searchText → 键盘选中文本 $selectedText → 剪贴板 $pasteboardContent
 *
 * 可选元书变量：
 * - translate_proxy_url：自建代理地址（例如 https://your-domain/api/translate）
 * - google_translate_endpoint：覆盖直连主端点（默认 https://translate.googleapis.com/translate_a/single）
 *
 * 默认规则：
 * - 含中文字符 → 译为英文（en）
 * - 其他语言 → 译为简体中文（zh-CN）
 *
 * 指定目标语言（可选前缀）：
 * - 输入 `ja:你好` → 翻译为日语
 * - 输入 `zh-TW:测试` → 翻译为繁体中文
 */

async function output() {
  function readVar(value) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return "";
  }

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

  function normalizeTargetLang(code) {
    var map = {
      zh: "zh-CN",
      "zh-cn": "zh-CN",
      "zh-hans": "zh-CN",
      "zh-tw": "zh-TW",
      "zh-hant": "zh-TW",
      en: "en",
      ja: "ja",
      jp: "ja",
      ko: "ko",
      kr: "ko",
      fr: "fr",
      de: "de",
      es: "es",
      ru: "ru",
    };
    return map[code.toLowerCase()] || null;
  }

  function parseInput(raw) {
    var m = raw.match(/^([a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?)\s*[:：]\s*([\s\S]+)$/);
    if (m) {
      var explicitTarget = normalizeTargetLang(m[1]);
      if (explicitTarget) {
        return { text: m[2].trim(), target: explicitTarget };
      }
    }
    var hasChinese = /[\u4e00-\u9fff]/.test(raw);
    return { text: raw, target: hasChinese ? "en" : "zh-CN" };
  }

  async function translateViaProxy(proxyUrl, text, target) {
    var res = await $http({
      url: proxyUrl,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: {
        engine: "google",
        text: text,
        to: target,
      },
      timeout: 15,
    });
    var status = res && res.response ? res.response.statusCode : 0;
    var data = null;
    try {
      data = JSON.parse(res.data || "null");
    } catch (_e) {
      data = null;
    }
    if (status < 200 || status >= 300 || (data && data.error)) {
      var msg =
        data && data.message ? data.message : "HTTP " + status;
      throw new Error("代理翻译失败：" + msg);
    }
    var content =
      data && typeof data.content === "string" ? data.content.trim() : "";
    if (!content) {
      throw new Error("代理返回译文为空");
    }
    return content;
  }

  async function translateViaGtx(endpoint, text, target) {
    var url =
      endpoint +
      "?client=gtx&sl=auto&tl=" +
      encodeURIComponent(target) +
      "&dt=t&q=" +
      encodeURIComponent(text);
    var res = await $http({
      url: url,
      method: "GET",
      header: {
        Accept: "application/json",
      },
      timeout: 12,
    });
    var status = res && res.response ? res.response.statusCode : 0;
    if (status < 200 || status >= 300) {
      throw new Error("gtx HTTP " + status);
    }
    var json = JSON.parse(res.data || "null");
    if (!Array.isArray(json) || !Array.isArray(json[0])) {
      throw new Error("gtx 返回格式异常");
    }
    var parts = [];
    for (var i = 0; i < json[0].length; i++) {
      var seg = json[0][i];
      if (Array.isArray(seg) && typeof seg[0] === "string") {
        parts.push(seg[0]);
      }
    }
    var translated = parts.join("").trim();
    if (!translated) {
      throw new Error("gtx 译文为空");
    }
    return translated;
  }

  function parseBatchExecuteResponse(rawText) {
    if (!rawText) {
      return "";
    }
    var cleaned = rawText.replace(/^\)\]\}'\s*/, "");
    var lines = cleaned.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line[0] !== "[") {
        continue;
      }
      var outer = null;
      try {
        outer = JSON.parse(line);
      } catch (_e) {
        continue;
      }
      if (!Array.isArray(outer)) {
        continue;
      }
      for (var j = 0; j < outer.length; j++) {
        var entry = outer[j];
        if (
          Array.isArray(entry) &&
          entry[0] === "wrb.fr" &&
          entry[1] === "MkEWBc" &&
          typeof entry[2] === "string"
        ) {
          var inner = JSON.parse(entry[2]);
          var blocks =
            inner &&
            Array.isArray(inner[1]) &&
            Array.isArray(inner[1][0]) &&
            Array.isArray(inner[1][0][0]) &&
            Array.isArray(inner[1][0][0][5])
              ? inner[1][0][0][5]
              : [];
          var segments = [];
          for (var k = 0; k < blocks.length; k++) {
            if (Array.isArray(blocks[k]) && typeof blocks[k][0] === "string") {
              segments.push(blocks[k][0]);
            }
          }
          if (segments.length > 0) {
            return segments.join("").trim();
          }
        }
      }
    }
    return "";
  }

  async function translateViaBatchExecute(text, target) {
    var payload = JSON.stringify([
      [
        [
          "MkEWBc",
          JSON.stringify([[text, "auto", target, true], [null]]),
          null,
          "generic",
        ],
      ],
    ]);
    var res = await $http({
      url: "https://translate.google.com/_/TranslateWebserverUi/data/batchexecute?rpcids=MkEWBc",
      method: "POST",
      header: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: {
        "f.req": payload,
      },
      timeout: 12,
    });
    var status = res && res.response ? res.response.statusCode : 0;
    if (status < 200 || status >= 300) {
      throw new Error("batchexecute HTTP " + status);
    }
    var translated = parseBatchExecuteResponse(res.data || "");
    if (!translated) {
      throw new Error("batchexecute 返回解析为空");
    }
    return translated;
  }

  var raw = pickInput();
  if (!raw) {
    return ["请输入要翻译的文字，或选中文本后再运行"];
  }

  var parsed = parseInput(raw);
  if (!parsed.text) {
    return ["请输入要翻译的内容"];
  }

  var proxyUrl = readVar(
    typeof $translate_proxy_url !== "undefined" ? $translate_proxy_url : ""
  );

  try {
    if (proxyUrl) {
      $log("谷歌翻译(代理) -> " + parsed.target);
      return [await translateViaProxy(proxyUrl, parsed.text, parsed.target)];
    }

    var customEndpoint = readVar(
      typeof $google_translate_endpoint !== "undefined"
        ? $google_translate_endpoint
        : ""
    );
    var gtxEndpoint = customEndpoint
      ? customEndpoint.replace(/\?.*$/, "")
      : "https://translate.googleapis.com/translate_a/single";

    try {
      $log("谷歌翻译(gtx) -> " + parsed.target);
      return [await translateViaGtx(gtxEndpoint, parsed.text, parsed.target)];
    } catch (firstErr) {
      if (customEndpoint) {
        throw firstErr;
      }
      $log("gtx 失败，回退 batchexecute");
      return [await translateViaBatchExecute(parsed.text, parsed.target)];
    }
  } catch (error) {
    var msg = error && error.message ? error.message : String(error);
    $log("谷歌翻译失败: " + msg);
    return ["谷歌翻译失败：" + msg];
  }
}
