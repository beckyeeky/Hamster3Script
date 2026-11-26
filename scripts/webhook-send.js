/**
 * 元书输入法 · Webhook 发送（单次手动外发）
 *
 * 仅在手动触发时将当前文本以 JSON POST 到自建 Webhook 端点，并在候选栏显示回执。
 * 需开启键盘「完全访问」权限。默认关闭剪贴板访问，如需发送剪贴板请在该脚本设置中自行开启。
 *
 * 输入来源（按优先级）：脚本输入框 $searchText → 键盘选中文本 $selectedText → 剪贴板 $pasteboardContent
 *
 * 元书「脚本 → ... → 变量」配置：
 * - webhook_url（必填）：接收端 URL（需以 http:// 或 https:// 开头）
 * - webhook_token（可选）：Bearer Token，配置后自动附加 Authorization 请求头
 *
 * 请求体示例：
 * {"text": "内容", "source": "selectedText", "timestamp": "2026-11-26T07:00:00.000Z"}
 */

async function output() {
  function readVar(value) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return "";
  }

  function pickInputWithSource() {
    var candidates = [
      {
        source: "searchText",
        value: typeof $searchText === "string" ? $searchText : "",
      },
      {
        source: "selectedText",
        value: typeof $selectedText === "string" ? $selectedText : "",
      },
      {
        source: "pasteboardContent",
        value:
          typeof $pasteboardContent === "string" ? $pasteboardContent : "",
      },
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].value && candidates[i].value.trim().length > 0) {
        return {
          source: candidates[i].source,
          text: candidates[i].value,
        };
      }
    }
    return null;
  }

  var url = readVar(
    typeof $webhook_url !== "undefined" ? $webhook_url : ""
  );
  if (!url) {
    return ["未配置变量 webhook_url（请在元书「脚本 → ... → 变量」中添加）"];
  }
  if (!/^https?:\/\//i.test(url)) {
    return ["webhook_url 必须以 http:// 或 https:// 开头"];
  }

  var picked = pickInputWithSource();
  if (!picked) {
    return ["无待发送内容（请输入、选中文本，或在脚本设置中允许读取剪贴板）"];
  }

  var token = readVar(
    typeof $webhook_token !== "undefined" ? $webhook_token : ""
  );
  var header = {
    "Content-Type": "application/json",
  };
  if (token) {
    header.Authorization = "Bearer " + token;
  }

  try {
    $log("Webhook 发送来源: " + picked.source + ", 长度: " + picked.text.length);
    var res = await $http({
      url: url,
      method: "POST",
      header: header,
      body: {
        text: picked.text,
        source: picked.source,
        timestamp: new Date().toISOString(),
      },
      timeout: 15,
    });

    var status = res && res.response ? res.response.statusCode : 0;
    if (status >= 200 && status < 300) {
      return ["已发送 [" + picked.source + "] (HTTP " + status + ")"];
    }
    return ["发送失败 (HTTP " + status + ")"];
  } catch (error) {
    var msg = error && error.message ? error.message : String(error);
    $log("Webhook 异常: " + msg);
    return ["发送异常：" + msg];
  }
}
