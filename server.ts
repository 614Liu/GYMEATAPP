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
      apiKey: isValid ? apiKey : "AI_STUDIO_FALLBACK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Health check — visit this URL to confirm which version is live.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "v1.0-baseline" });
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
