/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'cn' = 国内版（隐藏谷歌登录）；不设 = 海外版 */
  readonly VITE_APP_REGION?: string;
  /** 原生 App 里调用后端的完整地址；网页版留空走同源 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json 里的版本号（vite.config.ts 注入） */
declare const __APP_VERSION__: string;
