import { StockHolding, StockTransaction } from '@/types';

/**
 * 計算台股證券手續費 (表定 0.1425%，低消 20 元)
 */
export function calculateTWStockFee(amount: number, discount = 0.6): number {
  const rawFee = amount * 0.001425 * discount;
  return Math.max(20, Math.floor(rawFee));
}

/**
 * 計算台股證券交易稅 (賣出時課徵 0.3%，ETF 0.1%)
 */
export function calculateTWStockTax(amount: number, isETF = false): number {
  return Math.floor(amount * (isETF ? 0.001 : 0.003));
}

/**
 * 計算單檔股票持倉的損益與報酬率
 */
export function calculateHoldingProfitLoss(holding: StockHolding) {
  const shares = holding.shares || 0;
  const avgCost = holding.avgCost || 0;
  const currentPrice = holding.currentPrice || avgCost;

  const totalCost = shares * avgCost;
  const marketValue = shares * currentPrice;
  const profitLoss = marketValue - totalCost;
  const returnRate = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

  // 今日預估損益
  const dayChange = holding.change || 0;
  const todayProfitLoss = shares * dayChange;

  return {
    totalCost,
    marketValue,
    profitLoss,
    returnRate: parseFloat(returnRate.toFixed(2)),
    todayProfitLoss
  };
}

/**
 * 計算整個股票投資組合的總資產狀況 (折合台幣)
 */
export function calculatePortfolioSummary(holdings: StockHolding[], usdRate = 32.5) {
  let totalCostTWD = 0;
  let totalMarketValueTWD = 0;
  let todayProfitLossTWD = 0;

  holdings.forEach((h) => {
    const rate = h.market === 'US' || h.currency === 'USD' ? usdRate : 1;
    const pl = calculateHoldingProfitLoss(h);

    totalCostTWD += pl.totalCost * rate;
    totalMarketValueTWD += pl.marketValue * rate;
    todayProfitLossTWD += pl.todayProfitLoss * rate;
  });

  const totalProfitLossTWD = totalMarketValueTWD - totalCostTWD;
  const totalReturnRate = totalCostTWD > 0 ? (totalProfitLossTWD / totalCostTWD) * 100 : 0;

  return {
    totalCostTWD,
    totalMarketValueTWD,
    totalProfitLossTWD,
    totalReturnRate: parseFloat(totalReturnRate.toFixed(2)),
    todayProfitLossTWD
  };
}
