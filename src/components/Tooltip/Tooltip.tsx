import React, { useState, useRef, ReactNode } from 'react';
import ReactDOM from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: React.ReactElement;
  className?: string;
  delay?: number;
}

export default function Tooltip({ content, children, className = '', delay = 0 }: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipPlaceAbove, setTooltipPlaceAbove] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let x = rect.left + rect.width / 2;

    const isAbilityTooltip = className?.includes('role-ability-tooltip');
    const safeMarginH = isAbilityTooltip ? 110 : 40;
    if (x > viewportWidth - safeMarginH) {
      x = viewportWidth - safeMarginH;
    } else if (x < safeMarginH) {
      x = safeMarginH;
    }

    let y: number;
    let placeAbove = true;
    if (isAbilityTooltip) {
      const safeMarginV = 12;
      const estimatedTooltipHeight = 180;
      const preferredYAbove = rect.top - 8;
      // 默认朝上展开；仅当朝上会导致 tooltip 顶部超出视口时才朝下
      const wouldOverflowTop = preferredYAbove - estimatedTooltipHeight < safeMarginV;
      if (!wouldOverflowTop) {
        y = Math.min(preferredYAbove, viewportHeight - safeMarginV);
      } else {
        placeAbove = false;
        y = rect.bottom + 8;
        if (y + estimatedTooltipHeight > viewportHeight - safeMarginV) {
          y = viewportHeight - safeMarginV - estimatedTooltipHeight;
        }
      }
    } else {
      y = rect.top - 8;
    }

    setTooltipPos({ x, y });
    setTooltipPlaceAbove(placeAbove);

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, delay);
    } else {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  // 添加兜底机制：监听全局事件，确保 Tooltip 在适当时候关闭
  React.useEffect(() => {
    if (!showTooltip) return;

    const checkHover = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // 增加一些缓冲区
        const buffer = 20; 
        
        // 检查鼠标是否在触发区域外
        const isOutside = 
          e.clientX < rect.left - buffer ||
          e.clientX > rect.right + buffer ||
          e.clientY < rect.top - buffer ||
          e.clientY > rect.bottom + buffer;

        if (isOutside) {
          handleMouseLeave();
        }
      }
    };

    // 处理全局点击/触摸，点击任意区域关闭 Tooltip
    const handleGlobalInteraction = (e: Event) => {
      // 如果点击的是触发区域本身，不强制关闭（由组件自身逻辑处理）
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      handleMouseLeave();
    };

    // 滚动时关闭 Tooltip
    const handleScroll = () => {
      handleMouseLeave();
    };

    window.addEventListener('mousemove', checkHover);
    window.addEventListener('mousedown', handleGlobalInteraction);
    window.addEventListener('touchstart', handleGlobalInteraction);
    window.addEventListener('scroll', handleScroll, { capture: true });

    return () => {
      window.removeEventListener('mousemove', checkHover);
      window.removeEventListener('mousedown', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [showTooltip]);

  return (
    <>
      <div 
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block', width: 'fit-content', height: 'fit-content' }}
      >
        {children}
      </div>
      
      {showTooltip && ReactDOM.createPortal(
        <div 
          className={`role-tooltip ${className}`}
          style={{ 
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: className?.includes('role-ability-tooltip')
              ? (tooltipPlaceAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)')
              : 'translate(-50%, -100%)',
            pointerEvents: 'none'
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
