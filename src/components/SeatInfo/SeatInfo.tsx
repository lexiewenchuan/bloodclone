import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface SeatInfoProps {
  seatId: number;
  playerName: string;
  scaleFactor?: number;
  onSettingsClick: (e: React.MouseEvent) => void;
  // 小镇模式：该座位是否有玩家已坐下
  townSeatOccupied?: boolean;
}

export default function SeatInfo({ 
  seatId, 
  playerName, 
  scaleFactor = 1, 
  onSettingsClick,
  townSeatOccupied = false
}: SeatInfoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  const displayName = (playerName || '').trim();
  
  // 动态计算字体大小和最大显示字符数
  const { fontSize, truncatedName } = useMemo(() => {
    if (!displayName) return { fontSize: 11 * scaleFactor, truncatedName: '' };
    
    const maxWidth = 100 * scaleFactor;
    const padding = 12 * scaleFactor;
    const availableWidth = maxWidth - padding;
    
    // 初始字体大小
    let fontSize = 11 * scaleFactor;
    let truncatedName = displayName;
    
    // 计算合适的字体大小
    for (let size = 11; size >= 8; size--) {
      const scaledSize = size * scaleFactor;
      // 计算座位序号的宽度（假设最多2位数字 + "号"）
      const seatNumberWidth = (String(seatId).length + 1) * scaledSize * 0.8;
      
      // 计算分隔符宽度
      const separatorWidth = scaledSize * 0.3;
      
      // 可用于显示姓名的宽度
      const nameAvailableWidth = availableWidth - seatNumberWidth - separatorWidth;
      
      // 计算最大字符数（中文字符按fontSize计算，英文字符按fontSize*0.6计算）
      let totalWidth = 0;
      let maxChars = 0;
      
      for (let i = 0; i < displayName.length; i++) {
        const char = displayName[i];
        const charWidth = /[\u4e00-\u9fa5]/.test(char) ? scaledSize : scaledSize * 0.6;
        
        if (totalWidth + charWidth > nameAvailableWidth) {
          break;
        }
        
        totalWidth += charWidth;
        maxChars++;
      }
      
      if (maxChars < displayName.length) {
        truncatedName = displayName.slice(0, maxChars) + '...';
      } else {
        truncatedName = displayName;
        fontSize = scaledSize;
        break;
      }
    }
    
    return { fontSize, truncatedName };
  }, [displayName, seatId, scaleFactor]);

  return (
    <>
      <div className="seat-info" style={{ position: 'relative' }}>
        <div 
          className="seat-label" 
          onClick={onSettingsClick} 
          onMouseEnter={(e) => {
            setIsHovered(true);
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltipPosition({
              x: rect.left + rect.width / 2,
              y: rect.bottom + 4 * scaleFactor
            });
          }}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            marginTop: `${0.5 * scaleFactor}px`,
            textAlign: 'center',
            cursor: 'pointer',
            color: 'white',
            fontSize: `${fontSize}px`,
            lineHeight: '1.2em',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: `${100 * scaleFactor}px`,
            padding: `${4 * scaleFactor}px ${6 * scaleFactor}px`,
            borderRadius: `${4 * scaleFactor}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: townSeatOccupied ? '1px solid rgba(34, 197, 94, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            boxShadow: townSeatOccupied 
              ? `0 ${2 * scaleFactor}px ${8 * scaleFactor}px rgba(34, 197, 94, 0.2)` 
              : `0 ${2 * scaleFactor}px ${8 * scaleFactor}px rgba(0, 0, 0, 0.5)`,
            height: 'auto',
            minHeight: `${22 * scaleFactor}px`
          }}
        >
          {/* 座位信息组合显示 */}
          <span style={{ display: 'flex', alignItems: 'center', gap: `${2 * scaleFactor}px` }}>
            {/* 座位序号带单位，默认展示是 "xx号" */}
            <span className="seat-number" style={{ fontWeight: 'bold', color: '#ffd700' }}>{seatId}号</span>
            {/* 占用状态指示器 */}
            {townSeatOccupied && (
              <span 
                className="seat-occupied-indicator"
                style={{
                  display: 'inline-block',
                  width: `${6 * scaleFactor}px`,
                  height: `${6 * scaleFactor}px`,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 4px rgba(34, 197, 94, 0.8)',
                  flexShrink: 0
                }}
                title="已有玩家坐下"
              />
            )}
            {/* 分隔符 */}
            {displayName && (
              <span style={{ margin: '0', color: 'rgba(255, 255, 255, 0.6)' }}>·</span>
            )}
            {/* 玩家姓名 */}
            {displayName && (
              <span className="seat-player-name" style={{ 
                fontWeight: 'normal',
                flex: 1,
                minWidth: '0',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>{truncatedName}</span>
            )}
          </span>
        </div>
      </div>
      
      {/* Hover时显示完整文字的tooltip - 使用 Portal 渲染到 body，避免被 SVG 裁剪或定位错误 */}
      {isHovered && displayName && truncatedName !== displayName && createPortal(
        <div style={{
          position: 'fixed',
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: 'translateX(-50%)',
          padding: `${4 * scaleFactor}px ${8 * scaleFactor}px`,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          fontSize: `${10 * scaleFactor}px`,
          borderRadius: `${3 * scaleFactor}px`,
          whiteSpace: 'nowrap',
          zIndex: 10000,
          boxShadow: `0 ${2 * scaleFactor}px ${6 * scaleFactor}px rgba(0, 0, 0, 0.3)`,
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
          border: `1px solid rgba(255, 255, 255, 0.1)`,
          animation: 'tooltipFadeIn 0.15s ease-out'
        }}>
          {displayName}
        </div>,
        document.body
      )}
    </>
  );
}
