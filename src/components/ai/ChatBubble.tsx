import React from 'react';
import { Bot, User } from 'lucide-react';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content?: string;
  children?: React.ReactNode;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, children }) => {
  const isUser = role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        width: '100%'
      }}
    >
      {/* 頭像 */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: isUser ? 'var(--primary)' : 'var(--bg-tertiary)',
          border: isUser ? 'none' : '1px solid var(--border)',
          color: isUser ? 'var(--on-primary)' : 'var(--accent-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {isUser ? <User size={16} strokeWidth={1.5} /> : <Bot size={16} strokeWidth={1.5} />}
      </div>

      {/* 訊息本體 */}
      <div
        style={{
          maxWidth: '85%',
          backgroundColor: isUser ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
          border: isUser ? '1px solid var(--border-focus)' : '1px solid var(--border)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          fontSize: '14px',
          lineHeight: 1.6
        }}
      >
        {content && <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>}
        {children}
      </div>
    </div>
  );
};
