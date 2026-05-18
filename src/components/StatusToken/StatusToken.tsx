import { RoleData } from '../../types';
import Token from '../Token/Token';

interface StatusTokenProps {
  role?: RoleData;
  statusName: string;
  size?: number;
  showDeleteEffect?: boolean;
  disableHover?: boolean;
  onClick?: () => void;
  isCustom?: boolean;
}

export default function StatusToken({ 
  role, 
  statusName,
  size = 75, 
  showDeleteEffect = false,
  disableHover = false,
  onClick,
  isCustom = false
}: StatusTokenProps) {
  return (
    <Token
      role={isCustom ? null : role}
      text={statusName}
      size={size}
      variant="status"
      showDeleteEffect={showDeleteEffect}
      disableHover={disableHover}
      onClick={onClick}
      isCustom={isCustom}
    />
  );
}
