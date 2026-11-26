/**
 * 元书输入法 · Unicode 查询
 *
 * 输入来源（按优先级）：脚本输入框 $searchText → 键盘选中文本 $selectedText → 剪贴板 $pasteboardContent
 *
 * 正向输入：中文
 * 输出：U+4E2D U+6587
 *
 * 反向输入：U+4E2D U+6587
 * 输出：中文
 */

async function output() {
  function hex(cp) {
    var text = cp.toString(16).toUpperCase();
    var width = cp > 0xffff ? 5 : 4;
    while (text.length < width) {
      text = "0" + text;
    }
    return text;
  }

  function decodeCodePoints(text) {
    var tokens = text.split(/[\s,]+/);
    if (!tokens.length) {
      return null;
    }
    var out = "";
    for (var i = 0; i < tokens.length; i++) {
      var m = tokens[i].match(/^[uU]\+([0-9a-fA-F]{4,6})$/);
      if (!m) {
        return null;
      }
      var cp = parseInt(m[1], 16);
      if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
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
    return ["请输入要查询的文字或 U+XXXX 码位，或选中文本后再运行"];
  }

  var reversed = decodeCodePoints(input);
  if (reversed !== null) {
    $log("反查码位：" + input + " -> " + reversed);
    return [reversed];
  }

  // Array.from 按码位切分，补充平面字符的代理对不会被拆散
  var codePoints = Array.from(input).map(function (ch) {
    return "U+" + hex(ch.codePointAt(0));
  });

  $log("查询 " + codePoints.length + " 个码位：" + input);

  return [codePoints.join(" ")];
}
