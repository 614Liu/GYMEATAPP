import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
// Render (and most hosts) inject the port via env; fall back to 3000 locally.
const PORT = Number(process.env.PORT) || 3000;

// Check if API key is a valid Gemini key structure
function isValidApiKey(key: string) {
  return typeof key === "string" && key.trim().startsWith("AIzaSy");
}

// Initialize Gemini dynamically per request to ensure real-time API Key updates
function getGeminiClientAndStatus(customApiKey?: string) {
  let apiKey = (process.env.GEMINI_API_KEY || "").trim();
  const trimmedCustom = (customApiKey || "").trim();
  
  let isCustom = false;
  if (trimmedCustom && 
      trimmedCustom !== "null" && 
      trimmedCustom !== "undefined" && 
      trimmedCustom.startsWith("AIzaSy")) {
    apiKey = trimmedCustom;
    isCustom = true;
  }
  
  const isValid = isValidApiKey(apiKey);
  
  return {
    client: new GoogleGenAI({ 
      apiKey: isValid ? apiKey : "INVALID_KEY_PLACEHOLDER"
    }),
    isValid,
    isCustom
  };
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN", description: "图片或描述是否包含食物或营养成分表" },
    reason: { type: "STRING", description: "如果不是食物，请简要说明原因" },
    name: { type: "STRING", description: "食物的标准中文名称" },
    calories: { type: "NUMBER", description: "热量 (kcal)" },
    protein: { type: "NUMBER", description: "蛋白质 (克)" },
    carbs: { type: "NUMBER", description: "碳水化合物 (克)" },
    fat: { type: "NUMBER", description: "脂肪 (克)" },
    amount: { type: "STRING", description: "估算的份量 (例如 '100g', '1个中等大小')" },
  },
  required: ["isFood", "name", "calories", "protein", "carbs", "fat", "amount"],
};

function buildContents(query: string, imageBase64: string | undefined, isLibrary: boolean): any[] {
  const contents: any[] = [];
  
  if (imageBase64) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      contents.push({
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      });
    }
  }

  if (isLibrary) {
    contents.push({
      text: imageBase64 
        ? `请分析这张图片（可能是食物、菜品或营养成分表）。\n用户补充描述："${query || '无'}"。\n\n关键要求：\n1. 判断这是否是食物或营养表。如果图片与食物完全无关，isFood 设为 false，并在 reason 中简要说明。\n2. 如果是食物或营养表，请提取或估算其营养成分。\n3. 【极其重要】你必须返回【每 100g】的营养数值！如果图片是按“每份(per serving)”标示的，请务必通过数学换算为 100g 的数值。\n4. amount 字段请固定返回 "100g"。\n5. name 字段请给出一个简洁、准确的中文名称（如包含品牌请保留）。`
        : `请分析以下食物名称或描述：\n"${query}"\n\n关键要求：\n1. 判断这是否是真实的食物。如果完全不是食物，isFood 设为 false，并在 reason 中简要说明。\n2. 如果是食物，请估算其营养成分。\n3. 【极其重要】你必须返回【每 100g】的营养数值！\n4. amount 字段请固定返回 "100g"。\n5. name 字段请给出一个简洁、准确的中文名称。`
    });
  } else {
    contents.push({
      text: imageBase64 
        ? `请分析这张图片（可能是食物或营养成分表）。用户补充描述："${query || '无'}"。\n请判断图片中是否包含食物或营养表。如果完全没有，isFood 请返回 false，并在 reason 中简要说明。\n如果有，请提取或估算其营养成分。请给出一个合理的估计份量 (如 "100g", "1个中等大小")，并计算出该份量下的总营养数值。`
        : `请分析以下食物名称或描述：\n"${query}"\n\n请判断这是否是真实的食物。如果完全不是食物，isFood 设为 false，并在 reason 中简要说明。\n如果是食物，请估算其营养成分。请给出一个合理的估计份量 (如 "100g", "1个中等大小")，并计算出该份量下的总营养数值。`
    });
  }

  return contents;
}

// ===============================================================
// DeepSeek (OpenAI-compatible) support — for users in mainland China
// where Gemini is not reachable.
// ===============================================================

function isValidDeepSeekKey(key: string) {
  // DeepSeek keys start with "sk-"
  return typeof key === "string" && key.trim().startsWith("sk-");
}

