# GYMEAT 版本基线

## v1.12-new-ui （当前版本）

界面整体重做（设计稿在 `design/gymeat-home/design-demos/`），**数据结构、Firebase、服务器 AI 都没动**。

- **四个页面 + 底部导航**：今天 / 趋势 / 中间的 + / 食物库 / 我的。以前的设置、食物库、记一笔、改份量、记体重、退出确认等弹窗全部去掉，改成在页面里原地展开；「拍照识别」「手动」是从右边滑进来的整页。
- **首页**：热量大环 + 三个营养素小环（颜色沿环渐变，变化时冲过头再回来；圆环不在屏幕上时等划回来再播）、一周日期条（点 / 左右滑看以前）、AI 教练卡（先用本地规则：再补多少蛋白、两条能补蛋白又装得下的建议）、今日任务、各顿「最近吃过」一键再记、点已记的一样原地改份量 / 删除（可撤销）。
- **趋势**：体重曲线（按住看某天）、原地记体重、热量柱、营养素平均、30 天打卡格、本周小结。
- **食物库**：搜索高亮、筛选、拍营养表识别、手动存（浮动标签 + 实时校验）、往左滑编辑 / 删除（可撤销）、点开选克数记进某顿。
- **我的**：登录 / 头像、连续天数和里程碑、增肌减脂维持、营养素目标（改了浮起保存条）、导出导入备份、退出原地确认。AI 引擎和 Key 的设置先去掉，等 AI 重做。
- **动效**：来自 motion-prompt 的 17 条（#001 #010 #011 #022 #056 #069 #072 #074 #093 #122 #125 #146 #158 #159 #160 #166 等），集中在 `src/lib/fx.ts`；都照顾「减少动态效果」设置。
- 新增 `src/lib/stats.ts`（连续天数、平均、体重变化等，带单元测试）；删掉不再用的旧组件。
- 已知没做：安卓返回键关闭「记一笔」页；AI 教练对话仍是旧弹窗；字体走 Google Fonts（离线首开用系统字体）。

## v1.11-data-sync

换成新的 Firebase 项目，重做数据的存储和同步，加数据导出/导入。**界面外观不变**，服务器 AI 部分**没动**。

### Firebase 项目
| 项 | 值 |
|---|---|
| 项目 ID | `gymeat-614`（账号 614yisi@gmail.com，旧的 AI Studio 项目不再使用，旧数据不迁移） |
| 方案 | **Spark 免费**，没绑卡，超额只会暂停不会扣钱 |
| 数据库 | Firestore `(default)`，区域 `eur3`（欧洲） |
| 登录 | 只开了 Google。已授权网域：localhost、gymeat-614.firebaseapp.com、gymeat-614.web.app、gymeatapp.onrender.com |
| 配置文件 | 网页 `firebase-config.json`；安卓 `android/app/google-services.json`（两个包名都在里面） |

常用命令：
```bash
npm run deploy:rules      # 部署 firestore.rules（改了规则后必须跑）
npm run test:rules        # 在本地模拟器上测安全规则（要 Java，见下）
npm test                  # 单元测试
```
`test:rules` 需要 Java 在 PATH 里。这台电脑用 Android Studio 自带的：
`$env:PATH = "E:\新建文件夹\jbr\bin;" + $env:PATH`（PowerShell），再跑命令。

### 安卓：原生谷歌登录
以前用弹窗登录，安卓 App 的 WebView 里打不开，海外版 APK 实际上一直登录不了。
现在用 `@capacitor-firebase/authentication`：系统弹出谷歌账号选择，拿到凭证交给网页端 Firebase SDK 登录。

**换电脑打包海外版前，必须登记那台电脑的签名指纹**，否则谷歌登录会失败（每台电脑的 debug 签名不一样）：
```bash
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android
npx firebase apps:android:sha:create 1:481469387422:android:997c4f57a5e872883ba18f <SHA1>
npx firebase apps:android:sha:create 1:481469387422:android:997c4f57a5e872883ba18f <SHA256>
```
（`keytool` 在 Android Studio 的 `jbr\bin` 里。已登记：这台电脑。）登记后重新下载 `google-services.json`。

### 版本号对应关系（改版本时五处一起改）
| 位置 | 值 |
|---|---|
| `android/app/build.gradle` | `versionCode 12` / `versionName "1.12"` |
| 「我的」页脚 | 自动读 `package.json`，不用改 |
| `server.ts` 的 `/api/health` | `v1.12-new-ui` |
| `package.json` 的 `version` | `1.12.0` |
| 本文件 | v1.12-new-ui |

