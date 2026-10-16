import React, { useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, TrendingUp, WalletCards, Plus, Menu } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { hapticLight, hapticMedium } from '@/utils/haptics';

export const BottomNav: React.FC = () => {
  const setTransactionModalOpen = useAppStore((s) => s.setTransactionModalOpen);
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen);
  const navigate = useNavigate();
  const location = useLocation();
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

  // 當位於 AI、預算、分析、設定頁面時，右側「選單」按鈕高亮顯示
  const isMoreRouteActive =
    isMobileMenuOpen ||
    ['/ai', '/budget', '/analytics', '/settings'].includes(location.pathname);

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
        height: 'var(--bottom-nav-height, 64px)',
        backgroundColor: 'var(--bg-glass-heavy)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 var(--space-1)',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0)'
      }}
    >
      {/* 前兩項 (總覽、明細) */}
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
              gap: '3px',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              flex: 1,
              padding: '4px 0',
              transition: 'color 0.2s',
              touchAction: 'manipulation'
            })}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}

      {/* 中央 FAB 記一筆（點擊：快速新增記帳 / 長按：進入 AI 記帳） */}
      <div
        style={{
          position: 'relative',
          top: '-14px',
          flex: 1,
          display: 'flex',
          justifyContent: 'center'
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
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            border: '4px solid var(--bg-primary)',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            touchAction: 'manipulation'
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </div>

      {/* 後兩項 (股票、帳戶) */}
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
              gap: '3px',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              flex: 1,
              padding: '4px 0',
              transition: 'color 0.2s',
              touchAction: 'manipulation'
            })}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}

      {/* 完整功能選單按鈕（開啟包含 AI 記帳、預算、分析、設定的完整側邊欄） */}
      <button
        onClick={() => {
          hapticLight();
          setMobileMenuOpen(!isMobileMenuOpen);
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '48px',
          gap: '3px',
          background: 'transparent',
          border: 'none',
          color: isMoreRouteActive ? 'var(--primary)' : 'var(--text-muted)',
          fontSize: '11px',
          fontWeight: isMoreRouteActive ? 700 : 500,
          flex: 1,
          padding: '4px 0',
          cursor: 'pointer',
          touchAction: 'manipulation'
        }}
      >
        <Menu size={20} />
        <span>完整選單</span>
      </button>
    </div>
  );
};
