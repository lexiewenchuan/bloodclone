import React from 'react';
import { RoleData } from '../types';
import RoleToken from './RoleToken/RoleToken';

export interface SimpleRoleTeam {
  type: string;
  name: string;
  color: string;
  roles: RoleData[];
}

interface RoleTeamGridSimpleProps {
  teams: SimpleRoleTeam[];
  onSelect: (role: RoleData) => void;
}

/**
 * 简化版角色团队网格布局：
 * - 按团队分组
 * - 左侧圆形团队图标
 * - 右侧每行 7 个角色 Token，行内居中
 * - 团队之间统一垂直间距
 * 
 * 注意：仅负责布局与间距，不包含选中状态、多选计数等逻辑。
 */
const RoleTeamGridSimple: React.FC<RoleTeamGridSimpleProps> = ({ teams, onSelect }) => {
  return (
    <div style={{
      width: '100%',
      padding: '10px 20px 5px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px',
        backgroundColor: 'transparent',
        borderRadius: '12px',
      }}>
        {teams.map((team) => {
          if (team.roles.length === 0) return null;
          
          return (
            <div key={team.type} style={{
              width: '100%',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center',
            }}>
              {/* 角色列表包裹容器：整体水平居中，团队圆标相对它定位 */}
              <div style={{
                position: 'relative',
                width: '70%',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                {/* 左侧团队圆形图标：绝对定位在列表左侧，保持固定间距 */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  right: '100%',
                  marginRight: '18px',
                  transform: 'translateY(-50%)',
                  width: '54px',
                  height: '54px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: `2px solid ${team.color}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 15px ${team.color}22`,
                    backdropFilter: 'blur(4px)',
                    textAlign: 'center',
                    color: team.color,
                    fontSize: '12px',
                    fontWeight: 'bold',
                    lineHeight: '1.2',
                  }}>
                    {team.name.substring(0, 2)}
                  </div>
                </div>

                {/* 右侧角色列表：整体在弹窗中水平居中，每行 7 个，行内居中 */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  {(() => {
                    const rows: RoleData[][] = [];
                    for (let i = 0; i < team.roles.length; i += 7) {
                      rows.push(team.roles.slice(i, i + 7));
                    }
                    return rows;
                  })().map((rowRoles, rowIndex) => (
                    <div key={`${team.type}-row-${rowIndex}`} style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '12px',
                      flexWrap: 'nowrap',
                    }}>
                      {rowRoles.map((role) => (
                        <RoleToken
                          key={role.id}
                          role={role}
                          size={75}
                          showName={true}
                          onClick={() => onSelect(role)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoleTeamGridSimple;
