import React from 'react';

interface DeathStatusLabelProps {
  isDead: boolean;
  showTag: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: (e: React.MouseEvent) => void;
}

export default function DeathStatusLabel({ 
  isDead, 
  showTag, 
  onMouseEnter, 
  onMouseLeave, 
  onClick 
}: DeathStatusLabelProps) {
  return (
    <div 
      className="death-status-label"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        position: 'absolute' as const,
        top: '-15px' as const,
        left: '50%' as const,
        transform: 'translateX(-50%)' as const,
        zIndex: 1001 as const,
        cursor: 'pointer' as const,
        transition: 'all 0.2s ease' as const
      }}
    >
      <div 
        className={`death-label ${isDead || showTag ? 'show' : ''}`}
        title="点击切换生死状态"
        style={{
          display: (isDead || showTag) ? 'block' as const : 'none' as const,
          animation: (isDead || showTag) ? 'fadeIn 0.3s ease' : 'none' as const
        }}
      >
        {/* 生死状态标签图 - 使用自定义WebP图片，盖在座位上面 */}
        <img 
          src="image/biaoqian.webp" 
          alt="死亡标签" 
          loading="lazy"
          style={{ 
            width: '48px' as const, 
            height: '48px' as const,
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))' as const
          }}
        />
      </div>
    </div>
  );
}
