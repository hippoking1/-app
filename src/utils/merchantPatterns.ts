import { Transaction, Category, Account, TransactionType } from '@/types';

export interface MerchantPattern {
  merchant: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  accountId?: string;
  accountName?: string;
  type?: TransactionType;
  commonTag?: string;
  frequency: number;
}

/**
 * 從歷史交易記錄中提取唯一地點/商家清單，並依出現頻率降序排列
 */
export function getUniqueMerchants(transactions: Transaction[] = []): { name: string; count: number }[] {
  const countMap = new Map<string, number>();

  (transactions || []).forEach((t) => {
    if (!t) return;
    const name = t.merchant?.trim();
    if (name) {
      countMap.set(name, (countMap.get(name) || 0) + 1);
    }
  });

  return Array.from(countMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 根據商家/地點名稱，從歷史交易中推算最常使用的消費模式 (分類、帳戶、類型、標籤)
 */
export function getMerchantPattern(
  merchantName: string,
  transactions: Transaction[] = [],
  categories: Category[] = [],
  accounts: Account[] = []
): MerchantPattern | null {
  const query = merchantName.trim().toLowerCase();
  if (!query) return null;

  // 搜尋符合該商家的歷史交易
  // 優先比對 t.merchant，若歷史無 merchant 則比對 t.note 是否包含或相等
  const matchedTxs = (transactions || []).filter((t) => {
    if (!t) return false;
    const m = t.merchant?.trim().toLowerCase();
    if (m && (m === query || m.includes(query) || query.includes(m))) return true;

    // 歷史記錄可能寫在 note
    const n = t.note?.trim().toLowerCase();
    if (n && (n === query || n.startsWith(query))) return true;

    return false;
  });

  if (matchedTxs.length === 0) return null;

  // 統計最高頻率項目
  const catCount = new Map<string, number>();
  const accCount = new Map<string, number>();
  const typeCount = new Map<TransactionType, number>();
  const tagCount = new Map<string, number>();

  matchedTxs.forEach((t) => {
    if (t.categoryId) {
      catCount.set(t.categoryId, (catCount.get(t.categoryId) || 0) + 1);
    }
    if (t.accountId) {
      accCount.set(t.accountId, (accCount.get(t.accountId) || 0) + 1);
    }
    if (t.type) {
      typeCount.set(t.type, (typeCount.get(t.type) || 0) + 1);
    }
    if (t.tags && Array.isArray(t.tags)) {
      t.tags.forEach((tag) => {
        if (tag && tag.trim()) {
          tagCount.set(tag.trim(), (tagCount.get(tag.trim()) || 0) + 1);
        }
      });
    }
  });

  const topCategoryId = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topAccountId = Array.from(accCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topType = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topTag = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  const cat = topCategoryId ? categories.find((c) => c.id === topCategoryId) : undefined;
  const acc = topAccountId ? accounts.find((a) => a.id === topAccountId) : undefined;

  return {
    merchant: merchantName.trim(),
    categoryId: topCategoryId,
    categoryName: cat?.name,
    categoryIcon: cat?.icon,
    categoryColor: cat?.color,
    accountId: topAccountId,
    accountName: acc?.name,
    type: topType,
    commonTag: topTag,
    frequency: matchedTxs.length
  };
}
