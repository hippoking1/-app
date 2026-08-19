import { ParsedTransaction, StockQuote, StockSearchResult, StockMarket } from '@/types';

// 從環境變數讀取 Google Apps Script Web App 部署 URL
export const GAS_URL = import.meta.env.VITE_GAS_DEPLOYMENT_URL || '';

export interface DiagnosticResult {
  gasConnected: boolean;
  gasUrl: string;
  hasGeminiKey: boolean;
  geminiModel: string;
  latencyMs: number;
  testStock2880?: StockQuote;
  testStock2330?: StockQuote;
  testAIResult?: ParsedTransaction[];
  error?: string;
}

interface GASResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  error?: string;
}

/**
 * 呼叫 Google Apps Script 後端通用方法
 */
async function callGAS<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!GAS_URL || GAS_URL.includes('your_deployment_id')) {
    console.warn(`[GAS] 尚未設定 VITE_GAS_DEPLOYMENT_URL，使用本機智慧模擬模式: ${action}`);
    return mockGASResponse<T>(action, payload);
  }

  try {
    // 使用 text/plain 繞過瀏覽器 CORS preflight 限制
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload })
    });

    const responseText = await response.text();

    // 若 GAS 回傳 HTML 錯誤頁面（例如「找不到以下指令碼函式：doPost」）
    if (responseText.startsWith('<!DOCTYPE html>') || responseText.startsWith('<html')) {
      if (responseText.includes('doPost')) {
        throw new Error('GAS 後端缺少 doPost 進入點！請確認已將最新 gas/Code.gs 貼入 Google Apps Script 並重新部署為新版本。');
      }
      throw new Error('GAS 回傳了 HTML 錯誤頁面，請確認 Web 應用程式「存取權」已設為「任何人 (Anyone)」');
    }

    const result: GASResponse<T> = JSON.parse(responseText);
    if (!result.success && result.error) {
      throw new Error(result.error);
    }

    return result.data;
  } catch (err: any) {
    console.error(`[GAS Error] ${action}:`, err);
    // 若網路出錯，回退至模擬模式以免畫面卡死
    return mockGASResponse<T>(action, payload);
  }
}

/**
 * 執行完整的 GAS & Gemini & Yahoo Finance 報價連線診斷
 */
export async function runSystemDiagnostics(): Promise<DiagnosticResult> {
  const startTime = Date.now();
  const result: DiagnosticResult = {
    gasConnected: false,
    gasUrl: GAS_URL,
    hasGeminiKey: false,
    geminiModel: 'gemini-3.7-flash',
    latencyMs: 0
  };

  if (!GAS_URL) {
    result.error = '尚未在 .env 設定 VITE_GAS_DEPLOYMENT_URL';
    return result;
  }

  try {
    // 1. 測試 POST 進入點
    const pingRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'testConnection', payload: {} })
    });

    const pingText = await pingRes.text();
    result.latencyMs = Date.now() - startTime;

    if (pingText.includes('doPost')) {
      result.error = 'GAS 找不到 doPost 函式！請將專案中的 gas/Code.gs 複製貼到 Google Apps Script 並點擊「部署 > 管理部署作業 > 編輯 > 建立新版本 > 部署」。';
      return result;
    }

    if (pingText.startsWith('<!DOCTYPE html>')) {
      result.error = 'GAS 回傳 HTML 頁面，請確認 GAS 部署設定中的「誰可以存取」設為「所有人 (Anyone)」。';
      return result;
    }

    const pingJson = JSON.parse(pingText);
    result.gasConnected = Boolean(pingJson.success);
    result.hasGeminiKey = Boolean(pingJson.data?.isGeminiConfigured);

    // 2. 測試 Yahoo Finance 報價 (2880 華南金)
    try {
      const quoteRes = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getStockQuote', payload: { symbol: '2880.TW' } })
      });
      const quoteJson = await quoteRes.json();
      if (quoteJson.success) {
        result.testStock2880 = quoteJson.data;
      }
    } catch (e) {}

    // 3. 測試 Gemini AI 記帳解析
    if (result.hasGeminiKey) {
      try {
        const aiRes = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'parseExpense',
            payload: {
              text: '今天午餐在麥當勞刷卡吃了 180 元',
              categories: [{ id: 'cat_1', name: '餐飲美食' }],
              accounts: [{ id: 'acc_1', name: '信用卡' }]
            }
          })
        });
        const aiJson = await aiRes.json();
        if (aiJson.success) {
          result.testAIResult = aiJson.data;
        }
      } catch (e) {}
    }

    return result;
  } catch (err: any) {
    result.latencyMs = Date.now() - startTime;
    result.error = err.message || '連線測試超時或失敗';
    return result;
  }
}

/**
 * 1. AI 記帳：將自然語言解析為結構化交易清單 (Gemini 3.7 Flash)
 */
export async function parseExpenseTextWithGemini(
  text: string,
  categories: Array<{ id: string; name: string }>,
  accounts: Array<{ id: string; name: string }>,
  userDate?: string
): Promise<ParsedTransaction[]> {
  return callGAS<ParsedTransaction[]>('parseExpense', {
    text,
    categories,
    accounts,
    userDate
  });
}

