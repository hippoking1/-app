import { Budget, BudgetStatus, Transaction, Category } from '@/types';
import { format, endOfMonth, parseISO, differenceInDays } from 'date-fns';

/**
 * 安全取得日期月份前綴 (相容 YYYY-MM-DD 與 YYYY/MM/DD)
 */
function getMonthKey(dateStr?: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 7).replace('/', '-');
}

/**
 * 計算各項預算在指定月份的使用狀況與超支狀態
 */
export function calculateBudgetStatuses(
  budgets: Budget[] = [],
  transactions: Transaction[] = [],
  categories: Category[] = [],
  monthStr: string
): BudgetStatus[] {
  const targetMonth = monthStr.replace('/', '-');

  const monthTxs = (transactions || []).filter((t) => {
    if (!t || t.type !== 'expense' || !t.date) return false;
    return getMonthKey(t.date) === targetMonth;
  });

  const categoryMap = new Map<string, Category>();
  (categories || []).forEach((c) => {
    if (c && c.id) categoryMap.set(c.id, c);
  });

  return (budgets || []).map((budget) => {
    let spent = 0;

    if (!budget.categoryId) {
      // 全域總預算：加總當月所有支出
      spent = monthTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } else {
      // 特定分類預算
      spent = monthTxs
        .filter((t) => t.categoryId === budget.categoryId)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    }

    const budgetAmount = Number(budget.amount) || 0;
    const remaining = budgetAmount - spent;
    const usageRatio = budgetAmount > 0 ? spent / budgetAmount : 0;
    const isOverBudget = spent > budgetAmount;
    const isWarning = Boolean(budget.alertEnabled) && usageRatio >= (budget.alertThreshold || 0.8) && !isOverBudget;

    return {
      budget,
      category: budget.categoryId ? categoryMap.get(budget.categoryId) : undefined,
      spent,
      remaining,
      usageRatio,
      isOverBudget,
      isWarning
    };
  });
}

/**
 * 計算當月剩餘天數與每日可用預算金額
 */
export function getDailyAllowance(totalBudget: number, totalSpent: number, monthStr: string) {
  const now = new Date();
  const currentMonthStr = format(now, 'yyyy-MM');
  
  if (monthStr !== currentMonthStr) {
    return { remainingDays: 0, dailyAllowance: 0, remainingBudget: 0 };
  }

  const endDay = endOfMonth(now);
  const remainingDays = Math.max(1, differenceInDays(endDay, now) + 1);
  const remainingBudget = Math.max(0, (totalBudget || 0) - (totalSpent || 0));
  const dailyAllowance = Math.floor(remainingBudget / remainingDays);

  return {
    remainingDays,
    dailyAllowance,
    remainingBudget
  };
}
