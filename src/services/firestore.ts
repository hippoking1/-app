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
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
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
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { calculateNextBillingDate } from '@/utils/subscriptionUtils';

// Local Demo 儲存輔助工具
class LocalStore {
  static get<T>(key: string, defaultVal: T): T {
    const data = localStorage.getItem('demo_' + key);
    return data ? JSON.parse(data) : defaultVal;
  }
  static set<T>(key: string, value: T): void {
    localStorage.setItem('demo_' + key, JSON.stringify(value));
    window.dispatchEvent(new Event('demo_storage_update'));
  }
}

/**
 * 徹底移除物件中的 undefined 屬性，防止 Firestore 拋出 Unsupported field value: undefined
 */
function cleanUndefined<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

// 記憶體初始化鎖，防止同一 Client Session 重複觸發種子寫入
const initializedUserMap = new Set<string>();

/**
 * 初始化使用者預設資料 (新使用者首次登入)
 */
export async function initializeUserData(userId: string): Promise<void> {
  if (initializedUserMap.has(userId)) return;
  initializedUserMap.add(userId);

  const { accounts, categories } = generateInitialSeedData(userId);

  if (!isFirebaseConfigured) {
    if (!localStorage.getItem('demo_accounts_' + userId)) {
      LocalStore.set('accounts_' + userId, accounts);
      LocalStore.set('categories_' + userId, categories);
      LocalStore.set('transactions_' + userId, []);
      LocalStore.set('budgets_' + userId, []);
      LocalStore.set('stocks_' + userId, []);
      LocalStore.set('subscriptions_' + userId, []);
    }
    return;
  }

  try {
    // 檢查 Firestore 是否已有帳戶
    const accsRef = collection(db, 'users', userId, 'accounts');
    const snap = await getDocs(accsRef);
    if (snap.empty) {
      const batch = writeBatch(db);
      
      accounts.forEach(acc => {
        const ref = doc(db, 'users', userId, 'accounts', acc.id);
        batch.set(ref, cleanUndefined(acc), { merge: true });
      });

      categories.forEach(cat => {
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
  if (!isFirebaseConfigured) {
    const load = () => {
      const data = LocalStore.get<Account[]>('accounts_' + userId, []);
      // 去重
      const seen = new Set<string>();
      const deduped = data.filter(a => {
        if (seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      });
      callback(deduped.sort((a, b) => a.sortOrder - b.sortOrder));
    };
    load();
    window.addEventListener('demo_storage_update', load);
    return () => window.removeEventListener('demo_storage_update', load);
  }

  const q = query(collection(db, 'users', userId, 'accounts'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const accs = snapshot.docs.map(d => d.data() as Account);
      // 自動依名稱去重
      const seen = new Set<string>();
      const deduped: Account[] = [];
      const duplicateIds: string[] = [];

      accs.forEach(acc => {
        const key = acc.name;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(acc);
        } else {
          duplicateIds.push(acc.id);
        }
      });

      // 背景清理 Firestore 中重複的帳戶文檔
      if (duplicateIds.length > 0) {
        duplicateIds.forEach(id => {
          deleteDoc(doc(db, 'users', userId, 'accounts', id)).catch(() => {});
        });
      }

      callback(deduped);
    },
    (error) => {
      console.warn('[Firestore] subscribeAccounts 存取受限或未初始化:', error);
      callback([]);
    }
  );
}

export async function saveAccount(account: Account): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Account[]>('accounts_' + account.userId, []);
    const idx = list.findIndex(a => a.id === account.id);
    if (idx >= 0) list[idx] = account;
    else list.push(account);
    LocalStore.set('accounts_' + account.userId, list);
    return;
  }

  const ref = doc(db, 'users', account.userId, 'accounts', account.id);
  await setDoc(ref, cleanUndefined(account), { merge: true });
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Account[]>('accounts_' + userId, []);
    LocalStore.set('accounts_' + userId, list.filter(a => a.id !== accountId));
    return;
  }

  await deleteDoc(doc(db, 'users', userId, 'accounts', accountId));
}

/* ==========================================================================
   分類 (Categories) 服務
   ========================================================================== */

export function subscribeCategories(userId: string, callback: (categories: Category[]) => void): () => void {
  if (!isFirebaseConfigured) {
    const load = () => {
      const data = LocalStore.get<Category[]>('categories_' + userId, []);
      const seen = new Set<string>();
      const deduped = data.filter(c => {
        const key = `${c.type}_${c.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      callback(deduped.sort((a, b) => a.sortOrder - b.sortOrder));
    };
    load();
    window.addEventListener('demo_storage_update', load);
    return () => window.removeEventListener('demo_storage_update', load);
  }

  const q = query(collection(db, 'users', userId, 'categories'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const cats = snapshot.docs.map(d => d.data() as Category);
      // 自動依 (type + name) 去重
      const seen = new Set<string>();
      const deduped: Category[] = [];
      const duplicateIds: string[] = [];

      cats.forEach(cat => {
        const key = `${cat.type}_${cat.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(cat);
        } else {
          duplicateIds.push(cat.id);
        }
      });

      // 背景清理 Firestore 中先前重複產生的分類文檔
      if (duplicateIds.length > 0) {
        duplicateIds.forEach(id => {
          deleteDoc(doc(db, 'users', userId, 'categories', id)).catch(() => {});
        });
      }

      callback(deduped);
    },
    (error) => {
      console.warn('[Firestore] subscribeCategories error:', error);
      callback([]);
    }
  );
}

export async function saveCategory(category: Category): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Category[]>('categories_' + category.userId, []);
    const idx = list.findIndex(c => c.id === category.id);
    if (idx >= 0) list[idx] = category;
    else list.push(category);
    LocalStore.set('categories_' + category.userId, list);
    return;
  }

  const ref = doc(db, 'users', category.userId, 'categories', category.id);
  await setDoc(ref, cleanUndefined(category), { merge: true });
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Category[]>('categories_' + userId, []);
    LocalStore.set('categories_' + userId, list.filter(c => c.id !== categoryId));
    return;
  }
  await deleteDoc(doc(db, 'users', userId, 'categories', categoryId));
}

