import React, { ReactNode, useEffect } from 'react';

interface ModalProps {
  children: ReactNode;
  title: string;
  onClose: () => void;
  width?: string;
  height?: string;
  // 可选：额外的标题区域内容（例如按钮、搜索框等），会和标题同处 header 中
  headerExtra?: ReactNode;
}

export default function Modal({ children, title, onClose, width = '800px', height, headerExtra }: ModalProps) {
  // 处理点击模态框外部关闭
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 处理 ESC 键关闭
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ width, height }}>
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="关闭"
        >
          &times;
        </button>
        {title && (
          <div
            className="modal-header"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,              // 增大标题与功能区域的间距
              paddingBottom: 14,    // 在功能区域下方额外留白，让组件底部略微下沉
            }}
          >
            <h2 className="modal-title">{title}</h2>
            {headerExtra && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  width: '100%',
                }}
              >
                {headerExtra}
              </div>
            )}
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
