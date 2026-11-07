import { describe, it, expect } from 'vitest';
import {
  convertForeignToTWD,
  getCurrencyInfo,
  formatForeignCurrency,
  formatExchangeRate,
  SUPPORTED_CURRENCIES,
  getUserPinnedCurrencies,
  setUserPinnedCurrencies,
  addPinnedCurrency,
  removePinnedCurrency,
  DEFAULT_PINNED_CURRENCIES
} from '../src/services/exchangeRate';

describe('多幣別即時匯率與旅行貨幣轉換測試', () => {
  it('正確取得支援貨幣與資訊', () => {
    const jpy = getCurrencyInfo('JPY');
    expect(jpy.code).toBe('JPY');
    expect(jpy.symbol).toBe('¥');
    expect(jpy.decimals).toBe(0);

    const usd = getCurrencyInfo('USD');
    expect(usd.code).toBe('USD');
    expect(usd.symbol).toBe('US$');
    expect(usd.decimals).toBe(2);

    // 未知貨幣安全 fallback
    const unknown = getCurrencyInfo('XYZ');
    expect(unknown.code).toBe('XYZ');
    expect(unknown.flag).toBe('🌐');
  });

  it('支援常見旅遊貨幣清單', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toContain('TWD');
    expect(codes).toContain('JPY');
    expect(codes).toContain('KRW');
    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');
    expect(codes).toContain('THB');
  });

  it('外幣換算為台幣 (無海外手續費)', () => {
    // 5000 日圓，匯率 0.2145
    // 5000 * 0.2145 = 1072.5 => Math.round = 1073
    const res = convertForeignToTWD(5000, 0.2145, 0);
    expect(res.baseTWD).toBe(1073);
    expect(res.feeTWD).toBe(0);
    expect(res.totalTWD).toBe(1073);
  });

  it('外幣換算為台幣 (含 1.5% 海外刷卡手續費)', () => {
    // 100 美元，匯率 32.5
    // base = 3250
    // fee = 3250 * 0.015 = 48.75 => Math.round = 49
    // total = 3250 + 49 = 3299
    const res = convertForeignToTWD(100, 32.5, 1.5);
    expect(res.baseTWD).toBe(3250);
    expect(res.feeTWD).toBe(49);
    expect(res.totalTWD).toBe(3299);
  });

  it('極值與 0 金額安全處理', () => {
    const res = convertForeignToTWD(0, 0.215, 1.5);
    expect(res.baseTWD).toBe(0);
    expect(res.feeTWD).toBe(0);
    expect(res.totalTWD).toBe(0);

    const neg = convertForeignToTWD(-500, 0.215, 1.5);
    expect(neg.totalTWD).toBe(0);
  });

  it('格式化外幣顯示文字', () => {
    expect(formatForeignCurrency(5000, 'JPY')).toBe('¥5,000 JPY');
    expect(formatForeignCurrency(24.5, 'USD')).toBe('US$24.50 USD');
  });

  it('格式化匯率小數位數', () => {
    expect(formatExchangeRate(0.2145)).toBe('0.2145');
    expect(formatExchangeRate(32.5)).toBe('32.50');
    expect(formatExchangeRate(120.5)).toBe('120.5');
  });

  it('使用者自由增刪釘選貨幣測試', () => {
    setUserPinnedCurrencies(DEFAULT_PINNED_CURRENCIES);
    const defaults = getUserPinnedCurrencies(false);
    expect(defaults).toEqual(DEFAULT_PINNED_CURRENCIES);

    // 新增 CHF (瑞士法郎)
    const afterAdd = addPinnedCurrency('CHF');
    expect(afterAdd).toContain('CHF');
    expect(getUserPinnedCurrencies(false)).toContain('CHF');

    // 移除 HKD
    const afterRemove = removePinnedCurrency('HKD');
    expect(afterRemove).not.toContain('HKD');
    expect(getUserPinnedCurrencies(false)).not.toContain('HKD');
  });
});