/* ==========================================================================
   交易 (Transactions) 服務 - 連動帳戶餘額更新
   ========================================================================== */

export function subscribeTransactions(userId: string, callback: (transactions: Transaction[]) => void): () => void {
  if (!isFirebaseConfigured) {
    const load = () => {
      const data = LocalStore.get<Transaction[]>('transactions_' + userId, []);
      callback(data.sort((a, b) => b.date.localeCompare(a.date)));
    };
    load();
    window.addEventListener('demo_storage_update', load);
    return () => window.removeEventListener('demo_storage_update', load);
  }

  const q = query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const txs = snapshot.docs.map(d => d.data() as Transaction);
      callback(txs);
    },
    (error) => {
      console.warn('[Firestore] subscribeTransactions error:', error);
      callback([]);
    }
  );
}

/**
 * 新增交易並自動連動帳戶餘額更新
 */
export async function addTransaction(transaction: Transaction): Promise<void> {
  const { userId, accountId, type, amount, transferToAccountId } = transaction;

  if (!isFirebaseConfigured) {
    const txList = LocalStore.get<Transaction[]>('transactions_' + userId, []);
    txList.unshift(transaction);
    LocalStore.set('transactions_' + userId, txList);

    // 更新帳戶餘額 (若現金錢包餘額為 0 則不扣減餘額，改為純記錄已用額度)
    const accList = LocalStore.get<Account[]>('accounts_' + userId, []);
    const sourceAcc = accList.find(a => a.id === accountId);
    if (sourceAcc) {
      const isCashZeroMode = sourceAcc.type === 'cash' && sourceAcc.balance === 0;
      if (!isCashZeroMode) {
        if (type === 'expense') sourceAcc.balance -= amount;
        else if (type === 'income') sourceAcc.balance += amount;
        else if (type === 'transfer') sourceAcc.balance -= amount;
      }
    }
    if (type === 'transfer' && transferToAccountId) {
      const targetAcc = accList.find(a => a.id === transferToAccountId);
      if (targetAcc) targetAcc.balance += amount;
    }
    LocalStore.set('accounts_' + userId, accList);
    return;
  }

  // 使用 Firestore Transaction 保證一致性
  await runTransaction(db, async (t) => {
    const txDocRef = doc(db, 'users', userId, 'transactions', transaction.id);
    const accDocRef = doc(db, 'users', userId, 'accounts', accountId);
    const accDoc = await t.get(accDocRef);

    if (accDoc.exists()) {
      const accData = accDoc.data();
      const currentBalance = accData.balance || 0;
      const isCashZeroMode = accData.type === 'cash' && currentBalance === 0;

      if (!isCashZeroMode) {
        let newBalance = currentBalance;
        if (type === 'expense') newBalance -= amount;
        else if (type === 'income') newBalance += amount;
        else if (type === 'transfer') newBalance -= amount;

        t.update(accDocRef, { balance: newBalance, updatedAt: new Date().toISOString() });
      }
    }

    if (type === 'transfer' && transferToAccountId) {
      const targetDocRef = doc(db, 'users', userId, 'accounts', transferToAccountId);
      const targetDoc = await t.get(targetDocRef);
      if (targetDoc.exists()) {
        const targetBalance = targetDoc.data().balance || 0;
        t.update(targetDocRef, {
          balance: targetBalance + amount,
          updatedAt: new Date().toISOString()
        });
      }
    }

    t.set(txDocRef, cleanUndefined(transaction));
  });
}

