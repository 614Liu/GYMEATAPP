import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gymeat.app',
  appName: '健食',
  // Vite builds the client into dist/ (alongside the server bundle).
  webDir: 'dist',
  // No "server.url" here on purpose: we ship the built web assets inside the
  // APK so the UI loads locally (no address bar, works offline for browsing).
  // Only the AI request reaches out to the backend, via VITE_API_BASE.
  plugins: {
    // 原生谷歌登录：原生端只负责弹出系统的谷歌账号选择，拿到凭证后交给网页端的 Firebase SDK 登录，
    // 所以数据读写仍走同一套 JS 代码（skipNativeAuth）。
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
