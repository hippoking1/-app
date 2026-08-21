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
 * 計算單檔股票持倉的損益、報酬率、年化與季化報酬率
 */
export function calculateHoldingProfitLoss(holding: Partial<StockHolding> | null | undefined) {
  if (!holding) {
    return {
      totalCost: 0,
      marketValue: 0,
      profitLoss: 0,
      returnRate: 0,
      todayProfitLoss: 0,
      daysHeld: 1,
      annualizedReturnRate: 0,
      quarterlyReturnRate: 0
    };
  }

  const shares = holding.shares || 0;
  const avgCost = holding.avgCost || 0;
  const currentPrice = holding.currentPrice || avgCost;

  const totalCost = shares * avgCost;
  const marketValue = shares * currentPrice;
  const profitLoss = marketValue - totalCost;
  const returnRateDecimal = totalCost > 0 ? profitLoss / totalCost : 0;
  const returnRate = returnRateDecimal * 100;

  // 今日預估損益
  const dayChange = holding.change || 0;
  const todayProfitLoss = shares * dayChange;

  // 計算持有天數
  const createdDate = holding.createdAt ? new Date(holding.createdAt) : new Date();
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - createdDate.getTime());
  const daysHeld = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const yearsHeld = daysHeld / 365.25;

  // 計算年化報酬率 (CAGR / 年化) 與 季化報酬率 (Quarterly / 季化)
  let annualizedReturnRate = 0;
  let quarterlyReturnRate = 0;

  if (totalCost > 0 && returnRateDecimal > -1) {
    if (daysHeld >= 30) {
      // 持有滿 30 天以上，使用標準複利年化公式 (CAGR)
      const cagr = Math.pow(1 + returnRateDecimal, 1 / yearsHeld) - 1;
      annualizedReturnRate = cagr * 100;
    } else {
      // 持有天數較短時，使用平滑線性年化防止暴衝
      annualizedReturnRate = (returnRateDecimal * (365.25 / daysHeld)) * 100;
    }

    // 季化報酬率 = (1 + 年化)^(1/4) - 1
    if (annualizedReturnRate > -100) {
      const qRate = Math.pow(1 + annualizedReturnRate / 100, 1 / 4) - 1;
      quarterlyReturnRate = qRate * 100;
    } else {
      quarterlyReturnRate = -25;
    }
  } else if (returnRateDecimal <= -1) {
    annualizedReturnRate = -100;
    quarterlyReturnRate = -25;
  }

  return {
    totalCost,
    marketValue,
    profitLoss,
    returnRate: parseFloat(returnRate.toFixed(2)),
    todayProfitLoss,
    daysHeld,
    annualizedReturnRate: parseFloat(annualizedReturnRate.toFixed(2)),
    quarterlyReturnRate: parseFloat(quarterlyReturnRate.toFixed(2))
  };
}

/**
 * 計算整個股票投資組合的總資產狀況 (折合台幣)，包含整體年化與季化報酬率
 */
export function calculatePortfolioSummary(holdings: StockHolding[] = [], usdRate = 32.5) {
  let totalCostTWD = 0;
  let totalMarketValueTWD = 0;
  let todayProfitLossTWD = 0;
  let weightedDaysSum = 0;

  const safeList = Array.isArray(holdings) ? holdings : [];

  safeList.forEach((h) => {
    if (!h) return;
    const rate = h.market === 'US' || h.currency === 'USD' ? usdRate : 1;
    const pl = calculateHoldingProfitLoss(h);

    const costTWD = pl.totalCost * rate;
    totalCostTWD += costTWD;
    totalMarketValueTWD += pl.marketValue * rate;
    todayProfitLossTWD += pl.todayProfitLoss * rate;
    weightedDaysSum += pl.daysHeld * costTWD;
  });

  const totalProfitLossTWD = totalMarketValueTWD - totalCostTWD;
  const totalReturnRateDecimal = totalCostTWD > 0 ? totalProfitLossTWD / totalCostTWD : 0;
  const totalReturnRate = totalReturnRateDecimal * 100;

  // 投資組合加權平均持有天數
  const weightedDaysHeld = totalCostTWD > 0 ? Math.max(1, Math.round(weightedDaysSum / totalCostTWD)) : 1;
  const weightedYearsHeld = weightedDaysHeld / 365.25;

  // 整體年化與季化報酬率
  let totalAnnualizedReturnRate = 0;
  let totalQuarterlyReturnRate = 0;

  if (totalCostTWD > 0 && totalReturnRateDecimal > -1) {
    if (weightedDaysHeld >= 30) {
      const cagr = Math.pow(1 + totalReturnRateDecimal, 1 / weightedYearsHeld) - 1;
      totalAnnualizedReturnRate = cagr * 100;
    } else {
      totalAnnualizedReturnRate = (totalReturnRateDecimal * (365.25 / weightedDaysHeld)) * 100;
    }

    if (totalAnnualizedReturnRate > -100) {
      const qRate = Math.pow(1 + totalAnnualizedReturnRate / 100, 1 / 4) - 1;
      totalQuarterlyReturnRate = qRate * 100;
    } else {
      totalQuarterlyReturnRate = -25;
    }
  }

  return {
    totalCostTWD,
    totalMarketValueTWD,
    totalProfitLossTWD,
    totalReturnRate: parseFloat(totalReturnRate.toFixed(2)),
    todayProfitLossTWD,
    weightedDaysHeld,
    totalAnnualizedReturnRate: parseFloat(totalAnnualizedReturnRate.toFixed(2)),
    totalQuarterlyReturnRate: parseFloat(totalQuarterlyReturnRate.toFixed(2))
  };
}
