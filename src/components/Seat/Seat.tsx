import React, { memo, useEffect, useState } from 'react';
import { Seat as SeatType } from '../../types';
import RoleToken from '../RoleToken/RoleToken';
import SeatInfo from '../SeatInfo/SeatInfo';
import StatusToken from '../StatusToken/StatusToken';
import AddStatusButton from '../AddStatusButton/AddStatusButton';
import ActionOrderBadge from '../ActionOrderBadge/ActionOrderBadge';
import SwapIcon from '../SwapIcon/SwapIcon';
import { SEAT_LAYOUT } from '../../constants/layout';

interface SeatProps {
  seat: SeatType;
  index: number;
  tokenRadius: number;
  tableCenterX: number;
  tableCenterY: number;
  tokenCenterX: number;
  tokenCenterY: number;
  actionOrder?: number;
  isFirstNight?: boolean;
  onSeatClick: (index: number) => void;
  onSettingsClick: (index: number) => void;
  onOpenStatusModal: (index: number) => void;
  onRemoveStatus: (index: number, statusName: string, roleId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isHovered?: boolean;
  // 新功能参数
  showSeatPanel?: boolean;
  onRenameSeat?: (index: number) => void;
  onRemoveSeat?: (index: number) => void;
  onSwapSeat?: (index: number) => void;
  onCloseSeatPanel?: () => void;
  isSwappingMode?: boolean;
  onSwapTargetSelect?: (targetIndex: number) => void;
  // 投票标记相关
  onRemoveVote?: (index: number) => void;
  // 隐藏圆桌上的敏感信息（角色图像、提示标记等），仅保留死亡样式
  hideSecrets?: boolean;
  // 小镇模式：该座位是否有玩家已坐下（说书人端显示「有人」标记）
  townSeatOccupied?: boolean;
}

const Seat = memo(({ 
  seat, 
  index, 
  tokenRadius,
  tableCenterX,
  tableCenterY,
  tokenCenterX,
  tokenCenterY,
  actionOrder,
  isFirstNight = false,
  onSeatClick, 
  onSettingsClick, 
  onOpenStatusModal,
  onRemoveStatus,
  onMouseEnter,
  onMouseLeave,
  isHovered = false,
  // 新功能参数
  isSwappingMode = false,
  onSwapTargetSelect,
  onRemoveVote,
  hideSecrets = false,
  townSeatOccupied = false
}: SeatProps) => {
  // 触摸屏检测：用于在触摸设备上常显「选择提示标记」按钮
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasTouch =
      'ontouchstart' in window ||
      // 部分桌面触摸设备
      (navigator as any).maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0;
    setIsTouchDevice(Boolean(hasTouch));
  }, []);

  // 基于基准token半径计算缩放比例
  const scaleFactor = tokenRadius / SEAT_LAYOUT.BASE_TOKEN_RADIUS;
  
  // 所有元素大小根据缩放比例同步调整
  // 提示 token 按比例计算，比例降低以保持合理大小
  const statusTokenSize = tokenRadius * 2 * SEAT_LAYOUT.STATUS_TOKEN_SIZE_FACTOR;
  const statusTokenGap = SEAT_LAYOUT.STATUS_TOKEN_GAP * scaleFactor;
  
  // 座位信息组件大小
  const seatInfoWidth = SEAT_LAYOUT.SEAT_INFO_WIDTH * scaleFactor;
  const seatInfoHeight = SEAT_LAYOUT.SEAT_INFO_HEIGHT * scaleFactor;
  const seatInfoOffsetX = -seatInfoWidth / 2;
  // 调整偏移量：将 SeatInfo 下移，确保紧贴角色 Token 底部但无遮挡
  const seatInfoOffsetY = tokenRadius * SEAT_LAYOUT.SEAT_INFO_OFFSET_Y_FACTOR;
  
  // 角色token容器大小和位置
  const tokenContainerOffset = SEAT_LAYOUT.TOKEN_CONTAINER_OFFSET * scaleFactor;
  const tokenContainerPadding = SEAT_LAYOUT.TOKEN_CONTAINER_PADDING * scaleFactor;
  const tokenContainerWidth = tokenRadius * 2 + SEAT_LAYOUT.TOKEN_CONTAINER_WIDTH_EXTRA * scaleFactor;
  const tokenContainerHeight = tokenRadius * 2 + SEAT_LAYOUT.TOKEN_CONTAINER_HEIGHT_EXTRA * scaleFactor;
  const tokenContainerX = -tokenRadius - tokenContainerOffset;
  const tokenContainerY = -tokenRadius - tokenContainerPadding;
  
