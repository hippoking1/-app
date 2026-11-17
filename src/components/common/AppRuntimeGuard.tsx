import React from 'react';
import { useVersionUpdater } from '@/hooks/useVersionUpdater';
import { useSingleInstanceGuard } from '@/hooks/useSingleInstanceGuard';
import { RefreshCw, Layers, X, MonitorSmartphone, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * 全域執行期守護元件：
 * 1. 負責啟動時與切回前景時自動偵測最新版本並智慧無感更新
 * 2. 負責攔截並防止同一瀏覽器同時開啟多個分頁操作
 */
export const AppRuntimeGuard: React.FC = () => {
  const {
    currentVersion,
    latestVersion,
    hasUpdate,
    isUpdating,
    isDismissed,
    setDismissed,
    applyUpdate
  } = useVersionUpdater();

  const { isDuplicateTab, takeOverHere } = useSingleInstanceGuard();

  // 1. 若偵測到重複開啟的多餘瀏覽器分頁，顯示單一實例保護畫面
  if (isDuplicateTab) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'var(--bg-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-focus)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px 24px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-text)'
            }}
          >
            <Layers size={22} strokeWidth={1.5} />
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            智慧記帳已在另一個視窗開啟
          </h2>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            為避免同時開啟多個分頁造成記帳資料不同步，系統已暫停此分頁。
            建議至「系統設定」安裝電腦版 (.exe) 或手機版獨立 App，以單一視窗運行。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '4px' }}>
            <Button
              variant="primary"
              fullWidth
              onClick={takeOverHere}
              icon={<MonitorSmartphone size={16} strokeWidth={1.5} />}
            >
              切換至此視窗繼續使用
            </Button>

            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                window.close();
              }}
            >
              關閉此分頁
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 正在執行智慧無感自動更新時的過渡畫面
  if (isUpdating) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          backgroundColor: 'var(--bg-overlay)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-focus)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <RefreshCw size={20} strokeWidth={1.5} color="var(--accent-text)" className="animate-spin" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              正在更新至 v{latestVersion || currentVersion}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              正在同步最新版本並清理快取，請稍候
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. 若在使用者操作過程中偵測到新版本，顯示不打斷輸入的懸浮更新橫幅
  if (hasUpdate && !isDismissed) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-top, 52px) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9990,
          width: 'calc(100% - 32px)',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-focus)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ArrowUpCircle size={18} strokeWidth={1.5} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              發現新版本 v{latestVersion || currentVersion}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              套用更新不影響現有帳務資料
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <Button
            variant="accent"
            size="sm"
            onClick={applyUpdate}
            icon={<RefreshCw size={14} strokeWidth={1.5} />}
          >
            立即更新
          </Button>
          <button
            onClick={() => setDismissed(true)}
            title="稍後更新"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
