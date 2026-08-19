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
  StockTransaction
} from '@/types';
import { generateInitialSeedData } from './seedData';

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

    // 更新帳戶餘額
    const accList = LocalStore.get<Account[]>('accounts_' + userId, []);
    const sourceAcc = accList.find(a => a.id === accountId);
    if (sourceAcc) {
      if (type === 'expense') sourceAcc.balance -= amount;
      else if (type === 'income') sourceAcc.balance += amount;
      else if (type === 'transfer') sourceAcc.balance -= amount;
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
      const currentBalance = accDoc.data().balance || 0;
      let newBalance = currentBalance;
      if (type === 'expense') newBalance -= amount;
      else if (type === 'income') newBalance += amount;
      else if (type === 'transfer') newBalance -= amount;

      t.update(accDocRef, { balance: newBalance, updatedAt: new Date().toISOString() });
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
      if (type === 'expense') sourceAcc.balance += amount;
      else if (type === 'income') sourceAcc.balance -= amount;
      else if (type === 'transfer') sourceAcc.balance += amount;
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
      const cur = accDoc.data().balance || 0;
      let reverted = cur;
      if (type === 'expense') reverted += amount;
      else if (type === 'income') reverted -= amount;
      else if (type === 'transfer') reverted += amount;

      t.update(accDocRef, { balance: reverted, updatedAt: new Date().toISOString() });
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
