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
 * 判斷是否為投資相關或股票買賣交易
 */
export function isInvestmentTransaction(
  t: Transaction,
  categories?: Category[] | Map<string, Category>
): boolean {
  if (!t) return false;

  // 1. 由股票模組產生的交易記錄 (ID 開頭為 tx_stock_)
  if (t.id && t.id.startsWith('tx_stock_')) {
    return true;
  }

  // 2. 分類 ID 判定 (預設投資理財分類)
  if (t.categoryId === 'cat_expense_investment' || t.categoryId === 'cat_income_investment') {
    return true;
  }

  // 3. 標籤判定 (包含股票、投資、證券、基金、理財)
  if (t.tags && Array.isArray(t.tags)) {
    const hasInvestmentTag = t.tags.some((tag) => {
      if (typeof tag !== 'string') return false;
      const lower = tag.toLowerCase();
      return (
        lower.includes('股票') ||
        lower.includes('投資') ||
        lower.includes('證券') ||
        lower.includes('基金') ||
        lower.includes('理財')
      );
    });
    if (hasInvestmentTag) return true;
  }

  // 4. 分類名稱判定 (使用者自訂的投資相關分類)
  if (categories && t.categoryId) {
    let cat: Category | undefined;
    if (categories instanceof Map) {
      cat = categories.get(t.categoryId);
    } else if (Array.isArray(categories)) {
      cat = categories.find((c) => c && c.id === t.categoryId);
    }
    if (cat && cat.name) {
      const lowerName = cat.name.toLowerCase();
      if (
        lowerName.includes('投資') ||
        lowerName.includes('股票') ||
        lowerName.includes('證券') ||
        lowerName.includes('理財')
      ) {
        return true;
      }
    }
  }

  // 5. 備註關鍵字判定 (例如股票交易相關)
  if (t.note) {
    const lowerNote = t.note.toLowerCase();
    if (
      lowerNote.includes('買進加碼') ||
      lowerNote.includes('初始建倉') ||
      lowerNote.includes('賣出減碼') ||
      lowerNote.includes('現金股利') ||
      lowerNote.includes('股票交易') ||
      lowerNote.includes('證券交割') ||
      lowerNote.includes('申購股票')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 計算各項預算在指定月份的使用狀況與超支狀態 (自動排除投資相關及股票買賣)
 */
export function calculateBudgetStatuses(
  budgets: Budget[] = [],
  transactions: Transaction[] = [],
  categories: Category[] = [],
  monthStr: string
): BudgetStatus[] {
  const targetMonth = monthStr.replace('/', '-');

  const categoryMap = new Map<string, Category>();
  (categories || []).forEach((c) => {
    if (c && c.id) categoryMap.set(c.id, c);
  });

  // 預算管理中，排除投資相關及股票買賣交易
  const monthTxs = (transactions || []).filter((t) => {
    if (!t || t.type !== 'expense' || !t.date) return false;
    if (getMonthKey(t.date) !== targetMonth) return false;
    if (isInvestmentTransaction(t, categoryMap)) return false;
    return true;
  });

  return (budgets || []).map((budget) => {
    let spent = 0;

    if (!budget.categoryId) {
      // 全域總預算：加總當月非投資生活支出
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