/**
 * 批次新增信用卡分期交易
 */
export async function addInstallmentTransactions(transactions: Transaction[]): Promise<void> {
  if (!transactions || transactions.length === 0) return;
  const firstTx = transactions[0];
  const { userId, accountId } = firstTx;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (!isFirebaseConfigured) {
    const txList = LocalStore.get<Transaction[]>('transactions_' + userId, []);
    txList.unshift(...transactions);
    LocalStore.set('transactions_' + userId, txList);

    const accList = LocalStore.get<Account[]>('accounts_' + userId, []);
    const sourceAcc = accList.find(a => a.id === accountId);
    if (sourceAcc) {
      sourceAcc.balance -= totalAmount;
    }
    LocalStore.set('accounts_' + userId, accList);
    return;
  }

  await runTransaction(db, async (t) => {
    const accDocRef = doc(db, 'users', userId, 'accounts', accountId);
    const accDoc = await t.get(accDocRef);

    if (accDoc.exists()) {
      const currentBalance = accDoc.data().balance || 0;
      t.update(accDocRef, {
        balance: currentBalance - totalAmount,
        updatedAt: new Date().toISOString()
      });
    }

    for (const tx of transactions) {
      const txDocRef = doc(db, 'users', userId, 'transactions', tx.id);
      t.set(txDocRef, cleanUndefined(tx));
    }
  });
}

/**
 * 刪除交易並回補帳戶餘額
 */
