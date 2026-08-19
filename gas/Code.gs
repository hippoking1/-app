/**
 * ==========================================================================
 * 智慧記帳 App - Google Apps Script 全功能一體後端 (Code.gs)
 * 包含：Gemini 3.7 Flash AI 記帳 + Yahoo Finance 全球/台股上市上櫃興櫃即時行情
 * ==========================================================================
 */

/**
 * GET 請求處理 (健康檢查與診斷)
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'healthCheck';
  
  try {
    switch (action) {
      case 'healthCheck':
        const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
        return jsonResponse({
          status: 'ok',
          message: 'Smart Expense Tracker GAS API 運作正常！',
          hasGeminiKey: Boolean(geminiKey),
          geminiModel: 'gemini-3.7-flash',
          engine: 'Yahoo Finance v8 + Gemini 3.7 Flash',
          timestamp: new Date().toISOString()
        });
        
      default:
        return jsonResponse({ error: '無效的 GET 動作: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack }, 500);
  }
}

/**
 * POST 請求處理 (主進入點)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: '缺少請求主體內容 (postData)' }, 400);
    }

    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};

    switch (action) {
      // 1. AI 記帳與花費分析 (Gemini 3.7 Flash)
      case 'parseExpense':
        return handleParseExpense(payload);

      case 'getSpendingInsights':
        return handleSpendingInsights(payload);

      // 2. 股票行情與搜尋 (Yahoo Finance v8 API)
      case 'getStockQuote':
        return handleGetStockQuote(payload);

      case 'searchStock':
        return handleSearchStock(payload);

      case 'getBatchQuotes':
        return handleBatchQuotes(payload);

      // 3. 連線診斷
      case 'testConnection':
        return handleTestConnection(payload);

      default:
        return jsonResponse({ error: '無效的 POST 動作: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: '伺服器執行錯誤: ' + err.toString(), stack: err.stack }, 500);
  }
}

/**
 * 統一回應 JSON 格式
 */
function jsonResponse(data, statusCode) {
  statusCode = statusCode || 200;
  const output = JSON.stringify({
    success: statusCode >= 200 && statusCode < 300,
    statusCode: statusCode,
    data: data
  });
  
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================================
   一、連線診斷功能
   ========================================================================== */

function handleTestConnection(payload) {
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  return jsonResponse({
    status: 'connected',
    serverTime: new Date().toISOString(),
    isGeminiConfigured: Boolean(geminiKey),
    message: geminiKey ? 'GAS 後端連線成功，Gemini API 金鑰已設定！' : 'GAS 後端連線成功，但尚未在專案設定 GEMINI_API_KEY！'
  });
}

/* ==========================================================================
   二、Gemini 3.7 Flash AI 記帳與分析模組
   ========================================================================== */

function handleParseExpense(payload) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'GAS 未設定 GEMINI_API_KEY，請至 GAS「專案設定 > 指令碼屬性」新增 GEMINI_API_KEY' }, 500);
  }

  const userText = payload.text || '';
  const categories = payload.categories || [];
  const accounts = payload.accounts || [];
  const today = payload.userDate || new Date().toISOString().split('T')[0];

  if (!userText.trim()) {
    return jsonResponse({ error: '請提供要解析的記帳文字' }, 400);
  }

  const categoryNames = categories.map(c => c.name).join(', ') || '餐飲, 交通, 購物, 娛樂, 居家, 醫療, 投資, 薪資, 其他';
  const accountNames = accounts.map(a => a.name).join(', ') || '現金, 信用卡, 銀行帳戶';

  const systemPrompt = `你是一個專業的財務記帳 AI 助手。你的任務是將使用者提供的日常自然語言文字，精確解析為一筆或多筆結構化交易資料。
今天的基準日期為：${today}。

【解析規則】：
1. 幣別固定為 TWD（新台幣）。金額必須為正整數數字。
2. 判斷交易類型 (type)："expense" (支出), "income" (收入), 或 "transfer" (轉帳)。
3. 最佳匹配分類 (categoryName)：請盡量優先從可選分類列表選擇：[${categoryNames}]。
4. 帳戶名稱 (accountName)：若提及支付方式（如刷卡、悠遊卡、現金、中信等），比對可用帳戶：[${accountNames}]。未提及預設為第一個或「現金錢包」。
5. 日期 (date)：若提及「昨天」、「前天」、「上週五」等，以基準日 (${today}) 推算正確 YYYY-MM-DD；未提及則為今日 ${today}。
6. 備註 (note)：清楚簡潔的項目摘要。
7. 標籤 (tags)：1~3 個繁體中文標籤陣列。
8. 信心度 (confidence)：0.0 ~ 1.0。

【回傳格式】：
必須嚴格遵守 JSON 陣列格式，不得輸出任何 Markdown 標記：
[
  {
    "type": "expense" | "income" | "transfer",
    "amount": number,
    "categoryName": string,
    "accountName": string,
    "note": string,
    "date": "YYYY-MM-DD",
    "tags": string[],
    "confidence": number
  }
]`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=' + apiKey;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    return jsonResponse({ error: 'Gemini API 呼叫失敗 (' + responseCode + '): ' + responseText }, 502);
  }

  const result = JSON.parse(responseText);
  try {
    const rawContent = result.candidates[0].content.parts[0].text;
    const parsedTransactions = JSON.parse(rawContent);
    return jsonResponse(parsedTransactions);
  } catch (parseErr) {
    return jsonResponse({ error: '解析 Gemini 輸出格式失敗: ' + parseErr.message }, 500);
  }
}

