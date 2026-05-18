import React, { useState, useEffect, useRef } from 'react';
import StatusToken from '../StatusToken/StatusToken';
import type { GamePhase, Seat, Status, RoleData } from '../../types';

// 添加占位符样式
const addPlaceholderStyles = () => {
  const styleId = 'grimoire-notes-placeholder-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .grimoire-notes-textarea::placeholder {
      color: rgba(255, 255, 255, 0.35) !important;
      font-size: 13px !important;
    }
    .grimoire-notes-textarea.export::placeholder {
      color: rgba(0, 0, 0, 0.4) !important;
      font-size: 13px !important;
    }
    .grimoire-notes-textarea:focus {
      border-color: rgba(212, 175, 55, 0.35) !important;
      background-color: rgba(255, 255, 255, 0.08) !important;
    }
    .grimoire-notes-textarea.export:focus {
      border-color: rgba(212, 175, 55, 0.4) !important;
      background-color: rgba(212, 175, 55, 0.12) !important;
    }
  `;
  document.head.appendChild(style);
};

interface ActionEvent {
  id: string;
  type: 'status' | 'custom';
  status?: {
    targetSeatIndex: number;
    role: RoleData;
    statusName: string;
  };
  text?: string;
  timestamp: number;
}

interface GrimoireNotesProps {
  seats: Seat[];
  currentPhase: GamePhase;
  phaseNotes: Record<string, any>;
  phaseCustomNotes: Record<string, string>;
  setPhaseNotes?: (notes: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  setPhaseCustomNotes?: (notes: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  readOnly?: boolean;
  getRoleImageSrc?: (src?: string) => string;
  mode?: 'screen' | 'export';
  exportScale?: number;
  exportOnlyActionOnDay?: boolean;
  columns?: number;
}

export default function GrimoireNotes({
  seats,
  currentPhase,
  phaseNotes,
  phaseCustomNotes,
  setPhaseNotes,
  setPhaseCustomNotes,
  readOnly = false,
  getRoleImageSrc,
  mode = 'screen',
  exportScale = 1,
  exportOnlyActionOnDay = false,
  columns = 1
}: GrimoireNotesProps) {
  const [editingEvent, setEditingEvent] = useState<{ playerId: number; eventId: string | null } | null>(null);
  const [screenScale, setScreenScale] = useState(1);
  const [hoveredStatusKey, setHoveredStatusKey] = useState<string | null>(null);
  /** 记录角色头像加载失败的 key（无图或加载失败时不展示头像，不占位） */
  const [roleImageErrorKeys, setRoleImageErrorKeys] = useState<Set<string>>(new Set());
  const isExport = mode === 'export';
  const isNight = currentPhase.type === 'night';
  const isFirstNight = currentPhase.count === 1;
  
  // 监听屏幕尺寸变化，动态调整缩放因子
  useEffect(() => {
    const updateScreenScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = width / height;
      
      // 根据屏幕尺寸和宽高比计算缩放因子
      // 考虑宽高比小的设备（更接近正方形或竖屏）需要更大程度的缩小
      let scale = 1;
      
      // 首先根据屏幕宽度确定基础缩放
      if (width < 768) {
        scale = 0.7;
      } else if (width < 1024) {
        scale = 0.8;
      } else if (width < 1280) {
        scale = 0.9;
      }
      
      // 然后根据宽高比进一步调整
      // 宽高比越小（越接近竖屏），缩小越多
      if (aspectRatio < 1.2) {
        scale *= 0.9;
      } else if (aspectRatio < 1.5) {
        scale *= 0.95;
      }
      
      // 确保缩放因子在合理范围内
      scale = Math.max(0.6, scale);
      
      setScreenScale(scale);
    };
    
    // 初始计算
    updateScreenScale();
    
    // 监听 resize 事件
    window.addEventListener('resize', updateScreenScale);
    
    // 添加占位符样式
    addPlaceholderStyles();
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('resize', updateScreenScale);
    };
  }, []);
  
  const scale = isExport ? exportScale : screenScale;
  const space = scale * (isExport ? 1.6 : 1);
  // 仅用行高和字间距缓解「挤在一起」，不放大字号，避免内容溢出被 PDF 裁切
  const exportTextStyle = isExport ? { lineHeight: 1.65 as const, letterSpacing: '0.04em' as const } : {};

  const baseSeats = isNight
    ? seats
        .filter(seat => {
          if (!seat.role) return false;
          const order = isFirstNight ? seat.role.firstNight : seat.role.otherNight;
          return typeof order === 'number' && order > 0;
        })
        .sort((a, b) => {
          const orderA = isFirstNight ? a.role!.firstNight : a.role!.otherNight;
          const orderB = isFirstNight ? b.role!.firstNight : b.role!.otherNight;
          return orderA - orderB;
        })
    : seats.slice().sort((a, b) => a.index - b.index);
  const hasAnyRole = seats.some(seat => seat.role);

  const resolveRoleImage = (src?: string) => {
    if (!src) return '';
    return getRoleImageSrc ? getRoleImageSrc(src) : src;
  };

  const getOutgoingStatuses = (seat: Seat) => {
    const outgoing: ActionEvent[] = [];
    
    if (seat.role) {
      seats.forEach(targetSeat => {
        targetSeat.statuses.forEach(status => {
          if (status.role && status.role.id === seat.role?.id) {
            const isCurrentPhase = status.addedAt &&
              status.addedAt.phase === currentPhase.type &&
              status.addedAt.count === currentPhase.count;
            if (isCurrentPhase) {
              outgoing.push({
                id: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'status',
                status: {
                  targetSeatIndex: targetSeat.index,
                  role: status.role,
                  statusName: status.name
                },
                timestamp: Date.now()
              });
            }
          }
        });
      });
    }
    
    // 不再收集自定义提示标记事件
    // seat.statuses.forEach(status => {
    //   if (status.type === 'custom') {
    //     const isCurrentPhase = status.addedAt &&
    //       status.addedAt.phase === currentPhase.type &&
    //       status.addedAt.count === currentPhase.count;
    //     if (isCurrentPhase) {
    //       outgoing.push({
    //         id: `custom_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    //         type: 'custom',
    //         text: status.name,
    //         timestamp: Date.now()
    //       });
    //     }
    //   }
    // });
    
    return outgoing;
  };

  const getHiddenStatusKey = (seatId: number) =>
    `${currentPhase.type}_${currentPhase.count}_${seatId}_hidden_status`;

  const getPlayerEvents = (seat: Seat) => {
    const currentPhaseKey = `${currentPhase.type}_${currentPhase.count}`;
    const seatNotes = phaseNotes[`${currentPhaseKey}_${seat.id}`];
    const statusEvents = getOutgoingStatuses(seat);
    const hiddenRaw = phaseNotes[getHiddenStatusKey(seat.id)];
    const hiddenList: Array<{ targetSeatIndex: number; statusName: string; roleId: string }> =
      Array.isArray(hiddenRaw) ? hiddenRaw : [];
    const isStatusHidden = (e: ActionEvent) =>
      e.type === 'status' &&
      e.status?.role?.id &&
      hiddenList.some(
        (h) =>
          h.targetSeatIndex === e.status!.targetSeatIndex &&
          h.statusName === e.status!.statusName &&
          h.roleId === e.status!.role!.id
      );
    const allEvents = statusEvents.filter((e) => !isStatusHidden(e));
    
    // 处理旧的字符串格式
    if (typeof seatNotes === 'string' && seatNotes) {
      allEvents.push({
        id: `legacy_${Date.now()}`,
        type: 'custom',
        text: seatNotes,
        timestamp: Date.now()
      });
    }
    // 处理新的事件数组格式
    else if (Array.isArray(seatNotes)) {
      seatNotes.forEach(event => {
        // 保留正在编辑的事件，即使文本为空
        const isEditing = editingEvent?.playerId === seat.id && editingEvent?.eventId === event.id;
        if (isEditing || 
            (event.type === 'custom' && event.text) || 
            (event.type === 'status' && !statusEvents.some(s => 
              s.type === 'status' && 
              s.status?.targetSeatIndex === event.status?.targetSeatIndex &&
              s.status?.statusName === event.status?.statusName
            ))) {
          allEvents.push(event);
        }
      });
    }
    
    // 按时间戳排序
    return allEvents.sort((a, b) => a.timestamp - b.timestamp);
  };

  const addCustomEvent = (seat: Seat) => {
    if (!setPhaseNotes) return;
    
    const currentPhaseKey = `${currentPhase.type}_${currentPhase.count}`;
    const key = `${currentPhaseKey}_${seat.id}`;
    const newEvent: ActionEvent = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'custom',
      text: '',
      timestamp: Date.now()
    };
    
    setPhaseNotes(prev => {
      // 转换旧的字符串格式为新的事件数组格式
      let currentEvents: ActionEvent[] = [];
      if (typeof prev[key] === 'string') {
        if (prev[key]) {
          currentEvents = [{
            id: `legacy_${Date.now()}`,
            type: 'custom',
            text: prev[key],
            timestamp: Date.now() - 1
          }];
        }
      } else if (Array.isArray(prev[key])) {
        currentEvents = prev[key];
      }
      
      return {
        ...prev,
        [key]: [...currentEvents, newEvent]
      };
    });
    
    setEditingEvent({ playerId: seat.id, eventId: newEvent.id });
  };

  const updateCustomEvent = (seat: Seat, eventId: string, text: string) => {
    if (!setPhaseNotes) return;
    
    const currentPhaseKey = `${currentPhase.type}_${currentPhase.count}`;
    const key = `${currentPhaseKey}_${seat.id}`;
    
    setPhaseNotes(prev => {
      // 转换旧的字符串格式为新的事件数组格式
      let currentEvents: ActionEvent[] = [];
      if (typeof prev[key] === 'string') {
        if (prev[key]) {
          currentEvents = [{
            id: `legacy_${Date.now()}`,
            type: 'custom',
            text: prev[key],
            timestamp: Date.now() - 1
          }];
        }
      } else if (Array.isArray(prev[key])) {
        currentEvents = prev[key];
      }
      
      const updatedEvents = currentEvents.map(event => 
        event.id === eventId ? { ...event, text } : event
      );
      // 保留空文本事件，等待用户完成编辑
      return {
        ...prev,
        [key]: updatedEvents
      };
    });
  };

  const deleteEvent = (seat: Seat, eventId: string) => {
    if (!setPhaseNotes) return;
    
    const currentPhaseKey = `${currentPhase.type}_${currentPhase.count}`;
    const key = `${currentPhaseKey}_${seat.id}`;
    
    setPhaseNotes(prev => {
      // 转换旧的字符串格式为新的事件数组格式
      let currentEvents: ActionEvent[] = [];
      if (typeof prev[key] === 'string') {
        if (prev[key]) {
          currentEvents = [{
            id: `legacy_${Date.now()}`,
            type: 'custom',
            text: prev[key],
            timestamp: Date.now() - 1
          }];
        }
      } else if (Array.isArray(prev[key])) {
        currentEvents = prev[key];
      }
      
      const filteredEvents = currentEvents.filter(event => event.id !== eventId);
      return {
        ...prev,
        [key]: filteredEvents
      };
    });
  };

  /** 仅用于来源于提示 token 的 status 事件：只在笔记中隐藏，不碰圆桌；圆桌撤掉该标记再重新挂上会再次生成事件（见 App 中清除隐藏） */
  const deleteStatusEvent = (seat: Seat, event: ActionEvent) => {
    if (!setPhaseNotes || event.type !== 'status' || !event.status?.role?.id) return;
    const key = getHiddenStatusKey(seat.id);
    const entry = {
      targetSeatIndex: event.status.targetSeatIndex,
      statusName: event.status.statusName,
      roleId: event.status.role.id,
    };
    setPhaseNotes((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      if (list.some((h) => h.targetSeatIndex === entry.targetSeatIndex && h.statusName === entry.statusName && h.roleId === entry.roleId))
        return prev;
      return { ...prev, [key]: [...list, entry] };
    });
  };

  if (!hasAnyRole) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        fontSize: '14px'
      }}>
        请先完成角色分配
      </div>
    );
  }

  const exportEntries = (exportOnlyActionOnDay && !isNight)
    ? baseSeats.map(seat => {
        const events = getPlayerEvents(seat);
        return {
          seat,
          events,
          hasAction: events.length > 0
        };
      }).filter(entry => entry.hasAction)
    : baseSeats.map(seat => ({
        seat,
        events: getPlayerEvents(seat),
        hasAction: false
      }));

  const gridStyle = isExport && columns > 1 ? {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    alignItems: 'start',
    gap: `${14 * space}px`
  } : {
    display: 'flex',
    flexDirection: 'column',
    gap: `${6 * space}px`
  } as const;

  return (
    <div
      data-notes-root="true"
      style={{
      flex: isExport ? 'none' : 1,
      display: 'flex',
      flexDirection: 'column',
      gap: `${12 * space}px`,
      overflow: isExport ? 'visible' : 'auto',
      minHeight: 0,
      ...(isExport ? { maxWidth: '88%', marginLeft: 'auto', marginRight: 'auto' } : {})
    }}>
      <div style={{
        flex: 'none',
        overflow: isExport ? 'visible' : 'visible',
        paddingRight: `${5 * space}px`,
        ...gridStyle
      }}>
        {exportEntries.length === 0 ? (
          <div style={{
            gridColumn: `1 / span ${columns}`, // 确保空状态占满整行
            padding: `${12 * space}px`,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: `${14 * scale}px`,
            ...exportTextStyle
          }}>
            {isNight ? '今夜无角色行动' : '本阶段无行动记录'}
          </div>
        ) : (
          exportEntries.map(({ seat, events }, index) => {
            const ownStatuses = seat.statuses || [];
            return (
              <React.Fragment key={seat.id}>
                <div style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: `${6 * space}px ${10 * space}px`,
                  borderTop: index > 0 && (columns || 1) === 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                  paddingTop: index > 0 && (columns || 1) === 1 ? `${10 * space}px` : `${6 * space}px`,
                  borderRadius: '6px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  alignContent: 'flex-start',
                  gap: `${8 * space}px`,
                  rowGap: `${10 * space}px`,
                  opacity: seat.isDead ? 0.5 : 1,
                  filter: seat.isDead ? 'grayscale(0.8)' : 'none',
                  pointerEvents: 'auto',
                  minHeight: 'auto',
                  breakInside: 'avoid', // 防止被分列时切断
                  pageBreakInside: 'avoid',
                  background: isExport ? '#ffffff' : 'transparent'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${6 * space}px`,
                  padding: `${4 * space}px`,
                  borderRadius: '6px',
                  flexShrink: 0,
                  alignSelf: 'flex-start'
                }}>
                  <div style={{
                    width: `${42 * scale}px`,
                    height: `${42 * scale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isExport ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.1)',
                    borderRadius: '50%',
                    color: isExport ? '#000000' : '#d4af37',
                    fontWeight: 'bold',
                    fontSize: `${16 * scale}px`,
                    flexShrink: 0,
                    ...exportTextStyle
                  }}>
                    {seat.index + 1}
                  </div>

                  {seat.role?.image && !roleImageErrorKeys.has(`${seat.id}-${seat.role?.id ?? ''}`) && (
                    <div style={{
                      width: `${42 * scale}px`,
                      height: `${42 * scale}px`,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      <img
                        src={resolveRoleImage(seat.role.image)}
                        alt={seat.role.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => setRoleImageErrorKeys(prev => new Set(prev).add(`${seat.id}-${seat.role?.id ?? ''}`))}
                      />
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: `${3 * space}px`,
                    flexWrap: 'wrap',
                    flexShrink: 0
                  }}>
                    <div style={{
                      color: isExport ? '#000000' : '#e5e7eb',
                      fontWeight: 'bold',
                      fontSize: `${14 * scale}px`,
                      whiteSpace: 'nowrap',
                      ...exportTextStyle
                    }}>
                      {seat.role?.name || '未分配'}
                    </div>

                    {ownStatuses.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: `${2 * space}px` }}>
                        <span style={{ color: isExport ? '#000000' : '#9ca3af', fontSize: `${16 * scale}px`, lineHeight: '1', ...exportTextStyle }}>(</span>
                        {ownStatuses.map((status, idx) => (
                          <div key={`${status.name}-${idx}`}>
                            <StatusToken
                              role={status.role}
                              statusName={status.name}
                              size={42 * scale}
                              isCustom={status.type === 'custom'}
                            />
                          </div>
                        ))}
                        <span style={{ color: isExport ? '#000000' : '#9ca3af', fontSize: `${16 * scale}px`, lineHeight: '1', ...exportTextStyle }}>)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: isExport ? 'flex-start' : 'center',
                  gap: `${6 * space}px`,
                  rowGap: `${10 * space}px`,
                  flex: 1,
                  minWidth: '0'
                }}>
                  {events.map((event, idx) => (
                    <React.Fragment key={event.id}>
                      {idx > 0 && (
                        <span style={{
                          color: isExport ? '#000000' : '#d4af37',
                          fontSize: `${14 * scale}px`,
                          fontWeight: 'bold',
                          alignSelf: isExport ? 'flex-start' : 'center',
                          ...exportTextStyle
                        }}>
                          ｜
                        </span>
                      )}
                      
                      {event.type === 'status' && event.status && (() => {
                        const statusHoverKey = `${seat.id}_${event.status.targetSeatIndex}_${event.status.statusName}`;
                        const isHovered = hoveredStatusKey === statusHoverKey;
                        return (
                        <div
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: isExport ? 'flex-start' : 'center',
                            justifyContent: isExport ? 'flex-start' : 'center',
                            gap: `${3 * space}px`,
                            padding: `${4 * space}px ${6 * space}px`,
                            background: isExport ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '6px',
                            ...(isExport ? { minHeight: `${50 * scale}px`, height: 'auto' } : { height: `${50 * scale}px` }),
                            boxSizing: 'border-box',
                            minWidth: `${50 * scale}px`,
                            width: 'auto',
                            maxWidth: isExport ? 'none' : `${300 * scale}px`,
                            overflow: 'visible',
                            whiteSpace: isExport ? 'normal' : 'nowrap',
                            ...(isExport ? { wordBreak: 'break-word' as const } : {}),
                            border: isExport ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(212, 175, 55, 0.5)'
                          }}
                          onMouseEnter={!readOnly && !isExport ? () => setHoveredStatusKey(statusHoverKey) : undefined}
                          onMouseLeave={!readOnly && !isExport ? () => setHoveredStatusKey(null) : undefined}
                        >
                          {!readOnly && !isExport && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); deleteStatusEvent(seat, event); }}
                              title="删除该提示 token 事件"
                              style={{
                                position: 'absolute',
                                top: '-10px',
                                right: '-10px',
                                zIndex: 10,
                                width: `${22 * scale}px`,
                                height: `${22 * scale}px`,
                                padding: 0,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: isHovered ? 1 : 0,
                                transition: 'opacity 0.15s ease',
                                pointerEvents: isHovered ? 'auto' : 'none'
                              }}
                            >
                              <svg width={22 * scale} height={22 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%', color: '#d4af37' }}>
                                <circle cx="12" cy="12" r="9.5" strokeWidth="2" />
                                <path d="M14 10l-4 4M10 10l4 4" />
                              </svg>
                            </button>
                          )}
                          <span style={{
                            color: isExport ? '#000000' : '#d4af37',
                            fontSize: `${12 * scale}px`,
                            fontWeight: 'bold',
                            ...exportTextStyle
                          }}>
                            #{event.status.targetSeatIndex + 1}
                          </span>
                          <StatusToken
                            role={event.status.role}
                            statusName={event.status.statusName}
                            size={42 * scale}
                          />
                        </div>
                        );
                      })()}
                      
                      {event.type === 'custom' && (
                        <div style={{
                          display: 'flex',
                          alignItems: isExport ? 'flex-start' : 'center',
                          justifyContent: isExport ? 'flex-start' : 'center',
                          gap: `${3 * space}px`,
                          padding: `${4 * space}px ${6 * space}px`,
                          background: isExport ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '6px',
                          ...(isExport ? { minHeight: `${50 * scale}px`, height: 'auto' } : { height: `${50 * scale}px` }),
                          boxSizing: 'border-box',
                          minWidth: `${50 * scale}px`,
                          width: 'auto',
                          maxWidth: isExport ? 'none' : `${300 * scale}px`,
                          overflow: isExport ? 'visible' : 'hidden',
                          whiteSpace: isExport ? 'normal' : 'nowrap',
                          ...(isExport ? { wordBreak: 'break-word' as const } : {}),
                          border: isExport ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(212, 175, 55, 0.5)'
                        }}>
                          {editingEvent?.playerId === seat.id && editingEvent?.eventId === event.id ? (
                              <>
                                <span
                                  ref={(el) => {
                                    if (el) {
                                      const width = el.offsetWidth;
                                      const input = el.parentElement?.querySelector('input');
                                      if (input) {
                                        input.style.width = `${Math.max(50 * scale, Math.min(width + 20, 300 * scale))}px`;
                                      }
                                    }
                                  }}
                                  style={{
                                    position: 'absolute',
                                    left: '-9999px',
                                    top: '0',
                                    whiteSpace: 'nowrap',
                                    fontSize: `${12 * scale}px`,
                                    visibility: 'hidden',
                                    pointerEvents: 'none'
                                  }}
                                >
                                  {event.text || ''}
                                </span>
                                <input
                                  autoFocus
                                  value={event.text || ''}
                                  onChange={(e) => updateCustomEvent(seat, event.id, (e.target as HTMLInputElement).value)}
                                  onBlur={(e) => {
                                    // 当用户完成编辑时，检查文本是否为空，如果为空则删除该事件
                                    const text = (e.target as HTMLInputElement).value;
                                    if (!text && setPhaseNotes) {
                                      const currentPhaseKey = `${currentPhase.type}_${currentPhase.count}`;
                                      const key = `${currentPhaseKey}_${seat.id}`;
                                      setPhaseNotes(prev => {
                                        let currentEvents: ActionEvent[] = [];
                                        if (typeof prev[key] === 'string') {
                                          if (prev[key]) {
                                            currentEvents = [{
                                              id: `legacy_${Date.now()}`,
                                              type: 'custom',
                                              text: prev[key],
                                              timestamp: Date.now() - 1
                                            }];
                                          }
                                        } else if (Array.isArray(prev[key])) {
                                          currentEvents = prev[key];
                                        }
                                        const filteredEvents = currentEvents.filter(e => e.id !== event.id);
                                        return {
                                          ...prev,
                                          [key]: filteredEvents
                                        };
                                      });
                                    }
                                    setEditingEvent(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      // 当用户按Enter键时，检查文本是否为空，如果为空则删除该事件
                                      const text = (e.target as HTMLInputElement).value;
                                      if (!text && setPhaseNotes) {
                                        const currentPhaseKey = `${currentPhase.type}_${currentPhase.count}`;
                                        const key = `${currentPhaseKey}_${seat.id}`;
                                        setPhaseNotes(prev => {
                                          let currentEvents: ActionEvent[] = [];
                                          if (typeof prev[key] === 'string') {
                                            if (prev[key]) {
                                              currentEvents = [{
                                                id: `legacy_${Date.now()}`,
                                                type: 'custom',
                                                text: prev[key],
                                                timestamp: Date.now() - 1
                                              }];
                                            }
                                          } else if (Array.isArray(prev[key])) {
                                            currentEvents = prev[key];
                                          }
                                          const filteredEvents = currentEvents.filter(e => e.id !== event.id);
                                          return {
                                            ...prev,
                                            [key]: filteredEvents
                                          };
                                        });
                                      }
                                      setEditingEvent(null);
                                    }
                                  }}
                                  style={{
                                    minWidth: event.text ? undefined : `${80 * scale}px`,
                                    maxWidth: `${300 * scale}px`,
                                    textAlign: 'center',
                                    background: isExport ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                                    border: 'none',
                                    borderBottom: `1px solid ${isExport ? 'rgba(0, 0, 0, 0.3)' : 'rgba(212, 175, 55, 0.5)'}`,
                                    color: isExport ? '#000000' : '#e5e7eb',
                                    fontSize: `${12 * scale}px`,
                                    padding: `${2 * space}px ${3 * space}px`,
                                    outline: 'none',
                                    ...exportTextStyle
                                  }}
                                />
                              </>
                            ) : (
                              <div
                                onClick={() => !readOnly && setEditingEvent({ playerId: seat.id, eventId: event.id })}
                                style={{
                                  width: 'auto',
                                  minWidth: `${50 * scale}px`,
                                  maxWidth: isExport ? 'none' : `${300 * scale}px`,
                                  overflow: isExport ? 'visible' : 'hidden',
                                  textOverflow: isExport ? 'clip' : 'ellipsis',
                                  whiteSpace: isExport ? 'normal' : 'nowrap',
                                  ...(isExport ? { wordBreak: 'break-word' as const } : {}),
                                  textAlign: isExport ? 'left' : 'center',
                                  fontSize: `${12 * scale}px`,
                                  color: isExport ? '#000000' : '#e5e7eb',
                                  cursor: readOnly ? 'default' : 'pointer',
                                  ...exportTextStyle
                                }}
                                title={isExport ? undefined : event.text}
                              >
                                {event.text}
                              </div>
                            )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {!readOnly && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        addCustomEvent(seat);
                      }}
                        style={{
                        cursor: 'pointer',
                        color: isExport ? '#000000' : '#d4af37',
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        padding: `${2 * space}px`,
                        marginLeft: 'auto',
                        height: `${50 * scale}px`,
                        boxSizing: 'border-box'
                      }}
                      title="添加行动事件"
                    >
                      <svg width={12 * scale} height={12 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
            );
          })
        )}
      </div>

      <div style={{
        height: `${120 * scale}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${8 * space}px`,
        flexShrink: 0,
        paddingTop: `${10 * space}px`,
        borderTop: isExport ? 'none' : '1px solid rgba(255, 255, 255, 0.12)'
      }}>
        <div style={{
          color: isExport ? '#000000' : 'rgba(212, 175, 55, 0.7)',
          fontSize: `${12 * scale}px`,
          fontWeight: 600,
          letterSpacing: '0.02em',
          ...exportTextStyle
        }}>备注</div>
        {(() => {
          const phaseKey = `${currentPhase.type}_${currentPhase.count}`;
          const value = phaseCustomNotes[phaseKey] || '';
          const notesInputBg = isExport ? 'rgba(212, 175, 55, 0.08)' : 'rgba(255, 255, 255, 0.06)';
          const notesInputBorder = isExport ? '1px solid rgba(212, 175, 55, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)';
          return readOnly ? (
            value ? (
              <div style={{
                flex: 1,
                background: notesInputBg,
                borderRadius: '8px',
                padding: `${10 * space}px`,
                color: isExport ? '#000000' : '#e5e7eb',
                fontSize: `${14 * scale}px`,
                lineHeight: isExport ? 1.65 : 1.5,
                whiteSpace: 'pre-wrap',
                border: notesInputBorder,
                ...exportTextStyle
              }}>
                {value}
              </div>
            ) : (
              <div style={{
                color: isExport ? '#000000' : 'rgba(156, 163, 175, 0.8)',
                fontSize: `${13 * scale}px`,
                padding: `${6 * space}px 0`,
                ...exportTextStyle
              }}>
                本阶段无备注信息
              </div>
            )
          ) : (
            <textarea
              value={value}
              onChange={(e) => {
                const val = e.target.value;
                setPhaseCustomNotes?.(prev => {
                  const next = { ...prev };
                  if (val) {
                    next[phaseKey] = val;
                  } else {
                    delete next[phaseKey];
                  }
                  return next;
                });
              }}
              placeholder={currentPhase.type === 'day'
                ? '可在此记录提名处决信息'
                : '笔记中所有内容可导出生成复盘记录'}
              className={`grimoire-notes-textarea ${isExport ? 'export' : ''}`}
              style={{
                  flex: 1,
                  background: notesInputBg,
                  borderRadius: '8px',
                  padding: `${10 * space}px`,
                  color: isExport ? '#000000' : '#e5e7eb',
                  fontSize: `${14 * scale}px`,
                  resize: 'none',
                  outline: 'none',
                  lineHeight: isExport ? 1.65 : 1.5,
                  border: notesInputBorder,
                  transition: 'border-color 0.2s ease, background-color 0.2s ease',
                  ...exportTextStyle
                }}
            />
          );
        })()}
      </div>
    </div>
  );
}
