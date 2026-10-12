import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Account,
  Category,
  Transaction,
  Budget,
  StockHolding,
  StockTransaction,
  Subscription
} from '@/types';
import { generateInitialSeedData } from './seedData';
import { format } from 'date-fns';
import { calculateNextBillingDate } from '@/utils/subscriptionUtils';

/**
 * 徹底移除物件中的 undefined 屬性，防止 Firestore 拋出 Unsupported field value: undefined
 */
function cleanUndefined<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

// 記憶體初始化鎖，防止同一 Session 重複觸發種子寫入
const initializedUserMap = new Set<string>();

/**
 * 初始化使用者預設資料 (新使用者首次登入)
 */
export async function initializeUserData(userId: string): Promise<void> {
  if (!userId || initializedUserMap.has(userId)) return;
  initializedUserMap.add(userId);

  try {
    const accsRef = collection(db, 'users', userId, 'accounts');
    const snap = await getDocs(accsRef);
    if (snap.empty) {
      const { accounts, categories } = generateInitialSeedData(userId);
      const batch = writeBatch(db);

      accounts.forEach((acc) => {
        const ref = doc(db, 'users', userId, 'accounts', acc.id);
        batch.set(ref, cleanUndefined(acc), { merge: true });
      });

      categories.forEach((cat) => {
        const ref = doc(db, 'users', userId, 'categories', cat.id);
        batch.set(ref, cleanUndefined(cat), { merge: true });
      });

      await batch.commit();
    }
  } catch (err) {
    console.warn('[Firestore] 初始化使用者種子資料失敗:', err);
  }
}

/* ==========================================================================
   帳戶 (Accounts) 服務
   ========================================================================== */

export function subscribeAccounts(userId: string, callback: (accounts: Account[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'users', userId, 'accounts'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const accs = snapshot.docs.map((d) => d.data() as Account);
      // 展示層去重 (同名稱僅保留最新/首個，絕不私自刪除 Firestore 文件)
      const seen = new Set<string>();
      const deduped: Account[] = [];
      accs.forEach((acc) => {
        if (!seen.has(acc.name)) {
          seen.add(acc.name);
          deduped.push(acc);
        }
      });
      callback(deduped);
    },
    (error) => {
      console.warn('[Firestore] subscribeAccounts 存取受限或未初始化:', error);
      callback([]);
    }
  );
}

export async function saveAccount(account: Account): Promise<void> {
  const ref = doc(db, 'users', account.userId, 'accounts', account.id);
  await setDoc(ref, cleanUndefined(account), { merge: true });
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
}

/* ==========================================================================
   分類 (Categories) 服務
   ========================================================================== */