### 一、数据只有一份，不再做本地/云端合并
以前登录后本机和云端各一份，靠「云端优先、本机补缺」合并。这条规则只认新增：
离线时删掉的记录上线后会复活，离线改的克数会被云端旧值盖回去。

现在：
- **游客**（未登录、国内版）：数据在本机 localStorage。
- **登录**：只认云端。Firestore 开了离线缓存（IndexedDB），离线照常读写，写入排队，联网自动上传，App 重启也不丢。
- 登录那一刻把游客期间的数据**只补不改**地传上去（`lib/accountSetup.ts`），成功后清掉本机那份。

### 二、云端数据结构（schemaVersion 1）
| 路径 | 内容 |
|---|---|
| `users/{uid}` | `goals`、`fitnessGoal`、`schemaVersion` |
| `users/{uid}/foods/{id}` | 每条饮食记录一个文档，带 `date`。两台设备同时改同一天不会互相覆盖 |
| `users/{uid}/library/{id}` | 食物库，每 100g |
| `users/{uid}/weightLogs/{date}` | 体重 |
| `users/{uid}/waterLogs/{date}` | 饮水，加减用服务端自增 `increment` |

以后改数据结构：`SCHEMA_VERSION` 加 1，在 `setupAccount` 里写迁移。

### 三、只加载最近的数据
饮食和饮水只加载最近 60 天，体重最近一年，翻到更早的日期时单独加载那一天。免费额度每天 5 万次读，不会随使用时间变长而吃光。

### 四、安全规则（`firestore.rules`）
- 每个集合都有字段白名单、数值范围、日期格式；`foods` 的 `id` 必须等于文档名；只能读写自己的数据；名单外的集合一律拒绝。
- 12 个自动测试（`tests/rules/`），GitHub Actions 每次推送都跑。
- 上传前统一清洗（`lib/records.ts` 的 `sanitize*`），备份文件里多余字段和不合理数值会被清掉。

### 五、数据导出 / 导入（设置 → 数据备份）
- 导出：全部记录、食物库、体重、饮水、目标 → 一个 JSON 文件。登录时从云端读全量。
  网页直接下载；安卓 App 写到缓存目录后调起系统分享（插件 `@capacitor/filesystem`、`@capacitor/share`）。
- 导入：记录只补上没有的，不覆盖已有；目标和健身目标用备份里的。

### 六、其他
- 应用崩溃时显示「出了点问题 / 重新加载」，技术细节折叠。
- 过了午夜：如果正在看「今天」，自动切到新的一天。
- 谷歌头像加载失败（Referer 被拒）已修，失败时显示邮箱首字母。
- GitHub Actions：类型检查、单元测试、安全规则测试、海外版和国内版构建。

### 七、收尾（提交后补的）
- 依赖安全补丁：`@capacitor/*` 8.4.1 → 8.4.3（修严重级漏洞）、`vite` → 6.4.5、`express` → 4.22.3，加 `npm audit fix`（不含大版本升级）。
  剩下的漏洞：本地开发工具（`firebase-tools`、`vitest`，要升大版本才能修，只在本机运行）和 Firebase SDK 里只在 Node 端用到的 gRPC，网页和 App 都不受影响。
- 退出登录：先等没同步完的改动传上去（离线时拦下来提示「请联网后再退出」），退出后删掉本机的 Firestore 离线缓存，上一个账号的数据不留在手机上。
- 加载状态：数据层返回 `loading`，登录后云端数据到之前显示占位，不再闪一下「清单空空如也」。UI 重塑时换成正式骨架屏。

### 已验证
- 退出登录后本机缓存被删、重新连接正常；刷新时先显示加载占位再出数据。
- 网页版登录（真实账号）：游客数据自动上传并清掉本机、增删改实时同步、刷新后数据还在、云端删除实时反映到页面。
- 海外版 APK 能编译通过（未在手机上试登录）。
- 测试数据已从账号里删掉。

### 没验证到的
- 安卓 App 上的原生谷歌登录和导出分享：要等 UI 做完打新 APK 时在手机上试。

---

## v1.10-code-fixes

这一版只修代码，**界面外观不变**。服务器 AI 部分（Gemini / DeepSeek、
`/api/estimate`、`/api/coach`、`/api/chat`）**没动**，之后整体重做。

### 一、修复的 bug

