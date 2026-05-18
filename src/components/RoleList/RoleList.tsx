import React from 'react';
import { RoleData } from '../../types';
import RoleToken from '../RoleToken/RoleToken';

export interface RoleTeam {
  type: string;
  name: string;
  color: string;
  roles: RoleData[];
}

interface RoleListProps {
  team: RoleTeam;
  onRoleClick?: (role: RoleData) => void;
  selectedRoleIds?: Set<string>;
  selectedRoleCounts?: Map<string, number>;
  enableMultiSelect?: boolean;
  onRoleToggle?: (role: RoleData) => void;
  showCount?: boolean;
  currentCount?: number;
  totalCount?: number;
  searchTerm?: string;
}

/**
 * 角色列表组件 - 展示同一角色类型的角色
 * 左侧：团队类型图标
 * 右侧：角色 Token 列表
 */
const RoleList: React.FC<RoleListProps> = ({
  team,
  onRoleClick,
  selectedRoleIds,
  selectedRoleCounts,
  enableMultiSelect,
  onRoleToggle,
  showCount,
  currentCount,
  totalCount,
  searchTerm,
}) => {
  // 计算搜索匹配（模糊匹配 name 或 name_eng）
  const normalizedSearch = searchTerm?.trim().toLowerCase() || '';
  const isSearchMatched = (role: RoleData) => {
    if (!normalizedSearch) return false;
    return role.name.toLowerCase().includes(normalizedSearch) ||
      (role.name_eng || '').toLowerCase().includes(normalizedSearch);
  };
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    }}>
      {/* 左侧团队类型图标 */}
      <div style={{
        flex: '0 0 60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '15px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'transparent',
          border: `2px solid ${team.color}55`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 15px ${team.color}22`,
          backdropFilter: 'blur(4px)',
          textAlign: 'center',
          color: team.color,
          fontSize: '12px',
          fontWeight: 'bold',
          lineHeight: '1.2'
        }}>
          <div>{team.name.substring(0, 2)}</div>
          {showCount && (
            <div style={{
              fontSize: '10px',
              fontWeight: '800',
              color: 'white',
              marginTop: '1px',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            }}>
              {currentCount || 0}/{totalCount || 0}
            </div>
          )}
        </div>
      </div>

      {/* 右侧角色列表 */}
      <div style={{
        width: '75%',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        justifyContent: 'center'
      }}>
        {team.roles.map((role) => {
          const roleCount = selectedRoleCounts?.get(role.id) || 0;
          const isSelected = enableMultiSelect 
            ? roleCount > 0 
            : selectedRoleIds?.has(role.id) || false;
          
          return (
            <div key={role.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px'
            }}>
              {/* 角色Token */}
              <div style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                // 搜索匹配标记样式：蓝色发光边框（与选中状态区分）
                boxShadow: isSearchMatched(role)
                  ? '0 0 0 2px rgba(56, 189, 248, 0.9), 0 0 12px rgba(56, 189, 248, 0.6)'
                  : 'none',
                borderRadius: '999px',
              }}>
                <RoleToken 
                  role={role}
                  size={75}
                  showName={true}
                  dimmed={!isSelected}
                  selected={isSelected}
                  showSetupMarker={isSelected}
                  onClick={() => {
                    if (onRoleToggle) {
                      onRoleToggle(role);
                    } else if (onRoleClick) {
                      onRoleClick(role);
                    }
                  }}
                />
              </div>
              
              {/* 多选计数器 */}
              {enableMultiSelect && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center'
                }}>
                  <button
                    onClick={() => {
                      const newCounts = new Map(selectedRoleCounts);
                      const currentCount = newCounts.get(role.id) || 0;
                      if (currentCount > 0) {
                        newCounts.set(role.id, currentCount - 1);
                        if (newCounts.get(role.id) === 0) {
                          newCounts.delete(role.id);
                        }
                        selectedRoleCounts && selectedRoleCounts.set(role.id, newCounts.get(role.id) || 0);
                        // 触发更新
                        onRoleToggle?.(role);
                      }
                    }}
                    disabled={roleCount <= 0}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: roleCount > 0 ? '1px solid #e53e3e' : '1px solid #4a5568',
                      backgroundColor: roleCount > 0 ? 'rgba(229, 62, 62, 0.8)' : 'rgba(74, 85, 104, 0.5)',
                      color: 'white',
                      fontSize: '14px',
                      cursor: roleCount > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: roleCount > 0 ? 1 : 0.5
                    }}
                  >
                    -
                  </button>
                  
                  <div style={{
                    color: roleCount > 0 ? '#4299e1' : '#718096',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {roleCount}
                  </div>
                  
                  <button
                    onClick={() => {
                      const newCounts = new Map(selectedRoleCounts);
                      const currentCount = newCounts.get(role.id) || 0;
                      newCounts.set(role.id, currentCount + 1);
                      selectedRoleCounts && selectedRoleCounts.set(role.id, newCounts.get(role.id) || 0);
                      // 触发更新
                      onRoleToggle?.(role);
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '1px solid #4299e1',
                      backgroundColor: 'rgba(66, 153, 225, 0.8)',
                      color: 'white',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoleList;
