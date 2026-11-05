/**
 * Firestore 安全规则测试。需要本地模拟器，用 `npm run test:rules` 跑（会自动启动和关闭模拟器）。
 * 不连真实项目，不花额度。
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, increment, collection, getDocs, query, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gymeat',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const guest = () => env.unauthenticatedContext().firestore();

const goals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
const food = (over: Record<string, unknown> = {}) => ({
  id: 'f1', date: '2026-11-05', name: '鸡胸肉', calories: 330, protein: 62, carbs: 0, fat: 7.2,
  amount: '200g', amountValue: 200, baseNutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: 'g' },
  timestamp: 1, mealType: 'lunch', ownerUid: 'alice', ...over,
});

describe('用户文档', () => {
  it('本人可以建档和读取', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { uid: 'alice', email: 'a@x.com', goals, fitnessGoal: 'lose', schemaVersion: 1 }));
    await assertSucceeds(getDoc(doc(alice(), 'users/alice')));
  });
  it('别人和未登录都不能读写', async () => {
    await assertFails(setDoc(doc(bob(), 'users/alice'), { uid: 'alice', goals }));
    await assertFails(getDoc(doc(guest(), 'users/alice')));
  });
  it('目标不合理时拒绝', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), { uid: 'alice', goals: { ...goals, calories: 0 } }));
    await assertFails(setDoc(doc(alice(), 'users/alice'), { uid: 'alice', goals, fitnessGoal: 'fly' }));
  });
});

describe('饮食记录 foods', () => {
  it('正常记录可以写、读、删', async () => {
    const db = alice();
    await assertSucceeds(setDoc(doc(db, 'users/alice/foods/f1'), food()));
    await assertSucceeds(getDoc(doc(db, 'users/alice/foods/f1')));
    await assertSucceeds(getDocs(query(collection(db, 'users/alice/foods'), where('date', '>=', '2026-01-01'))));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/foods/f1')));
  });
  it('没有 baseNutrition 和餐次的老式记录也接受', async () => {
    const { baseNutrition: _b, mealType: _m, ...plain } = food();
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/foods/f1'), plain));
  });
  it('写到别人名下、ownerUid 不符、id 和文档名不符都拒绝', async () => {
    await assertFails(setDoc(doc(bob(), 'users/alice/foods/f1'), food({ ownerUid: 'bob' })));
    await assertFails(setDoc(doc(alice(), 'users/alice/foods/f1'), food({ ownerUid: 'bob' })));
    await assertFails(setDoc(doc(alice(), 'users/alice/foods/f2'), food()));
  });
  it('多余字段、负数、超大数值、错误日期和餐次都拒绝', async () => {
    const db = alice();
    await assertFails(setDoc(doc(db, 'users/alice/foods/f1'), food({ isFood: true })));
    await assertFails(setDoc(doc(db, 'users/alice/foods/f1'), food({ calories: -1 })));
    await assertFails(setDoc(doc(db, 'users/alice/foods/f1'), food({ calories: 999999 })));
    await assertFails(setDoc(doc(db, 'users/alice/foods/f1'), food({ date: '2026/11/05' })));
    await assertFails(setDoc(doc(db, 'users/alice/foods/f1'), food({ mealType: 'brunch' })));
    await assertFails(setDoc(doc(db, 'users/alice/foods/f1'), food({ name: '' })));
  });
  it('别人读不到', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'users/alice/foods/f1'), food()); });
    await assertFails(getDoc(doc(bob(), 'users/alice/foods/f1')));
  });
});

describe('食物库、体重、饮水', () => {
  it('食物库：正常写入可以，多余字段拒绝', async () => {
    const item = { id: 'L1', name: '米饭', caloriesPer100g: 116, proteinPer100g: 2.6, carbsPer100g: 26, fatPer100g: 0.3, createdAt: 1, ownerUid: 'alice' };
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/library/L1'), item));
    await assertFails(setDoc(doc(alice(), 'users/alice/library/L1'), { ...item, extra: 1 }));
  });
  it('体重：0 和超过 500 拒绝，日期要和文档名一致', async () => {
    const w = (weight: number, date = '2026-11-05') => ({ date, weight, ownerUid: 'alice' });
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/weightLogs/2026-11-05'), w(65.5)));
    await assertFails(setDoc(doc(alice(), 'users/alice/weightLogs/2026-11-05'), w(0)));
    await assertFails(setDoc(doc(alice(), 'users/alice/weightLogs/2026-11-05'), w(600)));
    await assertFails(setDoc(doc(alice(), 'users/alice/weightLogs/2026-11-05'), w(65, '2026-11-04')));
  });
  it('饮水：服务端自增可以，减到负数拒绝', async () => {
    const ref = doc(alice(), 'users/alice/waterLogs/2026-11-05');
    await assertSucceeds(setDoc(ref, { date: '2026-11-05', ownerUid: 'alice', amount: increment(250) }, { merge: true }));
    await assertSucceeds(setDoc(ref, { date: '2026-11-05', ownerUid: 'alice', amount: increment(250) }, { merge: true }));
    await assertFails(setDoc(ref, { date: '2026-11-05', ownerUid: 'alice', amount: increment(-1000) }, { merge: true }));
  });
  it('不在名单里的集合一律拒绝', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/logs/2026-11-05'), { date: '2026-11-05', foods: [], ownerUid: 'alice' }));
    await assertFails(setDoc(doc(alice(), 'other/x'), { a: 1 }));
  });
});
