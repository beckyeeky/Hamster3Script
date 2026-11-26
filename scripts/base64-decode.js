/**
 * 元书输入法 · Base64 解码
 *
 * 输入来源（按优先级）：脚本输入框 $searchText → 键盘选中文本 $selectedText → 剪贴板 $pasteboardContent
 *
 * 输入：5Lit5paHIGFiYw==
 * 输出：中文 abc
 */

async function output() {
  var BASE64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // JavaScriptCore 没有 atob / TextDecoder，按字符查表手写解码
  function base64Bytes(text) {
    // 兼容 URL Safe 变体，忽略换行、空格与结尾填充
    var normalized = text
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/[\s=]/g, "");
    if (!normalized.length || normalized.length % 4 === 1) {
      return null;
    }

    var bytes = [];
    var buffer = 0;
    var bits = 0;
    for (var i = 0; i < normalized.length; i++) {
      var value = BASE64_CHARS.indexOf(normalized[i]);
      if (value < 0) {
        return null;
      }
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    return bytes;
  }

  // 按 UTF-8 规则还原码位，String.fromCodePoint 负责补回代理对
  function utf8Text(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var b0 = bytes[i++];
      var cp;
      var extra;
      var minCp;

      if (b0 < 0x80) {
        cp = b0;
        extra = 0;
        minCp = 0;
      } else if ((b0 & 0xe0) === 0xc0) {
        cp = b0 & 0x1f;
        extra = 1;
        minCp = 0x80;
      } else if ((b0 & 0xf0) === 0xe0) {
        cp = b0 & 0x0f;
        extra = 2;
        minCp = 0x800;
      } else if ((b0 & 0xf8) === 0xf0) {
        cp = b0 & 0x07;
        extra = 3;
        minCp = 0x10000;
      } else {
        return null;
      }

      if (i + extra > bytes.length) {
        return null;
      }
      for (var j = 0; j < extra; j++) {
        var bx = bytes[i++];
        if ((bx & 0xc0) !== 0x80) {
          return null;
        }
        cp = (cp << 6) | (bx & 0x3f);
      }

      if (cp < minCp || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
        return null;
      }
      out += String.fromCodePoint(cp);
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
      if (sources[i] && sources[i].trim().length > 0) {
        return sources[i].trim();
      }
    }
    return "";
  }

  var input = pickInput();
  if (!input) {
    return ["请输入要解码的 Base64 文本，或选中文本后再运行"];
  }

  var bytes = base64Bytes(input);
  if (bytes === null) {
    return ["输入不是有效的 Base64 编码"];
  }

  var decoded = utf8Text(bytes);
  if (decoded === null) {
    return ["解码结果不是有效的 UTF-8 文本"];
  }

  $log("解码 " + bytes.length + " 字节");
  return [decoded];
}
