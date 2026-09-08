import { Transaction, Category } from '@/types';
import { format, subMonths, addMonths, parseISO, startOfMonth, endOfMonth } from 'date-fns';

function getMonthKey(dateStr?: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 7).replace('/', '-');
}

export type TimeRangePreset = '3m' | '6m' | '12m' | 'ytd' | 'custom';

export interface CategoryTrendItem {
  id: string;
  name: string;
  color: string;
  icon?: string;
  total: number;
}

export interface CategoryTrendMonthData {
  month: string;
  fullMonth: string;
  totalExpense: number;
  [categoryId: string]: string | number;
}

const DEFAULT_CHART_COLORS = [
  '#f43f5e', '#0ea5e9', '#ec4899', '#8b5cf6', '#10b981',
  '#f59e0b', '#6366f1', '#14b8a6', '#f97316', '#64748b'
];

/**
 * 取得指定區間的月份清單 (由舊至新，格式 YYYY-MM)
 */
export function getMonthsInRange(
  preset: TimeRangePreset,
  customStart?: string,
  customEnd?: string
): string[] {
  const now = new Date();
  if (preset === 'custom' && customStart && customEnd) {
    let start = customStart;
    let end = customEnd;
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }
    const result: string[] = [];
    let cur = parseISO(`${start}-01`);
    const endDate = parseISO(`${end}-01`);
    let count = 0;
    while (cur <= endDate && count < 60) {
      result.push(format(cur, 'yyyy-MM'));
      cur = addMonths(cur, 1);
      count++;
    }
    return result.length > 0 ? result : [format(now, 'yyyy-MM')];
  }

  let monthsCount = 6;
  if (preset === '3m') monthsCount = 3;
  else if (preset === '6m') monthsCount = 6;
  else if (preset === '12m') monthsCount = 12;
  else if (preset === 'ytd') {
    monthsCount = Math.max(1, now.getMonth() + 1);
  }

  const months: string[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    months.push(format(subMonths(now, i), 'yyyy-MM'));
  }
  return months;
}

/**
 * 取得指定月份範圍內各支出分類的月度趨勢數據
 */
export function getCategoryMonthlyTrends(
  transactions: Transaction[] = [],
  categories: Category[] = [],
  months: string[] = []
): {
  chartData: CategoryTrendMonthData[];
  activeCategories: CategoryTrendItem[];
} {
  const safeList = transactions || [];
  const monthSet = new Set(months);

  // 1. 建立分類快速查找 Map
  const categoryMap = new Map<string, Category>();
  (categories || []).forEach((c) => {
    if (c && c.id) categoryMap.set(c.id, c);
  });

  // 2. 篩選出時間區間內的所有支出記錄
  const expenseTxs = safeList.filter(
    (t) => t && t.type === 'expense' && t.date && monthSet.has(getMonthKey(t.date))
  );

  // 3. 統計每個分類在整個區間內的累計支出，以排序重要度
  const catTotalMap = new Map<string, number>();
  expenseTxs.forEach((t) => {
    const catId = t.categoryId || 'unknown';
    catTotalMap.set(catId, (catTotalMap.get(catId) || 0) + (Number(t.amount) || 0));
  });

  const activeCategories: CategoryTrendItem[] = Array.from(catTotalMap.entries())
    .map(([catId, total], index) => {
      const cat = categoryMap.get(catId);
      return {
        id: catId,
        name: cat?.name || '其他支出',
        color: cat?.color || DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length],
        icon: cat?.icon,
        total
      };
    })
    .sort((a, b) => b.total - a.total);

  // 4. 判斷是否跨年份，以便決定 X 軸標籤格式
  const years = new Set(months.map((m) => m.slice(0, 4)));
  const isMultiYear = years.size > 1;

  // 5. 組合每月各分類支出數據
  const chartData: CategoryTrendMonthData[] = months.map((month) => {
    const monthTxs = expenseTxs.filter((t) => getMonthKey(t.date) === month);
    let totalExpense = 0;
    const catSpend: Record<string, number> = {};

    activeCategories.forEach((cat) => {
      catSpend[cat.id] = 0;
    });

    monthTxs.forEach((t) => {
      const catId = t.categoryId || 'unknown';
      const amt = Number(t.amount) || 0;
      totalExpense += amt;
      catSpend[catId] = (catSpend[catId] || 0) + amt;
    });

    let displayMonth = month;
    try {
      const d = parseISO(`${month}-01`);
      displayMonth = isMultiYear ? format(d, 'yy/MM') : format(d, 'M月');
    } catch (e) {
      displayMonth = isMultiYear ? month : month.slice(5) + '月';
    }

    return {
      month: displayMonth,
      fullMonth: month,
      totalExpense,
      ...catSpend
    };
  });

  return {
    chartData,
    activeCategories
  };
}

