import { useState, useEffect, useLayoutEffect, useRef } from 'react';

interface SeatPanelProps {
  seatIndex: number;
  playerName: string;
  isVisible: boolean;
  position: { x: number; y: number };
  onRename: (index: number) => void;
  onRemove: (index: number) => void;
  onAddSeatBefore?: (index: number) => void;
  onAddSeatAfter?: (index: number) => void;
  onSwap: (index: number) => void;
  onClose: () => void;
  scaleFactor?: number;
}

export default function SeatPanel({
  seatIndex,
  playerName,
  isVisible,
  position,
  onRename,
  onRemove,
  onAddSeatBefore,
  onAddSeatAfter,
  onSwap,
  onClose,
  scaleFactor = 1
}: SeatPanelProps) {
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // 获取全局缩放因子（与 desktop-device 样式一致）
    const getGlobalScale = () => {
      const container = document.querySelector('.container.desktop-device');
      if (container) {
        const scale = getComputedStyle(container).transform;
        if (scale && scale !== 'none') {
          // 解析 matrix(a, b, c, d, e, f) 中的 a（X轴缩放）
          const match = scale.match(/matrix\(([^,]+),/);
          if (match) return parseFloat(match[1]) || 1;
        }
      }
      return 1;
    };

    // 计算面板位置，确保与玩家信息组件底部对齐
    const calculatePanelPosition = () => {
      const globalScale = getGlobalScale();
      
      // 获取玩家信息组件的DOM元素
      const seatInfoElement = document.querySelector(`[data-seat-index="${seatIndex}"] .seat-info-container`);
      if (seatInfoElement) {
        const rect = seatInfoElement.getBoundingClientRect();
        
        // 计算面板位置：从玩家信息组件内部弹出，底部对齐
        // 由于 getBoundingClientRect 返回的是缩放后的坐标，需要除以缩放因子得到原始坐标
        const panelX = rect.right / globalScale;
        
        // 动态获取面板高度
        let panelHeight = 0;
        if (panelRef.current) {
          panelHeight = panelRef.current.offsetHeight;
        }
        
        // 使用 top 定位，确保面板底部与信息组件底部对齐
        // rect.bottom 是信息组件下边缘的Y坐标（已缩放）
        // panelHeight 是面板的高度（未缩放，因为 panel 是 fixed 定位在缩放容器外）
        // 需要统一坐标系：将 rect.bottom 转换为未缩放坐标
        const panelY = (rect.bottom / globalScale) - panelHeight;
        
        setPanelPosition({ x: panelX, y: panelY });
      } else {
        // 如果找不到玩家信息组件，使用备用方案：根据座位位置计算
        console.warn(`找不到座位 ${seatIndex} 的玩家信息组件，使用备用位置计算`);
        
        // 尝试获取座位token元素
        const seatTokenElement = document.querySelector(`[data-seat-index="${seatIndex}"] .seat-token-container`);
        if (seatTokenElement) {
          const rect = seatTokenElement.getBoundingClientRect();
          const panelX = rect.right / globalScale;
          
          let panelHeight = 0;
          if (panelRef.current) {
            panelHeight = panelRef.current.offsetHeight;
          }
          
          const panelY = (rect.bottom / globalScale) - panelHeight;
          setPanelPosition({ x: panelX, y: panelY });
        }
      }
    };

    if (isVisible) {
      // 立即计算
      calculatePanelPosition();
      
      // 监听窗口大小变化和滚动事件
      window.addEventListener('resize', calculatePanelPosition);
      window.addEventListener('scroll', calculatePanelPosition);
      
      // 使用ResizeObserver监听面板高度变化
      if (panelRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          calculatePanelPosition();
        });
        
        resizeObserver.observe(panelRef.current);
        
        return () => {
          window.removeEventListener('resize', calculatePanelPosition);
          window.removeEventListener('scroll', calculatePanelPosition);
          resizeObserver.disconnect();
        };
      }
      
      return () => {
        window.removeEventListener('resize', calculatePanelPosition);
        window.removeEventListener('scroll', calculatePanelPosition);
      };
    }
  }, [isVisible, seatIndex]);

  // 监听面板高度变化，重新计算位置
  useEffect(() => {
    if (isVisible) {
      const updatePositionBasedOnHeight = () => {
        // 由于改为使用 bottom 定位，面板高度变化会自动向上延伸，不需要重新计算位置
        // 除非高度变化导致位置发生根本性改变（如超出屏幕），这里暂时保留逻辑以应对未来需求
        // 但目前的 bottom 定位已经能自动处理高度变化了
      };

      // 使用ResizeObserver监听面板高度变化
      if (panelRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          updatePositionBasedOnHeight();
        });
        
        resizeObserver.observe(panelRef.current);
        
        return () => {
          resizeObserver.disconnect();
        };
      }
    }
  }, [isVisible, seatIndex]);

  // 点击任意位置关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isVisible && panelRef.current) {
        const target = event.target as Node;
        
        // 检查是否点击了面板内部
        const isInsidePanel = panelRef.current.contains(target);
        
        // 检查是否点击了触发该面板的座位信息组件
        // 如果是，则不处理（交给App.tsx中的handleSettingsClick处理toggle逻辑）
        const seatInfoElement = document.querySelector(`[data-seat-index="${seatIndex}"] .seat-info-container`);
        if (seatInfoElement && seatInfoElement.contains(target)) {
          return;
        }
        
        // 检查是否点击了弹窗相关元素
        const targetElement = target as HTMLElement;
        const isModal = targetElement.closest('[role="dialog"]') || 
                      targetElement.closest('.modal') || 
                      targetElement.closest('.modal-overlay');
        
        // 只有在面板外部且非弹窗区域时才关闭面板
        if (!isInsidePanel && !isModal) {
          onClose();
        }
      }
    };

    if (isVisible) {
      // 延迟添加事件监听器，避免立即触发关闭
      // 使用 capture: true 捕获阶段监听，确保在事件冒泡被阻止前捕获到点击
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside, { capture: true });
      }, 0);
      
      return () => {
        document.removeEventListener('click', handleClickOutside, { capture: true });
      };
    }
  }, [isVisible, onClose, seatIndex]);

  if (!isVisible) return null;

  // 处理面板内容点击，阻止事件冒泡
  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      ref={panelRef}
      className="seat-panel"
      onClick={handlePanelClick}
      style={{
        position: 'fixed',
        left: `${panelPosition.x}px`,
        top: `${panelPosition.y}px`,
        zIndex: 10000,
        minWidth: `${90 * scaleFactor}px`,
        background: 'rgba(0, 0, 0, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderLeft: 'none',
        borderTopLeftRadius: `${4 * scaleFactor}px`,
        borderBottomLeftRadius: `${4 * scaleFactor}px`,
        borderTopRightRadius: `${4 * scaleFactor}px`,
        borderBottomRightRadius: `${4 * scaleFactor}px`,
        padding: `${8 * scaleFactor}px`,
        boxShadow: `0 ${2 * scaleFactor}px ${8 * scaleFactor}px rgba(0, 0, 0, 0.5)`,
        backdropFilter: 'blur(2px)',
        animation: 'slideInFromRight 0.15s ease-out'
      }}
    >
      {/* 功能按钮 - 调整字体大小和间距 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * scaleFactor}px` }}>
        <button
          onClick={() => onRename(seatIndex)}
          style={{
            padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: `${3 * scaleFactor}px`,
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: `${12 * scaleFactor}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: `${5 * scaleFactor}px`,
            transition: 'all 0.15s ease',
            fontWeight: 'normal'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <i className="fa fa-edit" style={{ fontSize: `${11 * scaleFactor}px` }}></i>
          <span>改名</span>
        </button>

        {onAddSeatBefore && (
          <button
            onClick={() => onAddSeatBefore(seatIndex)}
            style={{
              padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: `${3 * scaleFactor}px`,
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: `${12 * scaleFactor}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: `${5 * scaleFactor}px`,
              transition: 'all 0.15s ease',
              fontWeight: 'normal'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <i className="fa fa-plus" style={{ fontSize: `${11 * scaleFactor}px` }}></i>
            <span>向前添加</span>
          </button>
        )}

        {onAddSeatAfter && (
          <button
            onClick={() => onAddSeatAfter(seatIndex)}
            style={{
              padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: `${3 * scaleFactor}px`,
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: `${12 * scaleFactor}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: `${5 * scaleFactor}px`,
              transition: 'all 0.15s ease',
              fontWeight: 'normal'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <i className="fa fa-plus" style={{ fontSize: `${11 * scaleFactor}px` }}></i>
            <span>向后添加</span>
          </button>
        )}

        <button
          onClick={() => onRemove(seatIndex)}
          style={{
            padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: `${3 * scaleFactor}px`,
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: `${12 * scaleFactor}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: `${5 * scaleFactor}px`,
            transition: 'all 0.15s ease',
            fontWeight: 'normal'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <i className="fa fa-trash" style={{ fontSize: `${11 * scaleFactor}px` }}></i>
          <span>移除</span>
        </button>

        <button
          onClick={() => onSwap(seatIndex)}
          style={{
            padding: `${6 * scaleFactor}px ${8 * scaleFactor}px`,
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: `${3 * scaleFactor}px`,
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: `${12 * scaleFactor}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: `${5 * scaleFactor}px`,
            transition: 'all 0.15s ease',
            fontWeight: 'normal'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <i className="fa fa-exchange" style={{ fontSize: `${11 * scaleFactor}px` }}></i>
          <span>换座</span>
        </button>
      </div>
    </div>
  );
}