  const calculateStatusTokenPosition = (statusIndex: number) => {
    const dx = tableCenterX - tokenCenterX;
    const dy = tableCenterY - tokenCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    const startDistance = tokenRadius + statusTokenSize / 2 + SEAT_LAYOUT.ADD_STATUS_OFFSET * scaleFactor;
    // 移除位置偏移逻辑，保持位置固定，避免悬停时提示标记 Token 移动导致的交互丢失
    const effectiveIndex = statusIndex;
    const offset = effectiveIndex * (statusTokenSize + statusTokenGap);
    
    const x = unitX * (startDistance + offset);
    const y = unitY * (startDistance + offset);
    
    return { x, y };
  };

  const calculateAddButtonPosition = () => {
    // 动态计算位置：如果有提示标记 Token，则显示在最后一个 Token 之后；否则显示在第一个位置
    const nextIndex = seat.statuses ? seat.statuses.length : 0;
    return calculateStatusTokenPosition(nextIndex);
  };

  const calculateBridgePath = () => {
    const addButtonPos = calculateAddButtonPosition();
    // 角色 Token 的中心在 (0, 0)
    const angle = Math.atan2(addButtonPos.y, addButtonPos.x);
    // 增加足够的长度，确保完全覆盖到 AddStatusButton 中心
    const distance = Math.sqrt(addButtonPos.x * addButtonPos.x + addButtonPos.y * addButtonPos.y) + statusTokenSize / 2;
    
    // 桥接区域的宽度与 statusTokenSize 一致，确保热区精准
    const bridgeWidth = statusTokenSize;
    
    return {
      angle: (angle * 180) / Math.PI,
      distance: distance,
      width: bridgeWidth
    };
  };