// Build OpenAI-style messages array for DeepSeek
function buildDeepSeekMessages(
  query: string,
  imageBase64: string | undefined,
  isLibrary: boolean,
  systemInstruction: string
): any[] {
  // Reuse the same prompt text builder as Gemini for consistency
  const geminiContents = buildContents(query, imageBase64, isLibrary);
  const promptText = geminiContents.find((c) => c.text)?.text || query;

  const userContent: any[] = [];
  if (imageBase64) {
    // DeepSeek vision expects an OpenAI-style image_url with a data URI
    userContent.push({
      type: "image_url",
      image_url: { url: imageBase64 },
    });
  }
  userContent.push({ type: "text", text: promptText });

  return [
    {
      role: "system",
      content:
        systemInstruction +
        " 你必须只返回一个 JSON 对象，包含字段：isFood(boolean), reason(string, 可选), name(string), calories(number), protein(number), carbs(number), fat(number), amount(string)。不要返回任何额外文字或 Markdown。",
    },
    {
      role: "user",
      // If no image, content can be a plain string; with image we use the array form
      content: imageBase64 ? userContent : promptText,
    },
  ];
}

async function callDeepSeek(
  apiKey: string,
  query: string,
  imageBase64: string | undefined,
  isLibrary: boolean,
  systemInstruction: string
): Promise<string> {
  const messages = buildDeepSeekMessages(query, imageBase64, isLibrary, systemInstruction);
  // deepseek-v4-flash supersedes the deprecated deepseek-chat name (deprecated 2026/07/24)
  const model = imageBase64 ? "deepseek-v4-flash" : "deepseek-v4-flash";

  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    let detail = "";
    try {
      const errBody = await resp.json();
      detail = errBody?.error?.message || JSON.stringify(errBody);
    } catch {
      detail = await resp.text().catch(() => "");
    }
    // Surface status so the client error parser can react (401/429/etc.)
    throw new Error(`DeepSeek API ${resp.status}: ${detail}`);
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

// Support JSON bodies for API requests
app.use(express.json({ limit: '50mb' }));

// Allow the Capacitor native app (origin capacitor://localhost or
// http://localhost) and the web app to call the API cross-origin.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Health check — visit this URL to confirm which version is live.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "v1.2-chat" });
});

// ===============================================================
// AI Coach — daily tips + next-meal recommendations, goal-aware.
// Reuses the same dual-provider (Gemini / DeepSeek) plumbing.
// ===============================================================

const GOAL_LABELS: Record<string, string> = {
  gain: "增肌（提高蛋白质摄入，保证热量盈余）",
  lose: "减脂（控制总热量，保证蛋白质，减少精制碳水）",
  maintain: "维持（营养均衡，热量与消耗持平）",
};

function buildCoachPrompt(kind: string, data: any): string {
  const goalText = GOAL_LABELS[data?.goal] || GOAL_LABELS.maintain;
  const t = data?.totals || {};
  const g = data?.goals || {};
  const stats = `用户目标：${goalText}
今日已摄入：热量 ${Math.round(t.calories || 0)} / ${g.calories || 0} kcal，蛋白质 ${Math.round(t.protein || 0)} / ${g.protein || 0} g，碳水 ${Math.round(t.carbs || 0)} / ${g.carbs || 0} g，脂肪 ${Math.round(t.fat || 0)} / ${g.fat || 0} g。`;

  if (kind === "meal") {
    return `${stats}

请根据用户的目标和今日剩余额度，推荐【下一餐】具体吃什么。要求：
1. 给出 2-3 个具体的食物/搭配建议（中文，接地气，符合中国人饮食）。
2. 每个建议标注大致热量和蛋白质。
3. 优先补足距离目标还差的营养素。
只返回一个 JSON 对象：{"suggestions":[{"name":"食物名","calories":数字,"protein":数字,"reason":"一句话理由"}]}，不要额外文字或 Markdown。`;
  }

  // default: daily tip
  return `${stats}

请用一句话（40字以内）给用户一条今天的营养小建议，要具体、可执行、贴合用户目标。
只返回一个 JSON 对象：{"tip":"你的建议"}，不要额外文字或 Markdown。`;
}

