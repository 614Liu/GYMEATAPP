import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gymeat.app',
  appName: '健食',
  // Vite builds the client into dist/ (alongside the server bundle).
  webDir: 'dist',
  // No "server.url" here on purpose: we ship the built web assets inside the
  // APK so the UI loads locally (no address bar, works offline for browsing).
  // Only the AI request reaches out to the backend, via VITE_API_BASE.
};

export default config;
