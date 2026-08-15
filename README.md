# 健食 GYMEAT

AI 营养记录 app —— 拍照/文字识别食物营养、记录每日热量、AI 营养教练、趋势分析。

React + Vite + Express + Firebase，用 Capacitor 打包成安卓 app。

> 详细的架构说明、打包步骤和踩过的坑见 `项目说明_必读.txt`；
> 版本历史和每版改动见 [VERSION.md](VERSION.md)。

## 本地运行

需要 Node.js。

```bash
npm install
```

```bash
npm run dev
```

打开 http://localhost:3000 （不是 5173 —— `dev` 跑的是 Express，Vite 以中间件形式挂在里面）。

## AI 功能需要 API Key

仓库里不含任何 key。两种配法，任选：

**A. 在 app 的「设置」里填**（存在浏览器本地，不进代码）
- Gemini：Google AI Studio 申请，必须 `AIzaSy` 开头
- DeepSeek：platform.deepseek.com 申请，`sk-` 开头，国内可直连

**B. 配服务端默认 key**

```bash
cp .env.example .env
```

填 `GEMINI_API_KEY` 或 `DEEPSEEK_API_KEY`。取值顺序是用户自填的 key 优先，没有才回落到 `.env`。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发（Express + Vite 中间件，端口 3000）|
| `npm run lint` | 类型检查（`tsc --noEmit`）**比 build 严格，改完必跑** |
| `npm run build` | 构建前端 + 打包后端 |
| `npm run sync:android:cn` | 构建国内版并同步到 android 工程 |
| `npm run sync:android:global` | 构建海外版并同步 |

> `npm run build` 走 esbuild，只转译不做类型检查 —— build 通过不代表类型没问题，
> 所以 `lint` 和 `build` 两个都要跑。

## 国内版 / 海外版

同一份代码两个版本，靠打包时的开关区分：

- **国内版**（`:cn`，包名 `com.gymeat.app`）：隐藏谷歌登录，国内登不了
- **海外版**（`:global`，包名 `com.gymeat.global`）：保留谷歌登录

包名不同，可以同时装在一台手机上。打 APK 的完整步骤见 `项目说明_必读.txt` 第五节。

## 部署

后端部署在 Render：https://gymeatapp.onrender.com

确认线上版本：

```bash
curl https://gymeatapp.onrender.com/api/health
```

返回的 `version` 字段就是当前线上版本。

> Render 免费档会休眠，第一次请求 AI 要等几十秒冷启动，属正常。
