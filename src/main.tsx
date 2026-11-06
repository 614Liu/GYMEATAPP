import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/layout/ErrorScreen';
import './index.css';

// Service worker is registered automatically by vite-plugin-pwa (registerType: autoUpdate).
// 发了新版本：新的离线缓存一接管页面就刷新一次，用户不用手动强制刷新才能看到新版。
// 第一次安装（之前没有缓存接管）时不刷新。
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
