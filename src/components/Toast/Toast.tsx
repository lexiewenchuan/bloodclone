import { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose?: () => void;
  duration?: number; // 可配置的持续时间，默认3秒
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  const [timeLeft, setTimeLeft] = useState(duration / 1000);

  // 倒计时
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 倒计时结束后自动关闭
  useEffect(() => {
    if (timeLeft === 0) {
      onClose?.();
    }
  }, [timeLeft, onClose]);

  // 根据类型获取不同的样式类
  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'error':
        return 'toast-error';
      case 'info':
      default:
        return 'toast-info';
    }
  };

  return (
    <div className={`toast ${getTypeClass()}`}>
      <span>{message}</span>
      <span style={{ 
        marginLeft: '10px', 
        fontSize: '12px',
        opacity: 0.7,
        minWidth: '20px'
      }}>
        {timeLeft}s
      </span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            marginLeft: '10px',
            fontSize: '14px',
          }}
        >
          <i className="fa fa-times"></i>
        </button>
      )}
    </div>
  );
}