app.post("/api/coach", async (req, res) => {
  try {
    const { kind, data, customApiKey, provider } = req.body;
    const prompt = buildCoachPrompt(kind || "tip", data || {});
    const systemInstruction = "你是一位专业、务实的营养教练，说话简洁不啰嗦。";

    // DeepSeek branch
    if (provider === "deepseek") {
      const dsKey = (customApiKey || process.env.DEEPSEEK_API_KEY || "").trim();
      if (!isValidDeepSeekKey(dsKey)) {
        return res.status(400).json({ error: "DeepSeek API Key 无效，请在设置中填写。" });
      }
      const resp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${dsKey}` },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.6,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`DeepSeek ${resp.status}: ${detail}`);
      }
      const dsData = await resp.json();
      let dsText = (dsData?.choices?.[0]?.message?.content || "").replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
      return res.json(JSON.parse(dsText));
    }

    // Gemini branch
    const { client: aiClient, isValid } = getGeminiClientAndStatus(customApiKey);
    if (!isValid) {
      return res.status(400).json({ error: "Gemini API Key 不可用，请在设置中配置或改用 DeepSeek。" });
    }
    const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let text = "";
    let lastError: any = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: [{ text: prompt }],
          config: { systemInstruction, responseMimeType: "application/json" },
        });
        text = response.text || "";
        if (text) break;
      } catch (err: any) {
        lastError = err;
        if (err.status === 400) throw err;
      }
    }
    if (!text) throw lastError || new Error("AI 未返回结果");
    text = text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Coach API Error:", error);
    res.status(500).json({ error: error.message || "教练建议生成失败" });
  }
});

// ===============================================================
// AI Chat — free-form Q&A, personalized with user data, but strictly
// restricted to nutrition / diet / fitness topics.
// ===============================================================

function buildChatSystemPrompt(data: any): string {
  const goalText = GOAL_LABELS[data?.goal] || GOAL_LABELS.maintain;
  const t = data?.totals || {};
  const g = data?.goals || {};
  const recent = Array.isArray(data?.recentFoods) && data.recentFoods.length
    ? data.recentFoods.slice(0, 15).map((f: any) => `${f.name}(${Math.round(f.calories || 0)}kcal)`).join("、")
    : "暂无记录";

  return `你是「健食」app 里的专属 AI 营养教练。你只回答与【饮食、营养、热量、食物、健身饮食、用户的饮食目标】相关的问题。

【严格规则】
- 如果用户问的问题与饮食/营养/健身无关（例如：编程、政治、写作、闲聊、新闻、情感、翻译、数学题等），你必须礼貌拒绝，回复类似："抱歉，我只能帮你解答饮食和营养相关的问题哦～" 并简短引导回饮食话题。绝对不要回答无关问题。
- 回答要简洁、具体、可执行，说中文。
- 充分利用下面的用户数据，给出个性化建议，而不是泛泛而谈。

【用户数据】
- 目标：${goalText}
- 今日已摄入：热量 ${Math.round(t.calories || 0)}/${g.calories || 0} kcal，蛋白 ${Math.round(t.protein || 0)}/${g.protein || 0}g，碳水 ${Math.round(t.carbs || 0)}/${g.carbs || 0}g，脂肪 ${Math.round(t.fat || 0)}/${g.fat || 0}g
- 最近吃过：${recent}`;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, data, customApiKey, provider } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "消息为空" });
    }
    const systemPrompt = buildChatSystemPrompt(data || {});

    // DeepSeek branch
    if (provider === "deepseek") {
      const dsKey = (customApiKey || process.env.DEEPSEEK_API_KEY || "").trim();
      if (!isValidDeepSeekKey(dsKey)) {
        return res.status(400).json({ error: "DeepSeek API Key 无效，请在设置中填写。" });
      }
      const resp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${dsKey}` },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.7,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`DeepSeek ${resp.status}: ${detail}`);
      }
      const dsData = await resp.json();
      return res.json({ reply: dsData?.choices?.[0]?.message?.content || "" });
    }

    // Gemini branch — convert messages to Gemini format
    const { client: aiClient, isValid } = getGeminiClientAndStatus(customApiKey);
    if (!isValid) {
      return res.status(400).json({ error: "Gemini API Key 不可用，请在设置中配置或改用 DeepSeek。" });
    }
    const geminiContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let text = "";
    let lastError: any = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: geminiContents,
          config: { systemInstruction: systemPrompt },
        });
        text = response.text || "";
        if (text) break;
      } catch (err: any) {
        lastError = err;
        if (err.status === 400) throw err;
      }
    }
    if (!text) throw lastError || new Error("AI 未返回结果");
    res.json({ reply: text });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message || "对话失败" });
  }
});

