import { useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useDataStore, startDataSync } from '@/stores/dataStore';
import { computeBalances, computeTotalNetWorth } from '@/utils/balances';
import { processDueSubscriptions } from '@/services/firestore';
import {
  Account,
  Category,
  Transaction,
  Budget,
  StockHolding,
  Subscription
} from '@/types';

/**
 * 全域資料即時同步 Hook (掛載在 AppShell)
 */
export function useGlobalDataSync() {
  const userId = useAppStore((state) => state.user?.uid);

  useEffect(() => {
    if (!userId) return;
    const stopSync = startDataSync(userId);
    return () => {
      stopSync();
    };
  }, [userId]);
}

/**
 * 取得當前使用者所有帳戶 (含衍生即時餘額)
 */
export function useAccounts() {
  const rawAccounts = useDataStore((state) => state.accounts);
  const transactions = useDataStore((state) => state.transactions);
  const loading = useDataStore((state) => state.loading.accounts);

  const balanceMap = useMemo(() => computeBalances(rawAccounts, transactions), [rawAccounts, transactions]);

  const accounts = useMemo(() => {
    return rawAccounts.map((acc) => ({
      ...acc,
      balance: balanceMap.get(acc.id) ?? acc.balance ?? 0
    }));
  }, [rawAccounts, balanceMap]);

  return { accounts, loading, balanceMap };
}

/**
 * 取得分類列表
 */
export function useCategories(type?: 'expense' | 'income') {
  const allCategories = useDataStore((state) => state.categories);
  const loading = useDataStore((state) => state.loading.categories);

  const categories = useMemo(() => {
    if (type) {
      return allCategories.filter((c) => c.type === type);
    }
    return allCategories;
  }, [allCategories, type]);

  return { categories, loading };
}

/**
 * 取得交易清單 (支援月份或帳戶過濾)
 */
export function useTransactions(options?: { accountId?: string; month?: string }) {
  const allTransactions = useDataStore((state) => state.transactions);
  const loading = useDataStore((state) => state.loading.transactions);

  const accountId = options?.accountId;
  const month = options?.month;

  const transactions = useMemo(() => {
    let filtered = allTransactions;

    if (accountId && accountId !== 'all') {
      filtered = filtered.filter(
        (t) => t.accountId === accountId || t.transferToAccountId === accountId
      );
    }

    if (month) {
      filtered = filtered.filter((t) => t.date && t.date.replace(/\//g, '-').startsWith(month));
    }

    return filtered;
  }, [allTransactions, accountId, month]);

  return { transactions, loading };
}

/**
 * 取得預算設定
 */
export function useBudgets() {
  const budgets = useDataStore((state) => state.budgets);
  const loading = useDataStore((state) => state.loading.budgets);

  return { budgets, loading };
}

/**
 * 取得股票持倉明細
 */
export function useStockHoldings() {
  const holdings = useDataStore((state) => state.holdings);
  const loading = useDataStore((state) => state.loading.holdings);

  return { holdings, loading };
}

/**
 * 計算全域總資產 (帳戶即時餘額 + 股票總市值)
 */
export function useTotalNetWorth(usdRate = 32.5) {
  const rawAccounts = useDataStore((state) => state.accounts);
  const transactions = useDataStore((state) => state.transactions);
  const holdings = useDataStore((state) => state.holdings);

  const balanceMap = useMemo(() => computeBalances(rawAccounts, transactions), [rawAccounts, transactions]);

  return useMemo(() => {
    return computeTotalNetWorth(rawAccounts, holdings, balanceMap, usdRate);
  }, [rawAccounts, holdings, balanceMap, usdRate]);
}

/**
 * 取得信用卡定期訂閱清單
 */
export function useSubscriptions() {
  const subscriptions = useDataStore((state) => state.subscriptions);
  const loading = useDataStore((state) => state.loading.subscriptions);

  return { subscriptions, loading };
}

/**
 * 自動排程檢查器：自動偵測並執行已到期的信用卡定期訂閱扣款
 * 具備視窗焦點回歸、防重複執行、定時輪巡機制，已修復 memory leak 與重複扣款
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
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runProcessor();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. 定時每 30 分鐘背景輪巡檢查
    const timer = setInterval(runProcessor, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(timer);
    };
  }, [userId, addToast]);
}
