import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChatBubble } from '@/components/ai/ChatBubble';
import { ParsedTransactionCard } from '@/components/ai/ParsedTransactionCard';
import { useAccounts, useCategories } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { parseExpenseTextWithGemini } from '@/services/gas';
import { addTransaction } from '@/services/firestore';
import { ParsedTransaction, Transaction } from '@/types';
import { Sparkles, Send, Loader2, Zap, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  parsedTransactions?: ParsedTransaction[];
}

const QUICK_PROMPTS = [
  '今天午餐吃了拉麵 240 元，現金支付',
  '搭計程車去高鐵站 350 元，刷信用卡',
  '全聯買生活用品與鮮奶共 680 元',
  '早餐 60, 午餐 130, 晚餐 200, 飲料 50'
];

export const AIBookkeeper: React.FC = () => {
  const { user, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 您好！我是您的 Gemini 3.7 Flash 記帳助手。\n\n您可以直接用自然語言告訴我花費，例如：\n• 「今天在全聯買菜 580 元，刷中信卡」\n• 「早餐 60、午餐 120、晚餐 200」\n• 「昨天搭捷運 45 元，悠遊卡付款」\n\n我會自動為您分類並整理成記帳清單！`
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || !user || loading) return;

    const userMsgId = 'msg_' + Date.now();
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: text }
    ];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const parsedList = await parseExpenseTextWithGemini(
        text,
        categories.map((c) => ({ id: c.id, name: c.name })),
        accounts.map((a) => ({ id: a.id, name: a.name })),
        todayStr
      );

      const aiMsgId = 'msg_ai_' + Date.now();
      setMessages([
        ...newMessages,
        {
          id: aiMsgId,
          role: 'assistant',
          content: `✅ 已成功為您解析出 ${parsedList.length} 筆交易！請核對以下明細並確認寫入：`,
          parsedTransactions: parsedList
        }
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ 解析失敗: ${err.message || '無法連線至 AI 服務'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSingle = async (msgId: string, txIndex: number, finalTx: Transaction) => {
    if (!user) return;
    try {
      finalTx.userId = user.uid;
      await addTransaction(finalTx);
      addToast({ type: 'success', message: `已成功寫入：${finalTx.note} ($${finalTx.amount})` });

      // 從該訊息中移除此項目
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === msgId && msg.parsedTransactions) {
            const updated = [...msg.parsedTransactions];
            updated.splice(txIndex, 1);
            return { ...msg, parsedTransactions: updated };
          }
          return msg;
        })
      );
    } catch (err: any) {
      addToast({ type: 'error', message: '寫入失敗: ' + err.message });
    }
  };

  const handleRemoveSingle = (msgId: string, txIndex: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.parsedTransactions) {
          const updated = [...msg.parsedTransactions];
          updated.splice(txIndex, 1);
          return { ...msg, parsedTransactions: updated };
        }
        return msg;
      })
    );
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '520px', gap: 'var(--space-4)' }}>
      {/* 頂部標題 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} color="var(--purple)" /> Gemini 3.7 Flash 智能記帳
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            輸入日常白話文，自動完成分類、帳戶與日期比對
          </p>
        </div>
      </div>

      {/* 聊天訊息捲動區 */}
      <Card
        glass
        padding="md"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          overflowY: 'auto'
        }}
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} role={msg.role} content={msg.content}>
            {msg.parsedTransactions && msg.parsedTransactions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {msg.parsedTransactions.map((item, idx) => (
                  <ParsedTransactionCard
                    key={idx}
                    transaction={item}
                    accounts={accounts}
                    categories={categories}
                    onConfirm={(tx) => handleConfirmSingle(msg.id, idx, tx)}
                    onRemove={() => handleRemoveSingle(msg.id, idx)}
                  />
                ))}
              </div>
            )}
          </ChatBubble>
        ))}

        {loading && (
          <ChatBubble role="assistant">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Loader2 size={16} className="animate-spin" />
              <span>Gemini 正在理解語意並拆解帳目...</span>
            </div>
          </ChatBubble>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* 快捷常用範例按鈕 */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            💬 {p}
          </button>
        ))}
      </div>

      {/* 底部輸入框 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: 'flex', gap: '8px' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：今天全聯買菜 580 元、悠遊卡儲值 500、星巴克 165..."
          disabled={loading}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 16px',
            fontSize: '14px',
            color: 'var(--text-primary)',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)'
          }}
        />

        <Button
          type="submit"
          variant="primary"
          disabled={!input.trim() || loading}
          icon={<Send size={18} />}
          style={{ borderRadius: 'var(--radius-lg)', padding: '0 20px' }}
        >
          發送
        </Button>
      </form>
    </div>
  );
};
