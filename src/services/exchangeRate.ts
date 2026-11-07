/**
 * 智慧記帳 - 多幣別即時匯率與旅行貨幣轉換服務
 */
import { CurrencyInfo } from '@/types';

// 常用出國旅遊與全球主要貨幣清單 (含離線保底基準匯率 1 外幣 = X TWD)
export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'TWD', name: '新台幣', symbol: 'NT$', flag: '🇹🇼', decimals: 0, defaultRateToTWD: 1.0 },
  { code: 'JPY', name: '日圓', symbol: '¥', flag: '🇯🇵', decimals: 0, defaultRateToTWD: 0.215 },
  { code: 'KRW', name: '韓元', symbol: '₩', flag: '🇰🇷', decimals: 0, defaultRateToTWD: 0.024 },
  { code: 'USD', name: '美元', symbol: 'US$', flag: '🇺🇸', decimals: 2, defaultRateToTWD: 32.5 },
  { code: 'EUR', name: '歐元', symbol: '€', flag: '🇪🇺', decimals: 2, defaultRateToTWD: 35.2 },
  { code: 'THB', name: '泰銖', symbol: '฿', flag: '🇹🇭', decimals: 1, defaultRateToTWD: 0.95 },
  { code: 'HKD', name: '港幣', symbol: 'HK$', flag: '🇭🇰', decimals: 2, defaultRateToTWD: 4.17 },
  { code: 'SGD', name: '新加坡幣', symbol: 'S$', flag: '🇸🇬', decimals: 2, defaultRateToTWD: 24.8 },
  { code: 'CNY', name: '人民幣', symbol: '¥', flag: '🇨🇳', decimals: 2, defaultRateToTWD: 4.52 },
  { code: 'VND', name: '越南盾', symbol: '₫', flag: '🇻🇳', decimals: 0, defaultRateToTWD: 0.0013 },
  { code: 'GBP', name: '英鎊', symbol: '£', flag: '🇬🇧', decimals: 2, defaultRateToTWD: 42.1 },
  { code: 'MYR', name: '馬來幣', symbol: 'RM', flag: '🇲🇾', decimals: 2, defaultRateToTWD: 7.35 },
  { code: 'AUD', name: '澳幣', symbol: 'A$', flag: '🇦🇺', decimals: 2, defaultRateToTWD: 21.6 },
  { code: 'CAD', name: '加拿大幣', symbol: 'C$', flag: '🇨🇦', decimals: 2, defaultRateToTWD: 23.8 },
  { code: 'PHP', name: '菲律賓披索', symbol: '₱', flag: '🇵🇭', decimals: 1, defaultRateToTWD: 0.58 },
  { code: 'CHF', name: '瑞士法郎', symbol: 'CHF', flag: '🇨🇭', decimals: 2, defaultRateToTWD: 36.8 },
  { code: 'NZD', name: '紐西蘭幣', symbol: 'NZ$', flag: '🇳🇿', decimals: 2, defaultRateToTWD: 19.8 },
  { code: 'MOP', name: '澳門幣', symbol: 'MOP$', flag: '🇲🇴', decimals: 2, defaultRateToTWD: 4.05 },
  { code: 'IDR', name: '印尼盾', symbol: 'Rp', flag: '🇮🇩', decimals: 0, defaultRateToTWD: 0.0021 },
  { code: 'TRY', name: '土耳其里拉', symbol: '₺', flag: '🇹🇷', decimals: 2, defaultRateToTWD: 0.95 },
  { code: 'INR', name: '印度盧比', symbol: '₹', flag: '🇮🇳', decimals: 1, defaultRateToTWD: 0.38 },
  { code: 'AED', name: '阿聯酋迪拉姆', symbol: 'AED', flag: '🇦🇪', decimals: 2, defaultRateToTWD: 8.85 },
  { code: 'SEK', name: '瑞典克朗', symbol: 'kr', flag: '🇸🇪', decimals: 2, defaultRateToTWD: 3.12 },
  { code: 'NOK', name: '挪威克朗', symbol: 'kr', flag: '🇳🇴', decimals: 2, defaultRateToTWD: 3.05 },
  { code: 'DKK', name: '丹麥克朗', symbol: 'kr', flag: '🇩🇰', decimals: 2, defaultRateToTWD: 4.72 },
  { code: 'MXN', name: '墨西哥披索', symbol: 'Mex$', flag: '🇲🇽', decimals: 2, defaultRateToTWD: 1.62 },
  { code: 'BRL', name: '巴西雷亞爾', symbol: 'R$', flag: '🇧🇷', decimals: 2, defaultRateToTWD: 5.65 },
  { code: 'ZAR', name: '南非蘭特', symbol: 'R', flag: '🇿🇦', decimals: 2, defaultRateToTWD: 1.82 }
];

