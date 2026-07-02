# GYMEAT 版本基线

## v1.6-scorefix （干净基线）

这一版整合了以下所有改动，作为后续开发的统一起点。
GitHub / Render / 本地代码请全部以这一版为准。

### 已包含的改动
- **DeepSeek 支持**：后端 `/api/estimate` 支持 provider 参数（gemini / deepseek），
  用户可在设置里切换。服务端默认 DeepSeek 通道读环境变量 `DEEPSEEK_API_KEY`。
- **CORS**：后端加了跨域头，供 Capacitor 原生 app 调用。
- **PWA**：vite-plugin-pwa 已启用，生成 manifest + service worker。
- **Logo**：深蓝圆底 + 白色水滴，全套图标（含 Android launcher 图标）。
- **Capacitor**：`android/` 原生工程已就绪，app 内 API 指向
  `https://gymeatapp.onrender.com`（见 package.json 的 build:app 脚本）。
- **部署**：Dockerfile + render.yaml，PORT 读环境变量。

### 后端健康检查
部署后访问：`https://gymeatapp.onrender.com/api/health`
应返回：`{"status":"ok","version":"v1.6-scorefix"}`
用这个确认线上是不是这一版。
