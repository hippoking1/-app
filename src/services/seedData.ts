import { Category, Account } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 系統預設分類資料
 */
export const DEFAULT_CATEGORIES: Array<Omit<Category, 'id' | 'userId'>> = [
  // 支出分類
  { name: '餐飲美食', icon: 'Utensils', color: '#f43f5e', type: 'expense', sortOrder: 1, isDefault: true },
  { name: '交通運輸', icon: 'Car', color: '#0ea5e9', type: 'expense', sortOrder: 2, isDefault: true },
  { name: '日常購物', icon: 'ShoppingBag', color: '#ec4899', type: 'expense', sortOrder: 3, isDefault: true },
  { name: '休閒娛樂', icon: 'Gamepad2', color: '#8b5cf6', type: 'expense', sortOrder: 4, isDefault: true },
  { name: '居家生活', icon: 'Home', color: '#10b981', type: 'expense', sortOrder: 5, isDefault: true },
  { name: '醫療保健', icon: 'HeartPulse', color: '#ef4444', type: 'expense', sortOrder: 6, isDefault: true },
  { name: '學習進修', icon: 'GraduationCap', color: '#f59e0b', type: 'expense', sortOrder: 7, isDefault: true },
  { name: '投資理財', icon: 'TrendingUp', color: '#6366f1', type: 'expense', sortOrder: 8, isDefault: true },
  { name: '其他支出', icon: 'MoreHorizontal', color: '#64748b', type: 'expense', sortOrder: 9, isDefault: true },
  
  // 收入分類
  { name: '薪資收入', icon: 'Briefcase', color: '#10b981', type: 'income', sortOrder: 1, isDefault: true },
  { name: '獎金分紅', icon: 'Award', color: '#059669', type: 'income', sortOrder: 2, isDefault: true },
  { name: '投資獲利', icon: 'LineChart', color: '#6366f1', type: 'income', sortOrder: 3, isDefault: true },
  { name: '副業兼職', icon: 'Laptop', color: '#0ea5e9', type: 'income', sortOrder: 4, isDefault: true },
  { name: '其他收入', icon: 'PiggyBank', color: '#8b5cf6', type: 'income', sortOrder: 5, isDefault: true }
];

/**
 * 系統預設帳戶資料
 */
export const DEFAULT_ACCOUNTS: Array<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = [
  {
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
    name: '常用信用卡',
    type: 'credit_card',
    icon: 'CreditCard',
    color: '#f43f5e',
    balance: 0,
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
  
  const accounts: Account[] = DEFAULT_ACCOUNTS.map((acc, index) => ({
    ...acc,
    id: 'acc_' + uuidv4().slice(0, 8),
    userId,
    createdAt: now,
    updatedAt: now
  }));

  const categories: Category[] = DEFAULT_CATEGORIES.map((cat, index) => ({
    ...cat,
    id: 'cat_' + uuidv4().slice(0, 8),
    userId
  }));

  return { accounts, categories };
}
