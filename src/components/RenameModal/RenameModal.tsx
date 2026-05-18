import React, { useState, useEffect, useRef } from 'react';

interface RenameModalProps {
  seatId: number;
  currentName: string;
  isOpen: boolean;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

export default function RenameModal({ seatId, currentName, isOpen, onConfirm, onCancel }: RenameModalProps) {
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(newName.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
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
    >
      <div 
        className="popup-content"
        style={{
          padding: '20px',
          minWidth: '300px',
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
        <h3 
          style={{
            margin: '0 0 20px 0',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'normal',
            textAlign: 'center'
          }}
        >
          请输入{seatId}号玩家名称
        </h3>
        
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入玩家名称"
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 24px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
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
              type="submit"
              style={{
                padding: '8px 24px',
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
              }}
            >
              确认
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}