/**
 * 智慧記帳 - 全域型別定義
 */

// 使用者帳戶類型
export type AccountType = 'cash' | 'bank' | 'credit_card' | 'e_wallet' | 'investment';

// 交易類型
export type TransactionType = 'expense' | 'income' | 'transfer';

// 預算週期
export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

// 股票市場
export type StockMarket = 'TW' | 'US';

// 股票交易類型
export type StockTradeType = 'buy' | 'sell' | 'dividend_cash' | 'dividend_stock' | 'init';

/**
 * 帳戶介面
 */
export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  balance: number;
  creditLimit?: number; // 信用卡總信用額度 (NT$)
  currency: string;
  isArchived: boolean;
  sortOrder: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分類介面
 */
export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  parentId?: string | null;
  sortOrder: number;
  isDefault?: boolean;
}

/**
 * 交易記錄介面
 */
export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  note: string;
  tags: string[];
  date: string; // YYYY-MM-DD
  transferToAccountId?: string; // 轉帳目標帳戶
  aiGenerated?: string; // AI 產生的原始提示詞
  createdAt: string;
  updatedAt: string;
}

/**
 * 預算介面
 */
export interface Budget {
  id: string;
  userId: string;
  categoryId?: string | null; // 若為 null 則代表全域總預算
  amount: number; // 預算上限金額
  period: BudgetPeriod;
  alertEnabled: boolean; // 是否啟用超支警示
  alertThreshold: number; // 警示百分比 (例如 0.8 代表 80%)
  startDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 預算使用狀態統計
 */
export interface BudgetStatus {
  budget: Budget;
  category?: Category;
  spent: number;
  remaining: number;
  usageRatio: number; // 0.0 ~ 1.0+
  isOverBudget: boolean;
  isWarning: boolean;
}

/**
 * 股票持倉明細
 */
export interface StockHolding {
  id: string;
  userId: string;
  symbol: string; // 例如 2330.TW 或 AAPL
  code: string; // 純代碼例如 2330 或 AAPL
  name: string;
  market: StockMarket;
  shares: number; // 持有總股數
  avgCost: number; // 平均每股成本 (原幣計價)
  currentPrice: number; // 最新股價 (快取)
  previousClose?: number; // 昨收價
  change?: number; // 漲跌金額
  changePercent?: number; // 漲跌幅 %
  lastPriceUpdate?: string; // 報價更新時間
  currency: string; // TWD 或 USD
  createdAt: string;
  updatedAt: string;
}

/**
 * 股票交易明細記錄 (買進、賣出、配息)
 */
export interface StockTransaction {
  id: string;
  userId: string;
  holdingId: string;
  symbol: string;
  type: StockTradeType;
  shares: number;
  price: number;
  fee: number;
  tax: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

/**
 * 股票即時/盤後報價統一結構
 */
export interface StockQuote {
  symbol: string;
  code: string;
  name: string;
  market: StockMarket;
  stockType?: string; // 上市 / 上櫃/興櫃 / 美股
  currency: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
  updatedAt: string;
  error?: string;
  isMock?: boolean;
}

/**
 * 股票搜尋結果項目
 */
export interface StockSearchResult {
  symbol: string;
  code: string;
  name: string;
  market: StockMarket;
  stockType?: string; // 上市 / 上櫃/興櫃 / 美股
  currency: string;
  price: number;
  change?: number;
}

/**
 * AI 解析出來的交易草稿結構
 */
export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  categoryName: string;
  accountName?: string;
  note: string;
  date: string;
  tags?: string[];
  confidence?: number;
}

/**
 * 使用者個人設定與偏好
 */
export interface UserSettings {
  theme: 'dark' | 'light';
  currency: string;
  usdToTwdRate: number; // 美元對台幣參考匯率 (預設 32.5)
  enableBudgetAlert: boolean;
  defaultAccountId?: string;
}