  return (
    <g 
      className="seat-component"
      data-seat-index={index}
      style={{ pointerEvents: 'none' }}
    >
      {/* 1. 基础展示层 (放在底层) */}
      
      {/* 隐形交互桥梁 - 连接 Token 和提示 Tokens */}
      {/* 移到最底层，避免遮挡 SeatInfo 的点击事件 */}
      {!hideSecrets && seat.statuses && seat.statuses.length > 0 && (() => {
        const lastStatusIndex = seat.statuses.length - 1;
        const endPos = calculateStatusTokenPosition(lastStatusIndex);
        
        return (
          <line
            x1={tokenCenterX}
            y1={tokenCenterY}
            x2={tokenCenterX + endPos.x}
            y2={tokenCenterY + endPos.y}
            stroke="rgba(0,0,0,0)" // 使用 rgba(0,0,0,0) 代替 transparent，增强 Safari 兼容性
            strokeWidth={tokenRadius * 2}
            strokeLinecap="round"
            // 关键修正：这条“桥接线”不再作为热区，仅用于占位/布局，
            // 避免宽 stroke 区域在座位之间持续维持上一个座位的 hover 状态。
            style={{ pointerEvents: 'none', cursor: 'default' }}
          />
        );
      })()}

      {/* 桥接感应区域 - 移至底层以避免遮挡提示标记 Token；无角色时也允许挂载提示标记 */}
      {!hideSecrets && !isSwappingMode && isHovered && (
        <g transform={`translate(${tokenCenterX}, ${tokenCenterY}) rotate(${calculateBridgePath().angle})`}>
          <rect
            x={tokenRadius - 5} // 从角色 Token 边缘附近开始 (留 5px 重叠确保不闪烁)
            y={-calculateBridgePath().width / 2}
            width={calculateBridgePath().distance - (tokenRadius - 5)}
            height={calculateBridgePath().width}
            fill="rgba(0,0,0,0)" // 使用 rgba(0,0,0,0) 代替 transparent，增强 Safari 兼容性
            // 关键修正：这条桥接矩形只做视觉/布局参考，不再参与命中检测，
            // 避免在座位之间形成一条宽矩形“热区”挡住相邻座位的提示标记交互。
            style={{ pointerEvents: 'none' }}
          />
        </g>
      )}

      {/* SeatInfo 悬停增强层 - 确保整个区域都能响应鼠标 */}
      {/* 放置在 foreignObject 下方，作为备用热区 */}
      <rect
        x={tokenCenterX + seatInfoOffsetX} 
        y={tokenCenterY + seatInfoOffsetY} 
        width={seatInfoWidth} 
        height={20 * scaleFactor} 
        fill="rgba(0,0,0,0)" // 关键修复：显式透明背景
        style={{ pointerEvents: 'auto', cursor: 'default' }}
        onMouseEnter={() => onMouseEnter?.()}
        onMouseLeave={() => onMouseLeave?.()}
      />

      {/* 座位信息组件 - 放在较底层 */}
      <foreignObject 
        x={tokenCenterX + seatInfoOffsetX} 
        y={tokenCenterY + seatInfoOffsetY} 
        width={seatInfoWidth} 
        style={{ pointerEvents: 'auto', background: 'transparent', overflow: 'visible' }}
        onMouseEnter={() => onMouseEnter?.()}
        onMouseLeave={() => onMouseLeave?.()}
      >
        <div className="seat-info-container" style={{ width: '100%', height: 'auto', transform: 'translateZ(0)' }}>
          <SeatInfo 
            seatId={index + 1}
            playerName={seat.playerName}
            scaleFactor={scaleFactor}
            onSettingsClick={(e) => {
              e.stopPropagation();
              onSettingsClick(index);
            }}
            townSeatOccupied={townSeatOccupied}
          />
        </div>
      </foreignObject>

      {/* 提示标记 token 展示区域 - 独立渲染 */}
      {!hideSecrets && seat.statuses && seat.statuses.length > 0 && seat.statuses.map((status, statusIndex) => {
        const position = calculateStatusTokenPosition(statusIndex);
        return (
          <g 
            key={statusIndex} 
            // 移除 transform，直接使用 foreignObject 的 x/y 属性
            // transform={`translate(${tokenCenterX + position.x}, ${tokenCenterY + position.y})`}
          >
            <foreignObject
              x={tokenCenterX + position.x - statusTokenSize / 2}
              y={tokenCenterY + position.y - statusTokenSize / 2}
              width={statusTokenSize}
              height={statusTokenSize}
              style={{ 
                overflow: 'visible', 
                // 将事件命中区域下放到内部缩小后的方块，避免过大的不可见命中区域
                pointerEvents: 'none', 
                background: 'transparent'
              }}
            >
              <div style={{ 
                position: 'relative', 
                width: '80%', 
                height: '80%', 
                margin: '10%',
                transform: 'translateZ(0)',
                // 透明背景 + 缩小后的方形命中区域，尽量贴近圆形 Token
                background: 'rgba(0,0,0,0)',
                pointerEvents: 'auto'
              }}
              onMouseEnter={() => onMouseEnter?.()}
              onMouseLeave={() => onMouseLeave?.()}
              >
                <StatusToken
                  role={status.role}
                  statusName={status.name}
                  size={statusTokenSize}
                  showDeleteEffect={true}
                  disableHover={isSwappingMode}
                  isCustom={status.type === 'custom'}
                  onClick={() => {
                    if (status.type === 'custom') {
                      onRemoveStatus(index, status.name, '');
                    } else if (status.role) {
                      onRemoveStatus(index, status.name, status.role.id);
                    }
                  }}
                />
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* 2. 交互控制层 - 实际上就是 RoleToken 本身，不再需要额外的 g 包装 */}
      {/* 角色 Token 触发区域 - 直接放在提示标记 Token 后面，确保层级高于 Bridge 但不遮挡提示 Token */}
      <g 
        onMouseEnter={onMouseEnter}
        style={{ pointerEvents: 'auto' }}
      >
        <foreignObject 
          x={tokenCenterX + tokenContainerX} 
          y={tokenCenterY + tokenContainerY} 
          width={tokenContainerWidth} 
          height={tokenContainerHeight} 
          style={{ pointerEvents: 'none', overflow: 'visible', background: 'transparent' }}
        >
          <div className="seat-token-container" style={{ position: 'relative', width: '100%', height: '100%', transform: 'translateZ(0)' }}>
            <div 
               style={{ 
                 position: 'absolute', 
                 top: `${tokenContainerPadding}px`, 
                 left: `${tokenContainerOffset}px`, 
                 width: `${tokenRadius * 2}px`, 
                 height: `${tokenRadius * 2}px`,
                 pointerEvents: 'auto',
                 transition: 'transform 0.1s ease',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center'
               }}
               onMouseLeave={onMouseLeave}
             >
              <RoleToken 
                role={seat.role}
                size={tokenRadius * 2}
                selected={false}
                isDead={seat.isDead}
                isFlipped={seat.isFlipped}
                hideRoleImage={hideSecrets}
                disableHover={isSwappingMode}
                onClick={() => onSeatClick(index)}
              />

              {/* 小镇座位占用标记：有人坐下 */}
              {townSeatOccupied && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    padding: '1px 5px',
                    borderRadius: 6,
                    background: 'rgba(34, 197, 94, 0.9)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 600,
                    pointerEvents: 'none',
                    zIndex: 5,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                >
                  有人
                </div>
              )}

              {/* 行动顺序标记 */}
              {!hideSecrets && actionOrder && actionOrder > 0 && seat.role && (
                <div style={{
                  position: 'absolute',
                  // 垂直居中
                  top: '50%',
                  // 水平位置在左边缘
                  left: '0',
                  width: `${tokenRadius * 0.5}px`,
                  height: `${tokenRadius * 0.5}px`,
                  // 使用 transform 确保自身中心点对齐到父容器左边缘中点
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ActionOrderBadge
                    role={seat.role}
                    actionOrder={actionOrder}
                    size={tokenRadius * 0.5}
                    isFirstNight={isFirstNight}
                    disableHover={isSwappingMode}
                  />
                </div>
              )}
            </div>
          </div>
        </foreignObject>
      </g>

      {/* 添加按钮 - 在 SVG 中后定义的元素在最上层；无角色时也允许挂载提示标记 */}
      {/* 触摸设备上常显，非触摸设备保持悬停显示 */}
      {!hideSecrets && !isSwappingMode && (isHovered || isTouchDevice) && (
          <g style={{ pointerEvents: 'none' }}>
            {/* 选择提示标记按钮 */}
            <g 
              // 移除 transform，直接使用 foreignObject 的 x/y 属性
              // transform={`translate(${tokenCenterX + calculateAddButtonPosition().x}, ${tokenCenterY + calculateAddButtonPosition().y})`}
            >
              <foreignObject
                x={tokenCenterX + calculateAddButtonPosition().x - statusTokenSize / 2}
                y={tokenCenterY + calculateAddButtonPosition().y - statusTokenSize / 2}
                width={statusTokenSize}
                height={statusTokenSize}
                style={{ overflow: 'visible', pointerEvents: 'none', background: 'transparent' }}
              >
                <div style={{ 
                  position: 'relative', 
                  width: '80%', 
                  height: '80%',
                  margin: '10%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'translateZ(0)',
                  // 缩小后的透明背景命中区域，避免两个座位之间出现过大的“看不见”重叠区域
                  background: 'rgba(0,0,0,0)',
                  pointerEvents: 'auto'
                }}
                onMouseEnter={() => onMouseEnter?.()}
                onMouseLeave={() => onMouseLeave?.()}
                >
                  <AddStatusButton
                    size={statusTokenSize}
                    disableHover={isSwappingMode}
                    onClick={() => onOpenStatusModal(index)}
                  />
                </div>
              </foreignObject>
            </g>
          </g>
        )}

        {/* 投票标记 - 放在最顶层，位于RoleToken和SeatInfo之上，但在悬停交互层之下 */}
      {/* 只有在非死亡状态或者非有票状态下才不显示 */}
      {seat.isDead && (
        <foreignObject
          // 坐标计算: 
          // x: SeatInfo右边缘 - 16(width) = seatInfoWidth/2 - 16*scaleFactor
          // y: SeatInfo顶部 - 15.5(offset) = seatInfoOffsetY - 15.5*scaleFactor
          x={tokenCenterX + seatInfoWidth / 2 - 16 * scaleFactor}
          y={tokenCenterY + seatInfoOffsetY - 15.5 * scaleFactor}
          width={16 * scaleFactor}
          height={16 * scaleFactor}
          style={{ pointerEvents: 'auto', overflow: 'visible', background: 'transparent' }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onRemoveVote?.(index);
            }}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transform: 'translateZ(0)'
            }}
            title={seat.hasVote ? "点击移除投票标记" : "点击恢复投票标记"}
          >
            <i 
              className="fa fa-vote-yea" 
              style={{ 
                color: seat.hasVote ? '#4299e1' : '#718096', // 激活时蓝色，失去时灰色
                fontSize: `${16 * scaleFactor}px`, // 字体大小与容器一致
                textShadow: `0 2px 4px rgba(0,0,0,0.5)`, // 增加阴影以在复杂背景上清晰可见
                opacity: seat.hasVote ? 1 : 0.6, // 失去时稍微透明
                transition: 'all 0.3s ease'
              }} 
            />
          </div>
        </foreignObject>
      )}

      {/* 换座模式下的图标 */}
      {isSwappingMode && (
        <foreignObject
          x={tokenCenterX - tokenRadius}
          y={tokenCenterY - tokenRadius}
          width={tokenRadius * 2}
          height={tokenRadius * 2}
          style={{ pointerEvents: 'auto', overflow: 'visible', background: 'transparent' }}
        >
          <div style={{ width: '100%', height: '100%', transform: 'translateZ(0)' }}>
            <SwapIcon
              size={Math.min(tokenRadius * 1.2, 50)}
              onClick={() => onSwapTargetSelect?.(index)}
              isActive={false}
            />
          </div>
        </foreignObject>
      )}
    </g>
  );
});

export default Seat;
