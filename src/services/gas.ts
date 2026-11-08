import { ParsedTransaction, StockQuote, StockSearchResult, StockMarket } from '@/types';
import { auth } from '@/lib/firebase';
import {
  AI_PROVIDERS,
  loadUserAIConfig,
  parseExpenseWithUserAI,
  generateSpendingInsightsWithUserAI
} from './ai';

// 從環境變數讀取 Google Apps Script Web App 部署 URL (僅用於 Yahoo Finance 股市報價代理)
export const GAS_URL = import.meta.env.VITE_GAS_DEPLOYMENT_URL || '';

export interface DiagnosticResult {
  gasConnected: boolean;
  gasUrl: string;
  hasGeminiKey: boolean;
  aiProviderName: string;
  geminiModel: string;
  latencyMs: number;
  testStock2880?: StockQuote;
  testStock2330?: StockQuote;
  testAIResult?: ParsedTransaction[];
  aiError?: string;
  error?: string;
}

interface GASResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  error?: string;
}

/**
 * 呼叫 Google Apps Script 後端通用方法 (僅限股市報價與非 AI 代理)
 */
async function callGAS<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const isMockMode = !GAS_URL || GAS_URL.includes('your_deployment_id');

  if (isMockMode) {
    console.warn(`[GAS] 尚未設定 VITE_GAS_DEPLOYMENT_URL，使用本機股市模擬模式: ${action}`);
    return mockGASResponse<T>(action, payload);
  }

  try {
    let idToken: string | undefined;
    try {
      idToken = await auth.currentUser?.getIdToken();
    } catch {}

    // 使用 text/plain 繞過瀏覽器 CORS preflight 限制，並設定 25 秒超時
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload, idToken }),
      signal: AbortSignal.timeout(25000)
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
    if (!result.success) {
      const errMsg = result.error || (result.data as any)?.error || 'GAS 後端執行失敗';
      throw new Error(errMsg);
    }

    return result.data;
  } catch (err: any) {
    console.error(`[GAS Error] ${action}:`, err);
    throw err;
  }
}

/**
 * 執行完整的 GAS 股市代理 & 使用者自備 AI 金鑰連線診斷
 * 注意：嚴格使用使用者自行輸入的 API Key 與自選模型，絕不讀取或呼叫 GAS 伺服器的預設金鑰
 */
export async function runSystemDiagnostics(): Promise<DiagnosticResult> {
  const startTime = Date.now();
  const userAIConfig = loadUserAIConfig();
  const providerMeta = AI_PROVIDERS[userAIConfig.provider] || AI_PROVIDERS.gemini;
  const hasUserKey = Boolean(userAIConfig.apiKey.trim() && userAIConfig.isKeyValid && userAIConfig.selectedModel);

  const result: DiagnosticResult = {
    gasConnected: false,
    gasUrl: GAS_URL,
    hasGeminiKey: hasUserKey,
    aiProviderName: providerMeta.shortName,
    geminiModel: userAIConfig.selectedModel || '未選擇模型',
    latencyMs: 0
  };

  // 1. 測試 GAS 股市報價代理伺服器
  if (GAS_URL) {
    try {
      const pingRes = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'testConnection', payload: {} })
      });

      const pingText = await pingRes.text();
      result.latencyMs = Date.now() - startTime;

      if (pingText.includes('doPost')) {
        result.error = 'GAS 找不到 doPost 函式！請將專案中的 gas/Code.gs 複製貼到 Google Apps Script 並重新部署。';
      } else if (pingText.startsWith('<!DOCTYPE html>')) {
        result.error = 'GAS 回傳 HTML 頁面，請確認 GAS 部署設定中的「誰可以存取」設為「所有人 (Anyone)」。';
      } else {
        const pingJson = JSON.parse(pingText);
        result.gasConnected = Boolean(pingJson.success);
      }

      // 2. 測試 Yahoo Finance 報價 (2880 華南金)
      if (result.gasConnected) {
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
        } catch {}
      }
    } catch (err: any) {
      result.latencyMs = Date.now() - startTime;
      result.error = err.message || 'GAS 連線測試超時或失敗';
    }
  } else {
    result.error = '尚未在 .env 設定 VITE_GAS_DEPLOYMENT_URL';
  }

  // 3. 測試使用者自備 AI API Key 與自選模型記帳解析 (絕不使用系統或 GAS 金鑰)
  if (hasUserKey) {
    try {
      const aiParsed = await parseExpenseWithUserAI(
        '今天午餐在麥當勞刷卡吃了 180 元',
        [{ id: 'cat_1', name: '餐飲美食' }],
        [{ id: 'acc_1', name: '信用卡' }]
      );
      result.testAIResult = aiParsed;
    } catch (aiErr: any) {
      result.aiError = aiErr.message || 'AI 模型測試解析失敗';
    }
  }

  return result;
}

/**
 * 1. AI 記帳：將自然語言解析為結構化交易清單（嚴格使用使用者自備 API Key 與自選模型）
 */
export async function parseExpenseTextWithGemini(
  text: string,
  categories: Array<{ id: string; name: string }>,
  accounts: Array<{ id: string; name: string }>,
  userDate?: string
): Promise<ParsedTransaction[]> {
  return parseExpenseWithUserAI(text, categories, accounts, userDate);
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
 * 5. 取得 AI 花費財務分析洞察（嚴格使用使用者自備 API Key 與自選模型）
 */
export async function fetchSpendingInsights(summaryData: Record<string, unknown>): Promise<string> {
  const insights = await generateSpendingInsightsWithUserAI(summaryData);
  return insights || '本月收支維持在良好狀態，建議持續保持記帳習慣！';
}

/* ==========================================================================
   本地股市 Fallback 模擬器 (僅限股市報價，AI 功能絕不模擬亦無預設金鑰)
   ========================================================================== */

function mockGASResponse<T>(action: string, payload: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (action === 'parseExpense' || action === 'getSpendingInsights') {
        reject(new Error('系統不預設任何 API Key，請先至「系統設定」輸入您的個人 API Key 並選擇模型'));
        return;
      }
      if (action === 'getStockQuote') {
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
