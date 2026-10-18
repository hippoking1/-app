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
  Sun,
  X
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTotalNetWorth } from '@/hooks/useFirestore';
import { formatCurrency } from '@/utils/analytics';
import { logout } from '@/services/auth';
import { CURRENT_VERSION } from '@/hooks/useVersionUpdater';

export const NAV_ITEMS = [
  { to: '/', label: '財務總覽', shortLabel: '總覽', icon: LayoutDashboard },
  { to: '/transactions', label: '收支明細', shortLabel: '明細', icon: ReceiptText },
  { to: '/ai', label: 'AI 智能記帳', shortLabel: 'AI 記帳', icon: Sparkles, highlight: true },
  { to: '/stocks', label: '股票投資', shortLabel: '股票', icon: TrendingUp },
  { to: '/budget', label: '預算管理', shortLabel: '預算', icon: Target },
  { to: '/analytics', label: '花費分析', shortLabel: '分析', icon: PieChart },
  { to: '/accounts', label: '帳戶資產', shortLabel: '帳戶', icon: WalletCards },
  { to: '/settings', label: '系統設定', shortLabel: '設定', icon: Settings }
];

interface SidebarProps {
  isMobileDrawer?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileDrawer = false, onCloseMobile }) => {
  const {
    user,
    theme,
    toggleTheme,
    isSidebarCollapsed,
    toggleSidebar,
    setTransactionModalOpen
  } = useAppStore();
  const { totalNetWorth } = useTotalNetWorth();

  const collapsed = isMobileDrawer ? false : isSidebarCollapsed;

  return (
    <aside
      style={{
        width: isMobileDrawer
          ? '280px'
          : collapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: isMobileDrawer ? 1001 : 50,
        overflow: 'hidden',
        paddingTop: isMobileDrawer ? 'var(--safe-top, max(env(safe-area-inset-top, 0px), 52px))' : 0,
        paddingBottom: isMobileDrawer ? 'var(--safe-bottom, max(env(safe-area-inset-bottom, 0px), 16px))' : 0
      }}
    >
      {/* 頂部 LOGO、快速記帳按鈕與導航列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: 'var(--space-5) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          {!collapsed && (
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
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                  智慧記帳
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}
                >
                  v{CURRENT_VERSION}
                </span>
              </div>
            </div>
          )}

          {isMobileDrawer ? (
            <button
              onClick={onCloseMobile}
              aria-label="關閉選單"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          ) : (
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
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>

        {/* 快速新增記帳按鈕 */}
        <div style={{ padding: 'var(--space-3) var(--space-3)', flexShrink: 0 }}>
          <button
            onClick={() => {
              onCloseMobile?.();
              setTransactionModalOpen(true);
            }}
            style={{
              width: '100%',
              padding: collapsed ? '10px 0' : '10px 16px',
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
            {!collapsed && <span>快速記一筆</span>}
          </button>
        </div>

        {/* 導航連結列表 */}
        <nav
          style={{
            padding: 'var(--space-2) var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onCloseMobile?.()}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--primary-glow)' : 'transparent',
                  border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
                  transition: 'all 0.15s',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  flexShrink: 0
                })}
              >
                <Icon size={18} color={item.highlight ? 'var(--purple)' : undefined} />
                {!collapsed && <span>{item.label}</span>}
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
          backgroundColor: 'var(--bg-tertiary)',
          flexShrink: 0
        }}
      >
        {!collapsed && (
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
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: '8px'
          }}
        >
          {!collapsed && (
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
                  fontSize: '13px',
                  flexShrink: 0
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
              onClick={() => {
                onCloseMobile?.();
                logout();
              }}
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
