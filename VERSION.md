# GYMEAT 版本基线

## v1.9-refactor-hardening （当前版本）

这一版没有新功能，全部是**技术债清理 + bug 修复**。
外观和交互跟 v1.8 一模一样，改的都是底下的东西。

### 版本号对应关系（改版本时四处必须一起改）
| 位置 | 值 |
|---|---|
| `android/app/build.gradle` | `versionCode 9` / `versionName "1.9"` |
| `src/components/modals/SettingsModal.tsx` 页脚 | `v1.9` |
| `server.ts` 的 `/api/health` | `v1.9-refactor-hardening` |
| 本文件 | v1.9-refactor-hardening |

---

### 一、App.tsx 拆分（3047 → 约 1950 行）

原来所有 UI 挤在一个文件里，改一处要在三千行里翻。现在按弹窗拆开，
**每拆一批都跑过 `tsc --noEmit` + `npm run build` 验证**。

```
src/
  constants.ts                  常量（目标默认值、配色、评分徽章样式）
  lib/
    image.ts                    图片压缩
    nutrition.ts                getAutoCalories（宏量反算热量）、parseAmount（份量解析）
    sync.ts                     云端/本地数据合并  ← 新增，见下面第二节
    utils.ts                    cn()、parseLocalDate()
  components/
    ui/                         AnimatedNumber、MacroStat、MacroBadge、ChartHelpers
    modals/
      LogoutModal.tsx           退出确认
      WeightModal.tsx           记录体重
      EditFoodModal.tsx         修改摄入量
      EditLibraryFoodModal.tsx  修改食物库条目
      ChatModal.tsx             AI 对话
      SettingsModal.tsx         设置（目标 / AI 引擎 / API Key）
      FoodLibraryModal.tsx      食物库
      addfood/
        AiTab.tsx               添加food-AI 识别页
        LibraryTab.tsx          添加food-收藏库页
        ManualTab.tsx           添加food-手动录入页
```

**拆分原则**：Firebase 和 AI 调用一律留在 App.tsx，组件只收回调。
比如「存入库中」原本在按钮 onClick 里直接写 `setDoc(doc(db, ...))`，
现在提成 App.tsx 的 `handleSaveEstimateToLibrary`，组件只拿到 `onSaveToLibrary`。
以后再拆记得守住这条线，不然 Firebase 逻辑会散得到处都是。

---

### 二、修复的 bug

#### 🔴 登录会清空本地数据（数据丢失）

**现象**：登出状态下记录的所有数据，在登录那一刻消失，且不可恢复。

**原因**：`onSnapshot` 拿到云端全量数据后直接 `setLogs(remote)` 整个替换本地状态，
紧接着持久化 effect 又把这个结果写回 localStorage。logs / 食物库 / 体重 / 饮水四类全中。

**修法**：新增 `src/lib/sync.ts`，改成「**首次快照合并、之后云端为准**」——
登录后第一次快照把本地独有的数据并进来并回传云端，之后的快照按云端替换。

> 为什么只合并一次：如果每次都合并，你在另一台设备删掉的条目，会被这台设备的本地残留反复复活。
> 同一天两边都有记录时，按食物 id 取并集，不会丢任何一边。

#### 🔴 Firestore 写操作放在 setState 的 updater 里

`main.tsx` 开着 `StrictMode`，React 会双调用 updater —— dev 下每次加/改/删食物都往云端写两遍；
而且在 updater 里做副作用本身就违反 React 的纯函数约定，React 有权丢弃或重放。

改成先用镜像 ref（`localDataRef`）算好新状态，再 `setState` + 同步，
三个 handler 统一走新的 `syncDayLog()`。

#### 🔴 AI 识别结果存进食物库时单位错乱

记录用的识别（`isLibrary=false`）返回的是**该份量的总营养**，食物库存的是**每 100g**，
原代码把两者直接对等。识别出「150g 鸡胸肉 248 kcal」存进库会变成 248 kcal/100g（实际应为 165）。

现在按份量比例换算。遇到「1个中等大小」这类没有克重的份量无法换算，照存但 toast 提示核对。

#### 🔴 修改摄入量：件类食物的换算会漂移

「1 份 165 kcal」改成 2 份得 330（对），再改成 3 份得 247.5（错，应为 495）。

原因是除数用了会随编辑变化的 `amountValue`，而 `baseNutrition` 存的是固定的「每 1 份」值。
改成除数恒为基准量（100g 或 1 份）。同时修了两个相关问题：
标签对件类食物不再显示「修改克数 (g)」而是从原份量串提取单位（"2个" → 「个」）；
`baseNutrition` 缺失的老数据，兜底值现在也归一化到同一语义。

#### 🟡 时区：图表日期偏一天

`new Date('2026-08-14')` 按 UTC 解析，在 UTC 负偏移时区（美洲）会退回前一天。
**海外版会踩到**。新增 `parseLocalDate()` 按本地时区解析。

#### 🟡 后端错误分类过宽

`server.ts` 把任何含 "invalid" 的报错都当成致命的 key 错误，直接跳过全部备用模型 ——
一个偶发的 "invalid response" 就会让三个模型的 fallback 全部失效。收窄到真正的鉴权信号
（400/401/403、`API_KEY_INVALID`、`PERMISSION_DENIED` 等）。

#### 🟡 安全：默认 API key 可被白嫖

CORS 放行无 Origin 的请求（原生 WebView 需要），意味着任何人拿到 URL 就能无限调用你的默认 key。
新增 **20 次/分钟的 IP 限流**（`/api/health` 豁免）；请求体上限 50MB → 8MB
（图片压缩后约 50-150KB，8MB 绰绰有余；50MB 够单个请求拖垮免费实例）。

#### 🟢 其他

- 饼图三个渐变从来没生效：`'Protein'` vs `'protein'` 大小写不匹配，一直在走 fallback 纯色
- 每条食物的评分每次渲染算两遍 → 提到 map 顶部算一次
- 删掉每次启动都读 `test/connection` 的无用请求（firestore.rules 里没这条，必然 permission-denied）
- `jianshi_tip_*` / `jianshi_chat_*` 缓存永不清理 → 启动时清 7 天前的
- 清理死代码：`imageBase64 ? "deepseek-v4-flash" : "deepseek-v4-flash"` 三元两边一样，
  提成 `DEEPSEEK_MODEL` 常量；删掉 6 个未使用的 import

---

### 三、验证方式

- `npm run lint`（`tsc --noEmit`）+ `npm run build` 全绿
- 27 项断言覆盖纯函数逻辑，全过：
  - 合并逻辑 12 项，含「登出攒数据后登录、云端为空」这个原本会丢数据的场景
  - `parseAmount` / 单位换算 / `parseLocalDate` / `getAutoCalories` 15 项
- 浏览器实测：手动录入、修改摄入量、收藏库、食物库、设置、体重弹窗全链路；限流实测前 20 通过后 5 返回 429

**注意 `npm run lint` 比 `npm run build` 严格** —— Vite 走 esbuild 只转译不做类型检查，
build 过不代表类型没问题。每次改完两个都跑。

### 四、这一版没验证到的

- AI 对话 / 拍照识别：需要配 API Key
- 登录态的合并流程：需要真实 Google 账号，目前只有纯函数级测试覆盖
- 饼图渐变、tab 切换动画：依赖 rAF，自动化环境里 Recharts 不渲染

---

## v1.8-chatsave

这一版整合了以下所有改动。

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
返回的 `version` 字段就是线上当前版本。
