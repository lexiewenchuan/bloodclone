

interface SwapIconProps {
  size?: number;
  onClick?: () => void;
  isActive?: boolean;
}

export default function SwapIcon({ 
  size = 40, 
  onClick, 
  isActive = false 
}: SwapIconProps) {
  return (
    <div
      className="swap-icon"
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: isActive 
          ? 'rgba(212, 175, 55, 0.9)' 
          : 'rgba(212, 175, 55, 0.7)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
        transition: 'all 0.2s ease',
        boxShadow: isActive 
          ? '0 0 15px rgba(212, 175, 55, 0.5)' 
          : '0 0 8px rgba(212, 175, 55, 0.3)',
        backdropFilter: 'blur(4px)'
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)';
          e.currentTarget.style.background = 'rgba(212, 175, 55, 0.85)';
          e.currentTarget.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
          e.currentTarget.style.background = 'rgba(212, 175, 55, 0.7)';
          e.currentTarget.style.boxShadow = '0 0 8px rgba(212, 175, 55, 0.3)';
        }
      }}
    >
      <i 
        className="fa fa-exchange" 
        style={{ 
          color: 'white', 
          fontSize: `${size * 0.45}px`,
          transform: 'rotate(90deg)'
        }}
      ></i>
    </div>
  );
}