export const DEFAULT_PINNED_CURRENCIES: string[] = ['JPY', 'KRW', 'USD', 'EUR', 'THB', 'HKD'];

const STORAGE_KEY_PINNED = 'smart_user_pinned_currencies_v1';
let memoryPinnedStore: string[] | null = null;

/**
 * 取得使用者自訂釘選的快捷貨幣代碼清單
 */
export function getUserPinnedCurrencies(includeTWD = false): string[] {
  let list = [...DEFAULT_PINNED_CURRENCIES];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_PINNED);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed.map((c: string) => String(c).toUpperCase());
        }
      }
    } else if (memoryPinnedStore) {
      list = [...memoryPinnedStore];
    }
  } catch (e) {
    console.warn('[FX] 讀取使用者釘選貨幣失敗:', e);
  }

  if (includeTWD && !list.includes('TWD')) {
    list.unshift('TWD');
  } else if (!includeTWD) {
    list = list.filter((c) => c !== 'TWD');
  }

  return list;
}

/**
 * 儲存使用者自訂釘選貨幣清單
 */
export function setUserPinnedCurrencies(currencies: string[]): void {
  try {
    const cleanList = Array.from(new Set(currencies.map((c) => c.toUpperCase())));
    memoryPinnedStore = cleanList;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(cleanList));
    }
  } catch (e) {
    console.warn('[FX] 儲存使用者釘選貨幣失敗:', e);
  }
}

/**
 * 新增釘選貨幣
 */
export function addPinnedCurrency(code: string): string[] {
  const current = getUserPinnedCurrencies(false);
  const upper = code.toUpperCase();
  if (upper === 'TWD') return current;
  if (!current.includes(upper)) {
    const next = [...current, upper];
    setUserPinnedCurrencies(next);
    return next;
  }
  return current;
}

/**
 * 移除釘選貨幣
 */
export function removePinnedCurrency(code: string): string[] {
  const current = getUserPinnedCurrencies(false);
  const upper = code.toUpperCase();
  const next = current.filter((c) => c !== upper);
  // 至少保留 1 個外幣
  if (next.length === 0) {
    next.push('JPY');
  }
  setUserPinnedCurrencies(next);
  return next;
}

