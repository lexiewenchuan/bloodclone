import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonRef?: React.RefObject<HTMLButtonElement>;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = '确认',
  cancelText = '取消',
  confirmButtonRef,
  onConfirm, 
  onCancel,
  isDanger = true
}: ConfirmModalProps) {
  useEffect(() => {
    if (isOpen && confirmButtonRef?.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen, confirmButtonRef]);

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
              color: isDanger ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 193, 7, 0.8)'
            }}
          >
            {isDanger ? '⚠️' : 'ℹ️'}
          </div>
          
          <h3 
            style={{
              margin: '0 0 12px 0',
              color: 'white',
              fontSize: '18px',
              fontWeight: '600'
            }}
          >
            {title}
          </h3>
          
          <p 
            style={{
              margin: '0 0 24px 0',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
            dangerouslySetInnerHTML={{ __html: message }}
          />
          
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
              {cancelText}
            </button>
            
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              style={{
                padding: '10px 28px',
                backgroundColor: isDanger ? 'rgba(239, 68, 68, 0.8)' : 'rgba(66, 153, 225, 0.8)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDanger ? 'rgba(239, 68, 68, 1)' : 'rgba(66, 153, 225, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDanger ? 'rgba(239, 68, 68, 0.8)' : 'rgba(66, 153, 225, 0.8)';
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
