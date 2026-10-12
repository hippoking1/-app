import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = '確認操作',
  message,
  confirmText = '確定',
  cancelText = '取消',
  isDestructive = true,
  onConfirm,
  onCancel
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {isDestructive && (
            <div
              style={{
                padding: '8px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--expense, #ef4444)',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={24} />
            </div>
          )}
          <p
            style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)',
              margin: 0
            }}
          >
            {message}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            marginTop: '8px'
          }}
        >
          <Button variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