export const CURRENCY_MAP = new Map<string, CurrencyInfo>(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

export function getCurrencyInfo(code?: string): CurrencyInfo {
  if (!code) return SUPPORTED_CURRENCIES[0];
  const upper = code.toUpperCase();
  return (
    CURRENCY_MAP.get(upper) || {
      code: upper,
      name: upper,
      symbol: upper,
      flag: '🌐',
      decimals: 2,
      defaultRateToTWD: 1.0
    }
  );
}

const STORAGE_KEY_RATES = 'smart_fx_rates_cache_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 小時快取

export interface ExchangeRateCache {
  timestamp: number;
  ratesToTWD: Record<string, number>; // 1 外幣 = X TWD
}

/**
 * 取得快取的即時匯率表 (若無快取則回傳預設保底匯率)
 */
export function getCachedRates(): Record<string, number> {
  const fallback: Record<string, number> = {};
  SUPPORTED_CURRENCIES.forEach((c) => {
    fallback[c.code] = c.defaultRateToTWD;
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATES);
    if (!raw) return fallback;
    const parsed: ExchangeRateCache = JSON.parse(raw);
    if (parsed && parsed.ratesToTWD && typeof parsed.ratesToTWD === 'object') {
      return { ...fallback, ...parsed.ratesToTWD };
    }
  } catch (e) {
    console.warn('[FX] 讀取本機匯率快取失敗:', e);
  }
  return fallback;
}

/**
 * 抓取最新即時匯率 (以台幣 TWD 為基準換算)
 * 支援多重公開 CDN 與 API 備援，並自動更新 LocalStorage 快取
 */
export async function fetchLiveExchangeRates(forceRefresh = false): Promise<Record<string, number>> {
  const currentCached = getCachedRates();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATES);
    if (raw && !forceRefresh) {
      const parsed: ExchangeRateCache = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.ratesToTWD;
      }
    }
  } catch (e) {}

  const newRates: Record<string, number> = { ...currentCached, TWD: 1.0 };

  // 1. 優先嘗試 open.er-api.com
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/TWD', {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        // data.rates["USD"] 代表 1 TWD = X USD
        // 因此 1 USD = 1 / data.rates["USD"] TWD
        for (const [code, rateAgainstTWD] of Object.entries(data.rates)) {
          const num = Number(rateAgainstTWD);
          if (num > 0) {
            newRates[code.toUpperCase()] = parseFloat((1 / num).toFixed(6));
          }
        }
        newRates.TWD = 1.0;
        saveRatesToCache(newRates);
        return newRates;
      }
    }
  } catch (err1) {
    console.warn('[FX] 主要匯率來源 (open.er-api) 連線失敗，嘗試備援來源:', err1);
  }

  // 2. 備援來源 jsdelivr currency-api
  try {
    const res2 = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json',
      { signal: AbortSignal.timeout(6000) }
    );
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.twd) {
        for (const [code, rateAgainstTWD] of Object.entries(data2.twd)) {
          const num = Number(rateAgainstTWD);
          if (num > 0) {
            newRates[code.toUpperCase()] = parseFloat((1 / num).toFixed(6));
          }
        }
        newRates.TWD = 1.0;
        saveRatesToCache(newRates);
        return newRates;
      }
    }
  } catch (err2) {
    console.warn('[FX] 備援匯率來源 (currency-api) 連線失敗:', err2);
  }

  // 若網路皆不通，回傳既有快取或保底匯率
  return currentCached;
}

function saveRatesToCache(rates: Record<string, number>) {
  try {
    const cacheObj: ExchangeRateCache = {
      timestamp: Date.now(),
      ratesToTWD: rates
    };
    localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(cacheObj));
  } catch (e) {
    console.warn('[FX] 寫入匯率快取失敗:', e);
  }
}

/**
 * 取得指定外幣的匯率 (1 外幣 = X TWD)
 */
export function getExchangeRateForCurrency(
  currencyCode: string,
  rates?: Record<string, number>
): number {
  const upper = (currencyCode || 'TWD').toUpperCase();
  if (upper === 'TWD') return 1.0;

  if (rates && rates[upper]) {
    return rates[upper];
  }

  const cached = getCachedRates();
  if (cached[upper]) {
    return cached[upper];
  }

  const def = getCurrencyInfo(upper);
  return def.defaultRateToTWD;
}

/**
 * 外幣金額換算為台幣 (支援海外刷卡手續費率加計)
 * @param originalAmount 外幣原幣金額
 * @param exchangeRate 當下匯率 (1 外幣 = X TWD)
 * @param foreignFeeRate 海外手續費百分比 (例如 1.5 代表 1.5%)
 */
export function convertForeignToTWD(
  originalAmount: number,
  exchangeRate: number,
  foreignFeeRate = 0
): {
  baseTWD: number;
  feeTWD: number;
  totalTWD: number;
} {
  const safeAmount = Math.max(0, Number(originalAmount) || 0);
  const safeRate = Math.max(0, Number(exchangeRate) || 1.0);
  const baseTWD = Math.round(safeAmount * safeRate);

  let feeTWD = 0;
  if (foreignFeeRate > 0) {
    feeTWD = Math.round(baseTWD * (foreignFeeRate / 100));
  }

  const totalTWD = baseTWD + feeTWD;
  return { baseTWD, feeTWD, totalTWD };
}

/**
 * 格式化外幣顯示文字 (例如 ¥5,500 JPY 或 US$24.50 USD)
 */
export function formatForeignCurrency(amount: number, currencyCode: string): string {
  const info = getCurrencyInfo(currencyCode);
  const safeAmount = Number(amount) || 0;
  const formattedNumber = safeAmount.toLocaleString('zh-TW', {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals
  });

  return `${info.symbol}${formattedNumber} ${info.code}`;
}

/**
 * 格式化匯率數值 (小數點 4 位，如 0.2145)
 */
export function formatExchangeRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(1);
  if (rate >= 10) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(3);
  return rate.toFixed(4);
}
