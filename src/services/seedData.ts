import { Category, Account } from '@/types';

/**
 * 系統預設分類資料 (具固定確定性 ID，徹底防止重複寫入)
 */
export const DEFAULT_CATEGORIES: Array<Omit<Category, 'userId'>> = [
  // 支出分類
  { id: 'cat_expense_food', name: '餐飲美食', icon: 'Utensils', color: '#f43f5e', type: 'expense', sortOrder: 1, isDefault: true },
  { id: 'cat_expense_transport', name: '交通運輸', icon: 'Car', color: '#0ea5e9', type: 'expense', sortOrder: 2, isDefault: true },
  { id: 'cat_expense_shopping', name: '日常購物', icon: 'ShoppingBag', color: '#ec4899', type: 'expense', sortOrder: 3, isDefault: true },
  { id: 'cat_expense_entertainment', name: '休閒娛樂', icon: 'Gamepad2', color: '#8b5cf6', type: 'expense', sortOrder: 4, isDefault: true },
  { id: 'cat_expense_home', name: '居家生活', icon: 'Home', color: '#10b981', type: 'expense', sortOrder: 5, isDefault: true },
  { id: 'cat_expense_medical', name: '醫療保健', icon: 'HeartPulse', color: '#ef4444', type: 'expense', sortOrder: 6, isDefault: true },
  { id: 'cat_expense_education', name: '學習進修', icon: 'GraduationCap', color: '#f59e0b', type: 'expense', sortOrder: 7, isDefault: true },
  { id: 'cat_expense_investment', name: '投資理財', icon: 'TrendingUp', color: '#6366f1', type: 'expense', sortOrder: 8, isDefault: true },
  { id: 'cat_expense_others', name: '其他支出', icon: 'MoreHorizontal', color: '#64748b', type: 'expense', sortOrder: 9, isDefault: true },
  
  // 收入分類
  { id: 'cat_income_salary', name: '薪資收入', icon: 'Briefcase', color: '#10b981', type: 'income', sortOrder: 1, isDefault: true },
  { id: 'cat_income_bonus', name: '獎金分紅', icon: 'Award', color: '#059669', type: 'income', sortOrder: 2, isDefault: true },
  { id: 'cat_income_investment', name: '投資獲利', icon: 'LineChart', color: '#6366f1', type: 'income', sortOrder: 3, isDefault: true },
  { id: 'cat_income_sidejob', name: '副業兼職', icon: 'Laptop', color: '#0ea5e9', type: 'income', sortOrder: 4, isDefault: true },
  { id: 'cat_income_others', name: '其他收入', icon: 'PiggyBank', color: '#8b5cf6', type: 'income', sortOrder: 5, isDefault: true }
];

/**
 * 系統預設帳戶資料 (具固定確定性 ID)
 */
export const DEFAULT_ACCOUNTS: Array<Omit<Account, 'userId' | 'createdAt' | 'updatedAt'>> = [
  {
    id: 'acc_default_cash',
    name: '現金錢包',
    type: 'cash',
    icon: 'Wallet',
    color: '#10b981',
    balance: 0,
    currency: 'TWD',
    isArchived: false,
    sortOrder: 1
  },
  {
    id: 'acc_default_bank',
    name: '銀行帳戶',
    type: 'bank',
    icon: 'Building2',
    color: '#0ea5e9',
    balance: 0,
    currency: 'TWD',
    isArchived: false,
    sortOrder: 2
  },
  {
    id: 'acc_default_credit',
    name: '常用信用卡',
    type: 'credit_card',
    icon: 'CreditCard',
    color: '#f43f5e',
    balance: 0,
    creditLimit: 50000,
    currency: 'TWD',
    isArchived: false,
    sortOrder: 3
  }
];

/**
 * 產生使用者初始資料
 */
export function generateInitialSeedData(userId: string) {
  const now = new Date().toISOString();
  
  const accounts: Account[] = DEFAULT_ACCOUNTS.map((acc) => ({
    ...acc,
    userId,
    createdAt: now,
    updatedAt: now
  }));

  const categories: Category[] = DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    userId
  }));

  return { accounts, categories };
}
