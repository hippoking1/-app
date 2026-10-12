import { describe, it, expect } from 'vitest';
import { computeBalances, computeTotalNetWorth } from '../src/utils/balances';
import { Account, Transaction, StockHolding } from '../src/types';

describe('computeBalances', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc_cash',
      userId: 'u1',
      name: '現金錢包',
      type: 'cash',
      icon: 'Wallet',
      color: '#10b981',
      balance: 1000,
      currency: 'TWD',
      isArchived: false,
      sortOrder: 1,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 'acc_bank',
      userId: 'u1',
      name: '銀行帳戶',
      type: 'bank',
      icon: 'Building2',
      color: '#3b82f6',
      balance: 50000,
      currency: 'TWD',
      isArchived: false,
      sortOrder: 2,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 'acc_credit',
      userId: 'u1',
      name: '信用卡',
      type: 'credit_card',
      icon: 'CreditCard',
      color: '#f43f5e',
      balance: 0,
      currency: 'TWD',
      isArchived: false,
      sortOrder: 3,
      createdAt: '',
      updatedAt: ''
    }
  ];

  it('應正確計算支出、收入與轉帳後的餘額', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        userId: 'u1',
        accountId: 'acc_cash',
        categoryId: 'cat_1',
        type: 'expense',
        amount: 200,
        note: '午餐',
        tags: [],
        date: '2026-10-01',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'tx_2',
        userId: 'u1',
        accountId: 'acc_bank',
        categoryId: 'cat_2',
        type: 'income',
        amount: 10000,
        note: '薪水',
        tags: [],
        date: '2026-10-05',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'tx_3',
        userId: 'u1',
        accountId: 'acc_bank',
        transferToAccountId: 'acc_cash',
        categoryId: '',
        type: 'transfer',
        amount: 3000,
        note: 'ATM 提款',
        tags: [],
        date: '2026-10-06',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const balances = computeBalances(mockAccounts, transactions);

    // 現金: 1000 (初始) - 200 (支出) + 3000 (轉入) = 3800
    expect(balances.get('acc_cash')).toBe(3800);

    // 銀行: 50000 (初始) + 10000 (收入) - 3000 (轉出) = 57000
    expect(balances.get('acc_bank')).toBe(57000);
  });

  it('純額度模式 (trackBalance=false) 餘額應維持 0 不受交易扣減', () => {
    const zeroCashAcc: Account = {
      ...mockAccounts[0],
      trackBalance: false,
      balance: 0
    };

    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        userId: 'u1',
        accountId: zeroCashAcc.id,
        categoryId: 'cat_1',
        type: 'expense',
        amount: 500,
        note: '純額度消費',
        tags: [],
        date: '2026-10-01',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const balances = computeBalances([zeroCashAcc], transactions);
    expect(balances.get(zeroCashAcc.id)).toBe(0);
  });
});

describe('computeTotalNetWorth', () => {
  it('應正確將現金與股票換算成台幣加總', () => {
    const accounts: Account[] = [
      {
        id: 'acc1',
        userId: 'u1',
        name: '銀行',
        type: 'bank',
        icon: '',
        color: '',
        balance: 100000,
        currency: 'TWD',
        isArchived: false,
        sortOrder: 1,
        createdAt: '',
        updatedAt: ''
      }
    ];

    const holdings: StockHolding[] = [
      {
        id: 'stk_1',
        userId: 'u1',
        symbol: '2330.TW',
        code: '2330',
        name: '台積電',
        market: 'TW',
        shares: 100,
        avgCost: 900,
        currentPrice: 1000,
        currency: 'TWD',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'stk_2',
        userId: 'u1',
        symbol: 'AAPL',
        code: 'AAPL',
        name: '蘋果',
        market: 'US',
        shares: 10,
        avgCost: 200,
        currentPrice: 220,
        currency: 'USD',
        createdAt: '',
        updatedAt: ''
      }
    ];

    const netWorth = computeTotalNetWorth(accounts, holdings, undefined, 32.5);

    // 現金: 100,000
    // 台積電: 100 * 1000 = 100,000
    // 美股 AAPL: 10 * 220 * 32.5 = 71,500
    // 總淨資產: 100000 + 100000 + 71500 = 271,500
    expect(netWorth.cashTotal).toBe(100000);
    expect(netWorth.stockTotalTWD).toBe(171500);
    expect(netWorth.totalNetWorth).toBe(271500);
  });
});
