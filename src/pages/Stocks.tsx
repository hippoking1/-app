import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StockCard } from '@/components/stocks/StockCard';
import { StockSearchModal } from '@/components/stocks/StockSearchModal';
import { StockTradeForm } from '@/components/stocks/StockTradeForm';
import { useStockHoldings } from '@/hooks/useFirestore';
import { useBatchUpdateHoldings } from '@/hooks/useStockPrice';
import { StockHolding, StockSearchResult } from '@/types';
import { calculatePortfolioSummary } from '@/utils/stockCalculations';
import { formatCurrency } from '@/utils/analytics';
import { TrendingUp, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';

export const Stocks: React.FC = () => {
  const { holdings } = useStockHoldings();
  const { updateAllPrices, isUpdating } = useBatchUpdateHoldings(holdings);

  const [isSearchModalOpen, setSearchModalOpen] = useState(false);
  const [isTradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | StockHolding | undefined>(undefined);

  const portfolio = calculatePortfolioSummary(holdings);

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
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
            股票資產與即時淨值
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            台股盤後 OpenAPI 與美股 Finnhub 即時報價整合
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={updateAllPrices}
            loading={isUpdating}
            icon={<RefreshCw size={16} />}
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
            icon={<Plus size={16} />}
          >
            🎯 初始自訂建倉 (含興櫃)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setSearchModalOpen(true)}
            icon={<Search size={16} />}
          >
            搜尋股票行情
          </Button>
        </div>
      </div>

      {/* 投資組合總結卡片 */}
      <div className="grid-3">
        <Card glass padding="lg">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            持倉總市值 (折合 NT$)
          </span>
          <div className="font-mono" style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px' }}>
            {formatCurrency(portfolio.totalMarketValueTWD)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            原始持有總成本: {formatCurrency(portfolio.totalCostTWD)}
          </div>
        </Card>

        <Card glass padding="lg">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            未實現總損益 (金額 / 報酬率)
          </span>
          <div
            className="font-mono"
            style={{
              fontSize: '28px',
              fontWeight: 900,
              marginTop: '6px',
              color: portfolio.totalProfitLossTWD >= 0 ? 'var(--income)' : 'var(--expense)'
            }}
          >
            {portfolio.totalProfitLossTWD >= 0 ? '+' : ''}
            {formatCurrency(portfolio.totalProfitLossTWD)}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '8px',
              color: portfolio.totalReturnRate >= 0 ? 'var(--income)' : 'var(--expense)'
            }}
          >
            總報酬率: {portfolio.totalReturnRate >= 0 ? '+' : ''}{portfolio.totalReturnRate}%
          </div>
        </Card>

        <Card glass padding="lg">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            今日預估損益 (TWD)
          </span>
          <div
            className="font-mono"
            style={{
              fontSize: '28px',
              fontWeight: 900,
              marginTop: '6px',
              color: portfolio.todayProfitLossTWD >= 0 ? 'var(--income)' : 'var(--expense)'
            }}
          >
            {portfolio.todayProfitLossTWD >= 0 ? '+' : ''}
            {formatCurrency(portfolio.todayProfitLossTWD)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            持有股票檔數: {holdings.length} 檔
          </div>
        </Card>
      </div>

      {/* 持倉列表 Grid */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
          📈 持倉股票明細 ({holdings.length})
        </h3>

        <div className="grid-2">
          {holdings.map((h) => (
            <StockCard key={h.id} holding={h} onTrade={handleTradeHolding} />
          ))}
        </div>

        {holdings.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            目前尚無任何股票持倉記錄。點擊右上角「新增持股 / 買入」搜尋並記錄第一筆股票！
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
        title="📊 股票交易紀錄 (買進 / 賣出)"
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
