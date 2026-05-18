import React from 'react';
import { RoleData } from '../../types';
import Tooltip from '../Tooltip/Tooltip';
import { useApp } from '../../contexts/AppContext';

interface ActionOrderBadgeProps {
  role: RoleData;
  actionOrder: number;
  size?: number;
  isFirstNight: boolean;
  disableHover?: boolean;
}

export default function ActionOrderBadge({ role, actionOrder, size = 22, isFirstNight, disableHover = false }: ActionOrderBadgeProps) {
  const { state: appState } = useApp();
  const reminder = isFirstNight ? role.firstNightReminder : role.otherNightReminder;

  const badgeElement = (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      background: 'linear-gradient(135deg, #d4af37, #b8962d)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#1a202c',
      fontSize: `${size * 0.55}px`,
      fontWeight: '800',
      boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
      zIndex: 100,
      border: `${Math.max(0.5, size * 0.07)}px solid #1a202c`,
      textShadow: 'none',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      clipPath: 'circle(50%)',
      pointerEvents: 'auto'
    }}
    onMouseEnter={disableHover ? undefined : (e) => {
      e.currentTarget.style.transform = 'scale(1.1)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 175, 55, 0.6), inset 0 1px 1px rgba(255,255,255,0.3)';
    }}
    onMouseLeave={disableHover ? undefined : (e) => {
      e.currentTarget.style.transform = 'scale(1)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)';
    }}
    >
      {actionOrder}
    </div>
  );

  // 根据魔典设置决定是否显示夜间信息说明
  if (appState.grimoireSettings.hideNightInstructions || disableHover) {
    return badgeElement;
  }

  return (
    <Tooltip
      content={
      <div>
        <span className="role-tooltip-ability">{reminder || '暂无提示信息'}</span>
      </div>
    }
      className="role-ability-tooltip"
    >
      {badgeElement}
    </Tooltip>
  );
}
