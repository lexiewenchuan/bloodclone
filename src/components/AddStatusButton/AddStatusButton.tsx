import React from 'react';
import Token from '../Token/Token';

interface AddStatusButtonProps {
  size: number;
  onClick: () => void;
  disableHover?: boolean;
}

export default function AddStatusButton({ size, onClick, disableHover = false }: AddStatusButtonProps) {
  return (
    <div 
      className="add-status-button-wrapper"
      style={{ 
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Token
        size={size}
        variant="status"
        disableHover={disableHover}
        onClick={onClick}
      >
        {/* 中央加号 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 20,
          color: 'white',
          fontSize: `${size * 0.6}px`,
          fontWeight: 'normal',
          fontFamily: 'serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textShadow: '0 0 10px rgba(167, 139, 250, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none'
        }}>
          +
        </div>
      </Token>
    </div>
  );
}
