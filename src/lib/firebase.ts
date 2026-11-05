import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-config.json';

const app = initializeApp(firebaseConfig);

/**
 * 安卓 App 里不能用 getAuth：它会加载弹窗登录用的 iframe，在 App 的 WebView 里会卡住或报错。
 * 原生端改用 initializeAuth + IndexedDB 保存登录状态，登录本身交给原生谷歌登录（见 cloud.ts）。
 */
export const auth: Auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

/**
 * 开启 Firestore 的离线缓存（存在 IndexedDB）：
 * - 离线时照常读写，写入排队，联网后自动上传，App 重启也不丢；
 * - 登录后云端就是唯一的数据源，不再需要自己维护一份本地副本再合并。
 * 不支持 IndexedDB 的环境（极少数隐私模式）退回内存缓存。
 */
function createDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }
    );
  } catch (err) {
    console.warn('Persistent cache unavailable, falling back to memory cache:', err);
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
}

export const db = createDb();
