/**
 * 元书输入法 · DeepSeek（支持任意 OpenAI Chat Completions 兼容接口）
 *
 * 使用内置 $http 发起单次对话请求，需开启键盘「完全访问」权限。
 *
 * 触发规则（不自动提交）：
 * - 仅在脚本输入框 $searchText 非空时发起请求；打开脚本时即使存在选中文本或剪贴板内容也不会自动发送。
 * - 当宿主应用存在选中文本 $selectedText 时，自动附加在 $searchText 末尾一起发送。
 *
 * 元书「脚本 → ... → 变量」配置：
 * - deepseek_api_key（必填）：API Key
 * - deepseek_base_url（可选）：接口地址，默认 https://api.deepseek.com/chat/completions
 * - deepseek_model（可选）：模型名称，默认 deepseek-chat
 * - deepseek_system_prompt（可选）：系统提示词，默认直接返回适合上屏的精简文本
 * - deepseek_thinking（可选）：仅对 api.deepseek.com 生效，默认 disabled；填 enabled 可启用思考模式
 */

async function output() {
  function readVar(value, fallback) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return fallback;
  }

  function previewText(text, maxLen) {
    var singleLine = text.replace(/\s+/g, " ").trim();
    var chars = Array.from(singleLine);
    if (chars.length <= maxLen) {
      return singleLine;
    }
    return chars.slice(0, maxLen).join("") + "…";
  }

  function resolveEndpoint(rawUrl) {
    var cleaned = rawUrl.replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(cleaned)) {
      return cleaned;
    }
    // DeepSeek 端点去除冗余的 /v1
    if (/^https?:\/\/api\.deepseek\.com\/v1$/i.test(cleaned)) {
      return cleaned.replace(/\/v1$/i, "") + "/chat/completions";
    }
    return cleaned + "/chat/completions";
  }

  function isDeepSeekHost(url) {
    return /^https?:\/\/api\.deepseek\.com(\/|$)/i.test(url);
  }

  function normalizeContent(content) {
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      var parts = [];
      for (var i = 0; i < content.length; i++) {
        var part = content[i];
        if (typeof part === "string") {
          parts.push(part);
        } else if (part && typeof part === "object") {
          if (typeof part.text === "string") {
            parts.push(part.text);
          } else if (part.text && typeof part.text.value === "string") {
            parts.push(part.text.value);
          }
        }
      }
      return parts.join("").trim();
    }
    return "";
  }

  function extractReply(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return "";
    }
    if (Array.isArray(parsed.choices) && parsed.choices[0]) {
      var first = parsed.choices[0];
      if (first.message && first.message.content !== undefined) {
        var msgText = normalizeContent(first.message.content);
        if (msgText) {
          return msgText;
        }
      }
      if (first.delta && first.delta.content !== undefined) {
        var deltaText = normalizeContent(first.delta.content);
        if (deltaText) {
          return deltaText;
        }
      }
    }
    if (parsed.output_text !== undefined) {
      return normalizeContent(parsed.output_text);
    }
    if (parsed.content !== undefined) {
      return normalizeContent(parsed.content);
    }
    return "";
  }

  var prompt =
    typeof $searchText === "string" ? $searchText.trim() : "";
  var selected =
    typeof $selectedText === "string" ? $selectedText.trim() : "";

  // 不自动提交：未在脚本输入框输入提示词时不发起任何网络请求
  if (!prompt) {
    if (selected) {
      return [
        "请输入提示词后发送（已附带选中文本：" +
          previewText(selected, 24) +
          "）",
      ];
    }
    return ["请输入提示词后再运行 DeepSeek"];
  }

  var apiKey = readVar(
    typeof $deepseek_api_key !== "undefined" ? $deepseek_api_key : "",
    ""
  );
  if (!apiKey) {
    return ["未配置变量 deepseek_api_key（请在元书「脚本 → ... → 变量」中添加）"];
  }

  var userMessage = selected ? prompt + "\n\n" + selected : prompt;

  var endpoint = resolveEndpoint(
    readVar(
      typeof $deepseek_base_url !== "undefined" ? $deepseek_base_url : "",
      "https://api.deepseek.com/chat/completions"
    )
  );
  var model = readVar(
    typeof $deepseek_model !== "undefined" ? $deepseek_model : "",
    "deepseek-chat"
  );
  var systemPrompt = readVar(
    typeof $deepseek_system_prompt !== "undefined"
      ? $deepseek_system_prompt
      : "",
    "你是输入法内联助手。直接给出最终可发送的纯文本结果，不要使用 Markdown 标题、代码块包裹或多余寒暄。"
  );
  var thinkingMode = readVar(
    typeof $deepseek_thinking !== "undefined" ? $deepseek_thinking : "",
    "disabled"
  );

  var body = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    stream: false,
  };
  if (isDeepSeekHost(endpoint) && thinkingMode !== "enabled") {
    body.thinking = { type: "disabled" };
  }

  try {
    $log(
      "DeepSeek 请求模型: " +
        model +
        (selected ? "（附带选中文本）" : "")
    );
    var res = null;
    var status = 0;
    for (var attempt = 0; attempt < 2; attempt++) {
      res = await $http({
        url: endpoint,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: body,
        timeout: 30,
      });
      status = res && res.response ? res.response.statusCode : 0;
      if ((status !== 429 && status !== 503) || attempt >= 1) {
        break;
      }
      if (typeof setTimeout === "function") {
        await new Promise(function (resolve) {
          setTimeout(resolve, 300);
        });
      }
    }

    var parsed = null;
    try {
      parsed = JSON.parse((res && res.data) || "null");
    } catch (_e) {
      parsed = null;
    }

    if (status < 200 || status >= 300) {
      var apiErr =
        parsed && parsed.error && parsed.error.message
          ? parsed.error.message
          : "HTTP " + status;
      return ["DeepSeek 请求失败：" + apiErr];
    }

    var content = extractReply(parsed);
    if (!content) {
      return ["DeepSeek 返回内容为空"];
    }

    return [content];
  } catch (error) {
    var msg = error && error.message ? error.message : String(error);
    $log("DeepSeek 异常: " + msg);
    return ["DeepSeek 调用失败：" + msg];
  }
}
