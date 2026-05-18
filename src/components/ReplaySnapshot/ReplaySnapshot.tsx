import React from 'react';
import Token from '../Token/Token';
import StatusToken from '../StatusToken/StatusToken';
import { SEAT_LAYOUT } from '../../constants/layout';
import type { GamePhase } from '../../types';

interface ReplaySnapshotProps {
  phase: GamePhase;
}

// 纯 DOM 版本的圆桌快照视图，仅用于导出复盘 PDF 截图。
// 不依赖 SVG / foreignObject，以提升 html2canvas 对头像渲染的稳定性。
export default function ReplaySnapshot({ phase }: ReplaySnapshotProps) {
  const seats = phase.seats;
  const seatCount = seats.length || 1;

  // 基础参考尺寸设为 600（对应 ExportReview 中容器宽度 800px 的 75% 左右，占据一半页面视觉）
  // 网页端基准是 750，这里设为 600 让它在 PDF 上半部分更饱满
  const size = 600;
  const width = size;
  const height = size;
  const centerX = width / 2;
  const centerY = height / 2;
  // 保持网页中的半径计算逻辑：radius = baseSize / 2.3
  const radius = Math.min(width, height) / 2.3;

  return (
    <div
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {/* 中心区域预留给剧本名 / 装饰（目前保持空白，避免影响圆桌布局） */}

      {seats.map((seat, index) => {
        const angle = (2 * Math.PI * index) / seatCount - Math.PI / 2; // 从正上方开始顺时针
        
        // 计算缩放比例：当前容器尺寸 / 网页端基准尺寸 (750)
        const scaleFactor = width / 750;
        
        // 根据座位数计算 Token 大小 (与 useTableLayout 保持一致)
        let baseTokenRadius = 40.5; // 小尺寸：>15人
        if (seatCount <= 10) baseTokenRadius = 58; // 大尺寸：≤10人
        else if (seatCount <= 15) baseTokenRadius = 47; // 中尺寸：11-15人
        
        const tokenRadius = baseTokenRadius * scaleFactor;
        const tokenSize = tokenRadius * 2;
        
        // 计算 Token 到圆心的距离 (Token 内切于圆桌边界)
        const tokenDistance = radius - tokenRadius;
        
        const x = centerX + tokenDistance * Math.cos(angle);
        const y = centerY + tokenDistance * Math.sin(angle);

        // 提示标记 Token 相关尺寸
        const statusTokenSize = tokenSize * SEAT_LAYOUT.STATUS_TOKEN_SIZE_FACTOR;
        const statusTokenGap = SEAT_LAYOUT.STATUS_TOKEN_GAP * scaleFactor;
        const addOffset = SEAT_LAYOUT.ADD_STATUS_OFFSET * scaleFactor;

        // 计算指向圆心的单位向量（从座位指向圆心）
        const dx = centerX - x;
        const dy = centerY - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;

        return (
          <div
            key={`${seat.id}-${index}`}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: '#000000',
              textAlign: 'center',
            }}
          >
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative', width: tokenSize, height: tokenSize, display: 'inline-block' }}>
                <Token
                  role={seat.role || undefined}
                  text={seat.role?.name || ''}
                  size={tokenSize}
                  variant="role"
                  isDead={false}
                  imageRotation={seat.isFlipped ? 180 : 0}
                />
                {/* 死亡变暗：用半透明遮罩替代 filter，确保 html2canvas 能正确捕获 */}
                {seat.isDead && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.5)',
                      pointerEvents: 'none',
                      zIndex: 15,
                    }}
                  />
                )}
              </div>
{/* 完全还原圆桌样式：提示沿"座位中心→圆桌中心"方向排列 */}
              {seat.statuses && seat.statuses.length > 0 && seat.statuses.map((status, sIdx) => {
                const startDistance = tokenRadius + statusTokenSize / 2 + addOffset;
                const offset = sIdx * (statusTokenSize + statusTokenGap);
                
                // 关键修正：计算从 tokenCenter 指向 tableCenter 的向量
                // 此时 tokenCenter 是 (x, y)，tableCenter 是 (centerX, centerY)
                const vecX = centerX - x;
                const vecY = centerY - y;
                const vecLen = Math.sqrt(vecX * vecX + vecY * vecY) || 1;
                
                // 单位向量
                const unitX = vecX / vecLen;
                const unitY = vecY / vecLen;
                
                // 计算提示标记 Token 相对于座位中心 (x, y) 的偏移量
                // 在 Seat 组件中：const x = unitX * (startDistance + offset);
                // 这里的 absX/absY 是状态 Token 的绝对坐标
                // 注意：外层 div 已经定位到了 (x, y)，且使用了 translate(-50%, -50%)
                // 如果我们使用 position: absolute 和 left/top 设置为 absX/absY，
                // 那么它是相对于外层 div 的定位上下文（即 (x, y) 处）？
                // 不，外层 div 并没有 position: relative。
                // 让我们看看外层结构：
                // <div style={{ position: 'absolute', left: `${x}px`, top: `${y}px` ... }}>
                //   <div style={{ position: 'relative' }}>  <-- 这是相对定位上下文
                //     <Token ... />
                //     {statuses.map(...)}
                //   </div>
                // </div>
                
// 所以，提示标记 Token 的坐标应该是相对于"座位中心"的偏移量。
                // Seat 组件中的逻辑是计算相对于 tokenCenter 的偏移量。
                // const x = unitX * (startDistance + offset);
                // const y = unitY * (startDistance + offset);
                
                // 所以我们应该直接使用偏移量作为 left/top，而不是绝对坐标。
                const relX = unitX * (startDistance + offset);
                const relY = unitY * (startDistance + offset);

                return (
                  <div
                    key={`${seat.id}-status-${sIdx}`}
                    style={{
                      position: 'absolute',
                      // 相对于座位中心 (0, 0) 的偏移
                      // 因为父容器是 position: relative 且居中对齐了 Token
                      // Token 也是居中的。
                      // 我们希望提示标记 Token 的中心在 (relX, relY)
                      // 父容器宽度高度未定，但 flex column align center 会让内容水平居中。
                      // 更好的做法是：状态 Token 容器设为 width: 0, height: 0, left: 50%, top: 50%
                      // 然后 translate(relX - 50%, relY - 50%)
                      
                      left: '50%',
                      top: '50%',
                      transform: `translate(calc(-50% + ${relX}px), calc(-50% + ${relY}px))`,
                      zIndex: 10
                    }}
                  >
                    <StatusToken
                      role={status.role}
                      statusName={status.name}
                      size={statusTokenSize}
                      disableHover
                    />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 6 * scaleFactor,
                padding: `${2 * scaleFactor}px ${6 * scaleFactor}px`,
                borderRadius: 4 * scaleFactor,
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                fontSize: 11 * scaleFactor,
                minWidth: 60 * scaleFactor,
              }}
            >
              {seat.playerName || `玩家 ${seat.id}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
