/**
 * 股票即時/盤後報價服務模組 (Yahoo Finance v8 API + TWSE/TPEx OpenAPI 雙引擎備援)
 */

/**
 * 取得單檔股票報價 (支援台股上市 .TW、上櫃/興櫃 .TWO、美股等)
 * @param {Object} payload { symbol: string, market?: 'TW' | 'US' }
 */
function handleGetStockQuote(payload) {
  const rawSymbol = (payload.symbol || '').trim().toUpperCase();
  if (!rawSymbol) {
    return jsonResponse({ error: '請提供股票代碼 (symbol)' }, 400);
  }

  const cacheKey = 'quote_v3_' + rawSymbol;
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return jsonResponse(JSON.parse(cachedData));
  }

  // 1. 優先使用 Yahoo Finance API
  let quote = fetchYahooFinanceQuote(rawSymbol);

  // 2. 若 Yahoo 無法取得，嘗試 TWSE/TPEx OpenAPI 備援
  if (!quote || quote.error || quote.currentPrice === 0) {
    const isTW = /^\d{4,6}/.test(rawSymbol) || rawSymbol.includes('.TW');
    if (isTW) {
      const backupQuote = fetchTWStockQuote(rawSymbol);
      if (backupQuote && backupQuote.currentPrice > 0) {
        quote = backupQuote;
      }
    }
  }

  if (quote && !quote.error && quote.currentPrice > 0) {
    // 快取 120 秒 (2分鐘)
    try {
      cache.put(cacheKey, JSON.stringify(quote), 120);
    } catch (e) {}
  }

  return jsonResponse(quote);
}

/**
 * 取得批次股票報價
 * @param {Object} payload { items: Array<{ symbol: string, market: string }> }
 */
function handleBatchQuotes(payload) {
  const items = payload.items || [];
  const results = {};

  items.forEach(function(item) {
    const symbol = item.symbol.trim().toUpperCase();
    try {
      const cacheKey = 'quote_v3_' + symbol;
      const cache = CacheService.getScriptCache();
      const cached = cache.get(cacheKey);
      
      if (cached) {
        results[symbol] = JSON.parse(cached);
      } else {
        const quote = fetchYahooFinanceQuote(symbol);
        if (quote && !quote.error && quote.currentPrice > 0) {
          try {
            cache.put(cacheKey, JSON.stringify(quote), 120);
          } catch (e) {}
        }
        results[symbol] = quote;
      }
    } catch (e) {
      results[symbol] = { error: e.message, symbol: symbol };
    }
  });

  return jsonResponse(results);
}

/**
 * 從 Yahoo Finance v8 API 取得即時/盤後行情 (支援上市、上櫃、興櫃 7829.TWO 等)
 */
