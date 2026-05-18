import React from 'react';

interface FactionLabelProps {
  hasRole: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export default function FactionLabel({ hasRole, onClick }: FactionLabelProps) {
  if (!hasRole) return null;

  return (
    <div className="faction-label">
      {/* 阵营标签切换按钮 - 圆形小按钮，位于座位左上角，带有天平图标 */}
      <button 
        className="faction-toggle-btn"
        onClick={onClick}
        title="点击切换阵营"
        style={{
          position: 'absolute' as const,
          top: '-5px' as const,
          left: '-5px' as const,
          width: '24px' as const,
          height: '24px' as const,
          borderRadius: '50%' as const,
          background: 'rgba(0, 0, 0, 0.8)' as const,
          color: 'white' as const,
          border: '1px solid rgba(255, 255, 255, 0.3)' as const,
          cursor: 'pointer' as const,
          display: 'flex' as const,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          zIndex: 1002 as const,
          transition: 'all 0.3s ease' as const,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' as const
        }}
      >
        <i className="fa fa-balance-scale" style={{ fontSize: '12px' as const }}></i>
      </button>
    </div>
  );
}