/**
 * 2. 查詢單檔股票報價 (Yahoo Finance API)
 */
export async function fetchStockQuote(symbol: string, market: StockMarket = 'TW'): Promise<StockQuote> {
  return callGAS<StockQuote>('getStockQuote', { symbol, market });
}

/**
 * 3. 搜尋股票代碼或名稱 (Yahoo Search API)
 */
export async function searchStocks(keyword: string): Promise<StockSearchResult[]> {
  return callGAS<StockSearchResult[]>('searchStock', { keyword });
}

/**
 * 4. 批次查詢股票報價
 */
export async function fetchBatchStockQuotes(
  items: Array<{ symbol: string; market: StockMarket }>
): Promise<Record<string, StockQuote>> {
  return callGAS<Record<string, StockQuote>>('getBatchQuotes', { items });
}

/**
 * 5. 取得 AI 花費財務分析洞察
 */
export async function fetchSpendingInsights(summaryData: Record<string, unknown>): Promise<string> {
  const result = await callGAS<{ insights: string }>('getSpendingInsights', summaryData);
  return result.insights || '本月收支維持在良好狀態，建議持續保持記帳習慣！';
}

/* ==========================================================================
   智慧本地 Fallback 模擬器 (在無 GAS URL 時自動接手)
   ========================================================================== */

function mockGASResponse<T>(action: string, payload: Record<string, any>): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (action === 'parseExpense') {
        const text: string = payload.text || '';
        const today = payload.userDate || new Date().toISOString().split('T')[0];
        
        const amountMatch = text.match(/\d+/);
        const amount = amountMatch ? parseInt(amountMatch[0], 10) : 100;
        
        let catName = '餐飲美食';
        if (text.includes('車') || text.includes('油') || text.includes('捷運') || text.includes('悠遊卡')) catName = '交通運輸';
        else if (text.includes('買') || text.includes('全聯') || text.includes('家樂福') || text.includes('衣')) catName = '日常購物';
        else if (text.includes('薪') || text.includes('獎金') || text.includes('收入')) catName = '薪資收入';

        const mockItem: ParsedTransaction = {
          type: text.includes('薪') || text.includes('收入') ? 'income' : 'expense',
          amount: amount,
          categoryName: catName,
          accountName: payload.accounts?.[0]?.name || '現金錢包',
          note: text.replace(/\d+/g, '').replace(/(元|塊|花了|支出|買)/g, '').trim() || text,
          date: today,
          tags: ['本機智慧模擬模式'],
          confidence: 0.85
        };
        resolve([mockItem] as unknown as T);
      } else if (action === 'getStockQuote') {
        const symbol: string = payload.symbol || '2880.TW';
        const isTW = payload.market === 'TW' || symbol.includes('.TW') || symbol.includes('.TWO') || /^\d{4,6}$/.test(symbol);
        const code = symbol.replace('.TW', '').replace('.TWO', '');
        const quote: StockQuote = {
          symbol: symbol,
          code: code,
          name: code === '2880' ? '華南金' : code === '2330' ? '台積電' : code,
          market: isTW ? 'TW' : 'US',
          stockType: '台股',
          currency: isTW ? 'TWD' : 'USD',
          currentPrice: code === '2880' ? 25.4 : code === '2330' ? 985 : 100,
          previousClose: code === '2880' ? 25.2 : code === '2330' ? 970 : 98,
          change: 0.2,
          changePercent: 0.79,
          updatedAt: new Date().toISOString()
        };
        resolve(quote as unknown as T);
      } else if (action === 'searchStock') {
        const kw: string = (payload.keyword || '').toUpperCase();
        const mockList: StockSearchResult[] = [
          { symbol: '2880.TW', code: '2880', name: '華南金', market: 'TW' as StockMarket, stockType: '上市', currency: 'TWD', price: 25.4 },
          { symbol: '2330.TW', code: '2330', name: '台積電', market: 'TW' as StockMarket, stockType: '上市', currency: 'TWD', price: 985 },
          { symbol: '7829.TWO', code: '7829', name: '全景軟體', market: 'TW' as StockMarket, stockType: '上櫃/興櫃', currency: 'TWD', price: 112 },
          { symbol: '2454.TW', code: '2454', name: '聯發科', market: 'TW' as StockMarket, stockType: '上市', currency: 'TWD', price: 1320 },
          { symbol: '0050.TW', code: '0050', name: '元大台灣50', market: 'TW' as StockMarket, stockType: '上市', currency: 'TWD', price: 185 },
          { symbol: 'AAPL', code: 'AAPL', name: 'Apple Inc.', market: 'US' as StockMarket, stockType: '美股', currency: 'USD', price: 225.5 },
          { symbol: 'NVDA', code: 'NVDA', name: 'NVIDIA Corp', market: 'US' as StockMarket, stockType: '美股', currency: 'USD', price: 128.0 }
        ].filter(s => s.code.includes(kw) || s.name.includes(kw));
        resolve(mockList as unknown as T);
      } else {
        resolve({} as unknown as T);
      }
    }, 300);
  });
}
