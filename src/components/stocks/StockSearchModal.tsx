import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useStockSearch } from '@/hooks/useStockPrice';
import { StockSearchResult } from '@/types';
import { Search, TrendingUp, Loader2 } from 'lucide-react';
import { formatStockPrice } from '@/utils/analytics';

interface StockSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock: (stock: StockSearchResult) => void;
}

export const StockSearchModal: React.FC<StockSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectStock
}) => {
  const { keyword, setKeyword, results, loading } = useStockSearch();

  const handleSelect = (item: StockSearchResult) => {
    onSelectStock(item);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔍 搜尋股票 (台股 / 美股)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          placeholder="輸入代碼或名稱 (例如：2330、台積電、AAPL、NVDA)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          icon={<Search size={18} />}
          autoFocus
        />

        {/* 搜尋中狀態 */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader2 size={20} className="animate-spin" />
            <span>查詢最新行情中...</span>
          </div>
        )}

        {/* 搜尋結果列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
          {results.map((item) => (
            <button
              key={item.symbol}
              onClick={() => handleSelect(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: item.market === 'TW' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    color: item.market === 'TW' ? 'var(--income)' : 'var(--primary-light)'
                  }}
                >
                  {item.market}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {item.code} {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {item.symbol}
                  </div>
                </div>
              </div>

              {item.price > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontSize: '14px', fontWeight: 800 }}>
                    {item.currency === 'USD' ? 'US$' : '$'}
                    {formatStockPrice(item.price, item.currency)}
                  </div>
                </div>
              )}
            </button>
          ))}

          {!loading && keyword && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                上市/上櫃清單中查無「{keyword}」
              </div>
              <button
                type="button"
                onClick={() => {
                  const isNum = /^\d+$/.test(keyword);
                  handleSelect({
                    symbol: isNum ? `${keyword}.TW` : keyword.toUpperCase(),
                    code: keyword.toUpperCase(),
                    name: keyword.toUpperCase(),
                    market: isNum ? 'TW' : 'US',
                    currency: isNum ? 'TWD' : 'USD',
                    price: 0
                  });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ➕ 以自訂代碼「{keyword}」直接建立興櫃/初始持倉
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
