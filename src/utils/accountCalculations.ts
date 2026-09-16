import { Account, Transaction } from '@/types';
import {
  format,
  subMonths,
  addMonths,
  differenceInDays,
  parseISO
} from 'date-fns';

export interface CreditCardCycleInfo {
  billingCycleDay: number;
  cycleStartDate: string;
  cycleEndDate: string;
  lastClosingDate: string;
  daysRemaining: number;
  usedAmount: number;
  availableLimit: number;
  usagePercent: number;
}

export interface CashWalletUsageInfo {
  isZeroBalanceMode: boolean; // 當餘額為 0 時，不使用餘額功能，只使用已用額度功能
  currentMonthSpent: number;  // 本月已使用額度 (每月 1 號重新計算)
  balance: number;            // 目前餘額
}

/**
 * 計算信用卡帳單週期起訖日
 * 例如結帳日為每月 10 號：
 * - 若今天為 9/16 (在 10 號之後)：本期為 9/11 ~ 10/10，結帳日 9/10 後已自動開啟新一期
 * - 若今天為 9/08 (在 10 號之前)：本期為 8/11 ~ 9/10
 */
export function getCreditCardCycleDates(billingDay: number = 1, refDate: Date = new Date()) {
  const safeBillingDay = Math.max(1, Math.min(31, billingDay || 1));
  const currentDay = refDate.getDate();

  let lastClosingDate: Date;
  let nextClosingDate: Date;

  if (currentDay > safeBillingDay) {
    // 本月結帳日已過：上個結帳日是本月 safeBillingDay
    const maxDayThisMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
    lastClosingDate = new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(safeBillingDay, maxDayThisMonth));

    // 下個結帳日是下個月 safeBillingDay
    const nextMonth = addMonths(refDate, 1);
    const maxDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    nextClosingDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(safeBillingDay, maxDayNextMonth));
  } else {
    // 本月結帳日未到或當天：上個結帳日是上個月 safeBillingDay
    const prevMonth = subMonths(refDate, 1);
    const maxDayPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
    lastClosingDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), Math.min(safeBillingDay, maxDayPrevMonth));

    // 下個結帳日是本月 safeBillingDay
    const maxDayThisMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
    nextClosingDate = new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(safeBillingDay, maxDayThisMonth));
  }

  // 本期起始日：上個結帳日的隔天
  const cycleStartDate = new Date(lastClosingDate);
  cycleStartDate.setDate(cycleStartDate.getDate() + 1);

  return {
    cycleStart: format(cycleStartDate, 'yyyy-MM-dd'),
    cycleEnd: format(nextClosingDate, 'yyyy-MM-dd'),
    lastClosingDate: format(lastClosingDate, 'yyyy-MM-dd')
  };
}

/**
 * 計算信用卡在當前帳單週期的已刷卡未出帳金額 (結帳日後自動歸零重新計算)
 */
export function calculateCreditCardUsage(
  account: Account,
  transactions: Transaction[] = [],
  refDate: Date = new Date()
): CreditCardCycleInfo {
  const billingDay = account.billingCycleDay || 1;
  const { cycleStart, cycleEnd, lastClosingDate } = getCreditCardCycleDates(billingDay, refDate);

  // 篩選出屬於該信用卡且在當前結帳週期內的交易
  const cycleTxs = (transactions || []).filter((t) => {
    if (!t || t.accountId !== account.id || !t.date) return false;
    const d = t.date.replace(/\//g, '-');
    return d >= cycleStart && d <= cycleEnd;
  });

  const expenses = cycleTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const incomes = cycleTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 轉帳繳款入信用卡 (transferToAccountId === account.id)
  const payments = (transactions || [])
    .filter((t) => {
      if (!t || t.type !== 'transfer' || t.transferToAccountId !== account.id || !t.date) return false;
      const d = t.date.replace(/\//g, '-');
      return d >= cycleStart && d <= cycleEnd;
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 判斷是否曾有過交易紀錄；若本期無交易且帳戶餘額為負數且歷史無任何交易，以手動輸入餘額備援
  const hasAnyTx = (transactions || []).some(
    (t) => t && (t.accountId === account.id || t.transferToAccountId === account.id)
  );
  let usedAmount = Math.max(0, expenses - incomes - payments);

  if (!hasAnyTx && account.balance !== 0) {
    usedAmount = Math.abs(account.balance);
  }

  const creditLimit = Number(account.creditLimit) || 0;
  const availableLimit = Math.max(0, creditLimit - usedAmount);
  const usagePercent = creditLimit > 0 ? parseFloat(((usedAmount / creditLimit) * 100).toFixed(1)) : 0;

  return {
    billingCycleDay: billingDay,
    cycleStartDate: cycleStart,
    cycleEndDate: cycleEnd,
    lastClosingDate,
    daysRemaining: Math.max(0, differenceInDays(parseISO(cycleEnd), refDate)),
    usedAmount,
    availableLimit,
    usagePercent
  };
}

/**
 * 計算現金錢包本月已使用額度 (每月 1 號重新計算，餘額為 0 時不使用餘額功能)
 */
export function calculateCashWalletUsage(
  account: Account,
  transactions: Transaction[] = [],
  currentMonthStr?: string
): CashWalletUsageInfo {
  const targetMonth = currentMonthStr || format(new Date(), 'yyyy-MM');
  const isZeroBalanceMode = account.balance === 0;

  // 篩選本月從現金錢包支付的所有支出交易
  const currentMonthSpent = (transactions || [])
    .filter((t) => {
      if (!t || t.accountId !== account.id || t.type !== 'expense' || !t.date) return false;
      const txMonth = t.date.slice(0, 7).replace('/', '-');
      return txMonth === targetMonth;
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  return {
    isZeroBalanceMode,
    currentMonthSpent,
    balance: account.balance
  };
}
