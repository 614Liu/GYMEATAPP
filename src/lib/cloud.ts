/**
 * 云端（Firebase 项目 gymeat-614，免费 Spark 方案）的唯一入口。界面和 hooks 只调这里，不直接碰 firebase/*。
 *
 * Firebase SDK 按需加载：国内版没有登录，永远不会下载它；海外版首屏也不用等它。
 *
 * 数据结构（users/{uid} 下）：
 *   用户文档        goals、fitnessGoal、schemaVersion
 *   foods/{id}      每条饮食记录一个文档，带 date 字段
 *   library/{id}    食物库，每 100g
 *   weightLogs/{date}、waterLogs/{date}
 */
import { IS_CN_VERSION } from '../constants';

export interface CloudUser {
  uid: string;
  email: string | null;
  photoURL: string | null;
}

export type CloudCollection = 'foods' | 'library' | 'weightLogs' | 'waterLogs';

type FirebaseModules = {
  app: typeof import('./firebase');
  auth: typeof import('firebase/auth');
  firestore: typeof import('firebase/firestore');
};

let modulesPromise: Promise<FirebaseModules> | null = null;

function loadFirebase(): Promise<FirebaseModules> {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import('./firebase'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]).then(([app, auth, firestore]) => ({ app, auth, firestore }));
  }
  return modulesPromise;
}

/** 订阅一个异步才能拿到退订函数的监听，返回同步的退订函数 */
function deferredSubscription(start: () => Promise<() => void>): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;
  start()
    .then((unsub) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    })
    .catch((err) => console.error('Cloud subscription failed:', err));
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

// ---------- 登录 ----------

/** 监听登录状态。国内版没有登录，立即回调 null。 */
export function subscribeAuth(onChange: (user: CloudUser | null) => void): () => void {
  if (IS_CN_VERSION) {
    onChange(null);
    return () => {};
  }
  return deferredSubscription(async () => {
    const { app, auth } = await loadFirebase();
    return auth.onAuthStateChanged(app.auth, (u) => {
      onChange(u ? { uid: u.uid, email: u.email, photoURL: u.photoURL } : null);
    });
  });
}

/** 原生插件只在安卓 App 里加载，网页版不下载它 */
async function nativeAuthPlugin() {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return null;
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  return FirebaseAuthentication;
}

/**
 * 谷歌登录。
 * - 网页：弹窗登录。
 * - 安卓 App：WebView 里弹窗登录用不了，改用系统的谷歌账号选择（原生插件），
 *   拿到 idToken 后交给网页端 Firebase SDK 登录，后面的数据读写和网页版完全一样。
 */
export async function signInWithGoogle(): Promise<void> {
  const { app, auth } = await loadFirebase();
  const native = await nativeAuthPlugin();
  if (!native) {
    await auth.signInWithPopup(app.auth, new auth.GoogleAuthProvider());
    return;
  }
  const result = await native.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error('谷歌登录没有返回凭证');
  await auth.signInWithCredential(app.auth, auth.GoogleAuthProvider.credential(idToken));
}

export async function signOut(): Promise<void> {
  const { app } = await loadFirebase();
  // 原生端也要退出，否则下次登录会直接用上一个谷歌账号、不让选
  const native = await nativeAuthPlugin();
  if (native) await native.signOut().catch(() => {});
  await app.auth.signOut();
}

// ---------- 用户文档 ----------

export function subscribeUserDoc(uid: string, onData: (data: Record<string, unknown> | null) => void): () => void {
  return deferredSubscription(async () => {
    const { app, firestore } = await loadFirebase();
    return firestore.onSnapshot(
      firestore.doc(app.db, 'users', uid),
      (snap) => onData(snap.exists() ? snap.data() : null),
      (err) => console.error('Firestore error (user doc):', err)
    );
  });
}

export async function fetchUserDoc(uid: string): Promise<Record<string, unknown> | null> {
  const { app, firestore } = await loadFirebase();
  const snap = await firestore.getDoc(firestore.doc(app.db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserDoc(uid: string, data: Record<string, unknown>): Promise<void> {
  const { app, firestore } = await loadFirebase();
  await firestore.setDoc(firestore.doc(app.db, 'users', uid), data, { merge: true });
}

// ---------- 子集合 ----------

export interface DateFilter {
  /** 只要 date ≥ 这一天的文档 */
  since?: string;
  /** 只要 date = 这一天的文档 */
  on?: string;
}

/**
 * 监听子集合，每次回调给出（筛选后的）全量数据。
 * 带日期筛选时只读最近的数据：历史越积越多，每次启动都全量读会很快吃光免费读取额度。
 */
export function subscribeCollection<T>(
  uid: string,
  name: CloudCollection,
  onData: (items: T[]) => void,
  filter: DateFilter = {}
): () => void {
  return deferredSubscription(async () => {
    const { app, firestore: fs } = await loadFirebase();
    const ref = fs.collection(app.db, 'users', uid, name);
    const constraints = [
      ...(filter.since ? [fs.where('date', '>=', filter.since)] : []),
      ...(filter.on ? [fs.where('date', '==', filter.on)] : []),
    ];
    return fs.onSnapshot(
      constraints.length ? fs.query(ref, ...constraints) : ref,
      (snap) => onData(snap.docs.map((d) => d.data() as T)),
      (err) => console.error(`Firestore error (${name}):`, err)
    );
  });
}

/** 一次性读取整个子集合（迁移、导出用） */
export async function fetchCollection<T>(uid: string, name: CloudCollection): Promise<T[]> {
  const { app, firestore } = await loadFirebase();
  const snap = await firestore.getDocs(firestore.collection(app.db, 'users', uid, name));
  return snap.docs.map((d) => d.data() as T);
}

/** 写入子集合里的一条文档，自动带上 ownerUid（安全规则要求） */
export async function saveItem(uid: string, name: CloudCollection, id: string, data: object): Promise<void> {
  const { app, firestore } = await loadFirebase();
  await firestore.setDoc(firestore.doc(app.db, 'users', uid, name, id), { ...data, ownerUid: uid });
}

export async function deleteItem(uid: string, name: CloudCollection, id: string): Promise<void> {
  const { app, firestore } = await loadFirebase();
  await firestore.deleteDoc(firestore.doc(app.db, 'users', uid, name, id));
}

/** 批量写入（每批最多 450 条，Firestore 上限 500） */
export async function saveItems(uid: string, name: CloudCollection, items: { id: string; data: object }[]): Promise<void> {
  if (items.length === 0) return;
  const { app, firestore } = await loadFirebase();
  for (let i = 0; i < items.length; i += 450) {
    const batch = firestore.writeBatch(app.db);
    for (const { id, data } of items.slice(i, i + 450)) {
      batch.set(firestore.doc(app.db, 'users', uid, name, id), { ...data, ownerUid: uid });
    }
    await batch.commit();
  }
}

/**
 * 饮水量加减。用服务端自增而不是「读出来加好再写回」，
 * 两台设备同时点 +250 也不会互相覆盖。
 */
export async function addWater(uid: string, date: string, delta: number): Promise<void> {
  const { app, firestore } = await loadFirebase();
  await firestore.setDoc(
    firestore.doc(app.db, 'users', uid, 'waterLogs', date),
    { date, ownerUid: uid, amount: firestore.increment(delta) },
    { merge: true }
  );
}