/**
 * 取得月度收支趨勢數據 (預設近 6 個月)
 */
export function getMonthlyTrends(transactions: Transaction[] = [], monthsCount = 6) {
  const now = new Date();
  const months: string[] = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    months.push(format(subMonths(now, i), 'yyyy-MM'));
  }

  const safeList = transactions || [];

  return months.map((month) => {
    const monthTxs = safeList.filter((t) => t && t.date && getMonthKey(t.date) === month);
    const income = monthTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const expense = monthTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    let displayMonth = month;
    try {
      displayMonth = format(parseISO(`${month}-01`), 'M月');
    } catch (e) {
      displayMonth = month.slice(5) + '月';
    }

    return {
      month: displayMonth,
      fullMonth: month,
      income,
      expense,
      net: income - expense
    };
  });
}

/**
 * 取得分類佔比統計 (圓餅圖用)
 */
export function getCategoryBreakdown(
  transactions: Transaction[] = [],
  categories: Category[] = [],
  type: 'expense' | 'income' = 'expense',
  month?: string
) {
  const safeList = transactions || [];
  const targetMonth = month ? month.replace('/', '-') : undefined;

  let filtered = safeList.filter((t) => t && t.type === type);
  if (targetMonth) {
    filtered = filtered.filter((t) => t.date && getMonthKey(t.date) === targetMonth);
  }

  const categoryMap = new Map<string, Category>();
  (categories || []).forEach((c) => {
    if (c && c.id) categoryMap.set(c.id, c);
  });

  const totalAmount = filtered.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const group = new Map<string, number>();

  filtered.forEach((t) => {
    const catId = t.categoryId || 'unknown';
    const current = group.get(catId) || 0;
    group.set(catId, current + (Number(t.amount) || 0));
  });

  const list = Array.from(group.entries())
    .map(([catId, amount]) => {
      const cat = categoryMap.get(catId);
      const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
      return {
        id: catId,
        name: cat?.name || '其他分類',
        icon: cat?.icon || 'Tag',
        color: cat?.color || '#64748b',
        amount,
        percentage: parseFloat(percentage.toFixed(1))
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    items: list,
    totalAmount
  };
}

/**
 * 取得指定月份每日花費柱狀圖數據
 */
export function getDailySpending(transactions: Transaction[] = [], monthStr: string) {
  const targetMonth = monthStr.replace('/', '-');
  let daysInMonth = 30;

  try {
    const monthStart = startOfMonth(parseISO(`${targetMonth}-01`));
    const monthEnd = endOfMonth(monthStart);
    daysInMonth = monthEnd.getDate() || 30;
  } catch (e) {
    daysInMonth = 30;
  }

  const dailyMap = new Map<number, number>();
  for (let d = 1; d <= daysInMonth; d++) {
    dailyMap.set(d, 0);
  }

  (transactions || [])
    .filter((t) => t && t.type === 'expense' && t.date && getMonthKey(t.date) === targetMonth)
    .forEach((t) => {
      const parts = t.date.replace(/\//g, '-').split('-');
      const dayNum = parseInt(parts[2], 10);
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= daysInMonth) {
        const cur = dailyMap.get(dayNum) || 0;
        dailyMap.set(dayNum, cur + (Number(t.amount) || 0));
      }
    });

  const totalExpense = Array.from(dailyMap.values()).reduce((a, b) => a + b, 0);
  const avgDaily = daysInMonth > 0 ? Math.round(totalExpense / daysInMonth) : 0;

  const result = Array.from(dailyMap.entries()).map(([day, amount]) => ({
    day: `${day}日`,
    dayNum: day,
    amount,
    avg: avgDaily
  }));

  return {
    dailyData: result,
    totalExpense,
    avgDaily
  };
}

/**
 * 格式化貨幣數字字串 (加千分位)
 */
export function formatCurrency(amount: number, currency = 'TWD'): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '$0';
  const prefix = currency === 'USD' ? 'US$' : '$';
  return `${prefix}${Math.round(amount).toLocaleString('zh-TW')}`;
}

/**
 * 格式化精確小數位數貨幣 (股票用)
 */
export function formatStockPrice(price: number, currency = 'TWD'): string {
  if (isNaN(price) || price === null || price === undefined) return '0.00';
  const decimals = currency === 'USD' ? 2 : price < 100 ? 2 : 1;
  return price.toLocaleString('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
