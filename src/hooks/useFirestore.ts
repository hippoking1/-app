import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  subscribeAccounts,
  subscribeCategories,
  subscribeTransactions,
  subscribeBudgets,
  subscribeStockHoldings,
  subscribeSubscriptions,
  processDueSubscriptions,
  initializeUserData
} from '@/services/firestore';
import {
  Account,
  Category,
  Transaction,
  Budget,
  StockHolding,
  Subscription
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

  // 現金與帳戶資產 (若為純額度模式或負餘額的現金錢包，不扣減淨資產)
  const cashTotal = accounts
    .filter((a) => !a.isArchived)
    .reduce((sum, a) => {
      if (a.type === 'cash' && a.balance <= 0) {
        return sum;
      }
      return sum + (a.balance || 0);
    }, 0);

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

/**
 * 監聽並取得使用者之信用卡定期訂閱清單
 */
export function useSubscriptions() {
  const userId = useAppStore((state) => state.user?.uid);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeSubscriptions(userId, (data) => {
      setSubscriptions(Array.isArray(data) ? data : []);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { subscriptions, loading };
}

/**
 * 自動排程檢查器：自動偵測並執行已到期的信用卡定期訂閱扣款
 * 具備視窗焦點回歸、防重複執行、定時輪巡機制
 */
export function useSubscriptionAutoProcessor() {
  const userId = useAppStore((state) => state.user?.uid);
  const addToast = useAppStore((state) => state.addToast);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const runProcessor = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        const generated = await processDueSubscriptions(userId);
        if (generated.length > 0) {
          const names = generated.map((t) => t.merchant || t.note || '訂閱項目').slice(0, 3).join('、');
          const extra = generated.length > 3 ? ` 等共 ${generated.length} 筆` : '';
          addToast({
            type: 'info',
            message: `✨ 已自動完成 ${generated.length} 筆到期信用卡訂閱扣款紀錄：${names}${extra}`
          });
        }
      } catch (err) {
        console.error('[useSubscriptionAutoProcessor] 檢查失敗:', err);
      } finally {
        isProcessingRef.current = false;
      }
    };

    // 1. 初次載入即檢查
    runProcessor();

    // 2. 視窗切換回前景或可見時檢查
    const handleFocus = () => runProcessor();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        runProcessor();
      }
    });

    // 3. 定時每 30 分鐘背景輪巡檢查
    const timer = setInterval(runProcessor, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(timer);
    };
  }, [userId, addToast]);
}