function handleSpendingInsights(payload) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'GAS 未設定 GEMINI_API_KEY' }, 500);
  }

  const prompt = `你是一位資深個人財務顧問。請根據以下使用者的月度財務數據摘要，提供 3 到 4 點精闢、實用且具建設性的繁體中文財務洞察與改善建議：

【財務數據摘要】：
${JSON.stringify(payload, null, 2)}

請以結構化、親切專業的格式輸出：
1. 💡 本期財務健康度簡評
2. ⚠️ 需關注的花費項目或超支風險
3. 🎯 具體的省錢/資產配置建議`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=' + apiKey;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    return jsonResponse({ error: 'Gemini 洞察生成失敗' }, 502);
  }

  const result = JSON.parse(response.getContentText());
  const replyText = result.candidates[0].content.parts[0].text;
  return jsonResponse({ insights: replyText });
}

/* ==========================================================================
   三、Yahoo Finance 全球/台股 (上市/上櫃/興櫃) 報價與搜尋引擎
   ========================================================================== */

function handleGetStockQuote(payload) {
  const rawSymbol = (payload.symbol || '').trim().toUpperCase();
  if (!rawSymbol) {
    return jsonResponse({ error: '請提供股票代碼 (symbol)' }, 400);
  }

  const cleanCode = rawSymbol.replace('.TW', '').replace('.TWO', '');
  const isTWCode = /^\d{4,6}$/.test(cleanCode);

  // 嘗試查詢代碼 (針對台股分別嘗試 .TW 與 .TWO)
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
          const market = sym.endsWith('.TW') || sym.endsWith('.TWO') || meta.currency === 'TWD' ? 'TW' : 'US';
          const stockType = sym.endsWith('.TWO') ? '上櫃/興櫃' : sym.endsWith('.TW') ? '上市' : '美股';

          return jsonResponse({
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
          });
        }
      }
    } catch (err) {
      Logger.log('Yahoo Finance 查詢錯誤 (' + sym + '): ' + err.toString());
    }
  }

  // 找不到時回傳安全自訂結構
  return jsonResponse({
    symbol: isTWCode ? cleanCode + '.TW' : rawSymbol,
    code: cleanCode,
    name: cleanCode,
    market: isTWCode ? 'TW' : 'US',
    stockType: isTWCode ? '台股/興櫃' : '美股',
    currency: isTWCode ? 'TWD' : 'USD',
    currentPrice: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
    isCustom: true
  });
}

function handleBatchQuotes(payload) {
  const items = payload.items || [];
  const results = {};

  items.forEach(function(item) {
    const symbol = item.symbol.trim().toUpperCase();
    try {
      const quoteRes = handleGetStockQuote({ symbol: symbol });
      const parsed = JSON.parse(quoteRes.getContent());
      results[symbol] = parsed.data;
    } catch (e) {
      results[symbol] = { error: e.message, symbol: symbol };
    }
  });

  return jsonResponse(results);
}

function handleSearchStock(payload) {
  const keyword = (payload.keyword || '').trim();
  if (!keyword) return jsonResponse([]);

  const results = [];
  const upperKw = keyword.toUpperCase();

  // 1. Yahoo Finance Search API
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
    Logger.log('Yahoo 搜尋錯誤: ' + e.toString());
  }

  // 2. 若為純數字代碼（例如 2880、7829）直接嘗試查詢即時報價
  if (/^\d{4,6}$/.test(upperKw)) {
    const hasAlready = results.some(function(r) { return r.code === upperKw; });
    if (!hasAlready) {
      try {
        const quoteRes = handleGetStockQuote({ symbol: upperKw });
        const quoteObj = JSON.parse(quoteRes.getContent()).data;
        if (quoteObj && !quoteObj.isCustom) {
          results.unshift({
            symbol: quoteObj.symbol,
            code: quoteObj.code,
            name: quoteObj.name,
            market: quoteObj.market,
            stockType: quoteObj.stockType,
            currency: quoteObj.currency,
            price: quoteObj.currentPrice,
            change: quoteObj.change
          });
        }
      } catch (e) {}
    }
  }

  return jsonResponse(results);
}
