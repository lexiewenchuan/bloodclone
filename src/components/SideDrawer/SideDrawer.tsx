import React, { useState } from 'react';
import './SideDrawer.css';

interface SideDrawerProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  position?: 'left' | 'bottom';
  style?: React.CSSProperties;
}

const SideDrawer: React.FC<SideDrawerProps> = ({ 
  title, 
  icon, 
  children, 
  isOpen, 
  onToggle,
  position = 'left',
  style 
}) => {
  return (
    <div className={`dock-panel-container ${position} ${isOpen ? 'open' : ''}`} style={style}>
      {/* 停靠栏按钮 (Dock Tab) */}
      <div className="dock-tab" onClick={onToggle}>
        <div className="dock-tab-text">{title}</div>
      </div>

      {/* 扩展面板 (Expanded Content) */}
      <div className="dock-content">
        <div className="dock-content-inner">
          <div className="dock-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideDrawer;
