import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { SeatProvider, useSeat } from './contexts/SeatContext';
import { AppProvider, useApp } from './contexts/AppContext';
import RoundTable from './components/RoundTable/RoundTable';
import Modal from './components/Modal/Modal';
import RoleToken from './components/RoleToken/RoleToken';
import RoleListContainer from './components/RoleListContainer/RoleListContainer';
import StatusToken from './components/StatusToken/StatusToken';
import ScriptSelector from './components/ScriptSelector/ScriptSelector';
import LeftDrawers from './components/SideDrawer/LeftDrawers';
import GameTimeline from './components/GameTimeline/GameTimeline';
import Tooltip from './components/Tooltip/Tooltip';
import Toast from './components/Toast/Toast';
import SeatPanel from './components/SeatPanel/SeatPanel';
import RenameModal from './components/RenameModal/RenameModal';
import RemoveConfirmModal from './components/RemoveConfirmModal/RemoveConfirmModal';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
// 高频功能保持直接加载（RoundTable / ScriptSelector / 角色分配等）
// 中低频弹窗按需懒加载，减小首包体积
const BackgroundModal = lazy(() => import('./components/BackgroundModal/BackgroundModal'));
const ExportReview = lazy(() => import('./components/ExportReview/ExportReview'));
const GrimoireNotesLazy = lazy(() => import('./components/GrimoireNotes/GrimoireNotes'));
import { RoleData, FabledData, Status, Script, ParseResult, JinxedData, Seat } from './types';
import { buildScriptFetchUrl } from './utils/scriptUrl';
import {
  createTown,
  dealRoles,
  getTownWsUrl,
  leaveTown,
  pushGameData,
  updateTownSettings,
} from './api/townClient';
import { ROUND_TABLE_LAYOUT } from './constants/layout';

interface GrimoireNotesErrorBoundaryProps {
  onClose: () => void;
  children: React.ReactNode;
}

interface GrimoireNotesErrorBoundaryState {
  hasError: boolean;
}

class GrimoireNotesErrorBoundary extends React.Component<
  GrimoireNotesErrorBoundaryProps,
  GrimoireNotesErrorBoundaryState
