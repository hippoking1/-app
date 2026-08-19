import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useStockSearch } from '@/hooks/useStockPrice';
import { StockSearchResult } from '@/types';
import { Search, PlusCircle, Loader2, Sparkles } from 'lucide-react';
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

  const trimmed = keyword.trim();
  const isNumericCode = /^\d+$/.test(trimmed);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔍 搜尋股票行情 (台股 / 興櫃 / 美股)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          placeholder="輸入代碼或名稱 (例如：7829、2330、台積電、AAPL)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          icon={<Search size={18} />}
          autoFocus
        />

        {/* 只要有輸入代碼，始終提供「以代碼建立持倉」快捷列 */}
        {trimmed && (
          <button
            type="button"
            onClick={() =>
              handleSelect({
                symbol: isNumericCode ? `${trimmed}.TW` : trimmed.toUpperCase(),
                code: trimmed.toUpperCase(),
                name: trimmed.toUpperCase(),
                market: isNumericCode ? 'TW' : 'US',
                currency: isNumericCode ? 'TWD' : 'USD',
                price: 0
              })
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              backgroundColor: 'var(--primary-glow)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={18} color="var(--primary-light)" />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>
                直接以「{trimmed}」建立興櫃 / 自訂股票持倉
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--primary-light)', fontWeight: 600 }}>
              點擊建倉 ➔
            </span>
          </button>
        )}

        {/* 搜尋中狀態 */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader2 size={20} className="animate-spin" />
            <span>查詢行情中...</span>
          </div>
        )}

        {/* 搜尋結果列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
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
        </div>
      </div>
    </Modal>
  );
};