export function subscribeCategories(userId: string, callback: (categories: Category[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'users', userId, 'categories'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const cats = snapshot.docs.map((d) => d.data() as Category);
      // 展示層去重 (依 type + name，絕不私自刪除 Firestore 文件)
      const seen = new Set<string>();
      const deduped: Category[] = [];
      cats.forEach((cat) => {
        const key = `${cat.type}_${cat.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(cat);
        }
      });
      callback(deduped);
    },
    (error) => {
      console.warn('[Firestore] subscribeCategories error:', error);
      callback([]);
    }
  );
}

export async function saveCategory(category: Category): Promise<void> {
  const ref = doc(db, 'users', category.userId, 'categories', category.id);
  await setDoc(ref, cleanUndefined(category), { merge: true });
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'categories', categoryId));
}

/* ==========================================================================
   交易 (Transactions) 服務 - 支援衍生架構、離線快取與 Undo
   ========================================================================== */

export function subscribeTransactions(userId: string, callback: (transactions: Transaction[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const txs = snapshot.docs.map((d) => d.data() as Transaction);
      callback(txs);
    },
    (error) => {
      console.warn('[Firestore] subscribeTransactions error:', error);
      callback([]);
    }
  );
}

/**
 * 新增交易
 */
export async function addTransaction(transaction: Transaction): Promise<void> {
  const { userId, id } = transaction;
  const txDocRef = doc(db, 'users', userId, 'transactions', id);
  await setDoc(txDocRef, cleanUndefined(transaction), { merge: true });
}

/**
 * 更新既有交易 (支援明細點擊編輯)
 */
export async function updateTransaction(transaction: Transaction): Promise<void> {
  const { userId, id } = transaction;
  const txDocRef = doc(db, 'users', userId, 'transactions', id);
  await setDoc(
    txDocRef,
    cleanUndefined({
      ...transaction,
      updatedAt: new Date().toISOString()
    }),
    { merge: true }
  );
}

/**
 * 復原交易 (供 Undo Toast 呼叫)
 */
export async function restoreTransaction(transaction: Transaction): Promise<void> {
  await addTransaction(transaction);
}

/**
 * 刪除交易
 */
export async function deleteTransaction(transaction: Transaction): Promise<void> {
  const { id, userId } = transaction;
  const txDocRef = doc(db, 'users', userId, 'transactions', id);
  await deleteDoc(txDocRef);
}

/**
 * 批次新增信用卡分期交易
 */
export async function addInstallmentTransactions(transactions: Transaction[]): Promise<void> {
  if (!transactions || transactions.length === 0) return;
  const firstTx = transactions[0];
  const { userId } = firstTx;

  const batch = writeBatch(db);
  for (const tx of transactions) {
    const txDocRef = doc(db, 'users', userId, 'transactions', tx.id);
    batch.set(txDocRef, cleanUndefined(tx), { merge: true });
  }
  await batch.commit();
}

/**
 * 批次刪除同一分期群組之所有交易
 */
export async function deleteInstallmentGroup(userId: string, groupId: string): Promise<void> {
  const q = query(
    collection(db, 'users', userId, 'transactions'),
    where('installment.groupId', '==', groupId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

/* ==========================================================================
   預算 (Budgets) 服務
   ========================================================================== */

export function subscribeBudgets(userId: string, callback: (budgets: Budget[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = collection(db, 'users', userId, 'budgets');
  return onSnapshot(
    q,
    (snapshot) => {
      const budgets = snapshot.docs.map((d) => d.data() as Budget);
      callback(budgets);
    },
    (error) => {
      console.warn('[Firestore] subscribeBudgets error:', error);
      callback([]);
    }
  );
}

export async function saveBudget(budget: Budget): Promise<void> {
  const ref = doc(db, 'users', budget.userId, 'budgets', budget.id);
  await setDoc(ref, cleanUndefined(budget), { merge: true });
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'budgets', budgetId));
}

/* ==========================================================================
   股票持倉與交易明細 (Stock Holdings & Trades) 服務
   ========================================================================== */

export function subscribeStockHoldings(userId: string, callback: (holdings: StockHolding[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = collection(db, 'users', userId, 'stockHoldings');
  return onSnapshot(
    q,
    (snapshot) => {
      const holdings = snapshot.docs.map((d) => d.data() as StockHolding);
      callback(holdings);
    },
    (error) => {
      console.warn('[Firestore] subscribeStockHoldings error:', error);
      callback([]);
    }
  );
}

export async function saveStockHolding(holding: StockHolding): Promise<void> {
  const ref = doc(db, 'users', holding.userId, 'stockHoldings', holding.id);
  await setDoc(ref, cleanUndefined(holding), { merge: true });
}

export async function deleteStockHolding(userId: string, holdingId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'stockHoldings', holdingId));
}

/**
 * 記錄股票交易明細 (買進、賣出、配息)
 */
export async function saveStockTrade(trade: StockTransaction): Promise<void> {
  const ref = doc(db, 'users', trade.userId, 'stockTrades', trade.id);
  await setDoc(ref, cleanUndefined(trade), { merge: true });
}

export function subscribeStockTrades(
  userId: string,
  holdingId?: string,
  callback?: (trades: StockTransaction[]) => void
): () => void {
  if (!userId || !callback) return () => {};

  let q = query(collection(db, 'users', userId, 'stockTrades'), orderBy('date', 'desc'));
  if (holdingId) {
    q = query(collection(db, 'users', userId, 'stockTrades'), where('holdingId', '==', holdingId), orderBy('date', 'desc'));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const trades = snapshot.docs.map((d) => d.data() as StockTransaction);
      callback(trades);
    },
    (err) => console.warn('[Firestore] subscribeStockTrades error:', err)
  );
}

/* ==========================================================================
   信用卡定期訂閱 (Subscriptions) 服務 - 冪等性背景扣款
   ========================================================================== */

export function subscribeSubscriptions(userId: string, callback: (subscriptions: Subscription[]) => void): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'users', userId, 'subscriptions'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const subs = snapshot.docs.map((d) => d.data() as Subscription);
      callback(subs);
    },
    (error) => {
      console.warn('[Firestore] subscribeSubscriptions error:', error);
      callback([]);
    }
  );
}

export async function saveSubscription(subscription: Subscription): Promise<void> {
  const ref = doc(db, 'users', subscription.userId, 'subscriptions', subscription.id);
  await setDoc(ref, cleanUndefined(subscription), { merge: true });
}

export async function cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, 'users', userId, 'subscriptions', subscriptionId);
  await updateDoc(ref, {
    status: 'cancelled',
    autoRecord: false,
    cancelledAt: now,
    updatedAt: now
  });
}

export async function reactivateSubscription(userId: string, subscriptionId: string): Promise<void> {
  const now = new Date().toISOString();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const ref = doc(db, 'users', userId, 'subscriptions', subscriptionId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const sub = snap.data() as Subscription;
    let nextDate = sub.nextBillingDate;
    if (nextDate <= todayStr) {
      nextDate = calculateNextBillingDate(todayStr, sub.period, sub.billingCycleDay);
    }
    await updateDoc(ref, {
      status: 'active',
      autoRecord: true,
      nextBillingDate: nextDate,
      cancelledAt: null,
      updatedAt: now
    });
  }
}

export async function deleteSubscription(userId: string, subscriptionId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'subscriptions', subscriptionId));
}

/**
 * 檢查並自動執行已到期的信用卡定期訂閱扣款紀錄 (具備確定性 ID 防重與冪等性)
 */
export async function processDueSubscriptions(userId: string): Promise<Transaction[]> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();
  const generatedTxs: Transaction[] = [];

  let activeSubs: Subscription[] = [];
  try {
    const q = query(
      collection(db, 'users', userId, 'subscriptions'),
      where('status', '==', 'active'),
      where('autoRecord', '==', true)
    );
    const snap = await getDocs(q);
    activeSubs = snap.docs.map((d) => d.data() as Subscription);
  } catch (err) {
    console.warn('[Firestore] 查詢到期訂閱失敗:', err);
    return [];
  }

  for (const sub of activeSubs) {
    let currentNextBilling = sub.nextBillingDate;
    let loopCount = 0;
    const maxLoops = 12;

    while (currentNextBilling <= todayStr && loopCount < maxLoops) {
      // 確定性 ID：防止多裝置/多視窗同時執行時產生重複交易
      const txId = `tx_sub_${sub.id}_${currentNextBilling.replace(/-/g, '')}`;

      const existingTxSnap = await getDoc(doc(db, 'users', userId, 'transactions', txId));
      if (!existingTxSnap.exists()) {
        const newTx: Transaction = {
          id: txId,
          userId,
          accountId: sub.accountId,
          categoryId: sub.categoryId,
          type: 'expense',
          amount: sub.amount,
          merchant: sub.name,
          note: `${sub.name} (訂閱扣款)`,
          tags: Array.from(new Set([...(sub.tags || []), '訂閱付款'])),
          date: currentNextBilling,
          source: 'subscription',
          subscription: {
            subscriptionId: sub.id,
            period: sub.period
          },
          createdAt: now,
          updatedAt: now
        };

        try {
          await addTransaction(newTx);
          generatedTxs.push(newTx);
        } catch (err) {
          console.error(`[Firestore] 自動扣款紀錄失敗 (訂閱 ID: ${sub.id}):`, err);
          break;
        }
      }

      sub.lastRecordedDate = currentNextBilling;
      currentNextBilling = calculateNextBillingDate(currentNextBilling, sub.period, sub.billingCycleDay);
      sub.nextBillingDate = currentNextBilling;
      sub.updatedAt = now;
      await saveSubscription(sub);

      loopCount++;
    }
  }

  return generatedTxs;
}