export async function deleteTransaction(transaction: Transaction): Promise<void> {
  const { id, userId, accountId, type, amount, transferToAccountId } = transaction;

  if (!isFirebaseConfigured) {
    const txList = LocalStore.get<Transaction[]>('transactions_' + userId, []);
    LocalStore.set('transactions_' + userId, txList.filter(t => t.id !== id));

    const accList = LocalStore.get<Account[]>('accounts_' + userId, []);
    const sourceAcc = accList.find(a => a.id === accountId);
    if (sourceAcc) {
      const isCashZeroMode = sourceAcc.type === 'cash' && sourceAcc.balance === 0;
      if (!isCashZeroMode) {
        if (type === 'expense') sourceAcc.balance += amount;
        else if (type === 'income') sourceAcc.balance -= amount;
        else if (type === 'transfer') sourceAcc.balance += amount;
      }
    }
    if (type === 'transfer' && transferToAccountId) {
      const targetAcc = accList.find(a => a.id === transferToAccountId);
      if (targetAcc) targetAcc.balance += amount;
    }
    LocalStore.set('accounts_' + userId, accList);
    return;
  }

  await runTransaction(db, async (t) => {
    const txDocRef = doc(db, 'users', userId, 'transactions', id);
    const accDocRef = doc(db, 'users', userId, 'accounts', accountId);
    const accDoc = await t.get(accDocRef);

    if (accDoc.exists()) {
      const accData = accDoc.data();
      const cur = accData.balance || 0;
      const isCashZeroMode = accData.type === 'cash' && cur === 0;

      if (!isCashZeroMode) {
        let reverted = cur;
        if (type === 'expense') reverted += amount;
        else if (type === 'income') reverted -= amount;
        else if (type === 'transfer') reverted += amount;

        t.update(accDocRef, { balance: reverted, updatedAt: new Date().toISOString() });
      }
    }

    if (type === 'transfer' && transferToAccountId) {
      const targetDocRef = doc(db, 'users', userId, 'accounts', transferToAccountId);
      const targetDoc = await t.get(targetDocRef);
      if (targetDoc.exists()) {
        const targetBal = targetDoc.data().balance || 0;
        t.update(targetDocRef, { balance: targetBal - amount, updatedAt: new Date().toISOString() });
      }
    }

    t.delete(txDocRef);
  });
}

/**
 * 批次刪除同一分期群組之所有交易並回補帳戶額度
 */
export async function deleteInstallmentGroup(userId: string, groupId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const txList = LocalStore.get<Transaction[]>('transactions_' + userId, []);
    const matching = txList.filter((t) => t.installment?.groupId === groupId);
    if (matching.length === 0) return;

    const accountId = matching[0].accountId;
    const totalAmount = matching.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    LocalStore.set(
      'transactions_' + userId,
      txList.filter((t) => t.installment?.groupId !== groupId)
    );

    const accList = LocalStore.get<Account[]>('accounts_' + userId, []);
    const sourceAcc = accList.find((a) => a.id === accountId);
    if (sourceAcc) {
      sourceAcc.balance += totalAmount;
    }
    LocalStore.set('accounts_' + userId, accList);
    return;
  }

  // Firebase Firestore: 查詢同 groupId 的所有文檔
  const q = query(
    collection(db, 'users', userId, 'transactions'),
    where('installment.groupId', '==', groupId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const docs = snap.docs;
  const firstData = docs[0].data() as Transaction;
  const accountId = firstData.accountId;
  const totalAmount = docs.reduce((sum, d) => sum + ((d.data() as Transaction).amount || 0), 0);

  await runTransaction(db, async (t) => {
    const accDocRef = doc(db, 'users', userId, 'accounts', accountId);
    const accDoc = await t.get(accDocRef);
    if (accDoc.exists()) {
      const currentBalance = accDoc.data().balance || 0;
      t.update(accDocRef, {
        balance: currentBalance + totalAmount,
        updatedAt: new Date().toISOString()
      });
    }

    for (const d of docs) {
      t.delete(d.ref);
    }
  });
}

/* ==========================================================================
   預算 (Budgets) 服務
   ========================================================================== */

export function subscribeBudgets(userId: string, callback: (budgets: Budget[]) => void): () => void {
  if (!isFirebaseConfigured) {
    const load = () => {
      const data = LocalStore.get<Budget[]>('budgets_' + userId, []);
      callback(data);
    };
    load();
    window.addEventListener('demo_storage_update', load);
    return () => window.removeEventListener('demo_storage_update', load);
  }

  const q = collection(db, 'users', userId, 'budgets');
  return onSnapshot(
    q,
    (snapshot) => {
      const budgets = snapshot.docs.map(d => d.data() as Budget);
      callback(budgets);
    },
    (error) => {
      console.warn('[Firestore] subscribeBudgets error:', error);
      callback([]);
    }
  );
}

export async function saveBudget(budget: Budget): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Budget[]>('budgets_' + budget.userId, []);
    const idx = list.findIndex(b => b.id === budget.id);
    if (idx >= 0) list[idx] = budget;
    else list.push(budget);
    LocalStore.set('budgets_' + budget.userId, list);
    return;
  }

  const ref = doc(db, 'users', budget.userId, 'budgets', budget.id);
  await setDoc(ref, cleanUndefined(budget), { merge: true });
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Budget[]>('budgets_' + userId, []);
    LocalStore.set('budgets_' + userId, list.filter(b => b.id !== budgetId));
    return;
  }
  await deleteDoc(doc(db, 'users', userId, 'budgets', budgetId));
}

