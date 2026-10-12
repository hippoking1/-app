import { Account, Transaction, StockHolding } from '@/types';

/**
 * 衍生計算所有帳戶即時餘額
 * 依據 account.openingBalance (或初始 balance) + 歷史交易淨影響推導出
 * 彻底消除手動維護 balance 欄位容易發生的 race condition 與負數覆蓋 bug
 */
export function computeBalances(
  accounts: Account[] = [],
  transactions: Transaction[] = []
): Map<string, number> {
  const balanceMap = new Map<string, number>();

  // 1. 初始化各帳戶之基準餘額
  for (const acc of accounts) {
    if (!acc || !acc.id) continue;
    if (acc.trackBalance === false || (acc.type === 'cash' && acc.balance === 0 && acc.trackBalance === undefined)) {
      // 純額度模式不追蹤餘額
      balanceMap.set(acc.id, 0);
    } else {
      const base = acc.openingBalance !== undefined ? acc.openingBalance : (acc.balance || 0);
      balanceMap.set(acc.id, base);
    }
  }

  // 2. 累加所有交易對帳戶的影響
  for (const tx of transactions) {
    if (!tx) continue;
    const { type, amount, accountId, transferToAccountId } = tx;
    const numAmount = Number(amount) || 0;

    const sourceAcc = accounts.find((a) => a.id === accountId);
    if (sourceAcc && (sourceAcc.trackBalance === false || (sourceAcc.type === 'cash' && sourceAcc.balance === 0 && sourceAcc.trackBalance === undefined))) {
      // 純額度模式來源帳戶不扣減餘額
    } else if (accountId && balanceMap.has(accountId)) {
      const current = balanceMap.get(accountId)!;
      if (type === 'expense' || type === 'transfer') {
        balanceMap.set(accountId, current - numAmount);
      } else if (type === 'income') {
        balanceMap.set(accountId, current + numAmount);
      }
    }

    // 轉帳入款
    if (type === 'transfer' && transferToAccountId && balanceMap.has(transferToAccountId)) {
      const targetAcc = accounts.find((a) => a.id === transferToAccountId);
      if (targetAcc && (targetAcc.trackBalance === false || (targetAcc.type === 'cash' && targetAcc.balance === 0 && targetAcc.trackBalance === undefined))) {
        // 純額度模式目標帳戶不增加餘額
      } else {
        const currentTarget = balanceMap.get(transferToAccountId)!;
        balanceMap.set(transferToAccountId, currentTarget + numAmount);
      }
    }
  }

  return balanceMap;
}

/**
 * 衍生計算總淨資產 (現金與各帳戶資產 + 股票總市值)
 */
export function computeTotalNetWorth(
  accounts: Account[] = [],
  holdings: StockHolding[] = [],
  balanceMap?: Map<string, number>,
  usdRate = 32.5
) {
  const actualBalanceMap = balanceMap || computeBalances(accounts, []);

  // 現金與帳戶資產
  const cashTotal = accounts
    .filter((a) => !a.isArchived)
    .reduce((sum, a) => {
      if (a.trackBalance === false || (a.type === 'cash' && a.balance <= 0 && a.trackBalance === undefined)) {
        return sum;
      }
      const b = actualBalanceMap.get(a.id) ?? a.balance ?? 0;
      return sum + b;
    }, 0);

  // 股票市值 (台幣 1:1, 美元換算)
  const stockTotalTWD = holdings.reduce((sum, h) => {
    const rate = h.market === 'US' || h.currency === 'USD' ? usdRate : 1;
    const value = (h.shares || 0) * (h.currentPrice || h.avgCost || 0);
    return sum + value * rate;
  }, 0);

  return {
    totalNetWorth: cashTotal + stockTotalTWD,
    cashTotal,
    stockTotalTWD
  };
}
