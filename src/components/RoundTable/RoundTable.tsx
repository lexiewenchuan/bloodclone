
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Seat as SeatType } from '../../types';
import Seat from '../Seat/Seat';
import { useApp } from '../../contexts/AppContext';
import { useTableLayout } from '../../hooks/useTableLayout';

interface RoundTableProps {
  seats: SeatType[];
  currentPhase?: { type: 'night' | 'day'; count: number }; // 新增：当前阶段
  onSeatClick: (index: number) => void;
  onSettingsClick: (index: number) => void;
  onOpenStatusModal: (index: number) => void;
  onRemoveStatus: (index: number, statusName: string, roleId: string) => void;
  // 新功能参数
  showSeatPanelIndex?: number;
  onRenameSeat?: (index: number) => void;
  onRemoveSeat?: (index: number) => void;
  onSwapSeat?: (index: number) => void;
  onCloseSeatPanel?: () => void;
  isSwappingMode?: boolean;
  onSwapTargetSelect?: (targetIndex: number) => void;
  onSwapCancel?: () => void;
  // 魔典笔记状态
  showGrimoireNote?: boolean;
  // 分屏宽度比例
  splitRatio?: number;
  // 回调函数，用于传递 scaleFactor 给父组件
  onScaleFactorChange?: (scaleFactor: number) => void;
  // 投票标记相关
  onRemoveVote?: (index: number) => void;
  // 导出相关
  containerWidth?: number;
  containerHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  // 隐藏圆桌上的敏感信息（角色图像、提示标记等），仅保留死亡样式
  hideSecrets?: boolean;
  // 小镇座位占用（说书人端）：座位 index 是否已有玩家坐下
  townSeatOccupancy?: Record<number, boolean>;
}

