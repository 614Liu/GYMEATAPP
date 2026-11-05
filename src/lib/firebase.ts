import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  waitForPendingWrites,
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

let db: Firestore | null = null;

/** 当前的数据库实例（退出登录清缓存后会重建） */
export function getDb(): Firestore {
  if (!db) db = createDb();
  return db;
}

/** 等待还没传到云端的写入；超时返回 false（通常是离线） */
export async function flushPendingWrites(timeoutMs = 5000): Promise<boolean> {
  if (!db) return true;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return Promise.race([waitForPendingWrites(db).then(() => true as const), timeout]);
}

/**
 * 删掉本机的离线缓存。退出登录后调用：缓存里是上一个账号的数据，
 * 别人登录自己的账号虽然读不到，但数据仍留在这台手机上。
 */
export async function clearLocalCache(): Promise<void> {
  if (!db) return;
  const current = db;
  db = null;
  await terminate(current);
  await clearIndexedDbPersistence(current).catch((err) => {
    // 另一个标签页还开着同一个缓存时会失败，那个页面关闭后下次退出再清
    console.warn('Could not clear Firestore cache:', err);
  });
}