function fetchYahooFinanceQuote(rawSymbol) {
  const cleanCode = rawSymbol.replace('.TW', '').replace('.TWO', '');
  const isTWCode = /^\d{4,6}$/.test(cleanCode);

  // 候選查詢代碼清單 (針對台股嘗試 .TW 與 .TWO)
  const candidateSymbols = [];
  if (isTWCode) {
    if (rawSymbol.includes('.TWO')) {
      candidateSymbols.push(cleanCode + '.TWO', cleanCode + '.TW');
    } else {
      candidateSymbols.push(cleanCode + '.TW', cleanCode + '.TWO');
    }
  } else {
    candidateSymbols.push(rawSymbol);
  }

  for (let i = 0; i < candidateSymbols.length; i++) {
    const sym = candidateSymbols[i];
    try {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1d';
      const options = {
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      const res = UrlFetchApp.fetch(url, options);
      if (res.getResponseCode() === 200) {
        const json = JSON.parse(res.getContentText());
        const result = json && json.chart && json.chart.result && json.chart.result[0];
        if (result && result.meta) {
          const meta = result.meta;
          const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose || 0;
          const previousClose = meta.chartPreviousClose || currentPrice;
          const change = currentPrice - previousClose;
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
          const market = meta.currency === 'TWD' || sym.endsWith('.TW') || sym.endsWith('.TWO') ? 'TW' : 'US';
          const stockType = sym.endsWith('.TWO') ? '上櫃/興櫃' : sym.endsWith('.TW') ? '上市' : '美股';

          return {
            symbol: sym,
            code: cleanCode,
            name: meta.shortName || meta.longName || cleanCode,
            market: market,
            stockType: stockType,
            currency: meta.currency || (market === 'TW' ? 'TWD' : 'USD'),
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            previousClose: parseFloat(previousClose.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            high: meta.regularMarketDayHigh || currentPrice,
            low: meta.regularMarketDayLow || currentPrice,
            volume: meta.regularMarketVolume || 0,
            updatedAt: new Date().toISOString()
          };
        }
      }
    } catch (err) {
      Logger.log('Yahoo Finance API 查詢失敗 (' + sym + '): ' + err.toString());
    }
  }

  // 若查無報價，返回自訂安全結構，不阻擋建倉
  return {
    symbol: isTWCode ? cleanCode + '.TW' : rawSymbol,
    code: cleanCode,
    name: cleanCode,
    market: isTWCode ? 'TW' : 'US',
    stockType: isTWCode ? '興櫃/台股' : '美股',
    currency: isTWCode ? 'TWD' : 'USD',
    currentPrice: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
    isCustom: true
  };
}

/**
 * 股票即時搜尋 (整合 Yahoo Finance Search API，支援中文名稱與興櫃/台股/美股代碼)
 */
function handleSearchStock(payload) {
  const keyword = (payload.keyword || '').trim();
  if (!keyword) return jsonResponse([]);

  const results = [];
  const upperKw = keyword.toUpperCase();

  // 1. 使用 Yahoo Finance Search API 進行全球/台股全網搜尋
  try {
    const yahooSearchUrl = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(keyword) + '&quotesCount=10&newsCount=0&enableFuzzyQuery=true';
    const res = UrlFetchApp.fetch(yahooSearchUrl, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (res.getResponseCode() === 200) {
      const searchData = JSON.parse(res.getContentText());
      const quotes = searchData.quotes || [];

      quotes.forEach(function(q) {
        if (!q.symbol) return;
        const isTW = q.symbol.endsWith('.TW') || q.symbol.endsWith('.TWO');
        const cleanCode = q.symbol.replace('.TW', '').replace('.TWO', '');
        const stockType = q.symbol.endsWith('.TWO') ? '上櫃/興櫃' : q.symbol.endsWith('.TW') ? '上市' : (q.quoteType || '美股');

        results.push({
          symbol: q.symbol,
          code: cleanCode,
          name: q.shortname || q.longname || cleanCode,
          market: isTW ? 'TW' : 'US',
          stockType: stockType,
          currency: isTW ? 'TWD' : (q.currency || 'USD'),
          price: q.regularMarketPrice || 0,
          change: q.regularMarketChange || 0
        });
      });
    }
  } catch (e) {
    Logger.log('Yahoo 搜尋失敗: ' + e.toString());
  }

  // 2. 若為純數字代碼（例如 7829 或 2330）且 Yahoo 搜尋結果中尚未包含，主動補上 .TW 與 .TWO 候選
  if (/^\d{4,6}$/.test(upperKw)) {
    const hasAlready = results.some(function(r) { return r.code === upperKw; });
    if (!hasAlready) {
      // 嘗試立即查報價
      const directQuote = fetchYahooFinanceQuote(upperKw);
      if (directQuote && !directQuote.isCustom) {
        results.unshift({
          symbol: directQuote.symbol,
          code: directQuote.code,
          name: directQuote.name,
          market: directQuote.market,
          stockType: directQuote.stockType,
          currency: directQuote.currency,
          price: directQuote.currentPrice,
          change: directQuote.change
        });
      } else {
        // 預設提供上市與興櫃兩個選項
        results.push({
          symbol: upperKw + '.TW',
          code: upperKw,
          name: upperKw + ' (台股上市)',
          market: 'TW',
          stockType: '上市',
          currency: 'TWD',
          price: 0,
          change: 0
        });
        results.push({
          symbol: upperKw + '.TWO',
          code: upperKw,
          name: upperKw + ' (上櫃/興櫃)',
          market: 'TW',
          stockType: '上櫃/興櫃',
          currency: 'TWD',
          price: 0,
          change: 0
        });
      }
    }
  }

  // 3. 備援：若無任何結果，查詢本地 TWSE/TPEx 快取
  if (results.length === 0) {
    const twList = getOrFetchTWStockList();
    const twMatches = twList.filter(function(s) {
      return s.Code.includes(upperKw) || (s.Name && s.Name.includes(keyword));
    }).slice(0, 5);

    twMatches.forEach(function(s) {
      const price = parseFloat((s.ClosingPrice || s.Close || '0').replace(/,/g, '')) || 0;
      results.push({
        symbol: s.Code + (s.type === '上櫃/興櫃' ? '.TWO' : '.TW'),
        code: s.Code,
        name: s.Name || s.Code,
        market: 'TW',
        stockType: s.type || '台股',
        currency: 'TWD',
        price: price,
        change: parseFloat((s.Change || '0').replace(/,/g, '')) || 0
      });
    });
  }

  return jsonResponse(results);
}

/**
 * 取得或快取台股收盤清單 (TWSE 上市 + TPEx 櫃買中心備援)
 */
function getOrFetchTWStockList() {
  const cacheKey = 'twse_tpex_all_stocks_v3';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e){}
  }

  const allList = [];

  try {
    const twseUrl = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
    const res = UrlFetchApp.fetch(twseUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (Array.isArray(data)) {
        data.forEach(function(s) {
          allList.push({
            Code: s.Code,
            Name: s.Name,
            ClosingPrice: s.ClosingPrice,
            Change: s.Change,
            type: '上市'
          });
        });
      }
    }
  } catch (err) {}

  try {
    cache.put(cacheKey, JSON.stringify(allList.slice(0, 1000)), 900);
  } catch(e){}

  return allList;
}

function fetchTWStockQuote(symbol) {
  const cleanCode = symbol.replace('.TW', '').replace('.TWO', '');
  const allStocks = getOrFetchTWStockList();
  const target = allStocks.find(function(s) { return s.Code === cleanCode; });

  if (target) {
    const currentPrice = parseFloat((target.ClosingPrice || '0').replace(/,/g, '')) || 0;
    const change = parseFloat((target.Change || '0').replace(/,/g, '')) || 0;
    return {
      symbol: cleanCode + '.TW',
      code: cleanCode,
      name: target.Name || cleanCode,
      market: 'TW',
      currency: 'TWD',
      currentPrice: currentPrice,
      previousClose: currentPrice - change,
      change: change,
      changePercent: currentPrice > 0 ? parseFloat(((change / (currentPrice - change)) * 100).toFixed(2)) : 0,
      updatedAt: new Date().toISOString()
    };
  }
  return null;
}
