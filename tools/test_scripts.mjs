#!/usr/bin/env node
/**
 * 元书输入法脚本离线测试套件
 * - 模拟元书共享 JS 上下文，检验不会产生顶层全局污染
 * - 覆盖全部 8 个脚本的正常路径、输入优先级与异常分支
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCRIPT_FILES = [
  "scripts/roll.js",
  "scripts/base64-decode.js",
  "scripts/base64-encode.js",
  "scripts/unicode.js",
  "scripts/quick-translate.js",
  "scripts/google-translate.js",
  "scripts/deepseek.js",
  "scripts/webhook-send.js",
];

// 创建一个持久化共享上下文，模拟元书切换脚本时不重置全局作用域
const sharedContext = vm.createContext({
  $log: () => {},
});

const BASELINE_KEYS = new Set(Object.getOwnPropertyNames(sharedContext));

async function runScript(relPath, env = {}) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  const injectedKeys = [
    "$searchText",
    "$selectedText",
    "$pasteboardContent",
    "$http",
    "$translater",
    "$translate_proxy_url",
    "$google_translate_endpoint",
    "$deepseek_api_key",
    "$deepseek_base_url",
    "$deepseek_model",
    "$deepseek_system_prompt",
    "$deepseek_thinking",
    "$webhook_url",
    "$webhook_token",
  ];
  for (const k of injectedKeys) {
    delete sharedContext[k];
  }
  const logs = [];
  sharedContext.$log = (msg) => logs.push(String(msg));
  Object.assign(sharedContext, env);

  vm.runInContext(code, sharedContext, { filename: relPath });

  // 检查是否泄漏了除 output 和注入变量之外的全局符号
  const allowed = new Set([...BASELINE_KEYS, ...injectedKeys, "output"]);
  const leaked = Object.getOwnPropertyNames(sharedContext).filter(
    (k) => !allowed.has(k)
  );
  assert.deepEqual(
    leaked,
    [],
    `${relPath} 向共享全局作用域泄漏了变量/函数: ${leaked.join(", ")}`
  );

  const rawResult = await sharedContext.output();
  assert.ok(
    rawResult && typeof rawResult.length === "number",
    `${relPath} 返回值必须是字符串数组`
  );
  const result = Array.from(rawResult);
  return { result, logs };
}

async function main() {
  // 1. Roll
  {
    const { result } = await runScript("scripts/roll.js");
    assert.equal(result.length, 1);
    const n = Number(result[0]);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 100);

    const dice = await runScript("scripts/roll.js", { $searchText: "3d6" });
    assert.equal(dice.result.length, 2);
    const sum = Number(dice.result[0]);
    assert.ok(sum >= 3 && sum <= 18);
  }

  // 2. Base64 编码 + 解码（含首尾空白、中文、emoji、URL-safe、非法输入）
  {
    const enc = await runScript("scripts/base64-encode.js", {
      $searchText: "中文 abc 🚀",
    });
    assert.deepEqual(enc.result, ["5Lit5paHIGFiYyDwn5qA"]);

    const keepSpace = await runScript("scripts/base64-encode.js", {
      $selectedText: " a ",
    });
    assert.deepEqual(keepSpace.result, ["IGEg"]);

    const dec = await runScript("scripts/base64-decode.js", {
      $pasteboardContent: "5Lit5paHIGFiYyDwn5qA",
    });
    assert.deepEqual(dec.result, ["中文 abc 🚀"]);

    // URL-safe 无填充
    const decUrlSafe = await runScript("scripts/base64-decode.js", {
      $searchText: "5Lit5paH",
    });
    assert.deepEqual(decUrlSafe.result, ["中文"]);

    const badB64 = await runScript("scripts/base64-decode.js", {
      $searchText: "!!!not-base64!!!",
    });
    assert.match(badB64.result[0], /不是有效的 Base64/);

    const badUtf8 = await runScript("scripts/base64-decode.js", {
      $searchText: "//8=",
    });
    assert.match(badUtf8.result[0], /不是有效的 UTF-8/);
  }

  // 3. Unicode 正向与反向（含 emoji 补充平面）
  {
    const fwd = await runScript("scripts/unicode.js", {
      $searchText: "中文😀",
    });
    assert.deepEqual(fwd.result, ["U+4E2D U+6587 U+1F600"]);

    const rev = await runScript("scripts/unicode.js", {
      $selectedText: "U+4E2D U+6587 U+1F600",
    });
    assert.deepEqual(rev.result, ["中文😀"]);
  }

  // 4. 快捷翻译（离线 $translater）
  {
    const calls = [];
    const mockTranslater = async (text, src, dst) => {
      calls.push({ text, src, dst });
      return `[${src}->${dst}] ${text}`;
    };

    const zh2en = await runScript("scripts/quick-translate.js", {
      $searchText: "你好",
      $translater: mockTranslater,
    });
    assert.deepEqual(zh2en.result, ["[zh-Hans->en] 你好"]);

    const en2zh = await runScript("scripts/quick-translate.js", {
      $selectedText: "hello",
      $translater: mockTranslater,
    });
    assert.deepEqual(en2zh.result, ["[en->zh-Hans] hello"]);

    const custom = await runScript("scripts/quick-translate.js", {
      $searchText: "ja:早上好",
      $translater: mockTranslater,
    });
    assert.deepEqual(custom.result, ["[zh-Hans->ja] 早上好"]);

    const unsupported = await runScript("scripts/quick-translate.js", {
      $searchText: "hello",
    });
    assert.match(unsupported.result[0], /不支持 \$translater/);
  }

  // 5. 谷歌中英互译（直连 gtx、batchexecute 回退、pixivReader 代理模式）
  {
    const requests = [];
    const mockHttp = async (req) => {
      requests.push(req);
      return {
        data: JSON.stringify([[["Hello ", "你好"], ["world", "世界"]]]),
        response: { statusCode: 200 },
      };
    };
    const res = await runScript("scripts/google-translate.js", {
      $searchText: "你好世界",
      $http: mockHttp,
    });
    assert.deepEqual(res.result, ["Hello world"]);
    assert.match(requests[0].url, /tl=en&/);

    // gtx 429 时自动回退 batchexecute
    const fallbackReqs = [];
    const batchInner = JSON.stringify([
      null,
      [[[null, null, null, null, null, [["你好"]]]]],
    ]);
    const batchRaw =
      ")]}'\n\n123\n" +
      JSON.stringify([["wrb.fr", "MkEWBc", batchInner, null, null, null, "generic"]]);
    const fb = await runScript("scripts/google-translate.js", {
      $searchText: "hello",
      $http: async (req) => {
        fallbackReqs.push(req);
        if (req.url.includes("translate_a/single")) {
          return { data: "", response: { statusCode: 429 } };
        }
        return { data: batchRaw, response: { statusCode: 200 } };
      },
    });
    assert.deepEqual(fb.result, ["你好"]);
    assert.equal(fallbackReqs.length, 2);
    assert.match(fallbackReqs[1].url, /batchexecute/);
    assert.equal(
      fallbackReqs[1].header["Content-Type"],
      "application/x-www-form-urlencoded"
    );

    // pixivReader 代理模式
    let proxyReq = null;
    const proxied = await runScript("scripts/google-translate.js", {
      $searchText: "ja:早上好",
      $translate_proxy_url: "https://reader.example.com/api/translate",
      $http: async (req) => {
        proxyReq = req;
        return {
          data: JSON.stringify({ error: false, content: "おはようございます" }),
          response: { statusCode: 200 },
        };
      },
    });
    assert.deepEqual(proxied.result, ["おはようございます"]);
    assert.equal(proxyReq.method, "POST");
    assert.deepEqual(JSON.parse(JSON.stringify(proxyReq.body)), {
      engine: "google",
      text: "早上好",
      to: "ja",
    });
  }

  // 6. DeepSeek（不自动提交 + 末尾附带选中文本 + /v1 规范化 + thinking + 429 重试）
  {
    // 仅有选中文本或剪贴板、无 $searchText 时绝不发起网络请求
    let autoCalled = false;
    const noAutoSelected = await runScript("scripts/deepseek.js", {
      $selectedText: "这是一段被选中的正文内容",
      $deepseek_api_key: "sk-test-123",
      $http: async () => {
        autoCalled = true;
        return { data: "{}", response: { statusCode: 200 } };
      },
    });
    assert.equal(autoCalled, false);
    assert.match(noAutoSelected.result[0], /请输入提示词后发送/);
    assert.match(noAutoSelected.result[0], /这是一段被选中的正文内容/);

    const noAutoPasteboard = await runScript("scripts/deepseek.js", {
      $pasteboardContent: "剪贴板里的敏感内容",
      $deepseek_api_key: "sk-test-123",
      $http: async () => {
        autoCalled = true;
        return { data: "{}", response: { statusCode: 200 } };
      },
    });
    assert.equal(autoCalled, false);
    assert.match(noAutoPasteboard.result[0], /请输入提示词后再运行/);

    const missing = await runScript("scripts/deepseek.js", {
      $searchText: "hi",
    });
    assert.match(missing.result[0], /未配置变量 deepseek_api_key/);

    let attempts = 0;
    let captured = null;
    const ok = await runScript("scripts/deepseek.js", {
      $searchText: "润色得更正式",
      $selectedText: "明天不行，改天吧",
      $deepseek_api_key: "sk-test-123",
      $deepseek_base_url: "https://api.deepseek.com/v1",
      $deepseek_model: "deepseek-v4-flash",
      $http: async (req) => {
        attempts += 1;
        captured = req;
        if (attempts === 1) {
          return { data: "rate limit", response: { statusCode: 429 } };
        }
        return {
          data: JSON.stringify({
            choices: [
              { message: { content: [{ type: "text", text: "这是精简结果。" }] } },
            ],
          }),
          response: { statusCode: 200 },
        };
      },
    });
    assert.deepEqual(ok.result, ["这是精简结果。"]);
    assert.equal(attempts, 2);
    assert.equal(captured.url, "https://api.deepseek.com/chat/completions");
    assert.deepEqual(JSON.parse(JSON.stringify(captured.body.thinking)), {
      type: "disabled",
    });
    assert.equal(
      captured.body.messages[1].content,
      "润色得更正式\n\n明天不行，改天吧"
    );
    assert.equal(captured.header.Authorization, "Bearer sk-test-123");
    assert.equal(captured.body.model, "deepseek-v4-flash");
    // 确认日志中未打印 API Key
    assert.ok(ok.logs.every((l) => !l.includes("sk-test-123")));

    // 仅输入 $searchText、无选中文本时只发送提示词本身
    let onlyPromptCaptured = null;
    await runScript("scripts/deepseek.js", {
      $searchText: "写一句晚安",
      $deepseek_api_key: "sk-test-123",
      $http: async (req) => {
        onlyPromptCaptured = req;
        return {
          data: JSON.stringify({
            choices: [{ message: { content: "晚安。" } }],
          }),
          response: { statusCode: 200 },
        };
      },
    });
    assert.equal(onlyPromptCaptured.body.messages[1].content, "写一句晚安");
  }

  // 7. Webhook 发送（单次手动外发）
  {
    const missingUrl = await runScript("scripts/webhook-send.js", {
      $searchText: "note",
    });
    assert.match(missingUrl.result[0], /未配置变量 webhook_url/);

    const badUrl = await runScript("scripts/webhook-send.js", {
      $searchText: "note",
      $webhook_url: "ftp://example.com/hook",
    });
    assert.match(badUrl.result[0], /必须以 http:\/\/ 或 https:\/\//);

    let captured = null;
    const sent = await runScript("scripts/webhook-send.js", {
      $selectedText: "待发送文本",
      $webhook_url: "https://hook.example.com/inbox",
      $webhook_token: "tok-secret-xyz",
      $http: async (req) => {
        captured = req;
        return { data: '{"ok":true}', response: { statusCode: 200 } };
      },
    });
    assert.deepEqual(sent.result, ["已发送 [selectedText] (HTTP 200)"]);
    assert.equal(captured.method, "POST");
    assert.equal(captured.header.Authorization, "Bearer tok-secret-xyz");
    assert.equal(captured.body.text, "待发送文本");
    assert.equal(captured.body.source, "selectedText");
    assert.ok(sent.logs.every((l) => !l.includes("tok-secret-xyz")));
  }

  console.log(`全部 ${SCRIPT_FILES.length} 个脚本测试通过（含共享作用域污染检查）。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
