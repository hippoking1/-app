import { describe, it, expect } from 'vitest';
import { getCreditCardCycleDates, calculateCreditCardUsage, calculateCashWalletUsage } from '../src/utils/accountCalculations';
import { Account, Transaction } from '../src/types';

describe('accountCalculations', () => {
  it('getCreditCardCycleDates: 結帳日為 10 號，9/16 應落在 9/11~10/10 週期', () => {
    const refDate = new Date(2026, 8, 16); // 9月16日
    const dates = getCreditCardCycleDates(10, refDate);

    expect(dates.cycleStart).toBe('2026-09-11');
    expect(dates.cycleEnd).toBe('2026-10-10');
    expect(dates.lastClosingDate).toBe('2026-09-10');
  });

  it('getCreditCardCycleDates: 結帳日為 10 號，9/05 應落在 8/11~9/10 週期', () => {
    const refDate = new Date(2026, 8, 5); // 9月5日
    const dates = getCreditCardCycleDates(10, refDate);

    expect(dates.cycleStart).toBe('2026-08-11');
    expect(dates.cycleEnd).toBe('2026-09-10');
    expect(dates.lastClosingDate).toBe('2026-08-10');
  });

  it('calculateCreditCardUsage: 繳納上期卡費不應將本期已刷金額抵扣歸零', () => {
    const cardAcc: Account = {
      id: 'acc_card_1',
      userId: 'u1',
      name: '中信 LINE Pay 卡',
      type: 'credit_card',
      icon: 'CreditCard',
      color: '#00c300',
      balance: -10000,
      creditLimit: 100000,
      billingCycleDay: 10,
      currency: 'TWD',
      isArchived: false,
      sortOrder: 1,
      createdAt: '',
      updatedAt: ''
    };

    const refDate = new Date(2026, 8, 16); // 9/16 (週期 9/11 ~ 10/10)

    const transactions: Transaction[] = [
      // 本期 9/12 刷了 3,000
      {
        id: 'tx_new',
        userId: 'u1',
        accountId: 'acc_card_1',
        categoryId: 'cat_food',
        type: 'expense',
        amount: 3000,
        note: '聚餐',
        tags: [],
        date: '2026-09-12',
        createdAt: '',
        updatedAt: ''
      },
      // 9/15 轉帳繳了 10,000 上期帳單
      {
        id: 'tx_pay',
        userId: 'u1',
        accountId: 'acc_bank',
        transferToAccountId: 'acc_card_1',
        categoryId: '',
        type: 'transfer',
        amount: 10000,
        note: '繳卡費',
        tags: [],
        date: '2026-09-15',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const usage = calculateCreditCardUsage(cardAcc, transactions, refDate);

    // 本期已刷應該精確顯示 3,000，而不是被 10,000 抵消成 0
    expect(usage.usedAmount).toBe(3000);
    // 總信用額度 100,000，可用額度應充裕
    expect(usage.availableLimit).toBeGreaterThan(90000);
  });

  it('calculateCashWalletUsage: 正確計算本月生活支出', () => {
    const cashAcc: Account = {
      id: 'acc_cash',
      userId: 'u1',
      name: '現金錢包',
      type: 'cash',
      icon: 'Wallet',
      color: '',
      balance: 0,
      currency: 'TWD',
      isArchived: false,
      sortOrder: 1,
      createdAt: '',
      updatedAt: ''
    };

    const txs: Transaction[] = [
      {
        id: 't1',
        userId: 'u1',
        accountId: 'acc_cash',
        categoryId: 'cat1',
        type: 'expense',
        amount: 450,
        note: '',
        tags: [],
        date: '2026-10-02',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 't2',
        userId: 'u1',
        accountId: 'acc_cash',
        categoryId: 'cat1',
        type: 'expense',
        amount: 250,
        note: '',
        tags: [],
        date: '2026-09-28', // 上個月
        createdAt: '',
        updatedAt: ''
      }
    ];

    const info = calculateCashWalletUsage(cashAcc, txs, '2026-10');
    expect(info.currentMonthSpent).toBe(450);
  });
});
