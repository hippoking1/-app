import { useState, useEffect } from 'react';
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
  const user = useAppStore((state) => state.user);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // 初始化使用者預設資料
    initializeUserData(user.uid).catch(console.error);

    const unsubscribe = subscribeAccounts(user.uid, (data) => {
      setAccounts(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { accounts, loading };
}

/**
 * 監聽並取得分類列表
 */
export function useCategories(type?: 'expense' | 'income') {
  const user = useAppStore((state) => state.user);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeCategories(user.uid, (data) => {
      if (type) {
        setCategories(data.filter((c) => c.type === type));
      } else {
        setCategories(data);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, type]);

  return { categories, loading };
}

/**
 * 監聽並取得交易清單 (支援月份或帳戶過濾)
 */
export function useTransactions(options?: { accountId?: string; month?: string }) {
  const user = useAppStore((state) => state.user);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeTransactions(user.uid, (data) => {
      let filtered = data;

      if (options?.accountId && options.accountId !== 'all') {
        filtered = filtered.filter(
          (t) => t.accountId === options.accountId || t.transferToAccountId === options.accountId
        );
      }

      if (options?.month) {
        filtered = filtered.filter((t) => t.date.startsWith(options.month!));
      }

      setTransactions(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, options?.accountId, options?.month]);

  return { transactions, loading };
}

/**
 * 監聽並取得預算設定
 */
export function useBudgets() {
  const user = useAppStore((state) => state.user);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeBudgets(user.uid, (data) => {
      setBudgets(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { budgets, loading };
}

/**
 * 監聽並取得股票持倉
 */
export function useStockHoldings() {
  const user = useAppStore((state) => state.user);
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHoldings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeStockHoldings(user.uid, (data) => {
      setHoldings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { holdings, loading };
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
