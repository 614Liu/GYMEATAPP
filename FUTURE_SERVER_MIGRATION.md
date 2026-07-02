# 待办：更换后端服务器（从 onrender 换到国内可访问的服务器）

## 为什么会换
onrender 国内访问不稳定。等正经给国内用户用时，
需要换成国内能稳定访问的服务器（阿里云/腾讯云，或香港节点）。

## 换服务器 = 两件事
1. 把后端（Express）部署到新服务器
2. 把 app 里"AI 请求的地址"从 onrender 改成新地址

## 地址写在哪
- 网页版：前端用相对路径，自动跟后端走，**不用改**。
- 手机 APK 版：地址焊在 package.json 的 build:app 脚本里的
  VITE_API_BASE = https://gymeatapp.onrender.com
  → 换服务器要改这里，然后**重新打包 APK**，老用户需重新安装。

## 完整清单
1. 选新服务器（Node + Express 哪都能跑）
2. 部署后端，配环境变量 DEEPSEEK_API_KEY，拿到新域名
3. 改 package.json 里 VITE_API_BASE 为新域名
4. CORS：当前是 '*'（允许所有），不用改
5. 重新 sync:android + 打包 APK，发给用户更新
6. 网页版：重新部署到新服务器

## 一劳永逸技巧（避免以后每次换都重打包）
买个自己的域名，比如 api.gymeat.com 指向后端。
app 里写死 api.gymeat.com。以后换服务器只需改域名解析指向新 IP，
app 代码不用改、不用重打包。代价：域名费 + 一点配置。

## 提醒
- 只改后端/AI/网页功能 → 更新 GitHub + 部署平台
- 只改 app 外壳（闪屏/图标/名字）→ 只重新打包 APK
- 换服务器地址 → 既要改 VITE_API_BASE 又要重打包 APK

## 状态
暂用 onrender。真要换时从这份笔记继续，可让 Claude 全程带。
