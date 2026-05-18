import React, { useState, useRef } from 'react';

interface BackgroundModalProps {
  isOpen: boolean;
  onConfirm: (dayImage: string | null, nightImage: string | null) => void;
  onCancel: () => void;
}

export default function BackgroundModal({ isOpen, onConfirm, onCancel }: BackgroundModalProps) {
  const [dayImage, setDayImage] = useState<File | null>(null);
  const [nightImage, setNightImage] = useState<File | null>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  const nightInputRef = useRef<HTMLInputElement>(null);

  const handleDayImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDayImage(file);
    }
  };

  const handleNightImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNightImage(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const processImage = (file: File | null): Promise<string | null> => {
      if (!file) return Promise.resolve(null);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    };

    Promise.all([
      processImage(dayImage),
      processImage(nightImage)
    ]).then(([dayDataUrl, nightDataUrl]) => {
      onConfirm(dayDataUrl, nightDataUrl);
    });
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
      onKeyDown={handleKeyDown}
    >
      <div 
        className="popup-content"
        style={{
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
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
            fontSize: '18px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}
        >
          更换魔典背景
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label 
              style={{
                display: 'block',
                color: '#d4af37',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}
            >
              <i className="fa fa-sun-o"></i> 白天背景
            </label>
            <input
              ref={dayInputRef}
              type="file"
              accept="image/*"
              onChange={handleDayImageChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {dayImage && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px'
              }}>
                已选择: {dayImage.name}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label 
              style={{
                display: 'block',
                color: '#d4af37',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px'
              }}
            >
              <i className="fa fa-moon-o"></i> 夜晚背景
            </label>
            <input
              ref={nightInputRef}
              type="file"
              accept="image/*"
              onChange={handleNightImageChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {nightImage && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px'
              }}>
                已选择: {nightImage.name}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 24px',
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
                padding: '10px 24px',
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
              确认更换
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
