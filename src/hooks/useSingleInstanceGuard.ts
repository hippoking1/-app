import { useEffect, useState, useCallback, useRef } from 'react';

const CHANNEL_NAME = 'smart_expense_single_instance_v1';
const INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface InstanceMessage {
  type: 'PING' | 'PONG' | 'TAKEOVER';
  senderId: string;
  timestamp: number;
}

export interface SingleInstanceState {
  isDuplicateTab: boolean;
  takeOverHere: () => void;
}

/**
 * 單一執行個體防多分頁守衛 (Single Instance Guard)
 * 透過 BroadcastChannel 偵測同瀏覽器/同裝置是否已開啟另一個視窗或分頁：
 * - 若已有主視窗在運行，新開的分頁會自動進入暫停保護狀態並嘗試喚醒既有視窗
 * - 支援點擊「切換至此視窗繼續使用」主動接管成為唯一活躍視窗
 */
export function useSingleInstanceGuard(): SingleInstanceState {
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);
  const isDuplicateRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<InstanceMessage>) => {
      const msg = event.data;
      if (!msg || msg.senderId === INSTANCE_ID) return;

      if (msg.type === 'PING') {
        // 只有當前處於活躍狀態（非重複分頁）的實例才回覆 PONG 並嘗試聚焦自己
        if (!isDuplicateRef.current) {
          channel.postMessage({
            type: 'PONG',
            senderId: INSTANCE_ID,
            timestamp: Date.now()
          } satisfies InstanceMessage);

          try {
            window.focus();
            window.electronAPI?.focusMainWindow();
          } catch {
            // 忽略瀏覽器安全限制
          }
        }
      } else if (msg.type === 'PONG') {
        // 收到既有活躍視窗回覆，代表本分頁為多開的第二個分頁
        if (!isDuplicateRef.current) {
          isDuplicateRef.current = true;
          setIsDuplicateTab(true);
        }
      } else if (msg.type === 'TAKEOVER') {
        // 另一個視窗要求強制接管，本視窗退讓為暫停狀態
        isDuplicateRef.current = true;
        setIsDuplicateTab(true);
      }
    };

    channel.addEventListener('message', handleMessage);

    // 啟動時發送 PING 詢問是否已有其他開啟中的視窗
    channel.postMessage({
      type: 'PING',
      senderId: INSTANCE_ID,
      timestamp: Date.now()
    } satisfies InstanceMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const takeOverHere = useCallback(() => {
    isDuplicateRef.current = false;
    setIsDuplicateTab(false);
    channelRef.current?.postMessage({
      type: 'TAKEOVER',
      senderId: INSTANCE_ID,
      timestamp: Date.now()
    } satisfies InstanceMessage);
  }, []);

  return {
    isDuplicateTab,
    takeOverHere
  };
}
