import React, { useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, TrendingUp, WalletCards, Plus } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { hapticLight, hapticMedium } from '@/utils/haptics';

export const BottomNav: React.FC = () => {
  const setTransactionModalOpen = useAppStore((s) => s.setTransactionModalOpen);
  const navigate = useNavigate();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const leftItems = [
    { to: '/', label: '總覽', icon: LayoutDashboard },
    { to: '/transactions', label: '明細', icon: ReceiptText }
  ];

  const rightItems = [
    { to: '/stocks', label: '股票', icon: TrendingUp },
    { to: '/accounts', label: '帳戶', icon: WalletCards }
  ];

  const handleFabClick = () => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    hapticLight();
    setTransactionModalOpen(true);
  };

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      hapticMedium();
      navigate('/ai');
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-deepest)',
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        minHeight: '64px',
        padding: '4px var(--space-2) var(--safe-bottom, max(env(safe-area-inset-bottom, 0px), 12px))',
        zIndex: 50
      }}
    >
      {/* 左側兩項 */}
      {leftItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => hapticLight()}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '48px',
              gap: '4px',
              textDecoration: 'none',
              color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s var(--ease-out)',
              touchAction: 'manipulation'
            })}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}

      {/* 正中央第 3 欄：FAB 記一筆（點擊：快速記帳 / 長按：AI 記帳） */}
      <div
        style={{
          position: 'relative',
          top: '-12px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <button
          onClick={handleFabClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          aria-label="快速記一筆（長按開啟 AI 記帳）"
          title="點擊：快速記帳 / 長按：AI 記帳"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--accent)',
            border: '2px solid var(--bg-primary)',
            color: 'var(--on-accent)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s var(--ease-out), background-color 0.15s var(--ease-out)',
            touchAction: 'manipulation'
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Plus size={22} strokeWidth={2} />
        </button>
      </div>

      {/* 右側兩項 */}
      {rightItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => hapticLight()}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '48px',
              gap: '4px',
              textDecoration: 'none',
              color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s var(--ease-out)',
              touchAction: 'manipulation'
            })}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};