> {
  constructor(props: GrimoireNotesErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: unknown): GrimoireNotesErrorBoundaryState {
    // 轻量错误兜底：只记录日志，不打断其它界面
    console.error('[GrimoireNotes] 渲染异常');
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[GrimoireNotes] 组件错误详情:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#e5e7eb',
            fontSize: 14,
            textAlign: 'center'
          }}
        >
          <div style={{ maxWidth: 360 }}>
            魔典笔记加载失败，请刷新页面，或关闭后稍后再试。
          </div>
          <button
            onClick={this.props.onClose}
            style={{
              padding: '8px 18px',
              background: 'rgba(212, 175, 55, 0.18)',
              border: '1px solid rgba(212, 175, 55, 0.5)',
              borderRadius: 8,
              color: '#d4af37',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            关闭魔典笔记
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ExportReviewErrorBoundaryProps {
  onClose: () => void;
  children: React.ReactNode;
}

interface ExportReviewErrorBoundaryState {
  hasError: boolean;
}

class ExportReviewErrorBoundary extends React.Component<
  ExportReviewErrorBoundaryProps,
  ExportReviewErrorBoundaryState
> {
  constructor(props: ExportReviewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: unknown): ExportReviewErrorBoundaryState {
    console.error('[ExportReview] 渲染异常');
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ExportReview] 组件错误详情:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            color: '#e5e7eb',
            fontSize: 14,
            textAlign: 'center',
            zIndex: 10000
          }}
        >
          <div style={{ maxWidth: 360 }}>
            导出复盘加载失败，请刷新页面，或关闭后稍后再试。
          </div>
          <button
            onClick={this.props.onClose}
            style={{
              padding: '10px 24px',
              background: 'rgba(212, 175, 55, 0.2)',
              border: '1px solid rgba(212, 175, 55, 0.5)',
              borderRadius: 8,
              color: '#d4af37',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            关闭
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const DESKTOP_BASE_WIDTH = 1440;
const DESKTOP_BASE_HEIGHT = 900;
// 全局最小缩放比例：包括圆桌、侧边抽屉（传奇与奇遇 / 相克规则 / 恶魔的伪装）等所有在根容器内的组件
// 之前为 0.5，根据需求下调到 0.4，使在窄屏下这些组件可以继续缩小一档。
const MIN_UI_SCALE = 0.4;
const MAX_UI_SCALE = 1.3;

/**
 * 布局与缩放：统一一套「设计尺寸 + 整页 scale」
 * - 设计基准：DESKTOP_BASE_WIDTH × DESKTOP_BASE_HEIGHT，所有 UI 用设计像素（designPx）。
 * - 缩放：根容器 .container.desktop-device 使用 transform: scale(var(--adaptive-ui-scale)) 整体缩放填满视口。
 * - 约定：凡在 container 内的尺寸只使用 designPx(n)，不再使用 vw/vh 或「反缩放」的 calc(px/scale)。
 * 详见 docs/LAYOUT_SYSTEM.md
 */
const designPx = (n: number) => `${n}px`;

// 主应用组件
function AppContent() {
  // 统一使用桌面端布局：不再区分手机/平板
  const isMobile = false;
  const deviceType = 'desktop';
  const [isPreloading, setIsPreloading] = useState(true);

  const topControlOffset = designPx(12);
  const rightToolbarOffset = designPx(20);
  const topControlGap = designPx(8);
  const topControlButtonSize = designPx(36);
  const topButtonRadius = designPx(6);
  const topButtonIconSize = designPx(18);
  const topButtonShadow = `0 ${designPx(4)} ${designPx(12)} rgba(0, 0, 0, 0.5)`;
  const topButtonActiveShadow = `0 0 ${designPx(15)} rgba(212, 175, 55, 0.2)`;

  const topInfoCardMinWidth = designPx(160);
  const topInfoCardMaxWidth = designPx(260);
  const infoCardPadding = `${designPx(8)} ${designPx(12)}`;
  const infoCardInnerPadding = `${designPx(10)} ${designPx(16)}`;
  const infoCardGap = designPx(8);
  const topInfoCardShadow = `0 ${designPx(4)} ${designPx(16)} rgba(0, 0, 0, 0.5)`;

  const roundTablePaddingX = designPx(12);
  const roundTableMaxWidth = designPx(750);
  const splitPanelGap = designPx(8);
  const splitHandleWidth = designPx(4);
  const splitHandleHeight = designPx(40);
  const splitHandleRadius = designPx(2);
  const splitLineShadow = `0 0 ${designPx(10)} rgba(212, 175, 55, 0.3)`;
  const grimoirePanelTopPadding = designPx(80);
  const grimoirePanelGap = designPx(16);

  const footerBottomOffset = designPx(10);
  const footerFontSize = designPx(12);
  const footerHorizontalPadding = `0 ${designPx(20)}`;

  const modalLargeWidth = designPx(920);
  const modalMediumWidth = designPx(620);
  const modalSeatWidth = designPx(460);
  const modalSmallWidth = designPx(380);
  const modalCompactWidth = designPx(320);
  const versionLogModalWidth = designPx(640);

  const topMenuMinWidth = designPx(260);
  const topMenuOffset = designPx(8);
  const topMenuRadius = designPx(8);
  const topMenuTabPadding = `${designPx(10)} ${designPx(12)}`;
  const topMenuTabFontSize = designPx(13);
  const topMenuContentPadding = designPx(10);
  const topMenuGroupPadding = `${designPx(5)} 0`;

  const modalHeaderActionPadding = `${designPx(5)} ${designPx(12)}`;
  const modalHeaderActionFontSize = designPx(13);
  const modalHeaderActionCheckboxSize = designPx(16);
  // 白天计时器默认位置（以设计像素为单位），后续可被用户拖动覆盖
  const topControlOffsetValue = parseFloat(topControlOffset) || 0;
  const defaultDayTimerTop = topControlOffsetValue + 180;
  const defaultDayTimerLeft = topControlOffsetValue + 8;
  
  // console.log('[AppContent] 设备检测:', { isMobile, deviceType, windowWidth: window.innerWidth, windowHeight: window.innerHeight });
  
  const {
    state: seatState, 
    addSeat,
    removeSeat,
    removeSeatAt, 
    clearSeats,
    renameSeat, 
    swapSeats, 
    updateSeatRole, 
    addStatus,
    removeStatus, 
    clearStatuses,
    resetSeats,
    toggleDeathStatus,
    toggleVoteStatus,
    toggleFlipStatus,
    initSeats,
    dispatch: seatDispatch
  } = useSeat();

  const {
    state: appState,
    showToast,
    addSelectedFabledRole,
    addSelectedTravelerRole,
    updateDevilGuiseRole,
    setLoading,
    parseScript,
    calculateAvailableStatuses,
    toggleHideRoleAbilities,
    toggleHideNightInstructions,
    dispatch: appDispatch,
    loadScripts,
    setPhaseNotes,
    setPhaseCustomNotes
  } = useApp();
  
  const phaseNotes = appState.phaseNotes || {};
  const phaseCustomNotes = appState.phaseCustomNotes || {};

  // 白天计时器：初始分钟数 = 玩家数量（座位数）
  const initialDayMinutes = Math.max(1, seatState.seats.length || 0);
  const [dayTimerMinutes, setDayTimerMinutes] = useState(initialDayMinutes);
  const [dayTimerSeconds, setDayTimerSeconds] = useState(initialDayMinutes * 60);
  const [dayTimerStatus, setDayTimerStatus] = useState<'idle' | 'running' | 'paused' | 'finished'>('idle');
  const [isEditingDayTimer, setIsEditingDayTimer] = useState(false);
  // 白天计时器挂件位置（用户可拖动后覆盖默认位置）
  const [dayTimerPosition, setDayTimerPosition] = useState<{ top: number; left: number } | null>(null);
  const dayTimerDragStateRef = useRef<{
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  const dayTimerDraggingRef = useRef(false);

  const handleDayTimerMouseMove = (e: MouseEvent) => {
    const dragState = dayTimerDragStateRef.current;
    if (!dragState) return;
    // 鼠标移动是按屏幕像素计算，而挂件位置是在「设计空间」里，需按 adaptiveScale 反算
    const scale = adaptiveScale || 1;
    const deltaX = (e.clientX - dragState.startX) / scale;
    const deltaY = (e.clientY - dragState.startY) / scale;

    // 只有实际移动了一定距离才视为拖动，用于后续屏蔽点击
    if (!dayTimerDraggingRef.current) {
      const distanceSq = deltaX * deltaX + deltaY * deltaY;
      if (distanceSq > 4) {
        dayTimerDraggingRef.current = true;
      }
    }
    setDayTimerPosition({
      top: dragState.startTop + deltaY,
      left: dragState.startLeft + deltaX,
    });
  };

  const handleDayTimerMouseUp = () => {
    dayTimerDragStateRef.current = null;
    window.removeEventListener('mousemove', handleDayTimerMouseMove);
    window.removeEventListener('mouseup', handleDayTimerMouseUp);
    // 在当前事件循环内保持 dragging=true，让随后的 click 事件识别为拖动产生并被忽略
    setTimeout(() => {
      dayTimerDraggingRef.current = false;
    }, 0);
  };

  const handleDayTimerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // 只响应左键
    const target = e.target as HTMLElement;
    // 点击按钮或输入框时不触发拖拽，避免影响正常操作
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') return;
    e.preventDefault();
    dayTimerDraggingRef.current = false;

    const currentTop = dayTimerPosition?.top ?? defaultDayTimerTop;
    const currentLeft = dayTimerPosition?.left ?? defaultDayTimerLeft;

    dayTimerDragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: currentTop,
      startLeft: currentLeft,
    };

    window.addEventListener('mousemove', handleDayTimerMouseMove);
    window.addEventListener('mouseup', handleDayTimerMouseUp);
  };

  // 触摸设备上的计时器拖拽支持
  const handleDayTimerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    dayTimerDraggingRef.current = false;

    const currentTop = dayTimerPosition?.top ?? defaultDayTimerTop;
    const currentLeft = dayTimerPosition?.left ?? defaultDayTimerLeft;

    dayTimerDragStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTop: currentTop,
      startLeft: currentLeft,
    };

    const handleTouchMove = (ev: TouchEvent) => {
      const moveTouch = ev.touches[0];
      if (!moveTouch || !dayTimerDragStateRef.current) return;
      ev.preventDefault();
      const { startX, startY, startTop, startLeft } = dayTimerDragStateRef.current;
      const deltaX = moveTouch.clientX - startX;
      const deltaY = moveTouch.clientY - startY;
      const nextTop = startTop + deltaY;
      const nextLeft = startLeft + deltaX;
      dayTimerDraggingRef.current = true;
      setDayTimerPosition({ top: nextTop, left: nextLeft });
    };

    const handleTouchEnd = () => {
      dayTimerDragStateRef.current = null;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      setTimeout(() => {
        dayTimerDraggingRef.current = false;
      }, 0);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const isDayPhase = appState.history[appState.currentPhaseIndex].type === 'day';
  const dayTimerTotalSeconds = dayTimerMinutes * 60;
  // 记录上一帧是否为白天，用于判断是否是「从白天切到夜晚」
  const prevIsDayPhaseRef = useRef(isDayPhase);

  // 座位数变化时，如果计时器还没启动，自动调整初始时间
  useEffect(() => {
    if (dayTimerStatus !== 'idle') return;
    const nextMinutes = Math.max(1, seatState.seats.length || 0);
    setDayTimerMinutes(nextMinutes);
    setDayTimerSeconds(nextMinutes * 60);
  }, [seatState.seats.length, dayTimerStatus]);

  // 阶段从白天切换为夜晚时，自动暂停计时器（但允许在夜晚手动启动）
  useEffect(() => {
    const prevIsDayPhase = prevIsDayPhaseRef.current;
    if (prevIsDayPhase && !isDayPhase && dayTimerStatus === 'running') {
      setDayTimerStatus('paused');
    }
    prevIsDayPhaseRef.current = isDayPhase;
  }, [isDayPhase, dayTimerStatus]);

  // 计时逻辑
  useEffect(() => {
    if (dayTimerStatus !== 'running') return;
    if (dayTimerSeconds <= 0) return;

    const id = window.setInterval(() => {
      setDayTimerSeconds(prev => {
        if (prev <= 1) {
          window.clearInterval(id);
          setDayTimerStatus('finished');
          showToast('白天计时结束', 'info');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [dayTimerStatus, dayTimerSeconds, showToast]);

  const handleDayTimerMinutesChange = (value: string) => {
    const num = Number(value.replace(/[^\d]/g, ''));
    if (Number.isNaN(num)) return;
    const clamped = Math.min(Math.max(num, 1), 240); // 1~240 分钟
    setDayTimerMinutes(clamped);
    setDayTimerSeconds(clamped * 60);
    setDayTimerStatus('idle');
  };

  const handleDayTimerStartPause = () => {
    if (dayTimerStatus === 'running') {
      setDayTimerStatus('paused');
      return;
    }
    if (dayTimerSeconds <= 0) {
      setDayTimerSeconds(dayTimerMinutes * 60);
    }
    setDayTimerStatus('running');
  };

  const handleDayTimerReset = () => {
    setDayTimerSeconds(dayTimerMinutes * 60);
    setDayTimerStatus('idle');
  };

  // 小镇 / 联机发牌：创建小镇（说书人）
  const handleCreateTown = async () => {
    if (isTownBusy) return;
    try {
      setIsTownBusy(true);
      const result = await createTown({
        scriptName: appState.scriptInfo.name,
        seatCount: seatState.seats.length,
      });
      setTownId(result.townId);
      setTownHostToken(result.hostToken);
      setTownUserId(result.townId); // 仅做占位标识，真实实现可由后端返回 hostUserId
      setTownRole('host');
      showToast(`小镇创建成功，号码：${result.townId}`, 'success');
    } catch (error: unknown) {
      console.error('[Town] 创建小镇失败', error);
      const message = error instanceof Error ? error.message : '未知错误';
      showToast(`创建小镇失败：${message}`, 'error');
    } finally {
      setIsTownBusy(false);
    }
  };

  // 小镇 / 联机发牌：离开小镇
  const handleLeaveTown = async () => {
    if (!townId) {
      setTownId(null);
      setTownHostToken(null);
      setTownUserId(null);
      setTownRole(null);
      return;
    }
    if (isTownBusy) return;
    try {
      setIsTownBusy(true);
      if (townUserId) {
        await leaveTown({ townId, userId: townUserId });
      }
    } catch (error: unknown) {
      console.error('[Town] 离开小镇失败（将仅本地清理状态）', error);
    } finally {
      setTownId(null);
      setTownHostToken(null);
      setTownUserId(null);
      setTownRole(null);
      setIsTownBusy(false);
      showToast('已离开小镇', 'info');
    }
  };

  // 小镇 / 联机发牌：下发角色给已坐下的玩家
  const handleDealRolesToTown = async () => {
    if (!townId || !townHostToken) {
      showToast('请先创建或加入小镇（说书人）', 'error');
      return;
    }
    if (townRole !== 'host') {
      showToast('只有说书人可以下发角色', 'error');
      return;
    }
    const assignedSeats = seatState.seats.filter(seat => seat.role !== null);
    if (assignedSeats.length === 0) {
      showToast('请先完成角色分配', 'error');
      return;
    }

    const payloadSeats = assignedSeats.map(seat => ({
      seatIndex: seat.index,
      roleId: (seat.role as RoleData).id,
      roleName: (seat.role as RoleData).name,
      playerName: seat.playerName || `玩家 ${seat.id}`,
      isDead: seat.isDead,
      hasVote: seat.hasVote,
    }));

    try {
      setIsTownBusy(true);
      await dealRoles({
        townId,
        hostToken: townHostToken,
        seats: payloadSeats,
      });
      showToast('角色已下发至小镇', 'success');
    } catch (error: unknown) {
      console.error('[Town] 下发角色失败', error);
      const message = error instanceof Error ? error.message : '未知错误';
      showToast(`下发角色失败：${message}`, 'error');
    } finally {
      setIsTownBusy(false);
    }
  };
  
  // console.log('[AppContent] 游戏阶段:', {
  //   currentPhaseType: appState.history[appState.currentPhaseIndex].type,
  //   currentPhaseCount: appState.history[appState.currentPhaseIndex].count,
  //   dayBackground: appState.grimoireSettings.dayBackgroundImage,
  //   nightBackground: appState.grimoireSettings.nightBackgroundImage
  // });
  
  // 预加载首屏关键资源（夜晚背景 + 弹窗/Token 纹理），并在超时后强制进入应用
  useEffect(() => {
    const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
    const prefix = basePath ? `${basePath}/` : '/';

    const essentialImages = [
      'image/background-night.webp',  // 夜晚背景
      'image/tanchuang.webp',         // 弹窗纹理背景
      'image/zuowei.webp',            // 座位/角色 Token 背景
      'image/status_token.webp'       // 提示 Token 背景
    ];

    const loadImage = (relativePath: string) => {
      const src = `${prefix}${relativePath.replace(/^\/+/, '')}`;
      return new Promise<void>((resolve) => {
        const img = new Image();
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        // 如果浏览器支持 decode，则优先以 decode 完成为准，避免首帧再解码造成卡顿
        if (typeof (img as any).decode === 'function') {
          img.onerror = finish; // 失败时也不要阻塞
          img.src = src;
          (img as any).decode().then(finish).catch(finish);
          return;
        }
        // 不支持 decode 的浏览器退化为 onload/onerror 即可
        img.onload = finish;
        img.onerror = finish; // 即使加载失败也继续
        img.src = src;
      });
    };

    let finished = false;

    const finishPreload = () => {
      if (!finished) {
        finished = true;
        setIsPreloading(false);
      }
    };

    console.log('[App] 开始预加载首屏资源');

    // 并行预加载关键图片
    Promise.all(essentialImages.map(loadImage)).then(() => {
      console.log('[App] 首屏关键资源预加载完成');
      finishPreload();
    });

    // 最长等待时间，超时后也进入应用，避免长时间卡在启动页
    const timeoutId = window.setTimeout(() => {
      console.log('[App] 首屏预加载超时，使用兜底背景进入应用');
      finishPreload();
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  // 进入首页后后台预加载座位相关资源（不阻塞首屏）
  useEffect(() => {
    const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
    const prefix = basePath ? `${basePath}/` : '/';
    const seatImages = [
      'image/zuowei.webp',
      'image/status_token.webp',
      'image/yishuzi.webp'
    ];

    const preload = (relativePath: string) => {
      const src = `${prefix}${relativePath.replace(/^\/+/, '')}`;
      const img = new Image();
      img.src = src;
    };

    seatImages.forEach(preload);
  }, []);

  // 当 appState 中的 seats 发生变化时（例如由于时间线切换），同步到 seatState
  useEffect(() => {
    seatDispatch({ type: 'SYNC_SEATS', payload: appState.seats });
  }, [appState.currentPhaseIndex]);

  // 当 seatState 发生变化时，同步回 appState 的当前历史记录中
  useEffect(() => {
    appDispatch({ type: 'SET_SEATS', payload: seatState.seats });
  }, [seatState.seats]);

  // 弹窗状态
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('features');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showSeatSettingsModal, setShowSeatSettingsModal] = useState(false);
  const [showRoleDistributionModal, setShowRoleDistributionModal] = useState(false);
  const [showScriptSelector, setShowScriptSelector] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCustomStatusModal, setShowCustomStatusModal] = useState(false);
  
  // 剧本选择器状态缓存
  const [scriptSelectorSearchTerm, setScriptSelectorSearchTerm] = useState('');
  const [scriptSelectorSelectedType, setScriptSelectorSelectedType] = useState('all');

  // 角色搜索状态
  const [roleSearchTerm, setRoleSearchTerm] = useState('');

  // 临时状态
  const [currentSeatIndex, setCurrentSeatIndex] = useState(-1);
  const [currentDevilGuiseIndex, setCurrentDevilGuiseIndex] = useState(-1);
  const [activeSeatTab, setActiveSeatTab] = useState('rename');
  const [seatNameInput, setSeatNameInput] = useState('');
  const [swapStatus, setSwapStatus] = useState('点击下方座位进行选择');
  const [roleModalTitle, setRoleModalTitle] = useState('');
  const [isSelectingLegendary, setIsSelectingLegendary] = useState(false);
  const [isSelectingTraveler, setIsSelectingTraveler] = useState(false);
  const [currentStatusSeatIndex, setCurrentStatusSeatIndex] = useState(-1);
  const [availableStatuses, setAvailableStatuses] = useState<Array<{ name: string; role: RoleData; type: 'global' | 'local' }>>([]);
  const [customStatusText, setCustomStatusText] = useState('');
  
  // 菜单显示/隐藏的延时定时器
  const menuTimeoutRef = useRef<any>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (menuTimeoutRef.current) {
        clearTimeout(menuTimeoutRef.current);
      }
    };
  }, []);

  // 座位信息面板状态
  const [showSeatPanelIndex, setShowSeatPanelIndex] = useState(-1);
  const [isSwappingMode, setIsSwappingMode] = useState(false);
  const [swapSourceIndex, setSwapSourceIndex] = useState(-1);
  
  // 新增弹窗状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({ title: '', message: '', onConfirm: () => {} });
  const confirmModalRef = useRef<HTMLButtonElement>(null);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showScriptRequiredModal, setShowScriptRequiredModal] = useState(false);
  
  // 魔典笔记状态
  const [showGrimoireNote, setShowGrimoireNote] = useState(false);
  // 隐藏魔典：只保留死亡样式，其他圆桌信息翻面/隐藏
  const [isGrimoireHidden, setIsGrimoireHidden] = useState(false);
  // 展示信息弹窗
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfoKey, setSelectedInfoKey] = useState<string | null>(null);
  const [customInfoText, setCustomInfoText] = useState('');
  const [infoCustomCards, setInfoCustomCards] = useState<{ id: string; text: string }[]>([]);
  const [showExportReview, setShowExportReview] = useState(false);
  const [showVersionLog, setShowVersionLog] = useState(false);
  const [versionLogs, setVersionLogs] = useState<any[] | null>(null);
  const [isVersionLogLoading, setIsVersionLogLoading] = useState(false);
  const [showGameInfoCard, setShowGameInfoCard] = useState(true);
  // 倒计时工具是否显示，由顶部工具栏按钮控制，昼夜通用
  const [showDayTimerWidget, setShowDayTimerWidget] = useState(false);
  
  // 分屏宽度比例状态，用于控制左右两半屏的宽度
  const [splitRatio, setSplitRatio] = useState(0.65); // 0.65 表示左半屏占65%，右半屏占35%（6.5:3.5比例）
  
  // 缩放因子状态，用于控制座位信息组件和面板的大小
  const [scaleFactor, setScaleFactor] = useState(1);

  // 角色分配相关状态
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('selectedRoleIds');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      console.error('Failed to load selectedRoleIds from localStorage', e);
      return new Set();
    }
  });
  const [selectedRoleCounts, setSelectedRoleCounts] = useState<Map<string, number>>(() => {
    try {
      const saved = localStorage.getItem('selectedRoleCounts');
      return saved ? new Map(JSON.parse(saved)) : new Map();
    } catch (e) {
      console.error('Failed to load selectedRoleCounts from localStorage', e);
      return new Map();
    }
  });
  const [enableMultiSelect, setEnableMultiSelect] = useState(() => {
    try {
      const saved = localStorage.getItem('enableMultiSelect');
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      console.error('Failed to load enableMultiSelect from localStorage', e);
      return false;
    }
  }); 

  // 小镇 / 联机发牌相关状态（仅说书人端使用）
  const [townId, setTownId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('townId');
    } catch {
      return null;
    }
  });
  const [townHostToken, setTownHostToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('townHostToken');
    } catch {
      return null;
    }
  });
  const [townUserId, setTownUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('townUserId');
    } catch {
      return null;
    }
  });
  const [townRole, setTownRole] = useState<'host' | 'player' | null>(() => {
    try {
      const saved = localStorage.getItem('townRole');
      return saved === 'host' || saved === 'player' ? saved : null;
    } catch {
      return null;
    }
  });
  const [isTownBusy, setIsTownBusy] = useState(false);
  const [townSeatOccupancy, setTownSeatOccupancy] = useState<Record<number, boolean>>({});

  // 保存分配角色相关状态到 localStorage
  useEffect(() => {
    localStorage.setItem('selectedRoleIds', JSON.stringify(Array.from(selectedRoleIds)));
  }, [selectedRoleIds]);

  useEffect(() => {
    localStorage.setItem('selectedRoleCounts', JSON.stringify(Array.from(selectedRoleCounts.entries())));
  }, [selectedRoleCounts]);

  useEffect(() => {
    localStorage.setItem('enableMultiSelect', JSON.stringify(enableMultiSelect));
  }, [enableMultiSelect]);
  const [logoError] = useState(false);

  // 小镇相关状态持久化
  useEffect(() => {
    try {
      if (townId) {
        localStorage.setItem('townId', townId);
      } else {
        localStorage.removeItem('townId');
      }
    } catch {
      // ignore
    }
  }, [townId]);

  useEffect(() => {
    try {
      if (townHostToken) {
        localStorage.setItem('townHostToken', townHostToken);
      } else {
        localStorage.removeItem('townHostToken');
      }
    } catch {
      // ignore
    }
  }, [townHostToken]);

  useEffect(() => {
    try {
      if (townUserId) {
        localStorage.setItem('townUserId', townUserId);
      } else {
        localStorage.removeItem('townUserId');
      }
    } catch {
      // ignore
    }
  }, [townUserId]);

  useEffect(() => {
    try {
      if (townRole) {
        localStorage.setItem('townRole', townRole);
      } else {
        localStorage.removeItem('townRole');
      }
    } catch {
      // ignore
    }
  }, [townRole]);

  // 说书人在小镇时轮询座位占用（谁坐下了）
  useEffect(() => {
    if (!townId || !townHostToken || townRole !== 'host') {
      setTownSeatOccupancy({});
      return;
    }
    const wsUrl = getTownWsUrl({ townId, hostToken: townHostToken });
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'occupancy' && Array.isArray(data.seats)) {
          const next: Record<number, boolean> = {};
          data.seats.forEach((s: { seatIndex: number; occupied: boolean }) => {
            next[s.seatIndex] = s.occupied;
          });
          setTownSeatOccupancy(next);
        }
      } catch {
        // ignore
      }
    };
    ws.onclose = () => setTownSeatOccupancy({});
    return () => ws.close();
  }, [townId, townHostToken, townRole]);

  // 说书人修改剧本或座位数时，推送给所有已连接玩家
  const lastTownSettingsRef = useRef<{ scriptName: string; seatCount: number } | null>(null);
  useEffect(() => {
    if (!townId || !townHostToken || townRole !== 'host') return;
    const scriptName = appState.scriptInfo?.name ?? '';
    const seatCount = seatState.seats.length;
    const prev = lastTownSettingsRef.current;
    if (prev && prev.scriptName === scriptName && prev.seatCount === seatCount) return;
    lastTownSettingsRef.current = { scriptName, seatCount };
    updateTownSettings({ townId, hostToken: townHostToken, scriptName, seatCount }).catch(() => {
      // ignore
    });
  }, [townId, townHostToken, townRole, appState.scriptInfo?.name, seatState.seats.length]);

  // 进入白天时向玩家端推送游戏数据（仅说书人、有小镇时）
  const prevIsDayPhaseForPushRef = useRef(isDayPhase);
  useEffect(() => {
    const prev = prevIsDayPhaseForPushRef.current;
    if (!prev && isDayPhase && townId && townHostToken && townRole === 'host') {
      const assigned = seatState.seats.filter(seat => seat.role != null);
      if (assigned.length > 0) {
        const payload = assigned.map(seat => ({
          seatIndex: seat.index,
          roleId: (seat.role as RoleData).id,
          roleName: (seat.role as RoleData).name,
          playerName: seat.playerName || `玩家 ${seat.id}`,
          isDead: seat.isDead,
          hasVote: seat.hasVote,
        }));
        pushGameData({ townId, hostToken: townHostToken, seats: payload }).catch(() => {});
      }
    }
    prevIsDayPhaseForPushRef.current = isDayPhase;
  }, [isDayPhase, townId, townHostToken, townRole, seatState.seats]);

  // 当剧本信息变化时，重置 Logo 错误状态
  useEffect(() => {
    // Logo错误状态重置逻辑
  }, [appState.scriptInfo]);

  // 视口尺寸：resize 时立即更新，scale 与 viewport 同源
  const [viewportSize, setViewportSize] = useState(() =>
    typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 0, height: 0 }
  );
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      setViewportSize({ width: w, height: h });
      const nextScale = Math.min(
        MAX_UI_SCALE,
        Math.max(MIN_UI_SCALE, Math.min(w / DESKTOP_BASE_WIDTH, h / DESKTOP_BASE_HEIGHT))
      );
      root.style.setProperty('--adaptive-ui-scale', nextScale.toFixed(4));
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      root.style.setProperty('--adaptive-ui-scale', '1');
    };
  }, []);

  const adaptiveScale = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return 1;
    return Math.min(
      MAX_UI_SCALE,
      Math.max(MIN_UI_SCALE, Math.min(viewportSize.width / DESKTOP_BASE_WIDTH, viewportSize.height / DESKTOP_BASE_HEIGHT))
    );
  }, [viewportSize.width, viewportSize.height]);

  // 横屏 / 竖屏判断：用于工具栏位置与魔典笔记可用性
  const isPortrait = viewportSize.height > viewportSize.width;

  // 设置按钮（右上角菜单按钮）的最小视觉缩放比例：当整页缩放低于 0.7 时，按钮不再继续变小
  const settingsButtonSize = useMemo(() => {
    const scale = adaptiveScale > 0 ? adaptiveScale : 1;
    const targetScale = Math.max(scale, 0.7);
    // 在设计坐标系中放大到 (targetScale / scale) 倍，叠加整页 scale 后，按钮视觉尺寸约为 36 * targetScale
    return designPx(36 * (targetScale / scale));
  }, [adaptiveScale]);

  // 设置菜单面板的最小视觉缩放：与按钮一致，当整页缩放低于 0.7 时面板整体放大到 0.7 的效果
  const settingsPanelScale = useMemo(() => {
    if (adaptiveScale <= 0) return 1;
    if (adaptiveScale < 0.7) {
      return 0.7 / adaptiveScale;
    }
    return 1;
  }, [adaptiveScale]);

  // 若整页缩放过小，为顶部时间线、游戏信息卡片、左侧抽屉提供单独的最小缩放（0.5）
  const uiMinScaleForHud = useMemo(() => {
    if (adaptiveScale <= 0) return 1;
    if (adaptiveScale < 0.5) {
      return 0.5 / adaptiveScale;
    }
    return 1;
  }, [adaptiveScale]);

  // 白天计时器挂件的最小视觉缩放比例：当整页缩放低于 0.7 时，不再继续变小
  const dayTimerScale = useMemo(() => {
    if (adaptiveScale <= 0) return 1;
    if (adaptiveScale < 0.7) {
      return 0.7 / adaptiveScale;
    }
    return 1;
  }, [adaptiveScale]);

  // 若当前为竖屏且已经打开了魔典分屏，则自动关闭（竖屏不支持魔典笔记）
  useEffect(() => {
    if (isPortrait && showGrimoireNote) {
      setShowGrimoireNote(false);
    }
  }, [isPortrait, showGrimoireNote]);

  // 圆桌容器在设计空间中的尺寸（用于圆桌按「可用空间」计算大小，避免窗口变窄时圆桌无谓缩小、左右留白过大）
  const roundTableContainerRef = useRef<HTMLDivElement>(null);
  const [roundTableContainerScreenSize, setRoundTableContainerScreenSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = roundTableContainerRef.current;
    if (!el) return;

    let frameId: number | null = null;

    const updateSize = () => {
      // 使用 requestAnimationFrame 合并同一帧内的多次回调，避免分屏拖动时高频 setState 造成一顿一顿
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        if (!roundTableContainerRef.current) return;
        const width = roundTableContainerRef.current.clientWidth;
        setRoundTableContainerScreenSize(prev => {
          if (prev.width === width) return prev;
          // 拖小分屏时布局重排可能短暂得到 0，若把 0 写入会触发「估算宽」且可能大于实际，圆桌会突然放大一帧；保留上次有效宽
          if (width === 0 && prev.width > 0) return prev;
          // 只使用实际测得的「左屏容器宽度」，高度统一用视口/scale 推导，避免圆桌自身高度参与反馈导致尺寸在最大/最小之间跳动
          return { width, height: prev.height };
        });
      });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [showGrimoireNote]);

  // 圆桌容器始终 100% 宽，便于横屏时圆桌由高度决定且不因收窄而变小、竖屏时由宽度决定
  const roundTableContainerMaxWidth = '100%';

  // 未分屏时圆桌用「视口/scale」作为设计尺寸
  const viewportDesignSize = useMemo(() => {
    const scale = adaptiveScale > 0 ? adaptiveScale : 1;
    return {
      width: Math.round(viewportSize.width / scale),
      height: Math.round(viewportSize.height / scale)
    };
  }, [viewportSize.width, viewportSize.height, adaptiveScale]);

  // 分屏时圆桌在左屏，用左屏实测尺寸（设计空间）；未测到时用 splitRatio 估算左屏宽，避免横竖屏判断从「整页」切到「左屏」时圆桌突然跳动
  const roundTableContainerDesignSize = useMemo(() => {
    const scale = adaptiveScale > 0 ? adaptiveScale : 1;
    const designHeight = Math.round(viewportSize.height / scale);
    const fullDesignWidth = Math.round(viewportSize.width / scale);

    // 分屏：宽度用左屏实测值，高度始终用视口/scale 推导，避免由圆桌本身高度反向影响布局
    if (showGrimoireNote && roundTableContainerScreenSize.width > 0) {
      return { width: roundTableContainerScreenSize.width, height: designHeight };
    }

    // 分屏但尚未测到左屏宽度：用 splitRatio 估算左屏设计宽，使 useTableLayout 的横竖屏判断与实测后一致，避免跳动
    if (showGrimoireNote) {
      return { width: Math.round(fullDesignWidth * splitRatio), height: designHeight };
    }

    // 未分屏：整页设计尺寸
    return { width: fullDesignWidth, height: designHeight };
  }, [showGrimoireNote, roundTableContainerScreenSize.width, viewportSize.width, viewportSize.height, adaptiveScale, splitRatio]);

  // 计算游戏配置
  const gameConfig = useMemo(() => {
    const count = seatState.seats.length;
    return calculateGameConfig(count);
  }, [seatState.seats.length]);

  const gameConfigObj = useMemo(() => {
    const count = seatState.seats.length;
    return getGameConfig(count);
  }, [seatState.seats.length]);

  // 计算对局信息
  const gameStats = useMemo(() => {
    const totalPlayers = seatState.seats.length;
    const alivePlayers = seatState.seats.filter(seat => !seat.isDead).length;
    const votedPlayers = seatState.seats.filter(seat => seat.hasVote).length;

    return {
      total: totalPlayers,
      alive: alivePlayers,
      voted: votedPlayers
    };
  }, [seatState.seats]);

  // 计算角色团队
  const roleTeams = useMemo(() => [
    { type: 'townsfolk', name: '镇民', roles: appState.roles.townsfolk, color: '#4299e1' },
    { type: 'outsider', name: '外来者', roles: appState.roles.outsider, color: '#63b3ed' },
    { type: 'minion', name: '爪牙', roles: appState.roles.minion, color: '#f56565' },
    { type: 'demon', name: '恶魔', roles: appState.roles.demon, color: '#c53030' },
    { type: 'traveler', name: '旅行者', roles: appState.travelerRoles, color: '#48bb78' }
  ], [appState.roles, appState.travelerRoles]);

  // 计算当前剧本总角色数
  const totalRoleCount = useMemo(() => {
    return roleTeams.reduce((total, team) => total + team.roles.length, 0);
  }, [roleTeams]);

  // 计算选中角色数量
  const calculatedRoleCounts = useMemo(() => {
    const counts = {
      townsfolk: 0,
      outsider: 0,
      minion: 0,
      demon: 0,
      traveler: 0
    };

    if (enableMultiSelect) {
      // 多选模式：使用 selectedRoleCounts 中的数量
      selectedRoleCounts.forEach((count, roleId) => {
        // 从各团队中查找角色，确定其类型
        Object.entries(appState.roles).forEach(([teamType, roleList]) => {
          const foundRole = roleList.find((r: any) => r.id === roleId);
          if (foundRole) {
            counts[teamType as keyof typeof counts] += count;
          }
        });
        
        // 从旅行者中查找角色
        const travelerRole = appState.travelerRoles.find(r => r.id === roleId);
        if (travelerRole) {
          counts.traveler += count;
        }
      });
    } else {
      // 普通模式：使用原来的逻辑
      appState.roles.townsfolk.forEach(role => {
        if (selectedRoleIds.has(role.id)) counts.townsfolk++;
      });
      appState.roles.outsider.forEach(role => {
        if (selectedRoleIds.has(role.id)) counts.outsider++;
      });
      appState.roles.minion.forEach(role => {
        if (selectedRoleIds.has(role.id)) counts.minion++;
      });
      appState.roles.demon.forEach(role => {
        if (selectedRoleIds.has(role.id)) counts.demon++;
      });
      appState.travelerRoles.forEach(role => {
        if (selectedRoleIds.has(role.id)) counts.traveler++;
      });
    }

    return counts;
  }, [selectedRoleIds, selectedRoleCounts, enableMultiSelect, appState.roles, appState.travelerRoles]);

  // 计算是否可以分配角色
  const canDistributeRoles = useMemo(() => {
    if (enableMultiSelect) {
      // 多选模式：计算所有角色的总数量
      let totalSelected = 0;
      selectedRoleCounts.forEach(count => {
        totalSelected += count;
      });
      if (totalSelected === 0) return false;
      if (totalSelected > seatState.seats.length) return false;
      return true;
    } else {
      // 普通模式：使用原来的逻辑
      const totalSelected = selectedRoleIds.size;
      if (totalSelected === 0) return false;
      if (totalSelected > seatState.seats.length) return false;
      return true;
    }
  }, [selectedRoleIds.size, selectedRoleCounts, seatState.seats.length, enableMultiSelect]);

  // 初始化
  useEffect(() => {
    // 只有在没有从存储恢复时，才初始化默认座位
    if (!appState.isRestored) {
      // 初始化座位
      initSeats(0);
    }
    // 初始化恶魔的伪装座位（默认3个）
  }, []);

  // 应用启动时加载剧本列表
  useEffect(() => {
    // 使用从useApp()解构出的loadScripts方法
    if (appState.scripts.length === 0) {
      loadScripts();
    }
  }, [appState.scripts.length, loadScripts]);

  // 处理座位点击
  const handleSeatClick = (index: number) => {
    openRoleModal(index);
  };

  // 处理设置点击 - 新版本：显示座位面板
  const handleSettingsClick = (index: number) => {
    setShowSeatPanelIndex(prev => prev === index ? -1 : index);
  };

  // 关闭座位面板
  const handleCloseSeatPanel = () => {
    setShowSeatPanelIndex(-1);
    setIsSwappingMode(false);
    setSwapSourceIndex(-1);
  };

  // 处理改名（新面板）
  const handlePanelRenameSeat = (index: number) => {
    setCurrentSeatIndex(index);
    setShowRenameModal(true);
    handleCloseSeatPanel();
  };

  // 处理移除（新面板）
  const handlePanelRemoveSeat = (index: number) => {
    setCurrentSeatIndex(index);
    setShowRemoveConfirmModal(true);
    handleCloseSeatPanel();
  };

  // 处理向前添加座位
  const handleAddSeatBefore = (index: number) => {
    seatDispatch({ type: 'ADD_SEAT_BEFORE', payload: index });
    handleCloseSeatPanel();
  };

  // 处理向后添加座位
  const handleAddSeatAfter = (index: number) => {
    seatDispatch({ type: 'ADD_SEAT_AFTER', payload: index });
    handleCloseSeatPanel();
  };

  // 处理换座
  const handleSwapSeat = (index: number) => {
    setIsSwappingMode(true);
    setSwapSourceIndex(index);
    setShowSeatPanelIndex(-1);
  };

  // 处理改名确认
  const handleRenameConfirm = (newName: string) => {
    if (currentSeatIndex >= 0) {
      renameSeat(currentSeatIndex, newName);
      setShowRenameModal(false);
      setCurrentSeatIndex(-1);
    }
  };

  // 处理移除确认
  const handleRemoveConfirm = () => {
    if (currentSeatIndex >= 0) {
      removeSeatAt(currentSeatIndex);
      setShowRemoveConfirmModal(false);
      setCurrentSeatIndex(-1);
    }
  };

  // 处理换座目标选择
  const handleSwapTargetSelect = (targetIndex: number) => {
    if (swapSourceIndex >= 0 && swapSourceIndex !== targetIndex) {
      swapSeats(swapSourceIndex, targetIndex);
      // 显示成功消息
      const toastMessage = `已成功交换座位 ${swapSourceIndex + 1} 和 ${targetIndex + 1}`;
      appDispatch({ type: 'ADD_TOAST', payload: { id: Date.now(), message: toastMessage, type: 'success' } });
    }
    setIsSwappingMode(false);
    setSwapSourceIndex(-1);
  };

  // 处理换座取消（点击其他区域）
  const handleSwapCancel = () => {
    setIsSwappingMode(false);
    setSwapSourceIndex(-1);
  };

  // 处理状态管理按钮点击
  const handleOpenStatusModal = (index: number) => {
    openStatusModal(index);
  };

  // 处理状态标签点击：从圆桌移除标记，并清除魔典笔记中对该条的「隐藏」，这样重新挂上会再次生成事件
  const handleRemoveStatus = (index: number, statusName: string, roleId: string) => {
    removeStatus(index, statusName, roleId);
    setPhaseNotes((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!key.endsWith('_hidden_status')) return;
        const list = next[key];
        if (!Array.isArray(list)) return;
        const filtered = list.filter(
          (h: { targetSeatIndex: number; statusName: string; roleId: string }) =>
            !(h.targetSeatIndex === index && h.statusName === statusName && h.roleId === roleId)
        );
        next[key] = filtered;
      });
      return next;
    });
  };

  // 打开角色选择弹窗
  const openRoleModal = (index: number) => {
    // 检查是否已选择剧本
    if (!appState.scriptInfo.id) {
      setShowScriptRequiredModal(true);
      return;
    }
    setCurrentSeatIndex(index);
    const playerName = seatState.seats[index]?.playerName || '';
    const seatDisplay = playerName ? `${index + 1}号玩家(${playerName})` : `${index + 1}号玩家`;
    setRoleModalTitle(`为 ${seatDisplay} 选择角色`);
    setShowRoleModal(true);
  };

  // 关闭角色选择弹窗
  const closeRoleModal = () => {
    setShowRoleModal(false);
    setIsSelectingLegendary(false);
    setIsSelectingTraveler(false);
    setCurrentSeatIndex(-1);
    setCurrentDevilGuiseIndex(-1);
  };

  // 打开座位设置弹窗
  // const openSeatSettings = (index: number) => {
  //   setCurrentSeatIndex(index);
  //   const seat = seatState.seats[index];
  //   if (seat) {
  //     // 直接设置玩家名称，因为现在playerName默认是空字符串
  //     setSeatNameInput(seat.playerName);
  //   }
  //   setShowSeatSettingsModal(true);
  //   setActiveSeatTab('rename');
  //   setSwapStatus('点击下方座位进行选择');
  // };

  // 关闭座位设置弹窗
  const closeSeatSettingsModal = () => {
    setShowSeatSettingsModal(false);
    setCurrentSeatIndex(-1);
  };

  // 重命名座位
  const handleRenameSeat = () => {
    if (currentSeatIndex >= 0) {
      const newName = seatNameInput.trim().substring(0, 15);
      if (newName) {
        renameSeat(currentSeatIndex, newName);
        closeSeatSettingsModal();
      }
    }
  };

  // 移除座位
  const handleRemoveSeat = () => {
    if (currentSeatIndex >= 0) {
      removeSeatAt(currentSeatIndex);
      closeSeatSettingsModal();
    }
  };

  // 交换座位
  const handleSwapSeats = (index1: number, index2: number) => {
    swapSeats(index1, index2);
    setSwapStatus(`已成功交换座位 ${index1 + 1} 和 ${index2 + 1}`);
    setTimeout(() => {
      closeSeatSettingsModal();
    }, 1000);
  };

  // 打开角色分配弹窗
  const openRoleDistributionModal = () => {
    // 检查是否已选择剧本
    if (!appState.scriptInfo.id) {
      setShowScriptRequiredModal(true);
      return;
    }
    // 检查座位数量是否足够
    if (seatState.seats.length < 5) {
      showToast('请至少添加5个座位', 'error');
      return;
    }
    // 移除重置逻辑，保留上次的操作数据
    // setSelectedRoleIds(new Set());
    // setSelectedRoleCounts(new Map()); // 重置多选计数
    // 分配角色时，清空本局的自定义展示信息卡片
    setInfoCustomCards([]);
    setSelectedInfoKey(null);
    setCustomInfoText('');
    setShowRoleDistributionModal(true);
  };

  // 关闭角色分配弹窗
  const closeRoleDistributionModal = () => {
    setShowRoleDistributionModal(false);
  };

  // 切换角色选择
  const toggleRoleSelection = (role: RoleData) => {
    const newSelectedRoleIds = new Set(selectedRoleIds);
    if (newSelectedRoleIds.has(role.id)) {
      newSelectedRoleIds.delete(role.id);
    } else {
      newSelectedRoleIds.add(role.id);
    }
    setSelectedRoleIds(newSelectedRoleIds);
  };

  // 随机选择角色
  const randomizeRoles = () => {
    const config = getGameConfig(seatState.seats.length);
    
    if (enableMultiSelect) {
      // 多选模式：随机选择角色并设置数量
      const newSelectedRoleCounts = new Map<string, number>();

      // 随机选择镇民
      const townsfolkRoles = appState.roles.townsfolk;
      if (townsfolkRoles.length > 0) {
        const randomTownsfolk = getRandomItems(townsfolkRoles, Math.min(config.townsfolk, townsfolkRoles.length));
        randomTownsfolk.forEach(role => {
          newSelectedRoleCounts.set(role.id, 1);
        });
      }

      // 随机选择外来者
      const outsiderRoles = appState.roles.outsider;
      if (outsiderRoles.length > 0) {
        const randomOutsider = getRandomItems(outsiderRoles, Math.min(config.outsider, outsiderRoles.length));
        randomOutsider.forEach(role => {
          newSelectedRoleCounts.set(role.id, 1);
        });
      }

      // 随机选择爪牙
      const minionRoles = appState.roles.minion;
      if (minionRoles.length > 0) {
        const randomMinion = getRandomItems(minionRoles, Math.min(config.minion, minionRoles.length));
        randomMinion.forEach(role => {
          newSelectedRoleCounts.set(role.id, 1);
        });
      }

      // 随机选择恶魔
      const demonRoles = appState.roles.demon;
      if (demonRoles.length > 0) {
        const randomDemon = getRandomItems(demonRoles, Math.min(config.demon, demonRoles.length));
        randomDemon.forEach(role => {
          newSelectedRoleCounts.set(role.id, 1);
        });
      }

      // 随机选择旅行者
      if (config.traveler > 0) {
        const travelerRoles = appState.travelerRoles;
        if (travelerRoles.length > 0) {
          const randomTraveler = getRandomItems(travelerRoles, Math.min(config.traveler, travelerRoles.length));
          randomTraveler.forEach(role => {
            newSelectedRoleCounts.set(role.id, 1);
          });
        }
      }

      setSelectedRoleCounts(newSelectedRoleCounts);
    } else {
      // 普通模式：使用原来的逻辑
      const newSelectedRoleIds = new Set<string>();

      // 随机选择镇民
      const townsfolkRoles = appState.roles.townsfolk;
      const randomTownsfolk = getRandomItems(townsfolkRoles, config.townsfolk);
      randomTownsfolk.forEach(role => newSelectedRoleIds.add(role.id));

      // 随机选择外来者
      const outsiderRoles = appState.roles.outsider;
      const randomOutsider = getRandomItems(outsiderRoles, config.outsider);
      randomOutsider.forEach(role => newSelectedRoleIds.add(role.id));

      // 随机选择爪牙
      const minionRoles = appState.roles.minion;
      const randomMinion = getRandomItems(minionRoles, config.minion);
      randomMinion.forEach(role => newSelectedRoleIds.add(role.id));

      // 随机选择恶魔
      const demonRoles = appState.roles.demon;
      const randomDemon = getRandomItems(demonRoles, config.demon);
      randomDemon.forEach(role => newSelectedRoleIds.add(role.id));

      // 随机选择旅行者
      if (config.traveler > 0) {
        const travelerRoles = appState.travelerRoles;
        const randomTraveler = getRandomItems(travelerRoles, config.traveler);
        randomTraveler.forEach(role => newSelectedRoleIds.add(role.id));
      }

      setSelectedRoleIds(newSelectedRoleIds);
    }
  };

  // 分配角色
  const distributeRoles = () => {
    // 收集所有选中的角色
    const selectedRoles: RoleData[] = [];
    
    if (enableMultiSelect) {
      // 多选模式：根据角色数量构建角色列表
      selectedRoleCounts.forEach((count, roleId) => {
        // 查找对应的角色对象
        let role: RoleData | undefined;
        
        // 从各团队中查找角色
        Object.values(appState.roles).forEach(roleList => {
          const foundRole = roleList.find(r => r.id === roleId);
          if (foundRole) {
            role = foundRole;
          }
        });
        
        // 从旅行者中查找角色
        if (!role) {
          const foundRole = appState.travelerRoles.find(r => r.id === roleId);
          if (foundRole) {
            role = foundRole as any;
          }
        }
        
        // 将角色添加到列表中，根据数量重复添加
        if (role) {
          for (let i = 0; i < count; i++) {
            selectedRoles.push(role!);
          }
        }
      });
    } else {
      // 普通模式：使用原来的逻辑
      Object.values(appState.roles).forEach(roleList => {
        roleList.forEach(role => {
          if (selectedRoleIds.has(role.id)) {
            selectedRoles.push(role);
          }
        });
      });

      // 收集选中的旅行者
      appState.travelerRoles.forEach(role => {
        if (selectedRoleIds.has(role.id)) {
          selectedRoles.push(role as any);
        }
      });
    }

    // 检查是否有选中的角色
    if (selectedRoles.length === 0) {
      showToast('请先选择角色', 'error');
      return;
    }

    // 检查选择数量是否超出座位总数
    if (selectedRoles.length > seatState.seats.length) {
      showToast('选择数量超出座位总数', 'error');
      return;
    }

    // 打乱角色顺序
    shuffleArray(selectedRoles);

    // 打乱座位顺序
    const shuffledSeatIndices = [...Array(seatState.seats.length).keys()];
    shuffleArray(shuffledSeatIndices);

    // 先基于当前座位列表做一次「全体清空上一局信息」的拷贝：
    // - 保留：座位编号 / 玩家名字 / index
    // - 清空：角色 / 生死 / 投票 / 翻转 / 提示标记，以及未来扩展用的能力/认知/健康等
    const newSeats: Seat[] = seatState.seats.map((seat): Seat => ({
      ...seat,
      role: null,
      roleName: '',
      isFlipped: false,
      isDead: false,
      hasVote: true,
      alignment: undefined,
      abilityRole: null,
      perceivedRole: null,
      health: undefined,
      statuses: []
    }));
    
    // 然后把这一次选中的角色随机填入部分座位
    selectedRoles.forEach((role, index) => {
      const seatIndex = shuffledSeatIndices[index];
      newSeats[seatIndex] = {
        ...newSeats[seatIndex],
        role: role,
        roleName: role.name,
        isFlipped: false,
        isDead: false,
        hasVote: true
      };
    });

    // 重置游戏到首夜并更新座位
    appDispatch({ type: 'RESTART_GAME', payload: newSeats });

    // 清除魔典笔记数据
    setPhaseCustomNotes({});
    setPhaseNotes({});
    
    // 同步更新 SeatContext 中的座位信息
    seatDispatch({ type: 'SYNC_SEATS', payload: newSeats });

    closeRoleDistributionModal();
    showToast('角色分配成功', 'success');
  };

  // 选择角色
  const selectRole = (role: RoleData | FabledData) => {
    if (isSelectingLegendary) {
      // 选择传奇角色
      addSelectedFabledRole(role as FabledData);
      closeRoleModal();
    } else if (isSelectingTraveler) {
      // 选择旅行者角色
      addSelectedTravelerRole(role as FabledData);
      closeRoleModal();
    } else if (currentDevilGuiseIndex >= 0) {
      // 选择恶魔的伪装角色
      if ('team' in role && role.team !== 'fabled') {
        updateDevilGuiseRole(currentDevilGuiseIndex, role as RoleData);
        closeRoleModal();
      }
    } else if (currentSeatIndex >= 0) {
      // 选择普通角色
      if ('team' in role && role.team !== 'fabled') {
        updateSeatRole(currentSeatIndex, role as RoleData);
        closeRoleModal();
      }
    }
  };

  // 打开提示标记选择弹窗
  const openStatusModal = (index: number) => {
    setCurrentStatusSeatIndex(index);
    // 收集当前圆桌上的角色
    const presentRoles = seatState.seats
      .filter(seat => seat.role !== null)
      .map(seat => seat.role as RoleData);
    
    // 获取所有可用状态
    const allAvailableStatuses = calculateAvailableStatuses(presentRoles);
    
    // 过滤掉当前座位已经拥有的状态
    const currentSeat = seatState.seats[index];
    const existingStatusKeys = new Set(
      currentSeat.statuses
        .filter(s => s.role)
        .map(s => `${s.role!.id}-${s.name}`)
    );
    
    const filteredStatuses = allAvailableStatuses.filter(
      status => !existingStatusKeys.has(`${status.role.id}-${status.name}`)
    );

    setAvailableStatuses(filteredStatuses);
    setShowStatusModal(true);
  };

  // 打开恶魔伪装选择弹窗
  const openBluffModal = (index: number) => {
    // 检查是否已选择剧本
    if (!appState.scriptInfo.id) {
      setShowScriptRequiredModal(true);
      return;
    }
    setCurrentDevilGuiseIndex(index);
    setRoleModalTitle('为恶魔选择伪装');
    setShowRoleModal(true);
  };

  // 关闭提示标记选择弹窗
  const closeStatusModal = () => {
    setShowStatusModal(false);
    setCurrentStatusSeatIndex(-1);
  };

  // 选择提示标记
  const selectStatus = (status: { name: string; role: RoleData; type: 'global' | 'local' }) => {
    if (currentStatusSeatIndex >= 0) {
      const currentPhase = appState.history[appState.currentPhaseIndex];
      const statusWithTime = {
        ...status,
        addedAt: {
          phase: currentPhase.type,
          count: currentPhase.count
        }
      };
      addStatus(currentStatusSeatIndex, statusWithTime as Status);
      closeStatusModal();
    }
  };

  // 打开剧本选择弹窗
  const openScriptSelector = () => {
    console.log('[App] 打开剧本选择弹窗');
    setShowScriptSelector(true);
  };

  // 关闭剧本选择弹窗
  const closeScriptSelector = () => {
    setShowScriptSelector(false);
  };

  // 选择剧本
  const handleScriptSelect = async (script: Script) => {
    setLoading(true);
    closeScriptSelector();
    
    try {
      let scriptData = script.content;
      const cacheKey = `script_cache_${script.id}`;
      
      // 尝试从 localStorage 缓存中加载
      if (!scriptData) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // 检查缓存数据是否完整（是否有角色数据且包含 image 字段）
            const hasValidData = Array.isArray(data) && data.length > 0 && 
              data.some((item: any) => item && item.name && 'image' in item);
            
            // 缓存超过7天或者数据不完整则清除缓存
            if (Date.now() - timestamp >= 7 * 24 * 60 * 60 * 1000 || !hasValidData) {
              console.log('[handleScriptSelect] 缓存过期或数据不完整，清除缓存:', script.name);
              localStorage.removeItem(cacheKey);
            } else {
              console.log('[handleScriptSelect] 使用缓存剧本:', script.name);
              scriptData = data;
            }
          }
        } catch (e) {
          console.log('[handleScriptSelect] 读取缓存失败:', e);
        }
      }
      
      // 如果剧本内容不存在，尝试从文件加载
      if (!scriptData && script.filePath) {
        console.log('[handleScriptSelect] 从网络加载剧本:', script.name);
        // 必须用 buildScriptFetchUrl 构造 URL，勿手拼，否则含 + 等字符的路径会 404（见 utils/scriptUrl.ts）
        const scriptPath = buildScriptFetchUrl(script.filePath);
        console.log('[handleScriptSelect] scriptPath:', scriptPath);
        
        let lastError: Error | null = null;
        
        try {
          // 使用时间戳防止缓存，确保获取最新剧本数据
          const fetchUrl = `${scriptPath}${scriptPath.includes('?') ? '&' : '?'}_t=${Date.now()}`;
          const response = await fetch(fetchUrl, { cache: 'no-store' });
          if (!response.ok) {
            lastError = new Error(`加载剧本失败: ${response.status} ${response.statusText}`);
            throw lastError;
          }
          const text = await response.text();
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            lastError = new Error('剧本数据格式错误，不是数组');
            throw lastError;
          }
          scriptData = parsed;
        } catch (e) {
          lastError = e as Error;
          console.error('[handleScriptSelect] 加载失败，路径:', scriptPath, '错误:', lastError);
        }

        if (!scriptData) {
          throw lastError || new Error('剧本内容不存在');
        }
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: scriptData,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.log('[handleScriptSelect] 保存缓存失败:', e);
        }
      }
      
      if (!scriptData) {
        throw new Error('剧本内容不存在');
      }

      console.log('[handleScriptSelect] 选择的剧本信息:', {
        scriptName: script.name,
        scriptId: script.id,
        scriptAuthor: script.author,
        scriptType: script.type,
        hasContent: !!scriptData
      });

      // 先重置座位（清空上一局的角色/状态，但保留玩家名称与座位结构）
      seatDispatch({ type: 'RESET_SEATS' });

      const parseResult = parseScriptJson(scriptData, script.author);
      
      if (parseResult.meta && !parseResult.meta.type) {
        parseResult.meta.type = Array.isArray(script.type) ? script.type[0] || '' : script.type || '';
      }
      
      if (parseResult.meta) {
        parseResult.meta.id = script.id;
      }
      
      console.log('[handleScriptSelect] 解析后的meta信息:', {
        metaName: parseResult.meta?.name,
        metaAuthor: parseResult.meta?.author,
        metaType: parseResult.meta?.type
      });
      
      parseScript(parseResult);

      setSelectedRoleIds(new Set());
      setSelectedRoleCounts(new Map());

      setPhaseCustomNotes({});
      setPhaseNotes({});
    } catch (error) {
      console.error('加载剧本失败:', error);
      showToast(`加载剧本失败: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 处理剧本上传
  const handleScriptUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const scriptData = JSON.parse(e.target?.result as string);
        const parseResult = parseScriptJson(scriptData);

        // 上传剧本视为“更换剧本”：先清空上一局圆桌数据（角色 / 状态 / 投票等），保留座位结构与玩家名称
        seatDispatch({ type: 'RESET_SEATS' });

        // 为上传的剧本生成唯一ID，避免 failedLogos 状态冲突
        if (parseResult.meta) {
          parseResult.meta.id = `uploaded_${Date.now()}`;
        }

        parseScript(parseResult);

        // 切换剧本时清除选中的角色与阶段备注
        setSelectedRoleIds(new Set());
        setSelectedRoleCounts(new Map());
        setPhaseCustomNotes({});
        setPhaseNotes({});

        // 上传成功后关闭弹窗
        closeScriptSelector();
        // 显示成功提示
        showToast('剧本上传成功', 'success');
      } catch (error) {
        console.error('解析JSON文件失败:', error);
        // 显示错误提示
        showToast(`解析JSON文件失败: ${(error as Error).message}`, 'error');
      }
    };
    reader.onerror = () => {
      // 显示错误提示
      showToast('读取文件失败', 'error');
    };
    reader.readAsText(file);
  };

  // 解析剧本JSON数据
  const parseScriptJson = (jsonData: any, scriptRepositoryAuthor: string = ''): ParseResult => {
    if (!Array.isArray(jsonData)) {
      throw new Error('剧本数据格式错误，不是数组');
    }

    // 辅助函数：处理图片路径，去除 /blood-on-the-clocktower/ 前缀
    const normalizeImagePath = (imagePath: string | undefined): string => {
      if (!imagePath) return '';
      if (imagePath.startsWith('/blood-on-the-clocktower/')) {
        return imagePath.replace('/blood-on-the-clocktower/', '/');
      }
      return imagePath;
    };

    const result: ParseResult = {
      meta: null,
      townsfolk: [],
      outsider: [],
      minion: [],
      demon: [],
      fabled: [],
      traveler: [],
      jinxed: []
    };

    // 1. 首先全局寻找最合适的元数据
    const metaData = jsonData.find((item: any) => item && item.id === '_meta') || 
                     jsonData.find((item: any) => item && item.author && !item.team && !item.ability) ||
                     jsonData.find((item: any) => item && item.name && !item.team && !item.ability);

    console.log('[parseScriptJson] 查找metaData:', {
      hasMeta: !!metaData,
      metaId: metaData?.id,
      metaAuthor: metaData?.author,
      metaName: metaData?.name,
      hasTeam: !!metaData?.team,
      hasAbility: !!metaData?.ability,
      scriptRepositoryAuthor
    });

    if (metaData) {
      let extractedAuthor = (metaData.author || scriptRepositoryAuthor || '').trim();

      console.log('[parseScriptJson] 提取的作者信息:', {
        extractedAuthor,
        originalAuthor: metaData.author,
        scriptRepositoryAuthor,
        trimmed: extractedAuthor.length > 0
      });

      // 处理 logo 路径，去除 /blood-on-the-clocktower/ 前缀（如果存在）
      let logo = metaData.logo || '';
      if (logo && logo.startsWith('/blood-on-the-clocktower/')) {
        logo = logo.replace('/blood-on-the-clocktower/', '/');
      }

      result.meta = {
        id: metaData.id || '_meta',
        logo: logo,
        name: metaData.name || '未知剧本',
        townsfolkName: metaData.townsfolkName || metaData.townsfolk || '镇民',
        author: extractedAuthor,
        type: metaData.type || '自定义'
      };
    }

    // 2. 遍历所有条目处理角色（跳过刚才识别为 meta 的项）
    jsonData.forEach((item: any) => {
      if (!item || item === metaData) return;

      // 普通角色结构体
      if (['townsfolk', 'outsider', 'minion', 'demon', '镇民', '外来者', '爪牙', '恶魔'].includes(item.team)) {
        // 映射中文团队名称到英文
        let team = item.team;
        if (team === '镇民') team = 'townsfolk';
        else if (team === '外来者') team = 'outsider';
        else if (team === '爪牙') team = 'minion';
        else if (team === '恶魔') team = 'demon';

        const roleData: RoleData = {
          id: item.id || `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: item.name || '未知角色',
          team: team,
          ability: item.ability || '',
          image: normalizeImagePath(item.image) || '',
          firstNight: item.firstNight || 0,
          otherNight: item.otherNight || 0,
          setup: item.setup === 1 || item.setup === true,
          reminders: item.reminders || [],
          remindersGlobal: item.remindersGlobal || [],
          firstNightReminder: item.firstNightReminder || '',
          otherNightReminder: item.otherNightReminder || '',
          name_eng: item.name_eng || '',
          edition: item.edition || 'custom'
        };
        const teamKey = team as keyof Pick<ParseResult, 'townsfolk' | 'outsider' | 'minion' | 'demon'>;
        result[teamKey].push(roleData);
      }
      // 3. 传奇角色结构体
      else if (item.team === 'fabled' || item.team === 'traveler' || item.team === '传奇角色' || item.team === '旅行者') {
        const isTraveler = item.team === '旅行者' || item.team === 'traveler';
        const team = isTraveler ? 'traveler' : 'fabled';
        const fabledData: FabledData = {
          id: item.id || `${team}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: item.name || '未知角色',
          team: team,
          ability: item.ability || '',
          // 不再为传奇/旅行者自动补 AI 头像，若 JSON 未提供 image 则仅显示底图+文字
          image: normalizeImagePath(item.image) || '',
          firstNight: item.firstNight || 0,
          otherNight: item.otherNight || 0,
          setup: item.setup === 1 || item.setup === true,
          reminders: item.reminders || [],
          remindersGlobal: item.remindersGlobal || [],
          firstNightReminder: item.firstNightReminder || '',
          otherNightReminder: item.otherNightReminder || '',
          name_eng: item.name_eng || '',
          edition: item.edition || 'custom'
        };
        if (isTraveler) {
          result.traveler.push(fabledData);
        } else {
          result.fabled.push(fabledData);
        }
      }
      // 4. 相克角色结构体
      else if (item.team === 'a jinxed' || item.team === 'jinx' || item.jinx) {
        const jinxedData: JinxedData = {
          id: item.id || `jinx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: item.name || '未知相克',
          team: 'jinxed',
          ability: item.reason || item.ability || '',
          image: normalizeImagePath(item.image) || '',
          setup: false
        };
        result.jinxed.push(jinxedData);
      }
    });

    return result;
  };

  // 计算游戏配置
  function calculateGameConfig(count: number): string {
    let config = '';
    let travelers = 0;

    if (count <= 15) {
      switch(count) {
        case 5: config = '3011'; break;
        case 6: config = '3111'; break;
        case 7: config = '5011'; break;
        case 8: config = '5111'; break;
        case 9: config = '5211'; break;
        case 10: config = '7021'; break;
        case 11: config = '7121'; break;
        case 12: config = '7221'; break;
        case 13: config = '9031'; break;
        case 14: config = '9131'; break;
        case 15: config = '9231'; break;
        default: config = '0000';
      }
    } else {
      config = '9231';
      travelers = count - 15;
    }

    const townsfolk = parseInt(config[0]);
    const outsider = parseInt(config[1]);
    const minion = parseInt(config[2]);
    const demon = parseInt(config[3]);

    let displayText = `镇${townsfolk} 外${outsider} 爪${minion} 恶${demon}`;
    if (travelers > 0) {
      displayText += ` 旅${travelers}`;
    }

    return displayText;
  }

  // 获取游戏配置
  function getGameConfig(count: number): { townsfolk: number; outsider: number; minion: number; demon: number; traveler: number } {
    let config = '';
    let travelers = 0;

    if (count <= 15) {
      switch(count) {
        case 5: config = '3011'; break;
        case 6: config = '3111'; break;
        case 7: config = '5011'; break;
        case 8: config = '5111'; break;
        case 9: config = '5211'; break;
        case 10: config = '7021'; break;
        case 11: config = '7121'; break;
        case 12: config = '7221'; break;
        case 13: config = '9031'; break;
        case 14: config = '9131'; break;
        case 15: config = '9231'; break;
        default: config = '0000';
      }
    } else {
      config = '9231';
      travelers = count - 15;
    }

    return {
      townsfolk: parseInt(config[0]),
      outsider: parseInt(config[1]),
      minion: parseInt(config[2]),
      demon: parseInt(config[3]),
      traveler: travelers
    };
  }

  // 辅助函数：随机获取指定数量的元素
  function getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  // 辅助函数：打乱数组顺序
  function shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // 获取分配按钮提示
  const getDistributionButtonTooltip = (): string => {
    if (enableMultiSelect) {
      // 多选模式：计算所有角色的总数量
      let totalSelected = 0;
      selectedRoleCounts.forEach(count => {
        totalSelected += count;
      });
      
      if (totalSelected === 0) {
        return '请先选择角色';
      }

      if (totalSelected > seatState.seats.length) {
        return `选择的角色数量(${totalSelected})超过座位数量(${seatState.seats.length})`;
      }

      return '分配角色到座位';
    } else {
      // 普通模式：使用原来的逻辑
      const totalSelected = selectedRoleIds.size;
      const seatCount = seatState.seats.length;

      if (totalSelected === 0) {
        return '请先选择角色';
      }

      if (totalSelected > seatCount) {
        return `选择的角色数量(${totalSelected})超过座位数量(${seatCount})`;
      }

      return '分配角色到座位';
    }
  };

  return (
    <div className="container desktop desktop-device">
      {/* 预加载界面 */}
      {isPreloading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}>
          <div style={{
            fontSize: '24px',
            color: '#d4af37',
            marginBottom: '20px',
            fontFamily: '"KaiTi", "楷体", "STKaiti", "华文楷体", serif'
          }}>
            血染钟楼
          </div>
          <div style={{
            fontSize: '16px',
            color: 'white',
            marginBottom: '30px'
          }}>
            正在加载资源...
          </div>
          <div style={{
            width: '200px',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '60%',
              height: '100%',
              backgroundColor: '#d4af37',
              borderRadius: '2px',
              animation: 'loading 1.5s ease-in-out infinite'
            }} />
          </div>
          <style>{`
            @keyframes loading {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(266%);
              }
            }
          `}</style>
        </div>
      )}
      
      {/* 背景图片层 - 日间背景 (始终存在) */}
      <div 
        data-bg-type="day"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: appState.grimoireSettings.dayBackgroundImage ? `url(${appState.grimoireSettings.dayBackgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -2,
          pointerEvents: 'none'
        }} 
      />

      {/* 背景图片层 - 夜间背景 (通过透明度控制显示，实现淡入淡出) */}
      <div 
        data-bg-type="night"
        data-active-phase={appState.history[appState.currentPhaseIndex].type}
        data-opacity={appState.history[appState.currentPhaseIndex].type === 'night' ? 1 : 0}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: appState.grimoireSettings.nightBackgroundImage ? `url(${appState.grimoireSettings.nightBackgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -1,
          pointerEvents: 'none',
          opacity: appState.history[appState.currentPhaseIndex].type === 'night' ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out' // 丝滑的 1.5秒淡入淡出
        }} 
      />
      
      {/* 侧边抽屉面板 - 移到分屏层之外，确保只渲染一次，保持状态不变 */}
      <LeftDrawers 
        onOpenBluffModal={openBluffModal}
        hideRoleImage={isGrimoireHidden}
      />
      
      {/* 分屏层 - 在背景图和上层元素之间，仅在PC端显示 */}
      {showGrimoireNote && !isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 500,
          display: 'flex',
          pointerEvents: 'none',
          boxSizing: 'border-box'
        }}>
          {/* 左半屏 - 魔典内容 */}
          <div style={{
            flex: splitRatio,
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'auto',
            paddingRight: splitPanelGap,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {/* 圆桌容器 - 始终 100% 宽且拉伸占满高度，上下 padding 才真正缩小可用区；竖屏左右 0、横屏有左右留白 */}
            <div
              ref={roundTableContainerRef}
              className="round-table-container"
              style={{
                width: '100%',
                maxWidth: roundTableContainerMaxWidth,
                alignSelf: 'stretch',
                minHeight: 0,
                position: 'relative',
                zIndex: 100,
                padding: `${designPx(ROUND_TABLE_LAYOUT.MIN_MARGIN_VERTICAL)} ${designPx(ROUND_TABLE_LAYOUT.MIN_MARGIN_HORIZONTAL)}`,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
              }}
            >
              {/* 首页标题 - 当没有选择剧本且没有座位时显示 */}
            {appState.scriptInfo.name === '请选择剧本' && seatState.seats.length === 0 && (
              <img 
                src="image/yishuzi.webp"
                alt="染·钟楼谜团魔典工具"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  maxWidth: designPx(600),
                  maxHeight: designPx(360),
                  objectFit: 'contain',
                  zIndex: 0,
                  pointerEvents: 'none',
                  opacity: 0.9,
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6))'
                }}
              />
            )}
            {/* 圆桌组件 */}
            <RoundTable
              seats={seatState.seats}
              currentPhase={appState.history[appState.currentPhaseIndex]}
              onSeatClick={handleSeatClick}
              onSettingsClick={handleSettingsClick}
              onOpenStatusModal={handleOpenStatusModal}
              onRemoveStatus={handleRemoveStatus}
              // 新功能参数
              showSeatPanelIndex={showSeatPanelIndex}
              onRenameSeat={handlePanelRenameSeat}
              onRemoveSeat={handlePanelRemoveSeat}
              onSwapSeat={handleSwapSeat}
              onCloseSeatPanel={handleCloseSeatPanel}
              isSwappingMode={isSwappingMode}
              onSwapTargetSelect={handleSwapTargetSelect}
              onSwapCancel={handleSwapCancel}
              // 魔典笔记状态
              showGrimoireNote={showGrimoireNote}
              // 分屏宽度比例
              splitRatio={splitRatio}
              containerWidth={
                roundTableContainerDesignSize.width > 0
                  ? roundTableContainerDesignSize.width
                  : undefined
              }
              containerHeight={
                roundTableContainerDesignSize.height > 0
                  ? roundTableContainerDesignSize.height
                  : undefined
              }
              viewportWidth={viewportSize.width > 0 ? viewportSize.width : undefined}
              viewportHeight={viewportSize.height > 0 ? viewportSize.height : undefined}
              // 回调函数，用于接收 scaleFactor
              onScaleFactorChange={setScaleFactor}
              onRemoveVote={toggleVoteStatus}
              hideSecrets={isGrimoireHidden}
              townSeatOccupancy={townSeatOccupancy}
            />
          </div>

          {/* 分屏模式下的右侧竖向工具栏：贴在左屏最右侧 */}
          <div
            className="right-toolbar"
            style={{
              position: 'absolute',
              top: '50%',
              right: rightToolbarOffset,
              transform: 'translateY(-50%)',
              zIndex: 120,
              display: 'flex',
              flexDirection: 'column',
              gap: topControlGap,
            }}
          >
          {/* 展示信息：打开信息卡片弹窗 */}
          <Tooltip content="展示信息" delay={300}>
            <button
              type="button"
              onClick={() => {
                setSelectedInfoKey(null);
                setCustomInfoText('');
                setShowInfoModal(true);
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-info-circle" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>

          {/* 倒计时工具：打开/关闭计时器挂件（分屏模式右侧工具栏） */}
          <Tooltip content="倒计时" delay={300}>
            <button
              type="button"
              onClick={() => setShowDayTimerWidget(v => !v)}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: showDayTimerWidget
                  ? '1px solid rgba(59, 130, 246, 0.9)'
                  : '1px solid rgba(148, 163, 184, 0.6)',
                background: showDayTimerWidget ? 'rgba(37, 99, 235, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: showDayTimerWidget ? '#e5e7eb' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-hourglass-half" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>

            {/* 魔典笔记：开关分屏魔典 */}
            <Tooltip content="魔典笔记" delay={300}>
              <button
                type="button"
                onClick={() => setShowGrimoireNote(v => !v)}
                className="toolbar-btn"
                style={{
                  width: topControlButtonSize,
                  height: topControlButtonSize,
                  borderRadius: topButtonRadius,
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: showGrimoireNote ? 'rgba(30, 64, 175, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                  color: showGrimoireNote ? '#bfdbfe' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: topButtonShadow,
                }}
              >
                <i
                  className={`fa ${showGrimoireNote ? 'fa-book-open' : 'fa-book'}`}
                  style={{ fontSize: topButtonIconSize }}
                />
              </button>
            </Tooltip>

            {/* 生成复盘 */}
            <Tooltip content="生成复盘" delay={300}>
              <button
                type="button"
                onClick={() => {
                  showToast('功能开发中，请耐心等待', 'info');
                }}
                className="toolbar-btn"
                style={{
                  width: topControlButtonSize,
                  height: topControlButtonSize,
                  borderRadius: topButtonRadius,
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: topButtonShadow,
                }}
              >
                <i className="fa fa-history" style={{ fontSize: topButtonIconSize }} />
              </button>
            </Tooltip>

          {/* 隐藏魔典：隐藏圆桌角色与提示标记，仅保留玩家死亡样式 */}
          <Tooltip content="隐藏魔典" delay={300}>
            <button
              type="button"
              onClick={() => {
                setIsGrimoireHidden(v => {
                  const next = !v;
                  // 开启隐藏魔典时，自动关闭魔典笔记分屏
                  if (next) {
                    setShowGrimoireNote(false);
                  }
                  return next;
                });
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: isGrimoireHidden ? 'rgba(127, 29, 29, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: isGrimoireHidden ? '#fecaca' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
                opacity: 1,
              }}
            >
              <i className="fa fa-eye-slash" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>
          </div>
          </div>
          
          {/* 中间分隔线 - 可拖拽调节分屏大小 */}
          <div 
            style={{
              width: splitPanelGap,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'col-resize',
              background: 'transparent',
              pointerEvents: 'auto'
            }}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startRatio = splitRatio;
              
              // 防止拖拽时选中文字
              document.body.classList.add('dragging');
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const deltaRatio = deltaX / window.innerWidth;
                let newRatio = startRatio + deltaRatio;
                
                // 限制比例范围：左半屏最小1/3，右半屏最小1/3
                newRatio = Math.max(1/3, Math.min(2/3, newRatio));
                
                setSplitRatio(newRatio);
              };
              
              const handleMouseUp = () => {
                // 恢复文字选中和鼠标样式
                document.body.classList.remove('dragging');
                
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            {/* 拖拽手柄 */}
            <div style={{
              width: splitHandleWidth,
              height: splitHandleHeight,
              background: 'rgba(212, 175, 55, 0.5)',
              borderRadius: splitHandleRadius,
              cursor: 'col-resize',
              boxShadow: splitLineShadow
            }} />
          </div>
          
          {/* 右半屏 - 笔记页 */}
          <div style={{
            flex: 1 - splitRatio,
            height: '100%',
            background: 'rgba(26, 32, 44, 0.9)',
            backdropFilter: 'blur(10px)',
            borderLeft: '1px solid rgba(212, 175, 55, 0.3)',
            padding: `${grimoirePanelTopPadding} ${roundTablePaddingX} 0 ${roundTablePaddingX}`,
            minWidth: 0,
            overflow: 'auto',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: grimoirePanelGap,
            boxSizing: 'border-box'
          }}>
            <GrimoireNotesErrorBoundary onClose={() => setShowGrimoireNote(false)}>
              <Suspense fallback={
                <div style={{ color: '#d4af37', textAlign: 'center', padding: '20px' }}>
                  <i className="fa fa-spinner fa-spin" /> 正在加载魔典笔记...
                </div>
              }>
                <GrimoireNotesLazy
                  seats={seatState.seats}
                  currentPhase={appState.history[appState.currentPhaseIndex]}
                  phaseNotes={phaseNotes}
                  phaseCustomNotes={phaseCustomNotes}
                  setPhaseNotes={setPhaseNotes}
                  setPhaseCustomNotes={setPhaseCustomNotes}
                />
              </Suspense>
            </GrimoireNotesErrorBoundary>
          </div>
        </div>
      )}
      
      {/* 顶部中央时间线组件（最小视觉缩放 0.5） */}
      <div
        className="game-timeline-container"
        style={{
          position: 'absolute',
          top: topControlOffset,
          left: '50%',
          zIndex: 1000,
          pointerEvents:
            appState.scriptInfo.name === '请选择剧本' || seatState.seats.length === 0
              ? 'none'
              : 'auto',
          opacity:
            appState.scriptInfo.name === '请选择剧本' || seatState.seats.length === 0 ? 0.5 : 1,
          filter:
            appState.scriptInfo.name === '请选择剧本' || seatState.seats.length === 0
              ? 'grayscale(100%)'
              : 'none',
          transition: 'all 0.3s ease',
          transformOrigin: 'top center',
          transform: `translateX(-50%) scale(${uiMinScaleForHud})`,
        }}
      >
        <GameTimeline />
      </div>

      {/* 工具栏（仅桌面端，未开启魔典分屏时）：
          - 横屏：右侧竖向排列（保持现有逻辑）
          - 竖屏：移动到左侧，在游戏信息卡片下方横向排列 */}
      {!isMobile && !showGrimoireNote && !isPortrait && (
        <div
          className="right-toolbar"
          style={{
            position: 'absolute',
            top: '50%',
            right: rightToolbarOffset,
            transform: 'translateY(-50%)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            gap: topControlGap,
          }}
        >
          {/* 展示信息：打开信息卡片弹窗 */}
          <Tooltip content="展示信息" delay={300}>
            <button
              type="button"
              onClick={() => {
                setSelectedInfoKey(null);
                setCustomInfoText('');
                setShowInfoModal(true);
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-info-circle" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>

          {/* 倒计时工具：打开/关闭计时器挂件（未分屏时右侧工具栏） */}
          <Tooltip content="倒计时" delay={300}>
            <button
              type="button"
              onClick={() => setShowDayTimerWidget(v => !v)}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: showDayTimerWidget
                  ? '1px solid rgba(59, 130, 246, 0.9)'
                  : '1px solid rgba(148, 163, 184, 0.6)',
                background: showDayTimerWidget ? 'rgba(37, 99, 235, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: showDayTimerWidget ? '#e5e7eb' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-hourglass-half" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>

          {/* 魔典笔记：开关分屏魔典（仅横屏可用） */}
          <Tooltip content="魔典笔记" delay={300}>
            <button
              type="button"
              onClick={() => setShowGrimoireNote(v => !v)}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: showGrimoireNote ? 'rgba(30, 64, 175, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: showGrimoireNote ? '#bfdbfe' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className={`fa ${showGrimoireNote ? 'fa-book-open' : 'fa-book'}`} style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>

          {/* 生成复盘 */}
          <Tooltip content="生成复盘" delay={300}>
            <button
              type="button"
              onClick={() => {
                showToast('功能开发中，请耐心等待', 'info');
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-history" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>

          {/* 隐藏魔典：隐藏圆桌角色与提示标记，仅保留玩家死亡样式 */}
          <Tooltip content="隐藏魔典" delay={300}>
            <button
              type="button"
              onClick={() => {
                setIsGrimoireHidden(v => {
                  const next = !v;
                  // 开启隐藏魔典时，自动关闭魔典笔记分屏
                  if (next) {
                    setShowGrimoireNote(false);
                  }
                  return next;
                });
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: isGrimoireHidden ? 'rgba(127, 29, 29, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: isGrimoireHidden ? '#fecaca' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
                opacity: 1,
              }}
            >
              <i className="fa fa-eye-slash" style={{ fontSize: topButtonIconSize }} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* 左上角游戏信息卡片（最小视觉缩放 0.5） */}
      {showGameInfoCard && !isPortrait && (
      <div className="game-info-card panel" style={{ 
        position: 'absolute', 
        top: topControlOffset, 
        left: topControlOffset, 
        zIndex: 1100,
        width: 'fit-content',
        minWidth: topInfoCardMinWidth,
        maxWidth: topInfoCardMaxWidth,
        padding: infoCardPadding,
        background: 'rgba(26, 32, 44, 0.8)',
        borderRadius: topMenuRadius,
        boxShadow: topInfoCardShadow,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: infoCardGap,
        transition: 'width 0.3s ease',
        transform: `scale(${uiMinScaleForHud})`,
        transformOrigin: 'top left',
      }}>
        {/* 剧本名称和作者信息 */}
        {appState.scriptInfo.name !== '请选择剧本' && (
          <div 
            style={{ 
              flex: 1,
              padding: infoCardInnerPadding,
              background: 'rgba(45, 55, 72, 0.8)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: topMenuRadius,
              color: '#e5e7eb',
              fontSize: designPx(12),
              fontWeight: '400',
              textAlign: 'center',
              pointerEvents: 'auto',
              userSelect: 'text',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default'
            }}
            title={`${appState.scriptInfo.name} by ${appState.scriptInfo.author || '未知作者'}`}
          >
            <div 
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: designPx(4)
              }}
            >
              <span style={{ 
                fontWeight: '900', 
                fontSize: designPx(16),
                fontStyle: 'italic',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "SimHei", sans-serif',
                textShadow: '0 0 10px rgba(212, 175, 55, 0.5), 0 2px 4px rgba(0, 0, 0, 0.8)',
                letterSpacing: designPx(2),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {appState.scriptInfo.name.length > 6 ? `${appState.scriptInfo.name.substring(0, 6)}...` : appState.scriptInfo.name}
              </span>
              {appState.scriptInfo.author && (
                <span style={{ 
                  fontWeight: '300', 
                  fontSize: designPx(11),
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1 // 作者占用剩余空间
                }}>
                  by {appState.scriptInfo.author}
                </span>
              )}
            </div>
          </div>
        )}

          {/* 选择剧本后的信息展示 */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: infoCardGap,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* 角色配置 */}
          {gameConfig && (
            <div style={{ 
                width: '100%',
                padding: `${designPx(5)} ${designPx(10)}`, 
                border: '1px solid rgba(212, 175, 55, 0.3)', 
                borderRadius: topMenuRadius, 
                color: '#d4af37', 
                fontSize: designPx(11), 
                fontWeight: '600', 
                letterSpacing: designPx(0.4),
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                lineHeight: '1.3'
              }}>
                {gameConfig}
              </div>
            )}

          {/* 对局信息 */}
          <div style={{ 
              width: '100%',
              padding: `${designPx(5)} ${designPx(10)}`, 
              border: '1px solid rgba(66, 153, 225, 0.3)', 
              borderRadius: topMenuRadius, 
              color: '#4299e1', 
              fontSize: designPx(11), 
              fontWeight: '600', 
              letterSpacing: designPx(0.4),
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              lineHeight: '1.3'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: designPx(8) }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: designPx(2) }}>
                  <i className="fa fa-users"></i> {gameStats.total}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: designPx(2) }}>
                  <i className="fa fa-heartbeat"></i> {gameStats.alive}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: designPx(2) }}>
                  <i className="fa fa-vote-yea"></i> {gameStats.voted}
                </span>
              </span>
            </div>
        </div>
      </div>
      )}

      {/* 竖屏时：左侧信息卡 + 工具栏整体容器（绝对定位在左上角），信息卡在上，工具栏在下，均在容器内缩放 */}
      {showGameInfoCard && isPortrait && (
      <div
        style={{
          position: 'absolute',
          top: topControlOffset,
          left: topControlOffset,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: infoCardGap,
          transform: `scale(${uiMinScaleForHud})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="game-info-card panel" style={{ 
          width: 'fit-content',
          minWidth: topInfoCardMinWidth,
          maxWidth: topInfoCardMaxWidth,
          padding: infoCardPadding,
          background: 'rgba(26, 32, 44, 0.8)',
          borderRadius: topMenuRadius,
          boxShadow: topInfoCardShadow,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          gap: infoCardGap,
          transition: 'width 0.3s ease',
        }}>
        {/* 剧本名称和作者信息 */}
        {appState.scriptInfo.name !== '请选择剧本' && (
          <div 
            style={{ 
              flex: 1,
              padding: infoCardInnerPadding,
              background: 'rgba(45, 55, 72, 0.8)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: topMenuRadius,
              color: '#e5e7eb',
              fontSize: designPx(12),
              fontWeight: '400',
              textAlign: 'center',
              pointerEvents: 'auto',
              userSelect: 'text',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default'
            }}
            title={`${appState.scriptInfo.name} by ${appState.scriptInfo.author || '未知作者'}`}
          >
            <div 
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: designPx(4)
              }}
            >
              <span style={{ 
                fontWeight: '900', 
                fontSize: designPx(16),
                fontStyle: 'italic',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "微软雅黑", "PingFang SC", "Hiragino Sans GB", "Heiti SC", "SimHei", sans-serif',
                textShadow: '0 0 10px rgba(212, 175, 55, 0.5), 0 2px 4px rgba(0, 0, 0, 0.8)',
                letterSpacing: designPx(2),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {appState.scriptInfo.name.length > 6 ? `${appState.scriptInfo.name.substring(0, 6)}...` : appState.scriptInfo.name}
              </span>
              {appState.scriptInfo.author && (
                <span style={{ 
                  fontWeight: '300', 
                  fontSize: designPx(11),
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1 // 作者占用剩余空间
                }}>
                  by {appState.scriptInfo.author}
                </span>
              )}
            </div>
          </div>
        )}

          {/* 选择剧本后的信息展示 */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: infoCardGap,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* 角色配置 */}
          {gameConfig && (
            <div style={{ 
                width: '100%',
                padding: `${designPx(5)} ${designPx(10)}`, 
                border: '1px solid rgba(212, 175, 55, 0.3)', 
                borderRadius: topMenuRadius, 
                color: '#d4af37', 
                fontSize: designPx(11), 
                fontWeight: '600', 
                letterSpacing: designPx(0.4),
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                lineHeight: '1.3'
              }}>
                {gameConfig}
              </div>
            )}

          {/* 对局信息 */}
          <div style={{ 
              width: '100%',
              padding: `${designPx(5)} ${designPx(10)}`, 
              border: '1px solid rgba(66, 153, 225, 0.3)', 
              borderRadius: topMenuRadius, 
              color: '#4299e1', 
              fontSize: designPx(11), 
              fontWeight: '600', 
              letterSpacing: designPx(0.4),
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              lineHeight: '1.3'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: designPx(8) }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: designPx(2) }}>
                  <i className="fa fa-users"></i> {gameStats.total}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: designPx(2) }}>
                  <i className="fa fa-heartbeat"></i> {gameStats.alive}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: designPx(2) }}>
                  <i className="fa fa-vote-yea"></i> {gameStats.voted}
                </span>
              </span>
            </div>
        </div>
        </div>

        {/* 竖屏时的工具栏：移动到剧本信息卡片下方，左侧纵向排列；不展示 Tooltip，仅按钮本身可点 */}
        {!isMobile && !showGrimoireNote && (
          <div
            style={{
              marginTop: infoCardGap,
              display: 'flex',
              flexDirection: 'column',
              gap: topControlGap,
            }}
          >
            {/* 展示信息：打开信息卡片弹窗 */}
            <button
              type="button"
              onClick={() => {
                setSelectedInfoKey(null);
                setCustomInfoText('');
                setShowInfoModal(true);
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-info-circle" style={{ fontSize: topButtonIconSize }} />
            </button>

            {/* 倒计时工具：打开/关闭计时器挂件 */}
            <button
              type="button"
              onClick={() => setShowDayTimerWidget(v => !v)}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: showDayTimerWidget
                  ? '1px solid rgba(59, 130, 246, 0.9)'
                  : '1px solid rgba(148, 163, 184, 0.6)',
                background: showDayTimerWidget ? 'rgba(37, 99, 235, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: showDayTimerWidget ? '#e5e7eb' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-hourglass-half" style={{ fontSize: topButtonIconSize }} />
            </button>

            {/* 魔典笔记：竖屏下禁用，点击提示 Toast */}
            <button
              type="button"
              onClick={() => {
                showToast('竖屏状态不支持魔典笔记', 'info');
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-book" style={{ fontSize: topButtonIconSize }} />
            </button>

            {/* 生成复盘 */}
            <button
              type="button"
              onClick={() => {
                showToast('功能开发中，请耐心等待', 'info');
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: '1px solid rgba(148, 163, 184, 0.6)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className="fa fa-clipboard-list" style={{ fontSize: topButtonIconSize }} />
            </button>

            {/* 隐藏魔典：切换隐藏模式 */}
            <button
              type="button"
              onClick={() => {
                const next = !isGrimoireHidden;
                setIsGrimoireHidden(next);
                // 开启隐藏魔典时，自动关闭魔典笔记分屏
                if (next && showGrimoireNote) {
                  setShowGrimoireNote(false);
                }
              }}
              className="toolbar-btn"
              style={{
                width: topControlButtonSize,
                height: topControlButtonSize,
                borderRadius: topButtonRadius,
                border: isGrimoireHidden
                  ? '1px solid rgba(148, 163, 184, 0.9)'
                  : '1px solid rgba(148, 163, 184, 0.6)',
                background: isGrimoireHidden ? 'rgba(30, 64, 175, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                color: isGrimoireHidden ? '#bfdbfe' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: topButtonShadow,
              }}
            >
              <i className={isGrimoireHidden ? 'fa fa-eye' : 'fa fa-eye-slash'} style={{ fontSize: topButtonIconSize }} />
            </button>
          </div>
        )}
      </div>
      )}

      {/* 白天计时器挂件：可拖动，层级最高，由顶部工具栏开关控制，昼夜皆可使用 */}
      {showDayTimerWidget && (
        <div
          className={dayTimerStatus === 'finished' ? 'day-timer-finished' : undefined}
          style={{
            position: 'absolute',
            top: `${(dayTimerPosition?.top ?? defaultDayTimerTop)}px`,
            left: `${(dayTimerPosition?.left ?? defaultDayTimerLeft)}px`,
            zIndex: 4000,
            minWidth: designPx(150),
            padding: `${designPx(6)} ${designPx(12)}`,
            borderRadius: designPx(999),
            border: '1px solid rgba(148, 163, 184, 0.7)',
            background:
              dayTimerStatus === 'finished'
                ? 'rgba(127, 29, 29, 0.95)'
                : 'rgba(15, 23, 42, 0.9)',
            color: dayTimerStatus === 'finished' ? '#fecaca' : '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: designPx(8),
            fontSize: designPx(13),
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            // 最小视觉缩放 0.7：当整页缩放小于 0.7 时，计时器挂件不再继续缩小
            transform: `scale(${dayTimerScale})`,
            transformOrigin: 'top left',
          }}
          onMouseDown={handleDayTimerMouseDown}
          onTouchStart={handleDayTimerTouchStart}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: designPx(6) }}>
            <span
              style={{
                width: designPx(20),
                height: designPx(20),
                borderRadius: '999px',
                border: '1px solid rgba(148,163,184,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fa fa-hourglass-half" style={{ fontSize: designPx(11) }} />
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: designPx(4) }}>
              {isEditingDayTimer ? (
                <input
                  type="number"
                  autoFocus
                  value={dayTimerMinutes}
                  min={1}
                  max={240}
                  onChange={(e) => handleDayTimerMinutesChange(e.target.value)}
                  onBlur={() => setIsEditingDayTimer(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDayTimerMinutesChange((e.target as HTMLInputElement).value);
                    }
                    if (e.key === 'Escape') {
                      setIsEditingDayTimer(false);
                    }
                  }}
                  style={{
                    width: designPx(46),
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(148,163,184,0.8)',
                    borderRadius: designPx(4),
                    color: 'inherit',
                    fontSize: designPx(13),
                    textAlign: 'center',
                    outline: 'none',
                    padding: `0 ${designPx(4)}`,
                  }}
                />
              ) : (
                <span
                  onClick={(e) => {
                    // 如果本次交互是拖动结束触发的 click，则直接吞掉，不进入编辑模式
                    if (dayTimerDraggingRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    setIsEditingDayTimer(true);
                  }}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: designPx(16),
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title="点击修改分钟数"
                >
                  {String(Math.floor(dayTimerSeconds / 60)).padStart(2, '0')}:
                  {String(dayTimerSeconds % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: designPx(6) }}>
            <button
              type="button"
              onClick={handleDayTimerStartPause}
              style={{
                width: designPx(26),
                height: designPx(26),
                borderRadius: '999px',
                border: 'none',
                background: 'rgba(30, 64, 175, 0.95)',
                color: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: designPx(13),
              }}
            >
              {dayTimerStatus === 'running' ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              onClick={handleDayTimerReset}
              style={{
                width: designPx(26),
                height: designPx(26),
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.85)',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: designPx(13),
              }}
            >
              ↺
            </button>
          </div>
        </div>
      )}

      {/* 顶部按钮栏 */}
      <div className="top-buttons" style={{ 
        position: 'absolute', 
        top: topControlOffset, 
        right: topControlOffset, 
        zIndex: 1000,
        display: 'flex',
        gap: topControlGap
      }}>
        {/* 菜单按钮容器 */}
        <div 
          style={{ position: 'relative' }}
          onMouseEnter={() => {
            if (menuTimeoutRef.current) {
              clearTimeout(menuTimeoutRef.current);
              menuTimeoutRef.current = null;
            }
            setShowSettingsMenu(true);
          }}
          onMouseLeave={() => {
            menuTimeoutRef.current = setTimeout(() => {
              setShowSettingsMenu(false);
            }, 300); // 300ms 延迟
          }}
        >
          <button 
            id="settingsBtn" 
            className={showSettingsMenu ? 'active' : ''}
            style={{
              background: showSettingsMenu ? 'rgba(212, 175, 55, 0.15)' : 'rgba(15, 15, 20, 0.8)',
              color: showSettingsMenu ? '#d4af37' : '#a0aec0',
              border: showSettingsMenu ? '1px solid rgba(212, 175, 55, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
              // 最小缩放比例 0.7：当整页缩放低于 0.7 时，按钮不再继续缩小
              width: settingsButtonSize,
              height: settingsButtonSize,
              padding: '0',
              justifyContent: 'center',
              borderRadius: topButtonRadius,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontSize: topButtonIconSize,
              fontFamily: '"Cinzel", "Noto Serif SC", serif',
              transition: 'all 0.3s ease',
              boxShadow: showSettingsMenu ? topButtonActiveShadow : topButtonShadow,
              backdropFilter: 'blur(4px)'
            }}
          >
            <i className="fa fa-bars"></i> 
          </button>

          {/* 菜单内容 */}
          {showSettingsMenu && (
            <div
              style={{
                display: 'block',
                position: 'absolute',
                top: '100%',
                right: '0',
                paddingTop: topMenuOffset,
                zIndex: 1001,
                // 与按钮保持一致的最小缩放：当整页缩放小于 0.7 时，面板整体按 settingsPanelScale 放大
                transform: `scale(${settingsPanelScale})`,
                transformOrigin: 'top right',
              }}
            >
              <div 
                id="settingsMenu"
                style={{
                  background: 'rgba(15, 15, 20, 0.95)',
                  borderRadius: topMenuRadius,
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8), 0 0 10px rgba(212, 175, 55, 0.1)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  minWidth: topMenuMinWidth,
                  overflow: 'hidden',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {/* 标签页导航 */}
                <div 
                  className="settings-tabs-nav"
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'grimoire' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('grimoire')}
                    onMouseEnter={() => setActiveSettingsTab('grimoire')}
                    style={{
                      flex: 1,
                      background: activeSettingsTab === 'grimoire' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                      color: activeSettingsTab === 'grimoire' ? '#d4af37' : '#a0aec0',
                      border: 'none',
                      borderBottom: activeSettingsTab === 'grimoire' ? '2px solid #d4af37' : '2px solid transparent',
                      padding: topMenuTabPadding,
                      cursor: 'pointer',
                      fontSize: topMenuTabFontSize,
                      fontWeight: activeSettingsTab === 'grimoire' ? 'bold' : 'normal',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.2s ease',
                      fontFamily: '"Cinzel", "Noto Serif SC", serif'
                    }}
                  >
                    页面
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'seat' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('seat')}
                    onMouseEnter={() => setActiveSettingsTab('seat')}
                    style={{
                      flex: 1,
                      background: activeSettingsTab === 'seat' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                      color: activeSettingsTab === 'seat' ? '#d4af37' : '#a0aec0',
                      border: 'none',
                      borderBottom: activeSettingsTab === 'seat' ? '2px solid #d4af37' : '2px solid transparent',
                      padding: topMenuTabPadding,
                      cursor: 'pointer',
                      fontSize: topMenuTabFontSize,
                      fontWeight: activeSettingsTab === 'seat' ? 'bold' : 'normal',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.2s ease',
                      fontFamily: '"Cinzel", "Noto Serif SC", serif'
                    }}
                  >
                    座位
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'role' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('role')}
                    onMouseEnter={() => setActiveSettingsTab('role')}
                    style={{
                      flex: 1,
                      background: activeSettingsTab === 'role' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                      color: activeSettingsTab === 'role' ? '#d4af37' : '#a0aec0',
                      border: 'none',
                      borderBottom: activeSettingsTab === 'role' ? '2px solid #d4af37' : '2px solid transparent',
                      padding: topMenuTabPadding,
                      cursor: 'pointer',
                      fontSize: topMenuTabFontSize,
                      fontWeight: activeSettingsTab === 'role' ? 'bold' : 'normal',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.2s ease',
                      fontFamily: '"Cinzel", "Noto Serif SC", serif'
                    }}
                  >
                    角色
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'game' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('game')}
                    onMouseEnter={() => setActiveSettingsTab('game')}
                    style={{
                      flex: 1,
                      background: activeSettingsTab === 'game' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                      color: activeSettingsTab === 'game' ? '#d4af37' : '#a0aec0',
                      border: 'none',
                      borderBottom: activeSettingsTab === 'game' ? '2px solid #d4af37' : '2px solid transparent',
                      padding: topMenuTabPadding,
                      cursor: 'pointer',
                      fontSize: topMenuTabFontSize,
                      fontWeight: activeSettingsTab === 'game' ? 'bold' : 'normal',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.2s ease',
                      fontFamily: '"Cinzel", "Noto Serif SC", serif'
                    }}
                  >
                    游戏
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'features' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('features')}
                    onMouseEnter={() => setActiveSettingsTab('features')}
                    style={{
                      flex: 1,
                      background: activeSettingsTab === 'features' ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                      color: activeSettingsTab === 'features' ? '#d4af37' : '#a0aec0',
                      border: 'none',
                      borderBottom: activeSettingsTab === 'features' ? '2px solid #d4af37' : '2px solid transparent',
                      padding: topMenuTabPadding,
                      cursor: 'pointer',
                      fontSize: topMenuTabFontSize,
                      fontWeight: activeSettingsTab === 'features' ? 'bold' : 'normal',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 0.2s ease',
                      fontFamily: '"Cinzel", "Noto Serif SC", serif'
                    }}
                  >
                    关于
                  </button>
                </div>

                {/* 标签页内容 */}
                <div 
                  className="settings-tab-content"
                  style={{
                    padding: topMenuContentPadding,
                    display: 'block'
                  }}
                >
                  {activeSettingsTab === 'features' && (
                    <div 
                      className="settings-group"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: topMenuGroupPadding
                      }}
                    >
                      <button 
                        onClick={async () => {
                          setShowSettingsMenu(false);
                          setShowVersionLog(true);
                          if (!versionLogs && !isVersionLogLoading) {
                            try {
                              setIsVersionLogLoading(true);
                              const module = await import('./data/changelog.json');
                              const logs = (module as any).default || (module as any);
                              setVersionLogs(Array.isArray(logs) ? logs : []);
                            } catch (e) {
                              console.error('加载版本日志失败:', e);
                              setVersionLogs([]);
                            } finally {
                              setIsVersionLogLoading(false);
                            }
                          }
                        }}
                        className="settings-btn"
                      >
                        <i className="fa fa-code-branch"></i> 版本日志
                      </button>
                    </div>
                  )}

                  {activeSettingsTab === 'seat' && (
                <div 
                  className="settings-group"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '5px 0'
                  }}
                >
                  <button onClick={addSeat} className="settings-btn" disabled={seatState.seats.length >= 20}>
                    <i className="fa fa-plus"></i> 添加座位
                  </button>
                  <button onClick={removeSeat} className="settings-btn">
                    <i className="fa fa-minus"></i> 减少座位
                  </button>
                  <button
                    disabled={seatState.seats.length === 0}
                    onClick={() => {
                      if (seatState.seats.length === 0) return;
                      const hasAssignedRoles = seatState.seats.some(seat => seat.role !== null);
                      if (hasAssignedRoles) {
                        setConfirmModalConfig({
                          title: '确认清除座位？',
                          message: '清除座位会清空当前所有角色及提示标记，是否确认清除？',
                          confirmText: '确认清除',
                          onConfirm: () => {
                            clearSeats();
                            appDispatch({ type: 'RESTART_GAME', payload: [] });
                            // 清空本局的自定义展示信息卡片
                            setInfoCustomCards([]);
                            setSelectedInfoKey(null);
                            setCustomInfoText('');
                            setShowConfirmModal(false);
                            showToast('座位已清除', 'success');
                          }
                        });
                        setShowConfirmModal(true);
                      } else {
                        clearSeats();
                        appDispatch({ type: 'RESTART_GAME', payload: [] });
                        setInfoCustomCards([]);
                        setSelectedInfoKey(null);
                        setCustomInfoText('');
                        showToast('座位已清除', 'success');
                      }
                    }}
                    className="settings-btn"
                  >
                    <i className="fa fa-trash"></i> 清除座位
                  </button>
                </div>
              )}

              {activeSettingsTab === 'role' && (
                <div 
                  className="settings-group"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '5px 0'
                  }}
                >
                  <button onClick={() => setShowScriptSelector(true)} className="settings-btn">
                    <i className="fa fa-file-alt"></i> 选择剧本
                  </button>
                  <button onClick={openRoleDistributionModal} className="settings-btn">
                    <i className="fa fa-random"></i> 分配角色
                  </button>
                  <button
                    onClick={handleDealRolesToTown}
                    className="settings-btn"
                    disabled={
                      isTownBusy ||
                      !townId ||
                      townRole !== 'host' ||
                      !seatState.seats.some(seat => seat.role !== null)
                    }
                  >
                    <i className="fa fa-paper-plane"></i> 下发角色
                  </button>
                  <button
                    disabled={
                      !seatState.seats.some(seat => seat.role !== null) &&
                      !appState.devilGuiseRoles.some(r => r != null)
                    }
                    onClick={() => {
                      const hasAssignedRoles = seatState.seats.some(seat => seat.role !== null);
                      const hasDevilGuise = appState.devilGuiseRoles.some(r => r != null);
                      if (!hasAssignedRoles && !hasDevilGuise) return;

                      const resetPayload = seatState.seats.map(seat => ({
                        ...seat,
                        role: null,
                        roleName: '',
                        isDead: false,
                        hasVote: true,
                        isFlipped: false,
                        alignment: undefined,
                        abilityRole: null,
                        perceivedRole: null,
                        health: undefined,
                        statuses: [],
                      }));

                      if (hasAssignedRoles) {
                        setConfirmModalConfig({
                          title: '确认重置角色？',
                          message: '重置角色会清空当前所有角色及提示标记，是否确认重置？',
                          confirmText: '确认重置',
                          onConfirm: () => {
                            resetSeats();
                            appDispatch({ type: 'RESTART_GAME', payload: resetPayload });
                            // 清空本局的自定义展示信息卡片
                            setInfoCustomCards([]);
                            setSelectedInfoKey(null);
                            setCustomInfoText('');
                            setShowConfirmModal(false);
                            showToast('角色已重置', 'success');
                          }
                        });
                        setShowConfirmModal(true);
                      } else {
                        resetSeats();
                        appDispatch({ type: 'RESTART_GAME', payload: resetPayload });
                        setInfoCustomCards([]);
                        setSelectedInfoKey(null);
                        setCustomInfoText('');
                        showToast('角色已重置', 'success');
                      }
                    }}
                    className="settings-btn"
                  >
                    <i className="fa fa-refresh"></i> 重置角色
                  </button>
                </div>
              )}

              {activeSettingsTab === 'game' && (
                <div
                  className="settings-group"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '5px 0',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px dashed rgba(212, 175, 55, 0.3)',
                      color: '#e5e7eb',
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {townId ? (
                      <>
                        <div>当前已创建小镇。</div>
                        <div>
                          小镇号码：<span style={{ color: '#d4af37', fontWeight: 600 }}>{townId}</span>
                          {townRole === 'host' && (
                            <span style={{ marginLeft: 8, color: '#60a5fa' }}>（说书人）</span>
                          )}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
                          复制链接发送玩家，玩家打开后可直接加入小镇。
                        </div>
                      </>
                  ) : (
                      <div>说书人创建小镇后可以给在一个小镇的玩家在线发送角色。</div>
                    )}
                  </div>

                  {!townId && (
                    <button
                      onClick={handleCreateTown}
                      className="settings-btn"
                      disabled={isTownBusy}
                    >
                      <i className="fa fa-home"></i> 创建小镇（说书人）
                    </button>
                  )}

                  {townId && (
                    <>
                      <button
                        onClick={() => {
                          if (!townId) return;
                          const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                          // 允许通过环境变量显式指定玩家端前端地址，例如 https://my-site.com/botc
                          const playerBase =
                            (import.meta.env && (import.meta.env as any).VITE_PLAYER_BASE_URL) ||
                            (typeof window !== 'undefined'
                              ? `${window.location.origin}${basePath}`
                              : '');
                          const joinUrl = `${playerBase}?mode=player&townId=${encodeURIComponent(
                            townId,
                          )}`;
                          const text = joinUrl;
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard
                              .writeText(text)
                              .then(() => {
                                showToast('玩家加入链接已复制', 'success');
                              })
                              .catch(() => {
                                showToast('复制失败，请手动选择复制', 'error');
                              });
                          } else {
                            showToast('当前环境不支持一键复制，请手动选择复制', 'info');
                          }
                        }}
                        className="settings-btn"
                      >
                        <i className="fa fa-copy"></i> 复制链接
                      </button>
                      <button
                        onClick={handleLeaveTown}
                        className="settings-btn"
                        disabled={isTownBusy}
                      >
                        <i className="fa fa-sign-out-alt"></i> 离开小镇
                      </button>
                    </>
                  )}
                </div>
              )}

              {activeSettingsTab === 'grimoire' && (
                <div 
                  className="settings-group"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '5px 0'
                  }}
                >
                  <button onClick={toggleHideRoleAbilities} className="settings-btn">
                    <i className={`fa ${appState.grimoireSettings.hideRoleAbilities ? 'fa-eye-slash' : 'fa-eye'}`}></i> 
                    {appState.grimoireSettings.hideRoleAbilities ? ' 显示角色能力' : ' 隐藏角色能力'}
                  </button>

                  <button onClick={toggleHideNightInstructions} className="settings-btn">
                    <i className={`fa ${appState.grimoireSettings.hideNightInstructions ? 'fa-eye-slash' : 'fa-eye'}`}></i> 
                    {appState.grimoireSettings.hideNightInstructions ? ' 显示夜间信息' : ' 隐藏夜间信息'}
                  </button>

                  <button onClick={() => setShowBackgroundModal(true)} className="settings-btn">
                    <i className="fa fa-image"></i> 更换魔典背景
                  </button>
          </div>
        )}
        </div>
          </div>
          </div>
        )}
      </div>
      </div>

      {/* 主内容区域 - 当不显示魔典笔记时显示；绝对定位铺满容器，避免移动端竖屏下宽度未占满/左偏 */}
      {!showGrimoireNote && (
        <div
          className="main-content-area"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 圆桌容器 - 铺满主内容区，padding 留出上下左右边距 */}
          <div
            ref={roundTableContainerRef}
            className="round-table-container"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              padding: `${designPx(ROUND_TABLE_LAYOUT.MIN_MARGIN_VERTICAL)} ${designPx(ROUND_TABLE_LAYOUT.MIN_MARGIN_HORIZONTAL)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              minHeight: 0,
              zIndex: 100,
            }}
          >
            {/* 首页标题 - 当没有选择剧本且没有座位时显示 */}
            {appState.scriptInfo.name === '请选择剧本' && seatState.seats.length === 0 && (
              <img
                src="image/yishuzi.webp"
                alt="染·钟楼谜团魔典工具"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  maxWidth: designPx(600),
                  maxHeight: designPx(360),
                  objectFit: 'contain',
                  zIndex: 0,
                  pointerEvents: 'none',
                  opacity: 0.9,
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6))',
                }}
              />
            )}
            {/* 圆桌组件 */}
            <RoundTable
              seats={seatState.seats}
              currentPhase={appState.history[appState.currentPhaseIndex]}
              onSeatClick={handleSeatClick}
              onSettingsClick={handleSettingsClick}
              onOpenStatusModal={handleOpenStatusModal}
              onRemoveStatus={handleRemoveStatus}
              // 新功能参数
              showSeatPanelIndex={showSeatPanelIndex}
              onRenameSeat={handlePanelRenameSeat}
              onRemoveSeat={handlePanelRemoveSeat}
              onSwapSeat={handleSwapSeat}
              onCloseSeatPanel={handleCloseSeatPanel}
              isSwappingMode={isSwappingMode}
              onSwapTargetSelect={handleSwapTargetSelect}
              onSwapCancel={handleSwapCancel}
              // 魔典笔记状态
              showGrimoireNote={showGrimoireNote}
              // 回调函数，用于接收 scaleFactor
              onScaleFactorChange={setScaleFactor}
              onRemoveVote={toggleVoteStatus}
              containerWidth={viewportDesignSize.width > 0 ? viewportDesignSize.width : undefined}
              containerHeight={viewportDesignSize.height > 0 ? viewportDesignSize.height : undefined}
              viewportWidth={viewportSize.width > 0 ? viewportSize.width : undefined}
              viewportHeight={viewportSize.height > 0 ? viewportSize.height : undefined}
              hideSecrets={isGrimoireHidden}
              townSeatOccupancy={townSeatOccupancy}
            />
          </div>
        </div>
      )}

      {/* 免责声明：固定在视口底部，开关魔典笔记时垂直位置不变 */}
      <div
        style={{
          position: 'fixed',
          bottom: footerBottomOffset,
          left: 0,
          width: '100%',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: footerFontSize,
          pointerEvents: 'none',
          zIndex: 10,
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
          padding: `0 ${footerHorizontalPadding}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        本网站为民间说书人辅助工具，素材版权归染·钟楼谜团国内代理（集石科技）所有；剧本数据源自钟楼博物馆及网络；如有侵权请联系删除
      </div>

      {/* 角色选择弹窗 */}
      {showRoleModal && (
        <Modal 
          title={roleModalTitle}
          onClose={closeRoleModal}
          width={modalLargeWidth}
        >
          <div id="roleList" style={{ width: '100%' }}>
            {/* 检查是否选择了剧本 */}
            {appState.scriptInfo.name === '请选择剧本' ? (
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
                  📜
                </div>
                <div>请先选择剧本</div>
              </div>
            ) : (
              /* 角色列表：不再使用线框划分，而是采用流式布局 */
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '12px', 
                padding: '12px',
                borderRadius: '12px'
              }}>
                {/* 搜索输入框：仅当角色数>50时显示 */}
                {totalRoleCount > 50 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="搜索角色名称"
                    value={roleSearchTerm}
                    onChange={(e) => setRoleSearchTerm(e.target.value)}
                    style={{
                      height: '32px',
                      minWidth: '200px',
                      padding: '0 12px',
                      borderRadius: '999px',
                      border: '1px solid rgba(148, 163, 184, 0.8)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                )}
                {isSelectingLegendary ? (
                  // 选择传奇角色
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', width: '85%', padding: '10px', margin: '0 auto' }}>
                    {appState.fabledRoles.length > 0 ? (
                      appState.fabledRoles.map((role) => (
                        <RoleToken 
                          key={role.id}
                          role={role as any}
                          size={75}
                          showName={true}
                          onClick={() => selectRole(role)}
                        />
                      ))
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '14px', padding: '20px' }}>
                        当前剧本无传奇/奇遇角色
                      </div>
                    )}
                  </div>
                ) : (
                  // 选择普通角色：按团队分组并换行
                  (() => {
                    // 获取当前在场的角色 ID 列表（不修改 roleTeams，每次基于当前座位重新派生）
                    const assignedRoleIds = new Set(
                      seatState.seats
                        .filter(seat => seat.role !== null)
                        .map(seat => seat.role!.id)
                    );

                    const filteredTeams =
                      currentDevilGuiseIndex >= 0
                        ? roleTeams
                            .filter(teamItem => ['townsfolk', 'outsider'].includes(teamItem.type))
                            .map(teamItem => ({
                              ...teamItem,
                              roles: teamItem.roles.filter(role => !assignedRoleIds.has(role.id))
                            }))
                            .filter(teamItem => teamItem.roles.length > 0)
                        : roleTeams.filter(teamItem => {
                            if (isSelectingLegendary || isSelectingTraveler) return teamItem.type !== 'traveler';
                            return true;
                          });

                    // 检查是否有有效角色数据
                    const hasValidRoles = filteredTeams.some(teamItem => teamItem.roles.length > 0);

                    return hasValidRoles ? (
                      <RoleListContainer
                        teams={filteredTeams as any}
                        onRoleClick={selectRole}
                        searchTerm={roleSearchTerm}
                      />
                    ) : (
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
                  })()
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 展示信息弹窗 */}
      {showInfoModal && (
        <Modal
          title="展示信息"
          onClose={() => setShowInfoModal(false)}
          width={modalLargeWidth}
        >
          {(() => {
            const truncate = (text: string, max = 24) =>
              text.length > max ? `${text.slice(0, max)}…` : text;

            const baseOptions = [
              { key: 'choose', label: '请选择' },
              { key: 'rechoose', label: '请重新选择' },
              { key: 'no-target', label: '你不能将他作为目标' },
              { key: 'once-ability', label: '是否发动限一次能力' },
              { key: 'you-are', label: '你是' },
              { key: 'ability-applies', label: '该角色能力对你生效' },
              { key: 'this-player-is', label: '这名玩家是' },
              { key: 'they-are-minions', label: 'TA（们）是你的爪牙' },
              { key: 'they-are-demon', label: 'TA是恶魔' },
              { key: 'roles-not-in-play', label: '这些角色不在场' },
              { key: 'nominated-today', label: '你今天提名了吗' },
              { key: 'voted-today', label: '你今天投票了吗' },
            ] as const;

            const customOptions = infoCustomCards.map((card, index) => ({
              key: `custom-saved-${index}`,
              label: truncate(card.text),
              fullText: card.text,
            }));

            const options = [
              ...baseOptions.map(o => ({ ...o, fullText: o.label })),
              ...customOptions,
              { key: 'custom', label: '自定义', fullText: '自定义' },
            ];

            const showSingle = selectedInfoKey !== null;
            const selected = options.find(o => o.key === selectedInfoKey) || null;

            return (
              <div
                style={{
                  width: '100%',
                  minHeight: '260px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: showSingle ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    gap: showSingle ? '0' : '16px',
                    width: showSingle ? '70%' : '100%',
                    maxWidth: showSingle ? '640px' : '100%',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {(showSingle && selected ? [selected] : options).map(option => {
                    const isSelected = option.key === selectedInfoKey;
                    const isCustom = option.key === 'custom';
                    return (
                      <div
                        key={option.key}
                        onClick={() => {
                          if (!showSingle) {
                            setSelectedInfoKey(option.key);
                            if (option.key !== 'custom') {
                              setCustomInfoText('');
                            }
                          }
                        }}
                        style={{
                          minHeight: showSingle ? '140px' : '120px',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: '1px solid rgba(148, 163, 184, 0.5)',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(30, 64, 175, 0.9), rgba(15, 23, 42, 0.95))'
                            : 'rgba(15, 23, 42, 0.9)',
                          color: isSelected ? '#e5e7eb' : '#cbd5f5',
                          boxShadow: isSelected
                            ? '0 16px 40px rgba(15, 23, 42, 0.8)'
                            : '0 10px 28px rgba(15, 23, 42, 0.7)',
                          cursor: showSingle ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          transform: showSingle ? 'scale(1.03)' : 'scale(1)',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '15px',
                            lineHeight: 1.4,
                            fontWeight: 500,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {showSingle ? option.fullText : option.label}
                        </div>
                        {showSingle && isCustom && (
                          <div style={{ marginTop: '12px', width: '100%' }}>
                            <textarea
                              value={customInfoText}
                              onChange={e => setCustomInfoText(e.target.value)}
                              placeholder="自定义内容仅本局游戏有效"
                              style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(148,163,184,0.7)',
                                background: 'rgba(15,23,42,0.9)',
                                color: '#e5e7eb',
                                fontSize: '13px',
                                resize: 'vertical',
                                outline: 'none',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {showSingle && selectedInfoKey === 'custom' && (
                  <button
                    type="button"
                    onClick={() => {
                      const text = customInfoText.trim();
                      if (!text) return;
                      setInfoCustomCards(prev => [
                        ...prev,
                        { id: `custom-${Date.now()}-${prev.length}`, text },
                      ]);
                      // 返回列表并清空输入
                      setSelectedInfoKey(null);
                      setCustomInfoText('');
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '8px 18px',
                      borderRadius: '999px',
                      border: '1px solid rgba(212, 175, 55, 0.9)',
                      background: 'rgba(30, 64, 175, 0.95)',
                      color: '#fefcbf',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 6px 18px rgba(15,23,42,0.8)',
                    }}
                  >
                    <i className="fa fa-save" /> 保存
                  </button>
                )}

                {showSingle && selectedInfoKey !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInfoKey(null);
                      setCustomInfoText('');
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '8px 18px',
                      borderRadius: '999px',
                      border: '1px solid rgba(148, 163, 184, 0.7)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 14px rgba(15,23,42,0.7)',
                    }}
                  >
                    <i className="fa fa-undo" /> 更换卡片
                  </button>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* 座位设置弹窗 */}
      {showSeatSettingsModal && (
        <Modal 
          title="座位设置"
          onClose={closeSeatSettingsModal}
          width={modalSeatWidth}
        >
          {/* Tab 标签页 */}
          <div 
            className="tabs-nav"
            style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '20px',
              gap: '2px'
            }}
          >
            <button 
              className={`tab-btn ${activeSeatTab === 'rename' ? 'active' : ''}`}
              onClick={() => setActiveSeatTab('rename')}
              style={{
                flex: 1,
                background: activeSeatTab === 'rename' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(45, 55, 72, 0.8)',
                color: activeSeatTab === 'rename' ? '#d4af37' : '#9ca3af',
                border: 'none',
                padding: '12px 16px',
                borderRadius: activeSeatTab === 'rename' ? '8px 8px 0 0' : '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '14px',
                fontWeight: activeSeatTab === 'rename' ? '600' : '500',
                transition: 'all 0.3s ease'
              }}
            >
              <i className="fa fa-pencil"></i> 改名
            </button>
            <button 
              className={`tab-btn ${activeSeatTab === 'remove' ? 'active' : ''}`}
              onClick={() => setActiveSeatTab('remove')}
              style={{
                flex: 1,
                background: activeSeatTab === 'remove' ? 'rgba(245, 101, 101, 0.2)' : 'rgba(45, 55, 72, 0.8)',
                color: activeSeatTab === 'remove' ? '#f56565' : '#9ca3af',
                border: 'none',
                padding: '12px 16px',
                borderRadius: activeSeatTab === 'remove' ? '8px 8px 0 0' : '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '14px',
                fontWeight: activeSeatTab === 'remove' ? '600' : '500',
                transition: 'all 0.3s ease'
              }}
            >
              <i className="fa fa-trash"></i> 移除
            </button>
            <button 
              className={`tab-btn ${activeSeatTab === 'swap' ? 'active' : ''}`}
              onClick={() => setActiveSeatTab('swap')}
              style={{
                flex: 1,
                background: activeSeatTab === 'swap' ? 'rgba(66, 153, 225, 0.2)' : 'rgba(45, 55, 72, 0.8)',
                color: activeSeatTab === 'swap' ? '#4299e1' : '#9ca3af',
                border: 'none',
                padding: '12px 16px',
                borderRadius: activeSeatTab === 'swap' ? '8px 8px 0 0' : '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '14px',
                fontWeight: activeSeatTab === 'swap' ? '600' : '500',
                transition: 'all 0.3s ease'
              }}
            >
              <i className="fa fa-exchange"></i> 换座
            </button>
          </div>

          {/* 改名 Tab 内容 */}
          {activeSeatTab === 'rename' && (
            <div id="renameTab" className="settings-group">
              <div 
                className="settings-item"
                style={{
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label 
                  className="settings-label"
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#e5e7eb',
                    marginBottom: '4px'
                  }}
                >
                  座位名称
                </label>
                <input 
                  type="text" 
                  id="seatNameInput" 
                  value={seatNameInput}
                  onChange={(e) => setSeatNameInput(e.target.value)}
                  className="input-dark"
                  placeholder="请输入玩家姓名..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '8px',
                    background: 'rgba(45, 55, 72, 0.8)',
                    color: 'white',
                    fontSize: '14px',
                    transition: 'all 0.3s ease',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)'
                  }}
                />
              </div>
              <button 
                id="renameSeatBtn" 
                onClick={handleRenameSeat}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(212, 175, 55, 0.2))',
                  color: '#d4af37',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)'
                }}
              >
                <i className="fa fa-check"></i> 确认改名
              </button>
            </div>
          )}

          {/* 移除 Tab 内容 */}
          {activeSeatTab === 'remove' && (
            <div id="removeTab" className="settings-group">
              <div 
                style={{
                  color: '#e2e8f0', 
                  marginBottom: '24px', 
                  textAlign: 'center',
                  padding: '20px',
                  background: 'rgba(245, 101, 101, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 101, 101, 0.3)'
                }}
              >
                <p 
                  style={{
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    color: '#f87171',
                    marginBottom: '12px'
                  }}
                >
                  确定要移除这个座位吗？
                </p>
                <p 
                  style={{
                    fontSize: '13px', 
                    color: '#94a3b8',
                    lineHeight: '1.4'
                  }}
                >
                  移除后，后续座位的序号会自动调整。
                  此操作不可撤销，请谨慎操作。
                </p>
              </div>
              <button 
                id="removeSeatBtn" 
                onClick={handleRemoveSeat}
                className="btn btn-danger"
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, rgba(245, 101, 101, 0.3), rgba(245, 101, 101, 0.2))',
                  color: '#f56565',
                  border: '1px solid rgba(245, 101, 101, 0.4)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(245, 101, 101, 0.2)'
                }}
              >
                <i className="fa fa-trash"></i> 确认移除
              </button>
            </div>
          )}

          {/* 换座 Tab 内容 */}
          {activeSeatTab === 'swap' && (
            <div id="swapTab" className="settings-group">
              <div 
                style={{
                  color: swapStatus.includes('已成功交换') ? '#48bb78' : '#94a3b8', 
                  fontSize: '14px', 
                  marginBottom: '20px', 
                  textAlign: 'center',
                  padding: '12px',
                  background: swapStatus.includes('已成功交换') ? 'rgba(72, 187, 120, 0.1)' : 'rgba(66, 153, 225, 0.1)',
                  borderRadius: '8px',
                  border: swapStatus.includes('已成功交换') ? '1px solid rgba(72, 187, 120, 0.3)' : '1px solid rgba(66, 153, 225, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                {swapStatus || '请选择要交换的目标座位'}
              </div>
              <div 
                id="swapSeatContainer" 
                style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '12px',
                  justifyContent: 'center',
                  padding: '12px',
                  background: 'rgba(45, 55, 72, 0.6)',
                  borderRadius: '8px',
                  border: '1px solid rgba(66, 153, 225, 0.3)'
                }}
              >
                {seatState.seats.map((seat, seatIndex) => (
                  <div 
                    key={`swap-seat-${seat.id}`}
                    onClick={() => handleSwapSeats(currentSeatIndex, seatIndex)}
                    style={{
                      padding: '10px 16px',
                      background: seatIndex === currentSeatIndex 
                        ? 'rgba(245, 101, 101, 0.2)' 
                        : 'rgba(66, 153, 225, 0.1)',
                      border: '1px solid',
                      borderColor: seatIndex === currentSeatIndex 
                        ? 'rgba(245, 101, 101, 0.5)' 
                        : 'rgba(66, 153, 225, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: seatIndex === currentSeatIndex ? '600' : '500',
                      transition: 'all 0.3s ease',
                      boxShadow: seatIndex === currentSeatIndex 
                        ? '0 2px 8px rgba(245, 101, 101, 0.3)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minWidth: '80px',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (seatIndex !== currentSeatIndex) {
                        e.currentTarget.style.background = 'rgba(66, 153, 225, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(66, 153, 225, 0.6)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (seatIndex !== currentSeatIndex) {
                        e.currentTarget.style.background = 'rgba(66, 153, 225, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(66, 153, 225, 0.3)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    <div 
                      style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: seatIndex === currentSeatIndex ? '#f56565' : '#4299e1',
                        marginBottom: '2px'
                      }}
                    >
                      {seatIndex + 1}
                    </div>
                    <div 
                      style={{
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.8)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100px'
                      }}
                    >
                      {seat.playerName || '空座位'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* 角色分配弹窗 */}
      {showRoleDistributionModal && (
        <Modal 
          title={`为 ${seatState.seats.length} 名玩家分配角色`}
          onClose={closeRoleDistributionModal}
          width={modalLargeWidth}
        >
          {/* 操作按钮 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 20px', 
              gap: '20px', 
              marginBottom: '8px', 
              justifyContent: 'center',
              position: 'sticky',
              top: '0',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  onClick={randomizeRoles} 
                  className="btn btn-primary"
                  style={{ padding: '5px 12px', fontSize: '13px' }}
                >
                  <i className="fa fa-random"></i> 随机角色
                </button>
                <button 
                  onClick={distributeRoles} 
                  className="btn btn-secondary" 
                  disabled={!canDistributeRoles}
                  style={{ 
                    padding: '5px 12px', 
                    fontSize: '13px',
                    border: '1px solid transparent',
                    ...( !canDistributeRoles ? { 
                      opacity: '0.5', 
                      cursor: 'not-allowed',
                      border: '1px solid #4a5568'
                    } : {})
                  }}
                  title={getDistributionButtonTooltip()}
                >
                  <i className="fa fa-check"></i> 分配角色
                </button>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '13px', 
                  color: '#e5e7eb',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="checkbox" 
                    checked={enableMultiSelect} 
                    onChange={(e) => {
                      const newEnableMultiSelect = e.target.checked;
                      setEnableMultiSelect(newEnableMultiSelect);
                      
                      if (newEnableMultiSelect) {
                        // 切换到多选模式：保留当前选中的角色，每个选中角色数量设为1
                        const newCounts = new Map<string, number>();
                        selectedRoleIds.forEach(id => {
                          newCounts.set(id, 1);
                        });
                        setSelectedRoleCounts(newCounts);
                      } else {
                        // 切换回单选模式：将多选中有数量的角色转换为选中状态
                        const newSelectedIds = new Set<string>();
                        selectedRoleCounts.forEach((count, id) => {
                          if (count > 0) {
                            newSelectedIds.add(id);
                          }
                        });
                        setSelectedRoleIds(newSelectedIds);
                        // 清除多选计数
                        setSelectedRoleCounts(new Map());
                      }
                    }}
                    style={{ 
                      width: '16px', 
                      height: '16px',
                      accentColor: '#4299e1'
                    }}
                  />
                  多选模式
                </label>
                {/* 搜索输入框：仅当角色数>50时显示 */}
                {totalRoleCount > 50 && (
                <input
                  type="text"
                  placeholder="搜索角色"
                  value={roleSearchTerm}
                  onChange={(e) => setRoleSearchTerm(e.target.value)}
                  style={{
                    height: '30px',
                    minWidth: '150px',
                    padding: '0 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(148, 163, 184, 0.8)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#e5e7eb',
                    fontSize: '13px',
                    outline: 'none',
                    marginLeft: '10px',
                  }}
                />
                )}
              </div>
            </div>

            {/* 角色内容区域 */}
            <div className="role-distribution-content" style={{ overflowY: 'auto', padding: `${designPx(5)} ${designPx(20)}` }}>
              <RoleListContainer
                teams={roleTeams}
                selectedRoleIds={selectedRoleIds}
                selectedRoleCounts={selectedRoleCounts}
                enableMultiSelect={enableMultiSelect}
                onRoleToggle={toggleRoleSelection}
                showCount={true}
                calculatedRoleCounts={calculatedRoleCounts}
                gameConfigObj={gameConfigObj}
                searchTerm={roleSearchTerm}
              />
            </div>
        </Modal>
      )}

      {/* 剧本必选提示弹窗 */}
      {showScriptRequiredModal && (
        <Modal
          title="提示"
          onClose={() => setShowScriptRequiredModal(false)}
          width={modalSmallWidth}
          height="auto"
        >
          <div style={{
            padding: '10px 20px 30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px'
          }}>
            <div style={{
              fontSize: '18px',
              color: '#e2e8f0',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8V12" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16H12.01" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>请先选择剧本</span>
            </div>
            <button
              onClick={() => {
                setShowScriptRequiredModal(false);
                setShowScriptSelector(true);
              }}
              style={{
                padding: '10px 32px',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                color: '#d4af37',
                border: '1px solid #d4af37',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 0 10px rgba(212, 175, 55, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.2)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(212, 175, 55, 0.3)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(212, 175, 55, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              去选择剧本
            </button>
          </div>
        </Modal>
      )}

      {/* 剧本选择弹窗 */}
      {showScriptSelector && (
        <ScriptSelector 
          onClose={closeScriptSelector}
          onSelect={handleScriptSelect}
          onUpload={handleScriptUpload}
          initialSearchTerm={scriptSelectorSearchTerm}
          initialSelectedType={scriptSelectorSelectedType}
          onSearchTermChange={setScriptSelectorSearchTerm}
          onSelectedTypeChange={setScriptSelectorSelectedType}
        />
      )}

      {/* 提示标记选择弹窗 */}
      {showStatusModal && (
        <Modal 
          title="添加提示标记"
          onClose={closeStatusModal}
          width={modalMediumWidth}
          height="auto"
        >
          <div>
            {/* 生死和阵营切换按钮 */}
            {currentStatusSeatIndex >= 0 && seatState.seats[currentStatusSeatIndex]?.role && (
              <div style={{ 
                display: 'flex', 
                gap: '25px', 
                marginBottom: '25px', 
                justifyContent: 'center',
                padding: '15px',
                borderRadius: '15px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      toggleDeathStatus(currentStatusSeatIndex);
                      closeStatusModal();
                    }}
                    title={seatState.seats[currentStatusSeatIndex].isDead ? '设为存活' : '设为死亡'}
                    style={{
                      width: '65px',
                      height: '65px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: seatState.seats[currentStatusSeatIndex].isDead ? '#4a5568' : '#c53030',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      fontSize: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)';
                    }}
                  >
                    <i className={`fa ${seatState.seats[currentStatusSeatIndex].isDead ? 'fa-heart' : 'fa-skull'}`}></i>
                  </button>
                  <span style={{ fontSize: '11px', color: '#a0aec0', fontWeight: '500' }}>
                    {seatState.seats[currentStatusSeatIndex].isDead ? '存活' : '死亡'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      toggleFlipStatus(currentStatusSeatIndex);
                      closeStatusModal();
                    }}
                    title={seatState.seats[currentStatusSeatIndex].isFlipped ? '还原阵营' : '反转阵营'}
                    style={{
                      width: '65px',
                      height: '65px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: seatState.seats[currentStatusSeatIndex].isFlipped ? '#b7791f' : '#2b6cb0',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      fontSize: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)';
                    }}
                  >
                    <i className="fa fa-sync-alt"></i>
                  </button>
                  <span style={{ fontSize: '11px', color: '#a0aec0', fontWeight: '500' }}>
                    {seatState.seats[currentStatusSeatIndex].isFlipped ? '还原' : '反转'}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              {availableStatuses.map((status, index) => (
                <StatusToken
                  key={`status-${status.name}-${index}`}
                  role={status.role}
                  statusName={status.name}
                  size={75}
                  onClick={() => selectStatus(status)}
                />
              ))}
              <StatusToken
                role={{
                  id: 'custom_role',
                  name: '自定义',
                  team: 'townsfolk',
                  ability: '',
                  image: 'image/custom_status.webp',
                  firstNight: 0,
                  otherNight: 0,
                  setup: false,
                  reminders: [],
                  remindersGlobal: [],
                  firstNightReminder: '',
                  otherNightReminder: '',
                  name_eng: '',
                  edition: 'custom'
                }}
                statusName="自定义"
                size={75}
                onClick={() => {
                  setShowStatusModal(false);
                  setShowCustomStatusModal(true);
                  setCustomStatusText('');
                }}
              />
              {availableStatuses.length === 0 && (
                <div style={{ color: '#9ca3af', fontSize: '14px', padding: '20px', textAlign: 'center', width: '100%' }}>
                  暂无可用状态
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 自定义提示标记输入弹窗 */}
      {showCustomStatusModal && (
        <Modal
          title="自定义提示标记"
          onClose={() => {
            setShowCustomStatusModal(false);
            setCustomStatusText('');
          }}
          width={modalCompactWidth}
          height="auto"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
            <textarea
              value={customStatusText}
              onChange={(e) => setCustomStatusText(e.target.value)}
              placeholder="请输入自定义标签"
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '12px',
                background: 'rgba(45, 55, 72, 0.8)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.5'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCustomStatusModal(false);
                  setCustomStatusText('');
                }}
                style={{
                  padding: '10px 24px',
                  background: 'rgba(74, 85, 104, 0.5)',
                  border: '1px solid rgba(74, 85, 104, 0.6)',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(74, 85, 104, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(74, 85, 104, 0.5)';
                }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (customStatusText.trim()) {
                    const currentPhase = appState.history[appState.currentPhaseIndex];
                    const statusWithTime = {
                      name: customStatusText.trim(),
                      type: 'custom' as const,
                      addedAt: {
                        phase: currentPhase.type,
                        count: currentPhase.count
                      }
                    };
                    addStatus(currentStatusSeatIndex, statusWithTime as any);
                    setShowCustomStatusModal(false);
                    setCustomStatusText('');
                  }
                }}
                disabled={!customStatusText.trim()}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(212, 175, 55, 0.2))',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  borderRadius: '8px',
                  color: '#d4af37',
                  cursor: customStatusText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  opacity: customStatusText.trim() ? 1 : 0.5
                }}
                onMouseEnter={(e) => {
                  if (customStatusText.trim()) {
                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (customStatusText.trim()) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(212, 175, 55, 0.2))';
                  }
                }}
              >
                确认
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 座位面板 - 在App级别渲染，确保最高层级 */}
      {showSeatPanelIndex >= 0 && (
        <SeatPanel
          seatIndex={showSeatPanelIndex}
          playerName={seatState.seats[showSeatPanelIndex]?.playerName || ''}
          isVisible={true}
          position={{ x: 0, y: 0 }} // 位置将在组件内部计算
          onRename={handlePanelRenameSeat}
          onRemove={handlePanelRemoveSeat}
          onAddSeatBefore={handleAddSeatBefore}
          onAddSeatAfter={handleAddSeatAfter}
          onSwap={handleSwapSeat}
          onClose={handleCloseSeatPanel}
          scaleFactor={scaleFactor}
        />
      )}

      {/* 改名弹窗 */}
      {showRenameModal && currentSeatIndex >= 0 && (
        <RenameModal
          seatId={seatState.seats[currentSeatIndex].id}
          currentName={seatState.seats[currentSeatIndex].playerName}
          isOpen={showRenameModal}
          onConfirm={handleRenameConfirm}
          onCancel={() => {
            setShowRenameModal(false);
            setCurrentSeatIndex(-1);
          }}
        />
      )}

      {/* 移除确认弹窗 */}
      {showRemoveConfirmModal && currentSeatIndex >= 0 && (
        <RemoveConfirmModal
          seatId={seatState.seats[currentSeatIndex].id}
          isOpen={showRemoveConfirmModal}
          onConfirm={handleRemoveConfirm}
          onCancel={() => {
            setShowRemoveConfirmModal(false);
            setCurrentSeatIndex(-1);
          }}
        />
      )}

      {/* 通用确认弹窗 */}
      {showConfirmModal && (
        <ConfirmModal
          isOpen={showConfirmModal}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          confirmButtonRef={confirmModalRef}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {/* 更换魔典背景弹窗 */}
      {showBackgroundModal && (
        <Suspense fallback={
          <div style={{ color: '#d4af37', textAlign: 'center', padding: '20px' }}>
            <i className="fa fa-spinner fa-spin" /> 正在加载背景设置...
          </div>
        }>
          <BackgroundModal
            isOpen={showBackgroundModal}
            onConfirm={(dayImage, nightImage) => {
              appDispatch({ type: 'SET_DAY_BACKGROUND', payload: dayImage || '' });
              appDispatch({ type: 'SET_NIGHT_BACKGROUND', payload: nightImage || '' });
              setShowBackgroundModal(false);
            }}
            onCancel={() => {
              setShowBackgroundModal(false);
            }}
          />
        </Suspense>
      )}

      {/* Toast 通知 */}
      {appState.toasts.map((toast) => (
        <Toast 
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => {
            appDispatch({ type: 'REMOVE_TOAST', payload: toast.id });
          }}
        />
      ))}

      {/* 版本日志弹窗 */}
      {showVersionLog && (
        <Modal
          title="版本迭代日志"
          onClose={() => setShowVersionLog(false)}
          width={designPx(600)}
          height="70%"
        >
          <div style={{
            padding: '20px',
            color: '#e2e8f0',
            fontFamily: '"Noto Serif SC", serif'
          }}>
            {isVersionLogLoading && !versionLogs && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#d4af37' }}>
                <i className="fa fa-spinner fa-spin" /> 正在加载版本日志...
              </div>
            )}
            {!isVersionLogLoading && versionLogs && versionLogs.map((log: any, index: number) => (
              <div key={log.version} style={{
                marginBottom: '24px',
                borderBottom: index < versionLogs.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                paddingBottom: index < versionLogs.length - 1 ? '24px' : '0'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d4af37' }}>
                    {log.version}
                  </div>
                  <div style={{ fontSize: '12px', color: '#718096' }}>
                    {log.date}
                  </div>
                </div>
                
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px', color: '#edf2f7' }}>
                  {log.title}
                </div>

                {log.content.map((section: any, sIndex: number) => (
                  <div key={sIndex} style={{ marginBottom: '16px' }}>
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#90cdf4', 
                      marginBottom: '8px',
                      fontWeight: 'bold'
                    }}>
                      {section.title}
                    </div>
                    <ul style={{ 
                      margin: '0', 
                      paddingLeft: '20px', 
                      listStyleType: 'disc',
                      color: '#cbd5e0' 
                    }}>
                      {section.items.map((item: any, iIndex: number) => (
                        <li key={iIndex} style={{ marginBottom: '4px', fontSize: '13px', lineHeight: '1.6' }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}
      {showExportReview && (
        <ExportReviewErrorBoundary onClose={() => setShowExportReview(false)}>
          <Suspense fallback={
            <div style={{ color: '#d4af37', textAlign: 'center', padding: '20px' }}>
              <i className="fa fa-spinner fa-spin" /> 正在加载导出复盘...
            </div>
          }>
            <ExportReview
              appState={appState}
              phaseNotes={phaseNotes}
              phaseCustomNotes={phaseCustomNotes}
              onClose={() => setShowExportReview(false)}
            />
          </Suspense>
        </ExportReviewErrorBoundary>
      )}
    </div>
  );
}

// 应用入口组件
function App() {
  // 根据 BASE_URL 设置弹窗背景图路径，避免开发环境 base 为 / 时写死 /blood-on-the-clocktower/... 导致 404
  useEffect(() => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
    const prefix = base ? `${base}/` : '/';
    const modalBg = `url('${prefix}image/tanchuang.webp')`;
    document.documentElement.style.setProperty('--modal-bg-url', modalBg);
  }, []);

  return (
    <AppProvider>
      <SeatProvider>
        <AppContent />
      </SeatProvider>
    </AppProvider>
  );
}

export default App;
