import React, { ReactNode } from 'react';
import Modal from '../Modal/Modal';

interface RoleModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  maxHeight?: string;
}

/**
 * 角色弹窗容器组件
 * 包含：标题栏、功能区域（可选）、角色列表容器
 */
const RoleModalContent: React.FC<RoleModalContentProps> = ({
  isOpen,
  onClose,
  title,
  width = '900px',
  headerExtra,
  children,
  maxHeight = '68%',
}) => {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={width}
      headerExtra={headerExtra}
    >
      {/* 角色内容区域 */}
      <div 
        className="role-modal-content" 
        style={{ 
          maxHeight, 
          overflowY: 'auto', 
          padding: '10px 20px 5px'
        }}
      >
        {children}
      </div>
    </Modal>
  );
};

export default RoleModalContent;
