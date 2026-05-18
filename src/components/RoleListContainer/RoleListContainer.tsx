import React from 'react';
import { RoleData } from '../../types';
import RoleList, { RoleTeam } from '../RoleList/RoleList';

interface RoleListContainerProps {
  teams: RoleTeam[];
  onRoleClick?: (role: RoleData) => void;
  selectedRoleIds?: Set<string>;
  selectedRoleCounts?: Map<string, number>;
  enableMultiSelect?: boolean;
  onRoleToggle?: (role: RoleData) => void;
  showCount?: boolean;
  calculatedRoleCounts?: Record<string, number>;
  gameConfigObj?: Record<string, number>;
  searchTerm?: string;
}

/**
 * 角色列表容器组件 - 包含多个角色列表
 * 垂直排列，每个角色类型一行
 */
const RoleListContainer: React.FC<RoleListContainerProps> = ({
  teams,
  onRoleClick,
  selectedRoleIds,
  selectedRoleCounts,
  enableMultiSelect,
  onRoleToggle,
  showCount,
  calculatedRoleCounts,
  gameConfigObj,
  searchTerm,
}) => {
  // 过滤出有角色的团队
  const validTeams = teams.filter(team => team.roles.length > 0);
  
  // 检查是否有有效角色数据
  const hasValidRoles = validTeams.length > 0;

  if (!hasValidRoles) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: '#9ca3af',
        fontSize: '16px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          opacity: 0.5
        }}>
          🎭
        </div>
        <div>暂未识别到有效角色数据</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px',
      backgroundColor: 'transparent',
      borderRadius: '12px',
      width: '100%',
      maxWidth: '900px',
      margin: '0 auto',
    }}>
      {validTeams.map((teamItem) => (
        <RoleList
          key={teamItem.type}
          team={teamItem}
          onRoleClick={onRoleClick}
          selectedRoleIds={selectedRoleIds}
          selectedRoleCounts={selectedRoleCounts}
          enableMultiSelect={enableMultiSelect}
          onRoleToggle={onRoleToggle}
          showCount={showCount}
          currentCount={calculatedRoleCounts?.[teamItem.type]}
          totalCount={gameConfigObj?.[teamItem.type]}
          searchTerm={searchTerm}
        />
      ))}
    </div>
  );
};

export default RoleListContainer;