/* ==========================================================================
   股票持倉 (Stock Holdings & Trades) 服務
   ========================================================================== */

export function subscribeStockHoldings(userId: string, callback: (holdings: StockHolding[]) => void): () => void {
  if (!isFirebaseConfigured) {
    const load = () => {
      const data = LocalStore.get<StockHolding[]>('stocks_' + userId, []);
      callback(data);
    };
    load();
    window.addEventListener('demo_storage_update', load);
    return () => window.removeEventListener('demo_storage_update', load);
  }

  const q = collection(db, 'users', userId, 'stockHoldings');
  return onSnapshot(
    q,
    (snapshot) => {
      const holdings = snapshot.docs.map(d => d.data() as StockHolding);
      callback(holdings);
    },
    (error) => {
      console.warn('[Firestore] subscribeStockHoldings error:', error);
      callback([]);
    }
  );
}

export async function saveStockHolding(holding: StockHolding): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<StockHolding[]>('stocks_' + holding.userId, []);
    const idx = list.findIndex(s => s.id === holding.id);
    if (idx >= 0) list[idx] = holding;
    else list.push(holding);
    LocalStore.set('stocks_' + holding.userId, list);
    return;
  }

  const ref = doc(db, 'users', holding.userId, 'stockHoldings', holding.id);
  await setDoc(ref, cleanUndefined(holding), { merge: true });
}

export async function deleteStockHolding(userId: string, holdingId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<StockHolding[]>('stocks_' + userId, []);
    LocalStore.set('stocks_' + userId, list.filter(s => s.id !== holdingId));
    return;
  }
  await deleteDoc(doc(db, 'users', userId, 'stockHoldings', holdingId));
}

/* ==========================================================================
   信用卡定期訂閱 (Subscriptions) 服務
   ========================================================================== */

