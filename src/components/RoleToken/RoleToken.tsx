import React, { useState, useRef } from 'react';
import { RoleData } from '../../types';
import Token from '../Token/Token';
import ReactDOM from 'react-dom';
import { useApp } from '../../contexts/AppContext';

interface RoleTokenProps {
  role?: RoleData | null;
  size?: number;
  showName?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  isDead?: boolean;
  rotated?: boolean;
  isFlipped?: boolean;
  showSetupMarker?: boolean;
  disableHover?: boolean;
  onClick?: () => void;
  // 隐藏角色前景图，仅保留通用背景（用于“隐藏魔典”翻面效果）
  hideRoleImage?: boolean;
}

export default function RoleToken({ 
  role, 
  size = 75, 
  showName = true, 
  selected = false, 
  dimmed = false,
  isDead = false,
  rotated = false,
  isFlipped = false,
  showSetupMarker = false,
  disableHover = false,
  onClick,
  hideRoleImage = false
}: RoleTokenProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipExpandRight, setTooltipExpandRight] = useState(true); // true=朝右展开，false=朝左展开
  const [tooltipMaxWidth, setTooltipMaxWidth] = useState(220);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state: appState } = useApp();

  // 添加兜底机制：监听全局事件，确保 Tooltip 在适当时候关闭
  React.useEffect(() => {
    if (!showTooltip) return;

    const checkHover = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // 增加一些缓冲区，避免在边缘抖动
        const buffer = 20; 
        
        // 检查鼠标是否在 Token 区域外
        const isOutside = 
          e.clientX < rect.left - buffer ||
          e.clientX > rect.right + buffer ||
          e.clientY < rect.top - buffer ||
          e.clientY > rect.bottom + buffer;

        if (isOutside) {
          setShowTooltip(false);
        }
      }
    };

    // 处理全局点击/触摸，点击其他区域关闭 Tooltip
    const handleGlobalInteraction = (e: Event) => {
      // 如果点击的是 Token 本身，不关闭（可能需要点击交互）
      // 注意：containerRef 包含整个 RoleToken 组件
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      setShowTooltip(false);
    };

    // 滚动时关闭 Tooltip
    const handleScroll = () => {
      setShowTooltip(false);
    };

    window.addEventListener('mousemove', checkHover);
    window.addEventListener('mousedown', handleGlobalInteraction);
    window.addEventListener('touchstart', handleGlobalInteraction);
    window.addEventListener('scroll', handleScroll, { capture: true }); // 使用捕获阶段监听滚动

    return () => {
      window.removeEventListener('mousemove', checkHover);
      window.removeEventListener('mousedown', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [showTooltip]);

  // 根据阵营计算光晕颜色
  const getGlowColor = () => {
    // 隐藏模式下不显示任何阵营高亮
    if (hideRoleImage) return 'transparent';
    if (!role) return 'transparent';
    switch (role.team) {
      case 'townsfolk':
        return 'rgba(66, 153, 225, 0.6)'; // 蓝色
      case 'outsider':
        return 'rgba(99, 179, 237, 0.6)'; // 浅蓝色
      case 'minion':
        return 'rgba(245, 101, 101, 0.6)'; // 红色
      case 'demon':
        return 'rgba(197, 48, 48, 0.8)'; // 深红色
      case 'fabled':
        return 'rgba(159, 122, 234, 0.6)'; // 紫色
      case 'traveler':
        return 'rgba(72, 187, 120, 0.6)'; // 绿色
      default:
        return 'transparent';
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (hideRoleImage) return;
    if (role && role.ability && !appState.grimoireSettings.hideRoleAbilities) {
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const safeMarginH = 12;
      const normalTooltipMaxWidth = 220;
      const effectiveMaxWidth = Math.min(normalTooltipMaxWidth, viewportWidth - safeMarginH * 2);

      // 水平：左/中朝右展开（提示在 token 右侧）、右朝左展开（提示在 token 左侧），不盖住 token，且不超出左右视口
      const tokenCenterX = rect.left + rect.width / 2;
      const expandRight = tokenCenterX < viewportWidth / 2;
      const gap = 8;
      let x: number;
      if (expandRight) {
        x = Math.max(rect.right + gap, safeMarginH);
        x = Math.min(x, viewportWidth - safeMarginH - effectiveMaxWidth);
      } else {
        x = Math.min(rect.left - gap, viewportWidth - safeMarginH);
        x = Math.max(x, safeMarginH + effectiveMaxWidth);
      }
      setTooltipExpandRight(expandRight);
      setTooltipMaxWidth(effectiveMaxWidth);

      // 垂直：始终与 token 中心同一水平线，不因上下空间做位移；文字过长时面板在宽高上自然扩展即可
      const y = rect.top + rect.height / 2;

      setTooltipPos({ x, y });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const glowColor = getGlowColor();

  // 判断是否需要显示 setup 标记
  const hasSetup = role && (
    !hideRoleImage && (
      role.setup === true || 
      role.setup === 1 || 
      role.setup === '1' || 
      role.setup === 'true' ||
      (typeof role.setup === 'string' && role.setup.toLowerCase() === 'true')
    )
  );

  return (
      <>
        <div style={{ position: 'relative', display: 'inline-block', overflow: 'visible', zIndex: 5 }}>
          <div 
            ref={containerRef}
          className={`role-token ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''} ${isDead ? 'dead' : ''}`}
          style={{ 
            boxShadow: isDead
              ? `0 0 25px rgba(229, 62, 62, 0.8), 0 0 40px rgba(229, 62, 62, 0.4), inset 0 0 15px rgba(0, 0, 0, 0.3)`
              : (selected 
                  ? `0 0 0 2px ${glowColor}, 0 0 15px ${glowColor}, 0 0 30px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.4), inset 0 0 10px ${glowColor}` 
                  : (dimmed ? '0 2px 8px rgba(0,0,0,0.3)' : `0 0 10px ${glowColor}`)),
            display: 'inline-block',
            cursor: disableHover ? 'default' : 'pointer',
            borderRadius: '50%',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            filter: dimmed 
              ? 'grayscale(0.7) brightness(0.65) contrast(1.1)' 
              : (selected ? 'brightness(1.1) contrast(1.05)' : 'none'),
            transform: selected && !dimmed ? 'scale(1.08)' : 'scale(1)',
            overflow: 'visible',
            border: 'none'
          }}
          onClick={onClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {showSetupMarker && hasSetup && <div className="setup-marker" title="该角色在场时需要进行设置调整" />}
          
          {/* 未选中状态的高级神秘感蒙版 */}
          {dimmed && !isDead && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at center, rgba(26, 32, 44, 0.1) 0%, rgba(10, 15, 25, 0.4) 70%, rgba(5, 8, 15, 0.6) 100%)',
              borderRadius: '50%',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              {/* 深蓝色神秘微光 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(66, 153, 225, 0.03) 0%, transparent 50%, rgba(159, 122, 234, 0.03) 100%)',
                mixBlendMode: 'screen'
              }}></div>
            </div>
          )}
          

          
          {/* 选中状态的迷幻效果 */}
          {selected && !isDead && !dimmed && (
            <>
              {/* 外层烟雾效果光环 */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${glowColor.replace('0.6)', '0.3)').replace('0.8)', '0.3)')} 0%, transparent 40%)`,
                zIndex: -3,
                animation: 'smokePulse 4s infinite ease-in-out',
                pointerEvents: 'none',
                filter: 'blur(15px)'
              }}></div>
              
              {/* 中层烟雾效果光环 */}
              <div style={{
                position: 'absolute',
                top: '-30%',
                left: '-30%',
                width: '160%',
                height: '160%',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${glowColor.replace('0.6)', '0.4)').replace('0.8)', '0.4)')} 0%, transparent 50%)`,
                zIndex: -2,
                animation: 'smokePulse 3s infinite ease-in-out reverse',
                pointerEvents: 'none',
                filter: 'blur(10px)'
              }}></div>
              
              {/* 内层发光效果 */}
              <div style={{
                position: 'absolute',
                top: '-10%',
                left: '-10%',
                width: '120%',
                height: '120%',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${glowColor.replace('0.6)', '0.6)').replace('0.8)', '0.6)')} 0%, transparent 60%)`,
                zIndex: -1,
                animation: 'smokePulse 2s infinite ease-in-out',
                pointerEvents: 'none',
                filter: 'blur(6px)'
              }}></div>
            </>
          )}
          
          <div 
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Token
              role={role || undefined}
              text={!hideRoleImage && role && showName ? role.name : ''}
              size={size}
              variant="role"
              imageRotation={isFlipped ? 180 : 0}
              onClick={onClick}
              isDead={isDead}
              disableHover={disableHover}
              hideRoleImage={hideRoleImage}
            />
          </div>
        </div>
      </div>
      
      {showTooltip && role && role.ability && ReactDOM.createPortal(
        <div 
          className="role-tooltip role-ability-tooltip"
          style={{ 
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            maxWidth: `${tooltipMaxWidth}px`,
            transform: tooltipExpandRight ? 'translate(0, -50%)' : 'translate(-100%, -50%)',
            pointerEvents: 'none'
          }}
        >
          <span className="role-tooltip-ability">{role.ability}</span>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes selectedPulse {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        
        @keyframes borderRotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes smokePulse {
          0% { 
            opacity: 0.4;
            transform: scale(0.9) translate(0, 0);
            filter: blur(15px);
          }
          25% { 
            opacity: 0.6;
            transform: scale(1.05) translate(2%, 2%);
            filter: blur(12px);
          }
          50% { 
            opacity: 0.7;
            transform: scale(1.1) translate(0, 0);
            filter: blur(10px);
          }
          75% { 
            opacity: 0.5;
            transform: scale(1.05) translate(-2%, -2%);
            filter: blur(13px);
          }
          100% { 
            opacity: 0.4;
            transform: scale(0.9) translate(0, 0);
            filter: blur(15px);
          }
        }
      `}</style>
    </>
  );
}
