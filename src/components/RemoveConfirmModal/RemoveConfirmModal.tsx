import React, { useEffect, useRef } from 'react';

interface RemoveConfirmModalProps {
  seatId: number;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RemoveConfirmModal({ seatId, isOpen, onConfirm, onCancel }: RemoveConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        cursor: 'default'
      }}
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="popup-content"
        style={{
          padding: '24px',
          minWidth: '320px',
          maxWidth: '400px',
          backdropFilter: 'blur(10px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="modal-close-btn" 
          onClick={onCancel}
          aria-label="关闭"
        >
          &times;
        </button>
        <div style={{ textAlign: 'center' }}>
          <div 
            style={{
              fontSize: '48px',
              marginBottom: '16px',
              color: 'rgba(255, 0, 0, 0.8)'
            }}
          >
            ⚠️
          </div>
          
          <h3 
            style={{
              margin: '0 0 12px 0',
              color: 'white',
              fontSize: '18px',
              fontWeight: '600'
            }}
          >
            确认移除座位？
          </h3>
          
          <p 
            style={{
              margin: '0 0 24px 0',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          >
            是否确认移除{seatId}号座位及该座位上的所有信息？<br/>
            此操作不可撤销。
          </p>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 28px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              取消
            </button>
            
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              style={{
                padding: '10px 28px',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
              }}
            >
              确认移除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}