import { ParsedTransaction, StockQuote, StockSearchResult, StockMarket } from '@/types';

// 從環境變數讀取 Google Apps Script Web App 部署 URL
const GAS_URL = import.meta.env.VITE_GAS_DEPLOYMENT_URL || '';

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

    if (!response.ok) {
      throw new Error(`GAS API 伺服器錯誤: HTTP ${response.status}`);
    }

    const result: GASResponse<T> = await response.json();
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
 * 1. AI 記帳：將自然語言解析為結構化交易清單
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
 * 2. 查詢單檔股票報價 (台股/美股)
 */
export async function fetchStockQuote(symbol: string, market: StockMarket): Promise<StockQuote> {
  return callGAS<StockQuote>('getStockQuote', { symbol, market });
}

/**
 * 3. 搜尋股票代碼或名稱
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
        
        // 簡易正則提取模擬
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
          tags: ['AI自動解析'],
          confidence: 0.92
        };
        resolve([mockItem] as unknown as T);
      } else if (action === 'getStockQuote') {
        const symbol: string = payload.symbol || '2330.TW';
        const isTW = payload.market === 'TW' || symbol.includes('.TW');
        const quote: StockQuote = {
          symbol: symbol,
          code: symbol.replace('.TW', ''),
          name: symbol.includes('2330') ? '台積電' : symbol.includes('AAPL') ? 'Apple Inc.' : symbol,
          market: isTW ? 'TW' : 'US',
          currency: isTW ? 'TWD' : 'USD',
          currentPrice: isTW ? 985 : 225.5,
          previousClose: isTW ? 970 : 222.0,
          change: isTW ? 15 : 3.5,
          changePercent: isTW ? 1.55 : 1.58,
          updatedAt: new Date().toISOString()
        };
        resolve(quote as unknown as T);
      } else if (action === 'searchStock') {
        const kw: string = (payload.keyword || '').toUpperCase();
        const mockList: StockSearchResult[] = [
          { symbol: '2330.TW', code: '2330', name: '台積電', market: 'TW' as StockMarket, currency: 'TWD', price: 985 },
          { symbol: '2454.TW', code: '2454', name: '聯發科', market: 'TW' as StockMarket, currency: 'TWD', price: 1320 },
          { symbol: '0050.TW', code: '0050', name: '元大台灣50', market: 'TW' as StockMarket, currency: 'TWD', price: 185 },
          { symbol: 'AAPL', code: 'AAPL', name: 'Apple Inc.', market: 'US' as StockMarket, currency: 'USD', price: 225.5 },
          { symbol: 'NVDA', code: 'NVDA', name: 'NVIDIA Corp', market: 'US' as StockMarket, currency: 'USD', price: 128.0 },
          { symbol: 'TSLA', code: 'TSLA', name: 'Tesla Inc', market: 'US' as StockMarket, currency: 'USD', price: 215.0 }
        ].filter(s => s.code.includes(kw) || s.name.includes(kw));
        resolve(mockList as unknown as T);
      } else if (action === 'getSpendingInsights') {
        resolve({
          insights: `💡 **本期財務健康度簡評**\n整體收支比例維持在健康水準（儲蓄率約 35%）。\n\n⚠️ **需關注的花費項目**\n餐飲與外食支出佔總支出達 45%，接近預算警戒線。\n\n🎯 **財務優化建議**\n1. 可設定每日餐飲額度上限為 $450 元以防超支。\n2. 股票投資收益穩定，可持續定期定額分散風險。`
        } as unknown as T);
      } else {
        resolve({} as unknown as T);
      }
    }, 400);
  });
}