app.post("/api/estimate", async (req, res) => {
  try {
    const { query, imageBase64, isLibrary, customApiKey, provider } = req.body;

    let systemInstruction = "你是一位专业的营养师。请分析食物并以 JSON 格式返回数据。如果不是食物请明确指出。数值请保留一位小数。";
    if (isLibrary) {
       systemInstruction = "你是一位专业的营养师。请分析食物或营养成分表，并以 JSON 格式返回数据。如果不是食物请明确指出。你必须严格返回【每 100g】的数值，数值请保留一位小数。";
    }

    // -----------------------------------------------------------
    // DeepSeek branch (for mainland China / user choice)
    // -----------------------------------------------------------
    if (provider === "deepseek") {
      const dsKey = (customApiKey || process.env.DEEPSEEK_API_KEY || "").trim();
      if (!isValidDeepSeekKey(dsKey)) {
        return res.status(400).json({
          error: "Missing or Invalid API Key. DeepSeek API Key 格式不正确，应以 sk- 开头。请在「设置」中填写您的 DeepSeek API Key。",
        });
      }

      let dsText = "";
      let dsLastError: any = null;
      // Simple retry for transient errors
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          dsText = await callDeepSeek(dsKey, query || "", imageBase64, !!isLibrary, systemInstruction);
          if (dsText) break;
        } catch (err: any) {
          dsLastError = err;
          const msg = String(err?.message || "");
          // Auth errors: fail fast, don't retry
          if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("invalid")) {
            throw err;
          }
          // Otherwise wait briefly and retry once
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!dsText) {
        throw dsLastError || new Error("DeepSeek 未返回任何结果。");
      }

      dsText = dsText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
      const dsResult = JSON.parse(dsText);
      return res.json(dsResult);
    }

    // -----------------------------------------------------------
    // Gemini branch (default)
    // -----------------------------------------------------------
    // Dynamically retrieve client and credentials status
    const { client: aiClient, isValid, isCustom } = getGeminiClientAndStatus(customApiKey);

    if (!isValid) {
      return res.status(400).json({ 
        error: `Missing or Invalid API Key. ${
          isCustom 
            ? "您手动设置的 API Key 格式不正确，请确认它是否以 AIzaSy 开头且不要有前后空格。" 
            : "系统默认 API通道当前不可用，请在右上角「设置」中配置您专属的 Gemini API Key 激活服务。"
        }` 
      });
    }

    const contents = buildContents(query || "", imageBase64, !!isLibrary);

    let text = "";
    let lastError: any = null;
    
    // List of models to try in order of preference
    const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

    for (const modelName of modelsToTry) {
      let modelRetries = 2; // Try each model up to 2 times for retryable errors (initial + 1 retry)
      while (modelRetries > 0) {
        try {
          console.log(`[Gemini API] Attempting estimation using model: ${modelName} (retries left for this model: ${modelRetries - 1})`);
          const response = await aiClient.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              // @ts-ignore
              responseSchema,
            },
          });
          text = response.text || "";
          if (text) {
            break; // Success! Break out of the retry loop
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = err.message || String(err || "");
          
          // Terminal credentials or query bad parameters error -> Fail Fast
          const isTerminalAuthError = 
            err.status === 400 || 
            errMsg.includes("API key not valid") || 
            errMsg.includes("API_KEY_INVALID") || 
            errMsg.includes("INVALID_ARGUMENT") ||
            errMsg.toLowerCase().includes("api key") ||
            errMsg.toLowerCase().includes("invalid");

          if (isTerminalAuthError) {
            console.warn(`[Gemini API Error] Terminal auth/parameter error using ${modelName}. Stopping attempts.`);
            throw err;
          }

          const isThrottled = 
            err.status === 429 || 
            errMsg.includes("429") || 
            errMsg.toLowerCase().includes("rate limit") || 
            errMsg.toLowerCase().includes("quota");

          const isOverloadedOrUnavailable = 
            err.status === 503 || 
            errMsg.includes("503") || 
            errMsg.toLowerCase().includes("unavailable") || 
            errMsg.toLowerCase().includes("high demand") || 
            errMsg.toLowerCase().includes("temporary") ||
            errMsg.toLowerCase().includes("overloaded");

          if (isThrottled && modelRetries > 1) {
            modelRetries--;
            const delayMs = (3 - modelRetries) * 2000;
            console.warn(`[Gemini API Error] Throttling on ${modelName}. Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }

          if (isOverloadedOrUnavailable) {
            console.warn(`[Gemini API Warning] Model ${modelName} is currently overloaded (503/high demand). Skipping retries and moving to fallback model immediately.`);
          }
          
          // Break inner loop to try the next model
          break;
        }
      }
      
      if (text) {
        break; // If we got a successful response, stop trying other models
      }
    }

    if (!text) {
      throw lastError || new Error("All models failed to return a response.");
    }
    
    // Clean markdown JSON wrapper if present
    text = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Unknown error occurred during estimation" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
