import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText,
  Sparkles,
  TrendingUp,
  PieChart,
  Target,
  WalletCards,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTotalNetWorth } from '@/hooks/useFirestore';
import { formatCurrency } from '@/utils/analytics';
import { logout } from '@/services/auth';

export const Sidebar: React.FC = () => {
  const {
    user,
    theme,
    toggleTheme,
    isSidebarCollapsed,
    toggleSidebar,
    setTransactionModalOpen
  } = useAppStore();
  const { totalNetWorth } = useTotalNetWorth();

  const navItems = [
    { to: '/', label: '財務總覽', icon: LayoutDashboard },
    { to: '/transactions', label: '收支明細', icon: ReceiptText },
    { to: '/ai', label: 'AI 智能記帳', icon: Sparkles, highlight: true },
    { to: '/stocks', label: '股票投資', icon: TrendingUp },
    { to: '/budget', label: '預算管理', icon: Target },
    { to: '/analytics', label: '花費分析', icon: PieChart },
    { to: '/accounts', label: '帳戶資產', icon: WalletCards },
    { to: '/settings', label: '系統設定', icon: Settings }
  ];

  return (
    <aside
      style={{
        width: isSidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 40,
        overflow: 'hidden'
      }}
    >
      {/* 頂部 LOGO 與 收合按鈕 */}
      <div>
        <div
          style={{
            padding: 'var(--space-5) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border)'
          }}
        >
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
                }}
              >
                <Sparkles size={18} />
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                智慧記帳
              </span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* 快速新增記帳按鈕 */}
        <div style={{ padding: 'var(--space-3) var(--space-3)' }}>
          <button
            onClick={() => setTransactionModalOpen(true)}
            style={{
              width: '100%',
              padding: isSidebarCollapsed ? '10px 0' : '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              transition: 'transform 0.15s'
            }}
          >
            <Plus size={18} />
            {!isSidebarCollapsed && <span>快速記一筆</span>}
          </button>
        </div>

        {/* 導航連結列表 */}
        <nav style={{ padding: 'var(--space-2) var(--space-3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--primary-glow)' : 'transparent',
                  border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
                  transition: 'all 0.15s',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start'
                })}
              >
                <Icon size={18} color={item.highlight ? 'var(--purple)' : undefined} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* 底部使用者資訊與操作列 */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-tertiary)'
        }}
      >
        {!isSidebarCollapsed && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              淨資產估計
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatCurrency(totalNetWorth)}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            gap: '8px'
          }}
        >
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                {user?.displayName ? user.displayName.slice(0, 1) : '訪'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {user?.displayName || '訪客'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {user?.isAnonymous ? '訪客帳號' : '已登入'}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={toggleTheme}
              title="切換深淺主題"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => logout()}
              title="登出"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
