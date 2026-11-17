import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText,
  Bot,
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
  X,
  Plane
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTotalNetWorth, useTrips } from '@/hooks/useFirestore';
import { formatCurrency } from '@/utils/analytics';
import { logout } from '@/services/auth';
import { CURRENT_VERSION } from '@/hooks/useVersionUpdater';
import { BrandMark } from '@/components/common/BrandMark';

export const NAV_GROUPS = [
  {
    label: '帳務',
    items: [
      { to: '/', label: '財務總覽', shortLabel: '總覽', icon: LayoutDashboard },
      { to: '/transactions', label: '收支明細', shortLabel: '明細', icon: ReceiptText },
      { to: '/travel', label: '旅行記帳', shortLabel: '旅行', icon: Plane },
      { to: '/ai', label: 'AI 智能記帳', shortLabel: 'AI 記帳', icon: Bot }
    ]
  },
  {
    label: '資產',
    items: [
      { to: '/accounts', label: '帳戶資產', shortLabel: '帳戶', icon: WalletCards },
      { to: '/stocks', label: '股票投資', shortLabel: '股票', icon: TrendingUp },
      { to: '/budget', label: '預算管理', shortLabel: '預算', icon: Target },
      { to: '/analytics', label: '花費分析', shortLabel: '分析', icon: PieChart }
    ]
  },
  {
    label: '系統',
    items: [
      { to: '/settings', label: '系統設定', shortLabel: '設定', icon: Settings }
    ]
  }
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
  const { activeTrip } = useTrips();

  const collapsed = isMobileDrawer ? false : isSidebarCollapsed;

  return (
    <aside
      style={{
        width: isMobileDrawer
          ? '264px'
          : collapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-deepest)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.25s var(--ease-out)',
        zIndex: isMobileDrawer ? 1001 : 50,
        overflow: 'hidden',
        paddingTop: isMobileDrawer ? 'var(--safe-top, max(env(safe-area-inset-top, 0px), 52px))' : 0,
        paddingBottom: isMobileDrawer ? 'var(--safe-bottom, max(env(safe-area-inset-bottom, 0px), 16px))' : 0
      }}
    >
      {/* 頂部 LOGO、快速記帳按鈕與分組導航 */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          style={{
            height: '60px',
            padding: '0 var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BrandMark size={28} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                  智慧記帳
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)'
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
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={toggleSidebar}
              aria-label={collapsed ? '展開側邊欄' : '收合側邊欄'}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {collapsed ? <ChevronRight size={16} strokeWidth={1.5} /> : <ChevronLeft size={16} strokeWidth={1.5} />}
            </button>
          )}
        </div>

        {/* 快速記一筆按鈕 */}
        <div style={{ padding: 'var(--space-4) var(--space-3) var(--space-2)', flexShrink: 0 }}>
          <button
            onClick={() => {
              onCloseMobile?.();
              setTransactionModalOpen(true);
            }}
            style={{
              width: '100%',
              height: '36px',
              padding: collapsed ? '0' : '0 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
              border: '1px solid transparent',
              boxShadow: 'var(--highlight-top)',
              fontWeight: 500,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s var(--ease-out), transform 0.12s var(--ease-out)'
            }}
          >
            <Plus size={16} strokeWidth={2} />
            {!collapsed && <span>快速記一筆</span>}
          </button>
        </div>

        {/* 分組導航連結列表 */}
        <nav
          style={{
            padding: 'var(--space-2) var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {NAV_GROUPS.map((group, groupIdx) => (
            <div
              key={group.label}
              style={{
                marginTop: groupIdx === 0 ? '4px' : '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              {!collapsed && (
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    padding: '0 10px 6px'
                  }}
                >
                  {group.label}
                </div>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => onCloseMobile?.()}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      height: '34px',
                      padding: collapsed ? '0' : '0 10px',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                      borderLeft: !collapsed && isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      boxShadow: isActive ? 'var(--highlight-top)' : 'none',
                      transition: 'background-color 0.15s var(--ease-out), color 0.15s var(--ease-out)',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      flexShrink: 0
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          style={{
                            width: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                            flexShrink: 0
                          }}
                        >
                          <Icon size={16} strokeWidth={1.5} />
                        </span>
                        {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                        {item.to === '/travel' && activeTrip && (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--income)',
                              marginLeft: collapsed ? 0 : 'auto',
                              flexShrink: 0
                            }}
                            title={`旅途中模式：${activeTrip.name}`}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* 底部淨資產摘要與使用者操作列 */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0
        }}
      >
        {!collapsed && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
              淨資產估計
            </div>
            <div className="font-mono" style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
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
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
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
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {user?.displayName || '訪客'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
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
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