export function subscribeSubscriptions(userId: string, callback: (subscriptions: Subscription[]) => void): () => void {
  if (!isFirebaseConfigured) {
    const load = () => {
      const data = LocalStore.get<Subscription[]>('subscriptions_' + userId, []);
      callback(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    load();
    window.addEventListener('demo_storage_update', load);
    return () => window.removeEventListener('demo_storage_update', load);
  }

  const q = query(collection(db, 'users', userId, 'subscriptions'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const subs = snapshot.docs.map(d => d.data() as Subscription);
      callback(subs);
    },
    (error) => {
      console.warn('[Firestore] subscribeSubscriptions error:', error);
      callback([]);
    }
  );
}

export async function saveSubscription(subscription: Subscription): Promise<void> {
  const clean = cleanUndefined(subscription);
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Subscription[]>('subscriptions_' + subscription.userId, []);
    const idx = list.findIndex(s => s.id === subscription.id);
    if (idx >= 0) list[idx] = clean;
    else list.push(clean);
    LocalStore.set('subscriptions_' + subscription.userId, list);
    return;
  }

  const ref = doc(db, 'users', subscription.userId, 'subscriptions', subscription.id);
  await setDoc(ref, clean, { merge: true });
}

export async function cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
  const now = new Date().toISOString();
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Subscription[]>('subscriptions_' + userId, []);
    const idx = list.findIndex(s => s.id === subscriptionId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        status: 'cancelled',
        autoRecord: false,
        cancelledAt: now,
        updatedAt: now
      };
      LocalStore.set('subscriptions_' + userId, list);
    }
    return;
  }

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

  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Subscription[]>('subscriptions_' + userId, []);
    const idx = list.findIndex(s => s.id === subscriptionId);
    if (idx >= 0) {
      const sub = list[idx];
      let nextDate = sub.nextBillingDate;
      if (nextDate <= todayStr) {
        nextDate = calculateNextBillingDate(todayStr, sub.period, sub.billingCycleDay);
      }
      list[idx] = {
        ...sub,
        status: 'active',
        autoRecord: true,
        nextBillingDate: nextDate,
        cancelledAt: undefined,
        updatedAt: now
      };
      LocalStore.set('subscriptions_' + userId, list);
    }
    return;
  }

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
  if (!isFirebaseConfigured) {
    const list = LocalStore.get<Subscription[]>('subscriptions_' + userId, []);
    LocalStore.set('subscriptions_' + userId, list.filter(s => s.id !== subscriptionId));
    return;
  }

  await deleteDoc(doc(db, 'users', userId, 'subscriptions', subscriptionId));
}

/**
 * 檢查並自動執行已到期的信用卡定期訂閱扣款紀錄
 * - 能在指定時間自動於背景紀錄支出
 * - 一旦取消訂閱 (status !== 'active' 或 autoRecord === false) 絕不重複執行
 */
export async function processDueSubscriptions(userId: string): Promise<Transaction[]> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();
  const generatedTxs: Transaction[] = [];

  let activeSubs: Subscription[] = [];

  if (!isFirebaseConfigured) {
    const allSubs = LocalStore.get<Subscription[]>('subscriptions_' + userId, []);
    activeSubs = allSubs.filter(s => s.status === 'active' && s.autoRecord !== false);
  } else {
    try {
      const q = query(
        collection(db, 'users', userId, 'subscriptions'),
        where('status', '==', 'active'),
        where('autoRecord', '==', true)
      );
      const snap = await getDocs(q);
      activeSubs = snap.docs.map(d => d.data() as Subscription);
    } catch (err) {
      console.warn('[Firestore] 查詢到期訂閱失敗:', err);
      return [];
    }
  }

  for (const sub of activeSubs) {
    let currentNextBilling = sub.nextBillingDate;
    let loopCount = 0;
    const maxLoops = 12; // 防禦上限：最多自動補記 12 個週期

    while (currentNextBilling <= todayStr && loopCount < maxLoops) {
      // 避免同一天重複紀錄同一筆訂閱
      if (sub.lastRecordedDate === currentNextBilling) {
        currentNextBilling = calculateNextBillingDate(currentNextBilling, sub.period, sub.billingCycleDay);
        loopCount++;
        continue;
      }

      const txId = 'tx_sub_' + uuidv4().slice(0, 10);
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

        sub.lastRecordedDate = currentNextBilling;
        currentNextBilling = calculateNextBillingDate(currentNextBilling, sub.period, sub.billingCycleDay);
        sub.nextBillingDate = currentNextBilling;
        sub.updatedAt = now;
        await saveSubscription(sub);
      } catch (err) {
        console.error(`[Firestore] 自動扣款紀錄失敗 (訂閱 ID: ${sub.id}):`, err);
        break;
      }

      loopCount++;
    }
  }

  return generatedTxs;
}

