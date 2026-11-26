/**
 * 元书输入法 · Base64 编码
 *
 * 输入来源（按优先级）：脚本输入框 $searchText → 键盘选中文本 $selectedText → 剪贴板 $pasteboardContent
 *
 * 输入：中文 abc
 * 输出：5Lit5paHIGFiYw==
 */

async function output() {
  var BASE64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // JavaScriptCore 没有 btoa / TextEncoder，按码位手写 UTF-8 编码
  function utf8Bytes(text) {
    var bytes = [];
    // Array.from 按码位切分，emoji 等补充平面字符的代理对不会被拆散
    var points = Array.from(text);
    for (var i = 0; i < points.length; i++) {
      var cp = points[i].codePointAt(0);
      if (cp < 0x80) {
        bytes.push(cp);
      } else if (cp < 0x800) {
        bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      } else if (cp < 0x10000) {
        bytes.push(
          0xe0 | (cp >> 12),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      } else {
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      }
    }
    return bytes;
  }

  function base64(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i];
      var b1 = bytes[i + 1];
      var b2 = bytes[i + 2];
      var hasB1 = b1 !== undefined;
      var hasB2 = b2 !== undefined;

      out += BASE64_CHARS[b0 >> 2];
      out += BASE64_CHARS[((b0 & 0x03) << 4) | (hasB1 ? b1 >> 4 : 0)];
      out += hasB1
        ? BASE64_CHARS[((b1 & 0x0f) << 2) | (hasB2 ? b2 >> 6 : 0)]
        : "=";
      out += hasB2 ? BASE64_CHARS[b2 & 0x3f] : "=";
    }
    return out;
  }

  function pickInput() {
    var sources = [
      typeof $searchText === "string" ? $searchText : "",
      typeof $selectedText === "string" ? $selectedText : "",
      typeof $pasteboardContent === "string" ? $pasteboardContent : "",
    ];
    for (var i = 0; i < sources.length; i++) {
      // 只用 trim 判断是否为空，编码时保留原文首尾空白
      if (sources[i] && sources[i].trim().length > 0) {
        return sources[i];
      }
    }
    return "";
  }

  var input = pickInput();
  if (!input) {
    return ["请输入要编码的文字，或选中文本后再运行"];
  }

  var bytes = utf8Bytes(input);
  $log("编码 " + bytes.length + " 字节：" + input);

  return [base64(bytes)];
}
