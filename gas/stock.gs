/**
 * 股票即時/盤後報價服務模組 (台股 TWSE + 美股 Finnhub)
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
 * 查詢台股個股報價 (TWSE OpenAPI)
 */
function fetchTWStockQuote(symbol) {
  const cleanCode = symbol.replace('.TW', '').replace('.TWO', '');
  
  // 嘗試從台股當日全部收盤行情抓取
  const allStocks = getOrFetchTWStockList();
  const target = allStocks.find(function(s) {
    return s.Code === cleanCode;
  });

  if (target) {
    const currentPrice = parseFloat(target.ClosingPrice.replace(/,/g, '')) || 0;
    const change = parseFloat(target.Change.replace(/,/g, '')) || 0;
    const previousClose = currentPrice - change;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: cleanCode + '.TW',
      code: cleanCode,
      name: target.Name || cleanCode,
      market: 'TW',
      currency: 'TWD',
      currentPrice: currentPrice,
      previousClose: previousClose,
      change: change,
      changePercent: parseFloat(changePercent.toFixed(2)),
      high: parseFloat(target.HighestPrice.replace(/,/g, '')) || currentPrice,
      low: parseFloat(target.LowestPrice.replace(/,/g, '')) || currentPrice,
      open: parseFloat(target.OpeningPrice.replace(/,/g, '')) || currentPrice,
      volume: parseInt(target.TradeVolume.replace(/,/g, ''), 10) || 0,
      updatedAt: new Date().toISOString()
    };
  }

  // 若盤後清單無此股（如剛掛牌或櫃買），回傳備用預設結構
  return {
    symbol: cleanCode + '.TW',
    code: cleanCode,
    name: cleanCode,
    market: 'TW',
    currency: 'TWD',
    currentPrice: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
    isMock: true
  };
}

/**
 * 查詢美股報價 (Finnhub API)
 */
function fetchUSStockQuote(symbol) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
  if (!apiKey) {
    // 若未設定 Finnhub Key，回傳基本模擬資料防止整個畫面當掉
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
  // Finnhub quote: c = current, d = change, dp = percent change, h = high, l = low, o = open, pc = prev close
  if (!data || data.c === 0 && data.pc === 0) {
    return { error: '找不到美股代碼 ' + symbol + ' 之即時行情' };
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
 * 股票搜尋 (支援台股代碼/名稱與美股 Symbol)
 */
function handleSearchStock(payload) {
  const keyword = (payload.keyword || '').trim();
  if (!keyword) return jsonResponse([]);

  const results = [];
  const upperKw = keyword.toUpperCase();

  // 1. 搜尋台股
  const twList = getOrFetchTWStockList();
  const twMatches = twList.filter(function(s) {
    return s.Code.includes(upperKw) || (s.Name && s.Name.includes(keyword));
  }).slice(0, 8);

  twMatches.forEach(function(s) {
    const price = parseFloat((s.ClosingPrice || '0').replace(/,/g, '')) || 0;
    const change = parseFloat((s.Change || '0').replace(/,/g, '')) || 0;
    results.push({
      symbol: s.Code + '.TW',
      code: s.Code,
      name: s.Name || s.Code,
      market: 'TW',
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
 * 取得或快取 TWSE 全部台股收盤清單
 */
function getOrFetchTWStockList() {
  const cacheKey = 'twse_all_stocks_v1';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e){}
  }

  try {
    const url = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (Array.isArray(data) && data.length > 0) {
        // Cache limit 100KB, 故只快取熱門股票或壓縮
        const simplified = data.map(function(s) {
          return {
            Code: s.Code,
            Name: s.Name,
            ClosingPrice: s.ClosingPrice,
            Change: s.Change,
            HighestPrice: s.HighestPrice,
            LowestPrice: s.LowestPrice,
            OpeningPrice: s.OpeningPrice,
            TradeVolume: s.TradeVolume
          };
        });
        
        // 分塊或簡易快取 (15 分鐘)
        try {
          cache.put(cacheKey, JSON.stringify(simplified.slice(0, 500)), 900);
        } catch(e){}
        return simplified;
      }
    }
  } catch (err) {
    Logger.log('TWSE OpenAPI 取得失敗: ' + err.toString());
  }

  return [];
}

function handleGetTWStockAll() {
  const list = getOrFetchTWStockList();
  return jsonResponse(list);
}
