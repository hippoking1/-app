import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, Sparkles, TrendingUp, PieChart, Plus } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export const BottomNav: React.FC = () => {
  const { setTransactionModalOpen } = useAppStore();

  const navItems = [
    { to: '/', label: '總覽', icon: LayoutDashboard },
    { to: '/transactions', label: '明細', icon: ReceiptText },
    { to: '/ai', label: 'AI記帳', icon: Sparkles },
    { to: '/stocks', label: '股票', icon: TrendingUp },
    { to: '/analytics', label: '分析', icon: PieChart }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-nav-height)',
        backgroundColor: 'var(--bg-glass-heavy)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 var(--space-2)',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0)'
      }}
    >
      {/* 前兩項 */}
      {navItems.slice(0, 2).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              flex: 1,
              padding: '6px 0',
              transition: 'color 0.2s'
            })}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}

      {/* 中央凸起快速新增按鈕 */}
      <div style={{ position: 'relative', top: '-14px', flex: 1, display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setTransactionModalOpen(true)}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            border: '4px solid var(--bg-primary)',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      </div>

      {/* 後三項 */}
      {navItems.slice(2).map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              textDecoration: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              flex: 1,
              padding: '6px 0',
              transition: 'color 0.2s'
            })}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};
