import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StockCard } from '@/components/stocks/StockCard';
import { StockSearchModal } from '@/components/stocks/StockSearchModal';
import { StockTradeForm } from '@/components/stocks/StockTradeForm';
import { useStockHoldings } from '@/hooks/useFirestore';
import { useBatchUpdateHoldings } from '@/hooks/useStockPrice';
import { useAppStore } from '@/stores/appStore';
import { StockHolding, StockSearchResult } from '@/types';
import { calculatePortfolioSummary } from '@/utils/stockCalculations';
import { formatCurrency } from '@/utils/analytics';
import { Plus, RefreshCw, Search, ArrowUpDown } from 'lucide-react';

export const Stocks: React.FC = () => {
  const { holdings } = useStockHoldings();
  const safeHoldings = Array.isArray(holdings) ? holdings.filter(Boolean) : [];
  const { updateAllPrices, isUpdating } = useBatchUpdateHoldings(safeHoldings);
  const { marketColorScheme, toggleMarketColorScheme } = useAppStore();

  const [isSearchModalOpen, setSearchModalOpen] = useState(false);
  const [isTradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | StockHolding | undefined>(undefined);

  const portfolio = calculatePortfolioSummary(safeHoldings);

  const handleSelectFromSearch = (stock: StockSearchResult) => {
    setSelectedStock(stock);
    setTradeModalOpen(true);
  };

  const handleTradeHolding = (holding: StockHolding) => {
    setSelectedStock(holding);
    setTradeModalOpen(true);
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部標題與操作列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            股票投資
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            台股盤後 OpenAPI 與美股 Finnhub 報價整合
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMarketColorScheme}
            icon={<ArrowUpDown size={14} strokeWidth={1.5} />}
            title="切換台股紅漲綠跌或國際綠漲紅跌"
          >
            {marketColorScheme === 'tw' ? '台股紅漲綠跌' : '國際綠漲紅跌'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={updateAllPrices}
            loading={isUpdating}
            icon={<RefreshCw size={16} strokeWidth={1.5} />}
          >
            更新股價
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedStock(undefined);
              setTradeModalOpen(true);
            }}
            icon={<Plus size={16} strokeWidth={1.5} />}
          >
            自訂建倉
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setSearchModalOpen(true)}
            icon={<Search size={16} strokeWidth={1.5} />}
          >
            搜尋股票
          </Button>
        </div>
      </div>

      {/* 投資組合總結卡片 */}
      <div className="grid-3">
        <Card padding="lg">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            持倉總市值 (NT$)
          </span>
          <div className="font-mono" style={{ fontSize: '28px', fontWeight: 500, marginTop: '8px', color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {formatCurrency(portfolio.totalMarketValueTWD)}
          </div>
          <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
            原始總成本 {formatCurrency(portfolio.totalCostTWD)}
          </div>
        </Card>

        <Card padding="lg">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            未實現總損益
          </span>
          <div
            className="font-mono"
            style={{
              fontSize: '28px',
              fontWeight: 500,
              marginTop: '8px',
              lineHeight: 1.1,
              color: portfolio.totalProfitLossTWD >= 0 ? 'var(--gain)' : 'var(--loss)'
            }}
          >
            {portfolio.totalProfitLossTWD >= 0 ? '+' : ''}
            {formatCurrency(portfolio.totalProfitLossTWD)}
          </div>
          <div className="font-mono" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>累積報酬率</span>
              <span style={{ fontWeight: 500, color: portfolio.totalReturnRate >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                {portfolio.totalReturnRate >= 0 ? '+' : ''}{portfolio.totalReturnRate}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>年化 / 季化</span>
              <span style={{ fontWeight: 500, color: portfolio.totalAnnualizedReturnRate >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                {portfolio.totalAnnualizedReturnRate >= 0 ? '+' : ''}{portfolio.totalAnnualizedReturnRate}% / {portfolio.totalQuarterlyReturnRate >= 0 ? '+' : ''}{portfolio.totalQuarterlyReturnRate}%
              </span>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            今日預估損益 (NT$)
          </span>
          <div
            className="font-mono"
            style={{
              fontSize: '28px',
              fontWeight: 500,
              marginTop: '8px',
              lineHeight: 1.1,
              color: portfolio.todayProfitLossTWD >= 0 ? 'var(--gain)' : 'var(--loss)'
            }}
          >
            {portfolio.todayProfitLossTWD >= 0 ? '+' : ''}
            {formatCurrency(portfolio.todayProfitLossTWD)}
          </div>
          <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span>持有 {safeHoldings.length} 檔</span>
            <span>加權持有 {portfolio.weightedDaysHeld} 天</span>
          </div>
        </Card>
      </div>

      {/* 持倉列表 Grid */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
          持倉股票明細 ({safeHoldings.length})
        </h3>

        <div className="grid-2">
          {safeHoldings.map((h) => (
            <StockCard key={h.id} holding={h} onTrade={handleTradeHolding} />
          ))}
        </div>

        {safeHoldings.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
            尚無股票持倉記錄，點擊「搜尋股票」或「自訂建倉」開始記錄
          </Card>
        )}
      </div>

      {/* 股票搜尋彈窗 */}
      <StockSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectStock={handleSelectFromSearch}
      />

      {/* 買賣交易表單彈窗 */}
      <Modal
        isOpen={isTradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        title="股票交易與股利紀錄"
      >
        <StockTradeForm
          stock={selectedStock}
          onSuccess={() => setTradeModalOpen(false)}
          onCancel={() => setTradeModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
