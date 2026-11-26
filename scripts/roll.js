/**
 * 元书输入法 · Roll
 *
 * 无需输入，每次运行返回一个 1 - 100 的随机整数。
 * 也可在脚本输入框输入上限（如 20）或骰子表达式（如 2d6）。
 *
 * 输出示例：42
 */

async function output() {
  function pickInput() {
    var sources = [
      typeof $searchText === "string" ? $searchText : "",
      typeof $selectedText === "string" ? $selectedText : "",
    ];
    for (var i = 0; i < sources.length; i++) {
      if (sources[i] && sources[i].trim().length > 0) {
        return sources[i].trim();
      }
    }
    return "";
  }

  var raw = pickInput();

  // 支持 NdM 表达式，如 2d6（最多 20 颗、最大 10000 面）
  var diceMatch = raw.match(/^(\d{1,2})[dD](\d{1,5})$/);
  if (diceMatch) {
    var count = parseInt(diceMatch[1], 10);
    var sides = parseInt(diceMatch[2], 10);
    if (count >= 1 && count <= 20 && sides >= 2 && sides <= 10000) {
      var rolls = [];
      var sum = 0;
      for (var i = 0; i < count; i++) {
        var n = Math.floor(Math.random() * sides) + 1;
        rolls.push(n);
        sum += n;
      }
      var detail = count > 1 ? sum + " (" + rolls.join("+") + ")" : String(sum);
      $log("roll " + raw + ": " + detail);
      return count > 1 ? [String(sum), detail] : [String(sum)];
    }
  }

  // 支持纯正整数上限，默认 100
  var max = 100;
  if (/^\d{1,6}$/.test(raw)) {
    var parsed = parseInt(raw, 10);
    if (parsed >= 2 && parsed <= 1000000) {
      max = parsed;
    }
  }

  var value = Math.floor(Math.random() * max) + 1;
  $log("roll(1-" + max + "): " + value);
  return [String(value)];
}
