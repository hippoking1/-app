/**
 * 股票即時/盤後報價服務模組 (台股上市 TWSE + 上櫃/興櫃 TPEx + 美股 Finnhub)
 */

/**
 * 取得單檔股票報價
 * @param {Object} payload { symbol: string, market: 'TW' | 'US' }
 */
function handleGetStockQuote(payload) {
  const symbol = (payload.symbol || '').trim().toUpperCase();
  const market = (payload.market || (symbol.includes('.TW') || /^\d{4,6}$/.test(symbol) ? 'TW' : 'US')).toUpperCase();

  if (!symbol) {
    return jsonResponse({ error: '請提供股票代碼 (symbol)' }, 400);
  }

  const cacheKey = 'quote_' + market + '_' + symbol;
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return jsonResponse(JSON.parse(cachedData));
  }

  let quote;
  if (market === 'TW') {
    quote = fetchTWStockQuote(symbol);
  } else {
    quote = fetchUSStockQuote(symbol);
  }

  if (quote && !quote.error) {
    // 快取 180 秒 (3分鐘)
    cache.put(cacheKey, JSON.stringify(quote), 180);
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
    const market = item.market || (symbol.includes('.TW') || /^\d{4,6}$/.test(symbol) ? 'TW' : 'US');
    
    try {
      const cacheKey = 'quote_' + market + '_' + symbol;
      const cache = CacheService.getScriptCache();
      const cached = cache.get(cacheKey);
      
      if (cached) {
        results[symbol] = JSON.parse(cached);
      } else {
        const quote = market === 'TW' ? fetchTWStockQuote(symbol) : fetchUSStockQuote(symbol);
        if (quote && !quote.error) {
          cache.put(cacheKey, JSON.stringify(quote), 180);
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
 * 查詢台股個股報價 (TWSE 上市 + TPEx 上櫃/興櫃)
 */
function fetchTWStockQuote(symbol) {
  const cleanCode = symbol.replace('.TW', '').replace('.TWO', '');
  
  // 1. 嘗試從上市 + 上櫃/興櫃當日清單比對
  const allStocks = getOrFetchTWStockList();
  const target = allStocks.find(function(s) {
    return s.Code === cleanCode;
  });

  if (target) {
    const currentPrice = parseFloat((target.ClosingPrice || target.Close || '0').replace(/,/g, '')) || 0;
    const change = parseFloat((target.Change || '0').replace(/,/g, '')) || 0;
    const previousClose = currentPrice - change;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: cleanCode + '.TW',
      code: cleanCode,
      name: target.Name || cleanCode,
      market: 'TW',
      stockType: target.type || '台股',
      currency: 'TWD',
      currentPrice: currentPrice,
      previousClose: previousClose,
      change: change,
      changePercent: parseFloat(changePercent.toFixed(2)),
      high: parseFloat((target.HighestPrice || target.High || '0').replace(/,/g, '')) || currentPrice,
      low: parseFloat((target.LowestPrice || target.Low || '0').replace(/,/g, '')) || currentPrice,
      open: parseFloat((target.OpeningPrice || target.Open || '0').replace(/,/g, '')) || currentPrice,
      volume: parseInt((target.TradeVolume || '0').replace(/,/g, ''), 10) || 0,
      updatedAt: new Date().toISOString()
    };
  }

  // 若盤後清單無此股（如剛登錄興櫃或特別股），回傳基本自訂結構，不阻擋建倉
  return {
    symbol: cleanCode + '.TW',
    code: cleanCode,
    name: cleanCode,
    market: 'TW',
    stockType: '興櫃/自訂',
    currency: 'TWD',
    currentPrice: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
    isCustom: true
  };
}

/**
 * 查詢美股報價 (Finnhub API)
 */
function fetchUSStockQuote(symbol) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (!apiKey) {
    return {
      symbol: symbol,
      name: symbol,
      market: 'US',
      currency: 'USD',
      currentPrice: 150.0,
      previousClose: 148.0,
      change: 2.0,
      changePercent: 1.35,
      updatedAt: new Date().toISOString(),
      notice: '請至 GAS 設定 FINNHUB_API_KEY 以取得真實美股報價'
    };
  }

  const url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + apiKey;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  
  if (res.getResponseCode() !== 200) {
    return { error: 'Finnhub API 查詢失敗 (' + res.getResponseCode() + ')' };
  }

  const data = JSON.parse(res.getContentText());
  if (!data || (data.c === 0 && data.pc === 0)) {
    return {
      symbol: symbol,
      code: symbol,
      name: symbol,
      market: 'US',
      currency: 'USD',
      currentPrice: 0,
      updatedAt: new Date().toISOString(),
      isCustom: true
    };
  }

  return {
    symbol: symbol,
    code: symbol,
    name: symbol,
    market: 'US',
    currency: 'USD',
    currentPrice: data.c,
    previousClose: data.pc,
    change: data.d,
    changePercent: parseFloat((data.dp || 0).toFixed(2)),
    high: data.h,
    low: data.l,
    open: data.o,
    updatedAt: new Date().toISOString()
  };
}

/**
 * 股票搜尋 (支援台股上市/上櫃/興櫃代碼與名稱、美股 Symbol)
 */
function handleSearchStock(payload) {
  const keyword = (payload.keyword || '').trim();
  if (!keyword) return jsonResponse([]);

  const results = [];
  const upperKw = keyword.toUpperCase();

  // 1. 搜尋台股上市 + 上櫃 + 興櫃
  const twList = getOrFetchTWStockList();
  const twMatches = twList.filter(function(s) {
    return s.Code.includes(upperKw) || (s.Name && s.Name.includes(keyword));
  }).slice(0, 10);

  twMatches.forEach(function(s) {
    const price = parseFloat((s.ClosingPrice || s.Close || '0').replace(/,/g, '')) || 0;
    const change = parseFloat((s.Change || '0').replace(/,/g, '')) || 0;
    results.push({
      symbol: s.Code + '.TW',
      code: s.Code,
      name: s.Name || s.Code,
      market: 'TW',
      stockType: s.type || '台股',
      currency: 'TWD',
      price: price,
      change: change
    });
  });

  // 2. 搜尋美股 (若有設定 Finnhub Key 則呼叫)
  const finnhubKey = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (finnhubKey && /^[A-Za-z]+$/.test(keyword)) {
    try {
      const url = 'https://finnhub.io/api/v1/search?q=' + encodeURIComponent(keyword) + '&token=' + finnhubKey;
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const searchData = JSON.parse(res.getContentText());
        const usMatches = (searchData.result || []).filter(function(item) {
          return item.type === 'Common Stock' && !item.symbol.includes('.');
        }).slice(0, 5);

        usMatches.forEach(function(item) {
          results.push({
            symbol: item.symbol,
            code: item.symbol,
            name: item.description || item.symbol,
            market: 'US',
            stockType: '美股',
            currency: 'USD',
            price: 0
          });
        });
      }
    } catch (e) {
      // 忽略美股搜尋錯誤
    }
  }

  return jsonResponse(results);
}

/**
 * 取得或快取台股收盤清單 (整合 TWSE 上市 + TPEx 櫃買中心/興櫃)
 */
function getOrFetchTWStockList() {
  const cacheKey = 'twse_tpex_all_stocks_v2';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e){}
  }

  const allList = [];

  // A. 抓取 TWSE 上市股票
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
            HighestPrice: s.HighestPrice,
            LowestPrice: s.LowestPrice,
            OpeningPrice: s.OpeningPrice,
            TradeVolume: s.TradeVolume,
            type: '上市'
          });
        });
      }
    }
  } catch (err) {
    Logger.log('TWSE 上市 OpenAPI 取得失敗: ' + err.toString());
  }

  // B. 抓取 TPEx 上櫃/興櫃股票
  try {
    const tpexUrl = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
    const res2 = UrlFetchApp.fetch(tpexUrl, { muteHttpExceptions: true });
    if (res2.getResponseCode() === 200) {
      const data2 = JSON.parse(res2.getContentText());
      if (Array.isArray(data2)) {
        data2.forEach(function(s) {
          allList.push({
            Code: s.SecuritiesCompanyCode || s.Code,
            Name: s.CompanyName || s.Name,
            ClosingPrice: s.Close || s.ClosingPrice,
            Change: s.Change,
            HighestPrice: s.High,
            LowestPrice: s.Low,
            OpeningPrice: s.Open,
            TradeVolume: s.TradingShares,
            type: '上櫃/興櫃'
          });
        });
      }
    }
  } catch (err) {
    Logger.log('TPEx 櫃買 OpenAPI 取得失敗: ' + err.toString());
  }

  // 寫入快取 (15 分鐘)
  try {
    cache.put(cacheKey, JSON.stringify(allList.slice(0, 1000)), 900);
  } catch(e){}

  return allList;
}

function handleGetTWStockAll() {
  const list = getOrFetchTWStockList();
  return jsonResponse(list);
}