export default function RoundTable({ 
  seats, 
  currentPhase,
  onSeatClick,
  onSettingsClick,
  onOpenStatusModal,
  onRemoveStatus,
  // 新功能参数
  showSeatPanelIndex = -1,
  onRenameSeat,
  onRemoveSeat,
  onSwapSeat,
  onCloseSeatPanel,
  isSwappingMode = false,
  onSwapTargetSelect,
  onSwapCancel,
  // 魔典笔记状态
  showGrimoireNote = false,
  // 分屏宽度比例
  splitRatio = 0.5,
  // 回调函数，用于传递 scaleFactor 给父组件
  onScaleFactorChange,
  onRemoveVote,
  containerWidth,
  containerHeight,
  viewportWidth,
  viewportHeight,
  hideSecrets = false,
  townSeatOccupancy = {}
}: RoundTableProps) {
  const [hoveredSeatIndex, setHoveredSeatIndex] = useState<number | null>(null);
  const { state: appState, markLogoAsFailed } = useApp();
  const hoverTimeoutRef = useRef<number | null>(null);

  // 使用自定义 Hook 处理布局逻辑
  const {
    tableWidth,
    tableHeight,
    tableRadius,
    contentSize,
    tokenRadius,
    tokenDistance,
    tableCenterX,
    tableCenterY
  } = useTableLayout({
    seatCount: seats.length,
    showGrimoireNote,
    splitRatio,
    onScaleFactorChange,
    containerWidth,
    containerHeight,
    viewportWidth,
    viewportHeight
  });

  // 处理鼠标进入和离开
  const handleMouseEnter = useCallback((index: number) => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredSeatIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredSeatIndex(null);
    }, 200); // 200ms delay to allow moving between elements, improved for Safari
  }, []);

  // 换座模式下点击其他区域取消换座
  // 注意：这个 useEffect 依赖较多外部回调，且涉及 DOM 事件，保持原样
  useEffect(() => {
    if (isSwappingMode) {
      const handleCancelSwap = (e: MouseEvent | TouchEvent) => {
        // 检查点击目标是否是换座图标
        const target = e.target as HTMLElement;
        
        // 检查是否点击了换座图标
        const isSwapIcon = target.closest('.swap-icon');
        
        // 检查是否点击了弹窗相关元素
        const isModal = target.closest('[role="dialog"]') || 
                      target.closest('.modal') || 
                      target.closest('.modal-overlay');
        
        // 只有在非换座图标且非弹窗区域时才取消换座
        if (!isSwapIcon && !isModal) {
          onSwapCancel?.();
        }
      };
      
      document.addEventListener('click', handleCancelSwap);
      document.addEventListener('touchstart', handleCancelSwap);
      return () => {
        document.removeEventListener('click', handleCancelSwap);
        document.removeEventListener('touchstart', handleCancelSwap);
      };
    }
  }, [isSwappingMode, onSwapCancel]);
  
  // 当座位数量变化时，重置悬停状态，防止索引越界或指向错误的座位
  // 这能有效避免删除座位后出现的显示异常
  useEffect(() => {
    if (hoveredSeatIndex !== null && hoveredSeatIndex >= seats.length) {
      setHoveredSeatIndex(null);
    }
  }, [seats.length, hoveredSeatIndex]);

  // 计算行动顺序
  const actionOrders = useMemo(() => {
    if (!currentPhase || currentPhase.type !== 'night') return {};

    const isFirstNight = currentPhase.count === 1;
    
    // 获取所有在场且今晚有行动的角色及其原始值
    const actingRoles = seats
      .filter(seat => seat.role)
      .map(seat => {
        const value = isFirstNight ? seat.role!.firstNight : seat.role!.otherNight;
        return {
          index: seat.index,
          value: value
        };
      })
      .filter(item => item.value > 0);

    if (actingRoles.length === 0) return {};

    // 提取唯一且非零的值并排序
    const uniqueValues = [...new Set(actingRoles.map(item => item.value))].sort((a, b) => a - b);
    
    // 创建映射：原始值 -> 相对排序 (从1开始)
    const valueToRank = new Map();
    uniqueValues.forEach((val, idx) => {
      valueToRank.set(val, idx + 1);
    });

    // 为每个座位分配排序
    const orders: Record<number, number> = {};
    actingRoles.forEach(item => {
      orders[item.index] = valueToRank.get(item.value);
    });

    return orders;
  }, [seats, currentPhase]);
  
  const isFirstNight = currentPhase && currentPhase.type === 'night' && currentPhase.count === 1;
  
  // 竖屏以宽度为限（贴边），横屏以高度为限；分屏时用 hook 算出的尺寸（已是宽高先触限者）作为显式宽高，既符合逻辑又无横竖屏切换突变
  const isPortrait = containerWidth != null && containerHeight != null && containerHeight > containerWidth;
  const contentCenter = tableRadius;
  const constrainByWidth = isPortrait;

  return (
    <div className="round-table" style={{ 
      ...(showGrimoireNote
        ? { width: tableWidth, height: tableHeight }
        : (constrainByWidth ? { width: '100%' } : { height: '100%' })),
      ...(!showGrimoireNote && { aspectRatio: '1' }),
      margin: '0 auto',
      flexShrink: 0,
      position: 'relative',
      zIndex: 100,
      backgroundColor: 'transparent',
      transformOrigin: 'center center',
    }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${contentSize} ${contentSize}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          overflow: 'visible',
          display: 'block',
          isolation: 'isolate',
        }}
      >
        {/* 圆桌背景 - 调试用，稍微可见 */}
        <circle 
          cx={contentCenter} 
          cy={contentCenter} 
          r={tableRadius} 
          fill="transparent"
          stroke="transparent"
          strokeWidth="2"
        />

        {/* 
          Safari 兼容性修复:
          1. 不在 <g> 上使用 transform，而是将坐标直接传给 Seat 组件，让 foreignObject 直接定位。
             Safari 在嵌套 transform + foreignObject 时计算坐标有严重 bug。
          2. 使用 x/y 属性直接定位 foreignObject 是最稳妥的跨浏览器方案。
        */}


        {/* 圆桌中心剧本Logo - 响应式尺寸（沿用 tableWidth 比例保持视觉一致） */}
        {appState.scriptInfo.name !== '请选择剧本' && appState.scriptInfo.logo && appState.scriptInfo.logo.length > 0 && (!appState.scriptInfo.id || !appState.failedLogos[appState.scriptInfo.id]) && (
          <foreignObject
            x={contentCenter - (tableWidth * 0.133)}
            y={contentCenter - (tableWidth * 0.133)}
            width={tableWidth * 0.267}
            height={tableWidth * 0.267}
            style={{ pointerEvents: 'none', overflow: 'visible' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', transform: 'translateZ(0)' }}>
              <img 
                src={appState.scriptInfo.logo} 
                alt={appState.scriptInfo.name} 
                loading="lazy"
                onError={(e) => {
                  // 当logo加载失败时，隐藏该元素并标记为失败
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (appState.scriptInfo.id) {
                    markLogoAsFailed(appState.scriptInfo.id);
                  }
                }}
                style={{ 
                  maxWidth: tableWidth * 0.213, 
                  maxHeight: tableWidth * 0.213, 
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))'
                }} 
              />
            </div>
          </foreignObject>
        )}

        {/* 所有座位 */}
        {(() => {
          // 创建一个包含索引的座位数组
          const seatsWithIndex = seats.map((seat, index) => ({ seat, index }));
          
          // 如果有悬停的座位，将其移到最后渲染，以提高其层级
          // 使用 sort 确保元素唯一性，避免 filter+concat 可能导致的潜在问题
          const sortedSeats = [...seatsWithIndex].sort((a, b) => {
            if (hoveredSeatIndex === null) return a.index - b.index;
            if (a.index === hoveredSeatIndex) return 1;
            if (b.index === hoveredSeatIndex) return -1;
            return a.index - b.index;
          });
            
          return sortedSeats.map(({ seat, index }) => {
            const angle = (index / seats.length) * Math.PI * 2 - Math.PI / 2;
            const tokenCenterX = Math.cos(angle) * tokenDistance + contentCenter;
            const tokenCenterY = Math.sin(angle) * tokenDistance + contentCenter;
            
            return (
              <g 
                key={seat.id}
                style={{ 
                  // 不在外层 g 上使用 transition：此处未设置 transform，Safari 在座位数量变化重排时会错误触发过渡导致闪烁
                  cursor: isSwappingMode ? 'pointer' : 'default'
                }}
              >
                <Seat 
                  seat={seat} 
                  index={index}
                  tokenRadius={tokenRadius}
                  tableCenterX={contentCenter}
                  tableCenterY={contentCenter}
                  tokenCenterX={tokenCenterX} // 传入绝对坐标
                  tokenCenterY={tokenCenterY} // 传入绝对坐标
                  actionOrder={actionOrders[index]}
                  isFirstNight={isFirstNight}
                  onSeatClick={onSeatClick}
                  onSettingsClick={onSettingsClick}
                  onOpenStatusModal={onOpenStatusModal}
                  onRemoveStatus={onRemoveStatus}
                  onMouseEnter={() => handleMouseEnter(index)}
                  onMouseLeave={handleMouseLeave}
                  isHovered={hoveredSeatIndex === index}
                  // 新功能参数
                  showSeatPanel={showSeatPanelIndex === index}
                  onRenameSeat={onRenameSeat}
                  onRemoveSeat={onRemoveSeat}
                  onSwapSeat={onSwapSeat}
                  onCloseSeatPanel={onCloseSeatPanel}
                  isSwappingMode={isSwappingMode}
                  onSwapTargetSelect={onSwapTargetSelect}
                  onRemoveVote={onRemoveVote}
                  hideSecrets={hideSecrets}
                  townSeatOccupied={!!townSeatOccupancy[index]}
                />
              </g>
            );
          });
        })()}



      </svg>
    </div>
  );
}
