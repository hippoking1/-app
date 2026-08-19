import { useState, useEffect, useCallback } from 'react';
import { StockQuote, StockSearchResult, StockMarket, StockHolding } from '@/types';
import { fetchStockQuote, searchStocks, fetchBatchStockQuotes } from '@/services/gas';
import { saveStockHolding } from '@/services/firestore';

/**
 * 股票即時報價 Hook (單檔)
 */
export function useStockQuote(symbol?: string, market: StockMarket = 'TW') {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockQuote(symbol, market);
      setQuote(data);
    } catch (err: any) {
      setError(err.message || '無法取得報價');
    } finally {
      setLoading(false);
    }
  }, [symbol, market]);

  useEffect(() => {
    if (symbol) {
      refresh();
    }
  }, [symbol, refresh]);

  return { quote, loading, error, refresh };
}

/**
 * 股票防抖搜尋 Hook
 */
export function useStockSearch() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchStocks(trimmed);
        setResults(data);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [keyword]);

  return { keyword, setKeyword, results, loading };
}

/**
 * 自動更新所有持倉股票的最新報價並回寫 Firestore
 */
export function useBatchUpdateHoldings(holdings: StockHolding[] = []) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateAllPrices = useCallback(async () => {
    const safeHoldings = Array.isArray(holdings) ? holdings : [];
    if (safeHoldings.length === 0 || isUpdating) return;

    setIsUpdating(true);
    try {
      const queryItems = safeHoldings.map((h) => ({
        symbol: h.symbol,
        market: h.market || 'TW'
      }));

      const batchQuotes = await fetchBatchStockQuotes(queryItems);

      if (batchQuotes && typeof batchQuotes === 'object') {
        for (const holding of safeHoldings) {
          const symKey = holding.symbol.toUpperCase();
          const altKey = symKey.replace('.TW', '').replace('.TWO', '');
          const quote = batchQuotes[symKey] || batchQuotes[altKey];

          if (quote && quote.currentPrice > 0) {
            await saveStockHolding({
              ...holding,
              currentPrice: quote.currentPrice,
              previousClose: quote.previousClose || holding.previousClose,
              change: quote.change || 0,
              changePercent: quote.changePercent || 0,
              lastPriceUpdate: quote.updatedAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.error('批次更新持倉股價失敗:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [holdings, isUpdating]);

  return { updateAllPrices, isUpdating };
}
