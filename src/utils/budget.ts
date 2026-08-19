import { Budget, BudgetStatus, Transaction, Category } from '@/types';
import { format, endOfMonth, parseISO, differenceInDays } from 'date-fns';

/**
 * 計算各項預算在指定月份的使用狀況與超支狀態
 */
export function calculateBudgetStatuses(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  monthStr: string
): BudgetStatus[] {
  const monthTxs = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(monthStr)
  );

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  return budgets.map((budget) => {
    let spent = 0;

    if (!budget.categoryId) {
      // 全域總預算：加總當月所有支出
      spent = monthTxs.reduce((sum, t) => sum + t.amount, 0);
    } else {
      // 特定分類預算
      spent = monthTxs
        .filter((t) => t.categoryId === budget.categoryId)
        .reduce((sum, t) => sum + t.amount, 0);
    }

    const remaining = budget.amount - spent;
    const usageRatio = budget.amount > 0 ? spent / budget.amount : 0;
    const isOverBudget = spent > budget.amount;
    const isWarning = budget.alertEnabled && usageRatio >= (budget.alertThreshold || 0.8) && !isOverBudget;

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
    return { remainingDays: 0, dailyAllowance: 0 };
  }

  const endDay = endOfMonth(now);
  const remainingDays = Math.max(1, differenceInDays(endDay, now) + 1);
  const remainingBudget = Math.max(0, totalBudget - totalSpent);
  const dailyAllowance = Math.floor(remainingBudget / remainingDays);

  return {
    remainingDays,
    dailyAllowance,
    remainingBudget
  };
}
