import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  subscribeAccounts,
  subscribeCategories,
  subscribeTransactions,
  subscribeBudgets,
  subscribeStockHoldings,
  initializeUserData
} from '@/services/firestore';
import {
  Account,
  Category,
  Transaction,
  Budget,
  StockHolding
} from '@/types';

/**
 * 監聽並取得當前使用者所有帳戶
 */
export function useAccounts() {
  const userId = useAppStore((state) => state.user?.uid);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // 初始化使用者預設資料 (僅在未初始化時執行)
    initializeUserData(userId).catch(console.error);

    const unsubscribe = subscribeAccounts(userId, (data) => {
      // 強制依名稱唯一去重
      const uniqueAccs = Array.from(new Map(data.map((a) => [a.name, a])).values());
      setAccounts(uniqueAccs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]); // 使用穩定字串 userId，杜絕 User 物件引用變更導致的重新載入

  return { accounts, loading };
}

/**
 * 監聽並取得分類列表
 */
export function useCategories(type?: 'expense' | 'income') {
  const userId = useAppStore((state) => state.user?.uid);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeCategories(userId, (data) => {
      // 強制依 (type + name) 唯一去重
      const uniqueCats = Array.from(new Map(data.map((c) => [`${c.type}_${c.name}`, c])).values());
      if (type) {
        setCategories(uniqueCats.filter((c) => c.type === type));
      } else {
        setCategories(uniqueCats);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, type]); // 使用穩定字串 userId

  return { categories, loading };
}

/**
 * 監聽並取得交易清單 (支援月份或帳戶過濾)
 */
export function useTransactions(options?: { accountId?: string; month?: string }) {
  const userId = useAppStore((state) => state.user?.uid);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = options?.accountId;
  const month = options?.month;

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeTransactions(userId, (data) => {
      let filtered = data;

      if (accountId && accountId !== 'all') {
        filtered = filtered.filter(
          (t) => t.accountId === accountId || t.transferToAccountId === accountId
        );
      }

      if (month) {
        filtered = filtered.filter((t) => t.date && t.date.replace(/\//g, '-').startsWith(month));
      }

      setTransactions(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, accountId, month]); // 使用穩定原始型別依賴

  return { transactions, loading };
}

/**
 * 監聽並取得預算設定
 */
export function useBudgets() {
  const userId = useAppStore((state) => state.user?.uid);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeBudgets(userId, (data) => {
      setBudgets(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { budgets, loading };
}

/**
 * 監聽並取得股票持倉
 */
export function useStockHoldings() {
  const userId = useAppStore((state) => state.user?.uid);
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setHoldings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeStockHoldings(userId, (data) => {
      const safeData = Array.isArray(data) ? data : [];
      setHoldings(safeData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { holdings: Array.isArray(holdings) ? holdings : [], loading };
}

/**
 * 計算全域總資產 (帳戶餘額加總 + 股票總市值)
 */
export function useTotalNetWorth() {
  const { accounts } = useAccounts();
  const { holdings } = useStockHoldings();

  // 現金與帳戶資產
  const cashTotal = accounts
    .filter((a) => !a.isArchived)
    .reduce((sum, a) => sum + (a.balance || 0), 0);

  // 股票市值 (台幣 1:1, 美元按 32.5 換算)
  const stockTotalTWD = holdings.reduce((sum, h) => {
    const rate = h.market === 'US' || h.currency === 'USD' ? 32.5 : 1;
    const value = (h.shares || 0) * (h.currentPrice || h.avgCost || 0);
    return sum + value * rate;
  }, 0);

  return {
    totalNetWorth: cashTotal + stockTotalTWD,
    cashTotal,
    stockTotalTWD
  };
}
