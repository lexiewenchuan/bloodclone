import { useId, useState, useRef, useEffect } from 'react';
import { RoleData } from '../../types';

interface TokenProps {
  role?: RoleData | null;
  text?: string;
  size?: number;
  variant?: 'role' | 'status';
  showDeleteEffect?: boolean;
  imageRotation?: number;
  disableHover?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  isDead?: boolean;
  backgroundColor?: string;
  isCustom?: boolean;
  // 隐藏角色前景图，仅保留通用背景（用于“隐藏魔典”翻面效果）
  hideRoleImage?: boolean;
}

export default function Token({ 
  role, 
  text,
  size = 75, 
  variant = 'role',
  showDeleteEffect = false,
  imageRotation = 0,
  disableHover = false,
  onClick,
  children,
  isDead = false,
  backgroundColor = 'rgba(107, 33, 168, 0.8)',
  isCustom = false,
  hideRoleImage = false
}: TokenProps) {
  const isStatus = variant === 'status';
  const pathId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [bgError, setBgError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canShowDelete = isStatus && showDeleteEffect && isHovered;

  // 用全局 mousemove 作为 hover 的可靠来源：移入时设 true、移出时设 false，避免 token 间快速移动时 mouseenter 未触发导致删除图标不显示
  const needHoverTracking = isStatus && showDeleteEffect && !disableHover;
  useEffect(() => {
    if (!needHoverTracking || !containerRef.current) return;

    const shrink = 4; // 略微缩小 hover 区域，避免相邻 token 的矩形区域在中间有重叠
    const checkHover = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const isInside =
        e.clientX >= rect.left + shrink &&
        e.clientX <= rect.right - shrink &&
        e.clientY >= rect.top + shrink &&
        e.clientY <= rect.bottom - shrink;

      if (!isInside) {
        // 不在自身矩形内，直接关闭 hover
        if (isHovered) {
          setIsHovered(false);
        }
        return;
      }

      // 仅当前 Token 处于视觉最上层时才响应 hover：
      // 如果在同一位置上方还有其它元素（例如另一个重叠的 Token），
      // 通过 elementFromPoint 检测最上层元素是否属于当前 Token 容器。
      const topEl = document.elementFromPoint(e.clientX, e.clientY);
      if (!topEl || !el.contains(topEl)) {
        if (isHovered) {
          setIsHovered(false);
        }
        return;
      }

      // 此时既在自身矩形内，又确认当前 Token 是堆叠中的最上层，才设置为 hover
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      if (!isHovered) {
        setIsHovered(true);
      }
    };

    window.addEventListener('mousemove', checkHover);
    return () => window.removeEventListener('mousemove', checkHover);
  }, [needHoverTracking, isHovered]);

  const handleMouseEnter = () => {
    if (disableHover) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (disableHover) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
      hoverTimeoutRef.current = null;
    }, 50); // 短延迟，避免从 A 移到 B 时经过缝隙瞬间触发 leave 导致闪烁
  };

  const textColor = isStatus ? 'white' : 'black';
  const backgroundImage = isStatus ? 'image/status_token.webp' : 'image/zuowei.webp';
  // 以 75px 为基准比例计算
  const baseSize = 75;
  const ratio = size / baseSize;
  // 背景尺寸与偏移保持原有设计，仅单独调整前景 image 位置
  const backgroundSize = isStatus ? (baseSize + 60) * ratio : (baseSize + 6) * ratio;
  const backgroundOffset = isStatus ? -30 * ratio : -3 * ratio;

  const getFontSize = () => {
    if (!text) return size * 0.15;
    const len = text.length;
    if (len > 12) return size * 0.08;
    if (len > 8) return size * 0.1;
    if (len > 5) return size * 0.12;
    return size * 0.15;
  };

  const getLetterSpacing = () => {
    if (!text) return size * 0.02;
    const len = text.length;
    if (len > 12) return 0;
    if (len > 8) return size * 0.01;
    return size * 0.02;
  };

  // 对外部头像 URL 统一走后端代理，避免跨域导致 html2canvas 抓不到像素
  const getRoleImageSrc = () => {
    if (!role?.image) return '';
    const src = role.image;
    // 开发环境下直接使用原始 URL，保证本地调试正常
    if (import.meta.env.DEV) {
      return src;
    }
    // 仅对 http/https 外链走代理，本地静态资源维持不变
    if (/^https?:\/\//i.test(src)) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }
    return src;
  };

  return (    <div 
      ref={containerRef}
      className={`token ${variant}`}
      title={isCustom ? text : undefined}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        cursor: onClick && !disableHover ? 'pointer' : 'default',
        position: 'relative',
        transition: isStatus && isHovered ? 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
        borderRadius: '50%',
        overflow: isStatus ? 'visible' : 'hidden',
        boxShadow: !isStatus ? '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)' : 'none',
        transform: isStatus && isHovered ? 'scale(1.05)' : (imageRotation !== 0 ? `rotate(${imageRotation}deg)` : 'none'),
        clipPath: 'circle(50%)'
      }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 背景图层 */}
      <div style={{ 
        position: 'absolute',
        top: `${backgroundOffset}px`,
        left: `${backgroundOffset}px`,
        width: `${backgroundSize}px`,
        height: `${backgroundSize}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        zIndex: 1
      }}>
        <img 
          src={backgroundImage} 
          alt="背景" 
          loading="eager"
          decoding="sync"
          onError={() => setBgError(true)}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            filter: isDead ? 'brightness(0.5) grayscale(0.7)' : 'none',
            opacity: bgError ? 0 : 1,
            transition: bgError ? 'opacity 0.2s ease' : 'none'
          }} 
        />
        {bgError && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: isStatus ? 'rgba(107, 33, 168, 0.3)' : 'rgba(212, 175, 55, 0.2)',
            zIndex: 1
          }} />
        )}
      </div>
      
      {isStatus && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: backgroundColor,
          zIndex: 1.5,
          transition: 'background-color 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {canShowDelete && (
            <svg 
              width={size * 0.6} 
              height={size * 0.6} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{
                filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
                animation: 'stampIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                zIndex: 20
              }}
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </div>
      )}
      
      {role && !imageError && !hideRoleImage && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          opacity: canShowDelete ? 0.3 : 1,
          transition: canShowDelete ? 'opacity 0.3s ease' : 'none',
          pointerEvents: 'none'
        }}>
          <img 
            src={getRoleImageSrc()} 
            alt={text || ''}
            onError={() => setImageError(true)}
            style={{ 
              width: '76%',
              height: '76%', 
              objectFit: 'contain',
              filter: isDead ? 'grayscale(1) brightness(0.7)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              transform: 'translateY(-6%)'
            }} 
          />
        </div>
      )}
      
      {text && (
        isCustom ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 15,
              pointerEvents: 'none',
              padding: `${size * 0.12}px`,
              boxSizing: 'border-box',
              overflow: 'visible'
            }}
          >
            <span
              style={{
                color: textColor,
                fontSize: Math.max(getFontSize(), size * 0.2),
                fontWeight: 'bold',
                textAlign: 'center',
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5), 0 0 4px rgba(0, 0, 0, 0.3)',
                opacity: canShowDelete ? 0.5 : 1,
                transition: 'opacity 0.3s ease',
                lineHeight: 1.3,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'normal'
              }}
            >
              {text.length > 10 ? `${text.substring(0, 10)}...` : text}
            </span>
          </div>
        ) : (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              pointerEvents: 'none'
            }}
            viewBox={`0 0 ${size} ${size}`}
          >
            <defs>
              <path
                id={pathId}
                d={`M ${size * 0.1} ${size * 0.66} A ${size * 0.45} ${size * 0.45} 0 0 0 ${size * 0.9} ${size * 0.66}`}
              />
            </defs>
            <text
              fill={textColor}
              fontSize={getFontSize()}
              fontWeight="bold"
              textAnchor="middle"
              letterSpacing={`${getLetterSpacing()}px`}
              style={{
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5), 0 0 4px rgba(0, 0, 0, 0.3)',
                opacity: canShowDelete ? 0.5 : 1,
                transition: 'opacity 0.3s ease'
              }}
            >
              <textPath
                href={`#${pathId}`}
                startOffset="50%"
              >
                {text}
              </textPath>
            </text>
          </svg>
        )
      )}

      {children}

      <style>{`
        @keyframes stampIn {
          0% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
