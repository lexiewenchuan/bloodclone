
import { RoleData } from '../../types';
import Token from '../Token/Token';

interface RoleCardProps {
  role: RoleData;
  size?: number;
  showName?: boolean;
  selected?: boolean;
  onClick?: (role: RoleData) => void;
}

export default function RoleCard({ role, size = 60, showName = false, selected = false, onClick }: RoleCardProps) {
  const handleClick = () => {
    onClick?.(role);
  };

  return (
    <div 
      className={`role-card ${selected ? 'selected' : ''}`}
      style={{ 
        boxShadow: selected ? `0 0 0 3px #ffffff, 0 0 10px rgba(255, 255, 255, 0.5)` : 'none',
        display: 'inline-block'
      }}
    >
      <Token
        role={role}
        text={showName ? role.name : ''}
        size={size}
        variant="role"
        onClick={handleClick}
      />
    </div>
  );
}