| 问题 | 原因 | 修法 |
|---|---|---|
| AI 识别后调份量（×1.5）再记录，之后改克数数值会被重复放大 | 热量乘了倍数，份量文字还是「200g」，换算基准算错 | `scaleAmount` 让份量文字跟着放大 |
| 食物评分不准：大份鸡胸肉被判一般、小块蛋糕被当成低热量 | 评分门槛按每 100g 定，传进去的却是整份数值 | `scoreLoggedFood` 用每 100g 的 `baseNutrition` 评 |
| 打中文按回车，拼音没选完就发出去 | 回车没判断输入法正在选字 | `isSubmitEnter` 检查 `isComposing` |
| 设置页「保存修改」不保存 API Key；目标每敲一个字写一次云端；清空会存成 0 被云端拒绝 | 改动直接生效，底部按钮只是关闭 | 设置改成草稿，点保存才一起生效；空值不能保存 |
| 趋势页体重框回车空值记成 0kg | 没校验 | 体重必须在 0–500 之间 |
| 体重 65.5 显示成 66 | 数字动画一律取整 | `AnimatedNumber` 加 `decimals` |
| 退出登录后换账号登录，上一个账号的数据合并进新账号 | 退出没清本机数据 | 退出后清空本机个人数据（云端保留） |
| 蛋白质/碳水/脂肪在不同地方颜色不一样 | 清单和修改弹窗用了另一套 | 全部统一为 蛋白紫 / 碳水蓝 / 脂肪橙（`MACRO_TEXT`） |
| 食物库填 0 克添加，数值变成无穷大 | 没校验份量 | 份量必须大于 0 |
| 没有数字的份量（如「一碗」）按 100 份算 | `parseAmount` 兜底返回 100 | 没数字当 1 份 |
| 云端写入失败没有提示，还会出未捕获的异常 | 有几处 `setDoc` 没 `catch` | 所有写入统一捕获，失败时提示「云端同步失败，数据已保存在本机」 |
| 食物库弹窗和添加食物弹窗共用一个错误提示，互相串 | 共用状态 | 各自管各自的 |
| 收藏库里选中的食物被删后还能用它添加 | 选中状态没更新 | 被删时取消选中 |
| 同一张图片选第二次没反应 | 文件框没清空 | 选完清空 |
| 连续快速操作可能丢掉前一次 | 动作读的是上一次渲染的数据 | 数据层用 ref 保存最新值 |

### 二、结构

- `App.tsx` 1970 行 → 约 300 行，只负责拼装。
- 数据层 `hooks/useNutritionData.ts`：本地存储 + 云端同步 + 所有增删改。4 段几乎一样的同步代码合成一个。
- AI 教练 `hooks/useCoach.ts`：AI 相关状态都在这里，重做 AI 时只换它和 `lib/gemini.ts`。
- 云端入口 `lib/cloud.ts`：界面不再直接调 `firebase/*`。Firebase 改成用到时才加载，国内版运行时不下载。
- 本地存储 `lib/storage.ts`：所有 key 集中管理。
- 首页拆成 `components/layout/*`、`components/daily/*`、`components/stats/*`、`components/modals/AddFoodModal.tsx`。
  添加食物弹窗的草稿留在弹窗里，打字不会重渲染整个首页。

### 三、工程

- 装上了 `@types/react` / `@types/react-dom`：**之前 React 部分其实一直没有类型检查**。
- `tsconfig` 开启 `strict` 和 `noUnusedLocals`，去掉 `main.tsx` 的 `@ts-nocheck`。
- 打包分块：react / 图表 / 动画 / firebase 各自一块。首屏 JS 1.3MB → 约 870KB（gzip 366KB → 约 260KB）。
- 新增 `npm test`（vitest），覆盖份量解析与放大、记录换算、评分、同步合并。
- 安卓构建产物（`android/app/src/main/assets/public` 等）不再提交，`npx cap sync` 会重新生成。

### 没做的（留到后面）

- 服务器 AI：限流可伪造 IP 绕过、`/api/chat` 原样转发消息、没有超时、AI 返回值没校验 —— 随 AI 重做一起处理。
- `lib/gemini.ts` 里没被调用的 `getMealSuggestions` 先留着，AI 重做时一起删。
- 依赖没有挪到 devDependencies：`render.yaml` 设了 `NODE_ENV=production`，挪了可能导致 Render 构建跳过 vite。
- 喝水目标还是固定 2000ml、删除没有撤销、焦点框被全局隐藏 —— 留给 UI 重塑。
- 国内版数据只在本机，建议尽快做导出/导入（见 `FUTURE_EXPORT_IMPORT.md`）。

---

## v1.9-refactor-hardening

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
