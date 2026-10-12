import { create } from 'zustand';
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Account,
  Category,
  Transaction,
  Budget,
  StockHolding,
  Subscription
} from '@/types';
import { computeBalances, computeTotalNetWorth } from '@/utils/balances';
import { initializeUserData } from '@/services/firestore';

interface DataState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  holdings: StockHolding[];
  subscriptions: Subscription[];
  
  loading: {
    accounts: boolean;
    categories: boolean;
    transactions: boolean;
    budgets: boolean;
    holdings: boolean;
    subscriptions: boolean;
  };

  setAccounts: (accounts: Account[]) => void;
  setCategories: (categories: Category[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setBudgets: (budgets: Budget[]) => void;
  setHoldings: (holdings: StockHolding[]) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  setLoading: (key: keyof DataState['loading'], val: boolean) => void;
}

export const useDataStore = create<DataState>((set) => ({
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  holdings: [],
  subscriptions: [],

  loading: {
    accounts: true,
    categories: true,
    transactions: true,
    budgets: true,
    holdings: true,
    subscriptions: true
  },

  setAccounts: (accounts) => set({ accounts, loading: { ...useDataStore.getState().loading, accounts: false } }),
  setCategories: (categories) => set({ categories, loading: { ...useDataStore.getState().loading, categories: false } }),
  setTransactions: (transactions) => set({ transactions, loading: { ...useDataStore.getState().loading, transactions: false } }),
  setBudgets: (budgets) => set({ budgets, loading: { ...useDataStore.getState().loading, budgets: false } }),
  setHoldings: (holdings) => set({ holdings, loading: { ...useDataStore.getState().loading, holdings: false } }),
  setSubscriptions: (subscriptions) => set({ subscriptions, loading: { ...useDataStore.getState().loading, subscriptions: false } }),
  setLoading: (key, val) => set((state) => ({ loading: { ...state.loading, [key]: val } }))
}));

// 監聽清理器參照
let currentUnsubscribers: Array<() => void> = [];
let currentSyncUserId: string | null = null;

/**
 * 啟動單一全域資料即時同步 (每個 Collection 僅維持 1 個 onSnapshot 監聽)
 */
export function startDataSync(userId: string): () => void {
  if (currentSyncUserId === userId && currentUnsubscribers.length > 0) {
    return () => {};
  }

  // 清理既有訂閱
  stopDataSync();
  currentSyncUserId = userId;

  if (!userId) {
    useDataStore.setState({
      accounts: [],
      categories: [],
      transactions: [],
      budgets: [],
      holdings: [],
      subscriptions: []
    });
    return () => {};
  }

  // 初始化使用者預設資料 (若為首次登入)
  initializeUserData(userId).catch(console.error);

  const {
    setAccounts,
    setCategories,
    setTransactions,
    setBudgets,
    setHoldings,
    setSubscriptions
  } = useDataStore.getState();

  // 1. Accounts
  const qAccounts = query(collection(db, 'users', userId, 'accounts'), orderBy('sortOrder', 'asc'));
  const unsubAccounts = onSnapshot(
    qAccounts,
    (snap) => {
      const accs = snap.docs.map((d) => d.data() as Account);
      setAccounts(accs);
    },
    (err) => console.warn('[DataStore] Accounts sync error:', err)
  );

  // 2. Categories
  const qCategories = query(collection(db, 'users', userId, 'categories'), orderBy('sortOrder', 'asc'));
  const unsubCategories = onSnapshot(
    qCategories,
    (snap) => {
      const cats = snap.docs.map((d) => d.data() as Category);
      setCategories(cats);
    },
    (err) => console.warn('[DataStore] Categories sync error:', err)
  );

  // 3. Transactions
  const qTransactions = query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc'));
  const unsubTransactions = onSnapshot(
    qTransactions,
    (snap) => {
      const txs = snap.docs.map((d) => d.data() as Transaction);
      setTransactions(txs);
    },
    (err) => console.warn('[DataStore] Transactions sync error:', err)
  );

  // 4. Budgets
  const qBudgets = collection(db, 'users', userId, 'budgets');
  const unsubBudgets = onSnapshot(
    qBudgets,
    (snap) => {
      const budgets = snap.docs.map((d) => d.data() as Budget);
      setBudgets(budgets);
    },
    (err) => console.warn('[DataStore] Budgets sync error:', err)
  );

  // 5. Stock Holdings
  const qHoldings = collection(db, 'users', userId, 'stockHoldings');
  const unsubHoldings = onSnapshot(
    qHoldings,
    (snap) => {
      const holdings = snap.docs.map((d) => d.data() as StockHolding);
      setHoldings(holdings);
    },
    (err) => console.warn('[DataStore] Holdings sync error:', err)
  );

  // 6. Subscriptions
  const qSubscriptions = query(collection(db, 'users', userId, 'subscriptions'), orderBy('createdAt', 'desc'));
  const unsubSubscriptions = onSnapshot(
    qSubscriptions,
    (snap) => {
      const subs = snap.docs.map((d) => d.data() as Subscription);
      setSubscriptions(subs);
    },
    (err) => console.warn('[DataStore] Subscriptions sync error:', err)
  );

  currentUnsubscribers = [
    unsubAccounts,
    unsubCategories,
    unsubTransactions,
    unsubBudgets,
    unsubHoldings,
    unsubSubscriptions
  ];

  return stopDataSync;
}

export function stopDataSync() {
  currentUnsubscribers.forEach((u) => {
    try {
      u();
    } catch (e) {}
  });
  currentUnsubscribers = [];
  currentSyncUserId = null;
}
