import React, { useState, useEffect, useRef } from 'react';
import SideDrawer from './SideDrawer';
import { useApp } from '../../contexts/AppContext';
import RoleToken from '../RoleToken/RoleToken';
import TokenCarousel from '../TokenCarousel/TokenCarousel';
import './SideDrawer.css';

interface LeftDrawersProps {
  onOpenBluffModal: (index: number) => void;
  // 隐藏恶魔伪装等角色前景图，仅保留通用背景（用于“隐藏魔典”翻面效果）
  hideRoleImage?: boolean;
}

const LeftDrawers: React.FC<LeftDrawersProps> = ({
  onOpenBluffModal,
  hideRoleImage
}) => {
  const { 
    state: appState, 
    addSelectedFabledRole,
    removeSelectedFabledRole
  } = useApp();

  const [openDrawers, setOpenDrawers] = useState<Record<'bluffs' | 'fabled' | 'jinxed', boolean>>({
    bluffs: true,
    fabled: false,
    jinxed: false
  });

  const prevFabledLen = useRef(appState.fabledRoles.length);
  const prevJinxedLen = useRef(appState.jinxedRoles.length);

  // 仅在剧本的传奇/相克数量变化时同步开关（如换剧本），避免 context 引用变化导致覆盖用户点击产生闪烁
  useEffect(() => {
    const fl = appState.fabledRoles.length;
    const jl = appState.jinxedRoles.length;
    if (fl === prevFabledLen.current && jl === prevJinxedLen.current) return;
    prevFabledLen.current = fl;
    prevJinxedLen.current = jl;
    setOpenDrawers(prev => ({
      ...prev,
      bluffs: true,
      fabled: fl > 0,
      jinxed: jl > 0
    }));
  }, [appState.fabledRoles.length, appState.jinxedRoles.length]);

  const toggleDrawer = (drawer: 'bluffs' | 'fabled' | 'jinxed') => {
    setOpenDrawers(prev => ({
      ...prev,
      [drawer]: !prev[drawer]
    }));
  };

  const isFabledSelected = (roleId: string) => 
    appState.selectedFabledRoles.some(r => r.id === roleId);

  const handleFabledClick = (role: any) => {
    if (isFabledSelected(role.id)) {
      removeSelectedFabledRole(role.id);
    } else {
      addSelectedFabledRole(role);
    }
  };

  return (
    <>
      {/* 传奇与奇遇 - 停靠在左侧（上）；与相克规则间距 16px */}
      <SideDrawer
        title="传奇与奇遇"
        position="left"
        isOpen={openDrawers.fabled}
        onToggle={() => toggleDrawer('fabled')}
        style={{ 
          // 顶部抽屉：在中间抽屉（相克规则）之上，间距约 12px
          bottom: '294px',
          '--dock-width': 'auto',
          '--left-dock-token-size': '84px'
        } as React.CSSProperties}
        icon={
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" />
          </svg>
        }
      >
        {appState.fabledRoles.length === 0 ? (
          <div className="empty-state">
            <p>剧本中暂无传奇角色</p>
          </div>
        ) : (
          <TokenCarousel visibleCount={3} step={3}>
            {appState.fabledRoles.map((role, index) => (
              <div key={role.id} className="bluff-item">
                <RoleToken 
                  role={role as any} 
size={84}
                  onClick={() => handleFabledClick(role)}
                  disableHover={true}
                />
              </div>
            ))}
          </TokenCarousel>
        )}
      </SideDrawer>

      {/* 相克规则 - 停靠在左侧（中）；与恶魔的伪装、传奇与奇遇各 16px 间距 */}
      <SideDrawer
        title="相克规则"
        position="left"
        isOpen={openDrawers.jinxed}
        onToggle={() => toggleDrawer('jinxed')}
        style={{ 
          // 中间抽屉：在底部抽屉（恶魔的伪装）之上，间距约 12px
          bottom: '152px',
          '--dock-width': 'auto',
          '--left-dock-token-size': '84px'
        } as React.CSSProperties}
        icon={
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z" />
          </svg>
        }
      >
        {appState.jinxedRoles.length === 0 ? (
          <div className="empty-state">
            <p>剧本中暂无相克规则</p>
          </div>
        ) : (
          <TokenCarousel visibleCount={3} step={3}>
            {appState.jinxedRoles.map((role, index) => (
              <div key={role.id || index} className="bluff-item">
                <RoleToken 
                  role={role as any} 
                  size={84} 
                  disableHover={true}
                />
              </div>
            ))}
          </TokenCarousel>
        )}
      </SideDrawer>

      {/* 恶魔的伪装 - 停靠在左侧（下）；与相克规则间距 16px */}
      <SideDrawer
        title="恶魔的伪装"
        position="left"
        isOpen={openDrawers.bluffs}
        onToggle={() => toggleDrawer('bluffs')}
        style={{ 
          // 底部抽屉：贴近底边
          bottom: '10px',
          '--dock-width': 'auto',
          '--left-dock-token-size': '84px'
        } as React.CSSProperties}
        icon={
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" />
          </svg>
        }
      >
        <TokenCarousel visibleCount={3} step={3}>
          {appState.devilGuiseRoles.map((role, index) => (
            <div key={index} className="bluff-item">
              <RoleToken 
                role={role || undefined} 
                size={84} 
                onClick={() => onOpenBluffModal(index)}
                hideRoleImage={hideRoleImage}
              />
            </div>
          ))}
        </TokenCarousel>
      </SideDrawer>
    </>
  );

};

export default LeftDrawers;
