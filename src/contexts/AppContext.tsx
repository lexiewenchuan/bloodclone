import React, { createContext, useContext, useReducer, ReactNode, useRef, useEffect, useCallback, useMemo } from 'react';
import { RoleData, FabledData, JinxedData, ScriptInfo, Toast, StatusOption, ParseResult, Seat, GamePhase, Script } from '../types';
import { loadState, saveState } from '../utils/storage';

// 应用状态类型
interface AppState {
  seats: Seat[];
  scriptInfo: ScriptInfo;
  roles: {
    townsfolk: RoleData[];
    outsider: RoleData[];
    minion: RoleData[];
    demon: RoleData[];
  };
  fabledRoles: FabledData[];
  travelerRoles: FabledData[];
  selectedFabledRoles: FabledData[];
  selectedTravelerRoles: FabledData[];
  jinxedRoles: JinxedData[];
  devilGuiseRoles: (RoleData | null)[];
  toasts: Toast[];
  isLoading: boolean;
  
  // 剧本列表
  scripts: Script[];
  isScriptsLoading: boolean;
  failedLogos: Record<string, boolean>;
  
  // 时间线相关
  history: GamePhase[];
  currentPhaseIndex: number;
  
  // 魔典设置
  grimoireSettings: {
    dayBackgroundImage: string;
    nightBackgroundImage: string;
    hideRoleAbilities: boolean;
    hideNightInstructions: boolean;
  };
  
  // 魔典笔记
  phaseNotes: Record<string, any>;
  phaseCustomNotes: Record<string, string>;
  
  // 状态标志
  isRestored?: boolean;
}

// 应用操作类型
type AppAction =
  | { type: 'SET_SCRIPT_INFO'; payload: ScriptInfo }
  | { type: 'SET_ROLES'; payload: { townsfolk: RoleData[]; outsider: RoleData[]; minion: RoleData[]; demon: RoleData[] } }
  | { type: 'SET_FABLED_ROLES'; payload: FabledData[] }
  | { type: 'SET_TRAVELER_ROLES'; payload: FabledData[] }
  | { type: 'SET_JINXED_ROLES'; payload: JinxedData[] }
  | { type: 'ADD_SELECTED_FABLED_ROLE'; payload: FabledData }
  | { type: 'REMOVE_SELECTED_FABLED_ROLE'; payload: string }
  | { type: 'ADD_SELECTED_TRAVELER_ROLE'; payload: FabledData }
  | { type: 'REMOVE_SELECTED_TRAVELER_ROLE'; payload: string }
  | { type: 'SET_DEVIL_GUISE_ROLES'; payload: (RoleData | null)[] }
  | { type: 'UPDATE_DEVIL_GUISE_ROLE'; payload: { index: number; role: RoleData | null } }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'PARSE_SCRIPT'; payload: ParseResult }
  | { type: 'NEXT_PHASE' }
  | { type: 'MOVE_FORWARD' }
  | { type: 'PREV_PHASE' }
  | { type: 'JUMP_TO_PHASE'; payload: number }
  | { type: 'SET_SEATS'; payload: Seat[] }
  // 剧本列表相关操作
  | { type: 'SET_SCRIPTS'; payload: Script[] }
  | { type: 'SET_SCRIPTS_LOADING'; payload: boolean }
  | { type: 'MARK_LOGO_AS_FAILED'; payload: string }
  // 魔典设置相关操作
  | { type: 'SET_DAY_BACKGROUND'; payload: string }
  | { type: 'SET_NIGHT_BACKGROUND'; payload: string }
  | { type: 'TOGGLE_HIDE_ROLE_ABILITIES' }
  | { type: 'TOGGLE_HIDE_NIGHT_INSTRUCTIONS' }
  | { type: 'SET_PHASE_NOTES'; payload: Record<string, any> }
  | { type: 'SET_PHASE_CUSTOM_NOTES'; payload: Record<string, string> }
  | { type: 'RESTART_GAME'; payload: Seat[] };

// 初始状态
const initialState: AppState = {
  seats: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    playerName: `玩家 ${i + 1}`,
    role: null,
    roleName: '',
    index: i,
    isDead: false,
    hasVote: true,
    isFlipped: false,
    // 阵营 / 拥有能力 / 认知覆盖 / 健康：先留空，按需推导或后续扩展
    alignment: undefined,
    abilityRole: null,
    perceivedRole: null,
    health: undefined,
    statuses: []
  })),
  scriptInfo: {
    id: '',
    name: '请选择剧本',
    author: '未选择',
    logo: '',
  },
  roles: {
    townsfolk: [],
    outsider: [],
    minion: [],
    demon: [],
  },
  fabledRoles: [],
  travelerRoles: [],
  selectedFabledRoles: [],
  selectedTravelerRoles: [],
  jinxedRoles: [],
  devilGuiseRoles: [null, null, null],
  toasts: [],
  isLoading: false,
  
  // 剧本列表初始值
  scripts: [],
  isScriptsLoading: false,
  failedLogos: {},
  
  history: [
    {
      type: 'night',
      count: 1,
      seats: Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        playerName: `玩家 ${i + 1}`,
        role: null,
        roleName: '',
        index: i,
        isDead: false,
        hasVote: true,
        isFlipped: false,
        // 阵营 / 拥有能力 / 认知覆盖 / 健康：先留空
        alignment: undefined,
        abilityRole: null,
        perceivedRole: null,
        health: undefined,
        statuses: []
      })),
      devilGuiseRoles: [null, null, null],
      selectedFabledRoles: [],
      selectedTravelerRoles: []
    }
  ],
  currentPhaseIndex: 0,
  
  // 默认初始状态
  grimoireSettings: {
    dayBackgroundImage: `${import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL}/image/background-day.webp`,
    nightBackgroundImage: `${import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL}/image/background-night.webp`,
    hideRoleAbilities: false,
    hideNightInstructions: false,
  },
  phaseNotes: {},
  phaseCustomNotes: {}
};

// Reducer 函数
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SCRIPT_INFO':
      return {
        ...state,
        scriptInfo: action.payload,
      };

    case 'SET_ROLES':
      return {
        ...state,
        roles: action.payload,
      };

    case 'SET_FABLED_ROLES':
      return {
        ...state,
        fabledRoles: action.payload,
      };

    case 'SET_TRAVELER_ROLES':
      return {
        ...state,
        travelerRoles: action.payload,
      };

    case 'SET_JINXED_ROLES':
      return {
        ...state,
        jinxedRoles: action.payload,
      };

    case 'SET_SEATS':
      const updatedSeats = action.payload;
      const updatedHistory = [...state.history];
      updatedHistory[state.currentPhaseIndex] = {
        ...updatedHistory[state.currentPhaseIndex],
        seats: updatedSeats
      };
      return {
        ...state,
        seats: updatedSeats,
        history: updatedHistory
      };

    case 'NEXT_PHASE': {
      const currentPhase = state.history[state.currentPhaseIndex];
      let nextType: 'night' | 'day' = currentPhase.type === 'night' ? 'day' : 'night';
      let nextCount = nextType === 'night' ? currentPhase.count + 1 : currentPhase.count;

      const nextPhase: GamePhase = {
        type: nextType,
        count: nextCount,
        seats: JSON.parse(JSON.stringify(state.seats)),
        devilGuiseRoles: JSON.parse(JSON.stringify(state.devilGuiseRoles)),
        selectedFabledRoles: JSON.parse(JSON.stringify(state.selectedFabledRoles)),
        selectedTravelerRoles: JSON.parse(JSON.stringify(state.selectedTravelerRoles))
      };

      const newHistory = [...state.history.slice(0, state.currentPhaseIndex + 1), nextPhase];
      return {
        ...state,
        history: newHistory,
        currentPhaseIndex: state.currentPhaseIndex + 1,
        seats: nextPhase.seats,
        devilGuiseRoles: nextPhase.devilGuiseRoles,
        selectedFabledRoles: nextPhase.selectedFabledRoles,
        selectedTravelerRoles: nextPhase.selectedTravelerRoles
      };
    }

    case 'MOVE_FORWARD': {
      if (state.currentPhaseIndex >= state.history.length - 1) return state;
      const nextPhase = state.history[state.currentPhaseIndex + 1];
      return {
        ...state,
        currentPhaseIndex: state.currentPhaseIndex + 1,
        seats: nextPhase.seats,
        devilGuiseRoles: nextPhase.devilGuiseRoles,
        selectedFabledRoles: nextPhase.selectedFabledRoles,
        selectedTravelerRoles: nextPhase.selectedTravelerRoles
      };
    }

    case 'PREV_PHASE': {
      if (state.currentPhaseIndex <= 0) return state;
      const prevPhase = state.history[state.currentPhaseIndex - 1];
      return {
        ...state,
        currentPhaseIndex: state.currentPhaseIndex - 1,
        seats: prevPhase.seats,
        devilGuiseRoles: prevPhase.devilGuiseRoles,
        selectedFabledRoles: prevPhase.selectedFabledRoles,
        selectedTravelerRoles: prevPhase.selectedTravelerRoles
      };
    }

    case 'JUMP_TO_PHASE': {
      const targetPhase = state.history[action.payload];
      if (!targetPhase) return state;
      return {
        ...state,
        currentPhaseIndex: action.payload,
        seats: targetPhase.seats,
        devilGuiseRoles: targetPhase.devilGuiseRoles,
        selectedFabledRoles: targetPhase.selectedFabledRoles,
        selectedTravelerRoles: targetPhase.selectedTravelerRoles
      };
    }

    case 'ADD_SELECTED_FABLED_ROLE': {
      const newState = {
        ...state,
        selectedFabledRoles: [...state.selectedFabledRoles, action.payload],
      };
      // 更新当前历史快照
      const history = [...state.history];
      history[state.currentPhaseIndex] = {
        ...history[state.currentPhaseIndex],
        selectedFabledRoles: newState.selectedFabledRoles
      };
      return { ...newState, history };
    }

    case 'REMOVE_SELECTED_FABLED_ROLE': {
      const newState = {
        ...state,
        selectedFabledRoles: state.selectedFabledRoles.filter(role => role.id !== action.payload),
      };
      const history = [...state.history];
      history[state.currentPhaseIndex] = {
        ...history[state.currentPhaseIndex],
        selectedFabledRoles: newState.selectedFabledRoles
      };
      return { ...newState, history };
    }

    case 'ADD_SELECTED_TRAVELER_ROLE': {
      const newState = {
        ...state,
        selectedTravelerRoles: [...state.selectedTravelerRoles, action.payload],
      };
      const history = [...state.history];
      history[state.currentPhaseIndex] = {
        ...history[state.currentPhaseIndex],
        selectedTravelerRoles: newState.selectedTravelerRoles
      };
      return { ...newState, history };
    }

    case 'REMOVE_SELECTED_TRAVELER_ROLE': {
      const newState = {
        ...state,
        selectedTravelerRoles: state.selectedTravelerRoles.filter(role => role.id !== action.payload),
      };
      const history = [...state.history];
      history[state.currentPhaseIndex] = {
        ...history[state.currentPhaseIndex],
        selectedTravelerRoles: newState.selectedTravelerRoles
      };
      return { ...newState, history };
    }

    case 'SET_DEVIL_GUISE_ROLES': {
      const history = [...state.history];
      history[state.currentPhaseIndex] = {
        ...history[state.currentPhaseIndex],
        devilGuiseRoles: action.payload
      };
      return {
        ...state,
        devilGuiseRoles: action.payload,
        history
      };
    }

    case 'UPDATE_DEVIL_GUISE_ROLE': {
      const updatedDevilGuiseRoles = state.devilGuiseRoles.map((role, index) =>
        index === action.payload.index ? action.payload.role : role
      );
      const history = [...state.history];
      history[state.currentPhaseIndex] = {
        ...history[state.currentPhaseIndex],
        devilGuiseRoles: updatedDevilGuiseRoles
      };
      return {
        ...state,
        devilGuiseRoles: updatedDevilGuiseRoles,
        history
      };
    }

    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.payload),
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'PARSE_SCRIPT':
      return {
        ...state,
        scriptInfo: {
          id: action.payload.meta?.id || '',
          name: action.payload.meta?.name || '未知剧本',
          author: action.payload.meta?.author || '',
          logo: action.payload.meta?.logo || '',
          type: action.payload.meta?.type || '',
        },
        roles: {
          townsfolk: action.payload.townsfolk,
          outsider: action.payload.outsider,
          minion: action.payload.minion,
          demon: action.payload.demon,
        },
        fabledRoles: action.payload.fabled,
        travelerRoles: action.payload.traveler,
        jinxedRoles: action.payload.jinxed,
        selectedFabledRoles: [],
        selectedTravelerRoles: [],
        history: [
          {
            type: 'night',
            count: 1,
            seats: state.seats,
            devilGuiseRoles: [null, null, null],
            selectedFabledRoles: [],
            selectedTravelerRoles: []
          }
        ],
        devilGuiseRoles: [null, null, null],
        currentPhaseIndex: 0,
        phaseNotes: {},
        phaseCustomNotes: {}
      };

    // 魔典设置相关操作
    case 'SET_DAY_BACKGROUND':
      return {
        ...state,
        grimoireSettings: {
          ...state.grimoireSettings,
          dayBackgroundImage: action.payload
        }
      };

    case 'SET_NIGHT_BACKGROUND':
      return {
        ...state,
        grimoireSettings: {
          ...state.grimoireSettings,
          nightBackgroundImage: action.payload
        }
      };

    case 'TOGGLE_HIDE_ROLE_ABILITIES':
      return {
        ...state,
        grimoireSettings: {
          ...state.grimoireSettings,
          hideRoleAbilities: !state.grimoireSettings.hideRoleAbilities
        }
      };

    case 'TOGGLE_HIDE_NIGHT_INSTRUCTIONS':
      return {
        ...state,
        grimoireSettings: {
          ...state.grimoireSettings,
          hideNightInstructions: !state.grimoireSettings.hideNightInstructions
        }
      };

    case 'SET_PHASE_NOTES':
      return {
        ...state,
        phaseNotes: action.payload
      };

    case 'SET_PHASE_CUSTOM_NOTES':
      return {
        ...state,
        phaseCustomNotes: action.payload
      };

    case 'RESTART_GAME': {
      const newSeats = action.payload;
      // 重置时间线（清除座位 / 重置角色）时一律清空恶魔的伪装；相克规则与传奇奇遇仅随剧本变化
      const nextDevilGuise: (RoleData | null)[] = [null, null, null];
      const initialPhase: GamePhase = {
        type: 'night',
        count: 1,
        seats: newSeats,
        devilGuiseRoles: nextDevilGuise,
        selectedFabledRoles: state.selectedFabledRoles,
        selectedTravelerRoles: state.selectedTravelerRoles
      };

      return {
        ...state,
        currentPhaseIndex: 0,
        seats: newSeats,
        devilGuiseRoles: nextDevilGuise,
        history: [initialPhase],
        phaseNotes: {},
        phaseCustomNotes: {}
      };
    }

    // 剧本列表相关操作
    case 'SET_SCRIPTS':
      return {
        ...state,
        scripts: action.payload
      };

    case 'SET_SCRIPTS_LOADING':
      return {
        ...state,
        isScriptsLoading: action.payload
      };

    case 'MARK_LOGO_AS_FAILED':
      return {
        ...state,
        failedLogos: {
          ...state.failedLogos,
          [action.payload]: true
        }
      };

    default:
      return state;
  }
}

// Context 类型
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setScriptInfo: (scriptInfo: ScriptInfo) => void;
  setRoles: (roles: { townsfolk: RoleData[]; outsider: RoleData[]; minion: RoleData[]; demon: RoleData[] }) => void;
  setFabledRoles: (roles: FabledData[]) => void;
  setTravelerRoles: (roles: FabledData[]) => void;
  setJinxedRoles: (roles: JinxedData[]) => void;
  addSelectedFabledRole: (role: FabledData) => void;
  removeSelectedFabledRole: (roleId: string) => void;
  addSelectedTravelerRole: (role: FabledData) => void;
  removeSelectedTravelerRole: (roleId: string) => void;
  setDevilGuiseRoles: (roles: (RoleData | null)[]) => void;
  updateDevilGuiseRole: (index: number, role: RoleData | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setLoading: (loading: boolean) => void;
  parseScript: (parseResult: ParseResult) => void;
  calculateAvailableStatuses: (presentRoles: RoleData[]) => StatusOption[];
  
  // 剧本列表相关函数
  loadScripts: () => Promise<void>;
  markLogoAsFailed: (id: string) => void;
  
  // 魔典设置相关函数
  setDayBackground: (imageUrl: string) => void;
  setNightBackground: (imageUrl: string) => void;
  toggleHideRoleAbilities: () => void;
  toggleHideNightInstructions: () => void;
  
  // 魔典笔记相关函数
  setPhaseNotes: (notes: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  setPhaseCustomNotes: (notes: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
}

// 创建 Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider 组件
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState, (defaultState) => {
    const loaded = loadState();
    
    // 计算默认背景图路径
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
    const defaultDayBg = `${baseUrl}/image/background-day.webp`;
    const defaultNightBg = `${baseUrl}/image/background-night.webp`;

    if (loaded) {
      // 迁移旧的背景图片设置
      if (loaded.grimoireSettings) {
        // 强制修正默认背景图路径，以适应不同环境（开发环境/生产环境）
        // 如果当前保存的背景图是默认背景图（不管路径前缀是什么），都更新为当前环境的正确路径
        if (loaded.grimoireSettings.dayBackgroundImage.endsWith('image/background-day.webp') || 
            loaded.grimoireSettings.dayBackgroundImage.includes('background.webp') ||
            loaded.grimoireSettings.dayBackgroundImage.includes('day.jpeg')) {
           loaded.grimoireSettings.dayBackgroundImage = defaultDayBg;
        }
        
        if (loaded.grimoireSettings.nightBackgroundImage.endsWith('image/background-night.webp') || 
            loaded.grimoireSettings.nightBackgroundImage.includes('background.webp') ||
            loaded.grimoireSettings.nightBackgroundImage.includes('night.jpeg')) {
           loaded.grimoireSettings.nightBackgroundImage = defaultNightBg;
        }
      }

      return {
        ...defaultState,
        ...loaded,
        // 重置一些瞬态状态
        toasts: [],
        isLoading: false,
        scripts: [],
        isScriptsLoading: false,
        failedLogos: {},
        isRestored: true, // 标记为从存储恢复
      };
    }
    return defaultState;
  });

  // 监听状态变化并保存到 localStorage，使用防抖减少频繁写入
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      saveState(state);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  const toastIdRef = useRef(0);

  // 设置剧本信息
  const setScriptInfo = (scriptInfo: ScriptInfo) => {
    dispatch({ type: 'SET_SCRIPT_INFO', payload: scriptInfo });
  };

  // 设置角色数据
  const setRoles = (roles: { townsfolk: RoleData[]; outsider: RoleData[]; minion: RoleData[]; demon: RoleData[] }) => {
    dispatch({ type: 'SET_ROLES', payload: roles });
  };

  // 设置传奇角色
  const setFabledRoles = (roles: FabledData[]) => {
    dispatch({ type: 'SET_FABLED_ROLES', payload: roles });
  };

  // 设置旅行者角色
  const setTravelerRoles = (roles: FabledData[]) => {
    dispatch({ type: 'SET_TRAVELER_ROLES', payload: roles });
  };

  // 设置相克角色
  const setJinxedRoles = (roles: JinxedData[]) => {
    dispatch({ type: 'SET_JINXED_ROLES', payload: roles });
  };

  // 添加选中的传奇角色
  const addSelectedFabledRole = (role: FabledData) => {
    dispatch({ type: 'ADD_SELECTED_FABLED_ROLE', payload: role });
  };

  // 移除选中的传奇角色
  const removeSelectedFabledRole = (roleId: string) => {
    dispatch({ type: 'REMOVE_SELECTED_FABLED_ROLE', payload: roleId });
  };

  // 添加选中的旅行者角色
  const addSelectedTravelerRole = (role: FabledData) => {
    dispatch({ type: 'ADD_SELECTED_TRAVELER_ROLE', payload: role });
  };

  // 移除选中的旅行者角色
  const removeSelectedTravelerRole = (roleId: string) => {
    dispatch({ type: 'REMOVE_SELECTED_TRAVELER_ROLE', payload: roleId });
  };

  // 设置恶魔的伪装角色
  const setDevilGuiseRoles = (roles: (RoleData | null)[]) => {
    dispatch({ type: 'SET_DEVIL_GUISE_ROLES', payload: roles });
  };

  // 更新恶魔的伪装角色
  const updateDevilGuiseRole = (index: number, role: RoleData | null) => {
    dispatch({ type: 'UPDATE_DEVIL_GUISE_ROLE', payload: { index, role } });
  };

  // 显示 Toast 通知
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = toastIdRef.current++;
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
  };

  // 设置加载状态
  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  // 解析剧本
  const parseScript = (parseResult: ParseResult) => {
    dispatch({ type: 'PARSE_SCRIPT', payload: parseResult });
  };

  // 计算可用状态
  const calculateAvailableStatuses = (presentRoles: RoleData[]): StatusOption[] => {
    const statuses: StatusOption[] = [];
    
    // 收集所有角色
    const allRoles = [
      ...state.roles.townsfolk,
      ...state.roles.outsider,
      ...state.roles.minion,
      ...state.roles.demon,
      ...state.fabledRoles,
      ...state.travelerRoles,
    ];
    
    // 创建在场角色ID集合，用于快速查找
    const presentRoleIds = new Set(presentRoles.map(role => role.id));
    
    // 遍历所有角色，收集remindersGlobal和reminders
    allRoles.forEach(role => {
      // 处理remindersGlobal（剧本中就存在的状态）
      if (role.remindersGlobal && role.remindersGlobal.length > 0) {
        role.remindersGlobal.forEach(reminder => {
          statuses.push({
            name: reminder,
            role,
            type: 'global',
          });
        });
      }
      
      // 处理reminders（角色在场才存在的状态）
      if (role.reminders && role.reminders.length > 0) {
        // 只有当角色在场时才添加reminders状态
        if (presentRoleIds.has(role.id)) {
          role.reminders.forEach(reminder => {
            statuses.push({
              name: reminder,
              role,
              type: 'local',
            });
          });
        }
      }
    });
    
    // 去重
    const uniqueStatuses: StatusOption[] = [];
    const seenStatuses = new Set<string>();
    
    statuses.forEach(status => {
      const key = `${status.name}_${status.role.id}`;
      if (!seenStatuses.has(key)) {
        seenStatuses.add(key);
        uniqueStatuses.push(status);
      }
    });
    
    return uniqueStatuses;
  };

  // 剧本列表相关函数
  const loadScripts = useCallback(async () => {
    dispatch({ type: 'SET_SCRIPTS_LOADING', payload: true });
    try {
      const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      const timestamp = new Date().getTime();
      const indexPath = `${baseUrl}scripts.json?t=${timestamp}`;

      const response = await fetch(indexPath);
      if (!response.ok) {
        throw new Error(`加载索引失败: ${response.status}`);
      }
      const indexData = await response.json();
      
      if (!Array.isArray(indexData)) {
        throw new Error('索引数据格式错误: 应为数组');
      }

      const scriptsWithLogo = indexData.map((script: any, index: number) => ({
        id: script.name + (script.author ? `-${script.author}` : '') + `-${index}`,
        name: script.name,
        author: (script.author || '').trim(),
        logo: (script.logo || '').trim(),
        type: Array.isArray(script.types) ? script.types : script.types ? [script.types] : [],
        filePath: script.path, // 按 path 请求时须用 buildScriptFetchUrl(scriptUrl.ts)，勿手拼 URL
        min_players: script.min_players,
        content: null
      }));
      
      console.log('处理后的剧本数据:', scriptsWithLogo.slice(0, 3).map((s: any) => ({ name: s.name, type: s.type, filePath: s.filePath })));
      
      dispatch({ type: 'SET_SCRIPTS', payload: scriptsWithLogo });
    } catch (error) {
      console.error('加载剧本列表失败:', error);
      dispatch({ type: 'SET_SCRIPTS', payload: [] });
    } finally {
      dispatch({ type: 'SET_SCRIPTS_LOADING', payload: false });
    }
  }, []);

  const markLogoAsFailed = (id: string) => {
    dispatch({ type: 'MARK_LOGO_AS_FAILED', payload: id });
  };

  // 魔典设置相关函数
  const setDayBackground = (imageUrl: string) => {
    dispatch({ type: 'SET_DAY_BACKGROUND', payload: imageUrl });
  };

  const setNightBackground = (imageUrl: string) => {
    dispatch({ type: 'SET_NIGHT_BACKGROUND', payload: imageUrl });
  };

  const toggleHideRoleAbilities = () => {
    dispatch({ type: 'TOGGLE_HIDE_ROLE_ABILITIES' });
  };

  const toggleHideNightInstructions = () => {
    dispatch({ type: 'TOGGLE_HIDE_NIGHT_INSTRUCTIONS' });
  };

  const setPhaseNotes = (notes: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
    if (typeof notes === 'function') {
      const newNotes = notes(state.phaseNotes);
      dispatch({ type: 'SET_PHASE_NOTES', payload: newNotes });
    } else {
      dispatch({ type: 'SET_PHASE_NOTES', payload: notes });
    }
  };

  const setPhaseCustomNotes = (notes: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    if (typeof notes === 'function') {
      const newNotes = notes(state.phaseCustomNotes);
      dispatch({ type: 'SET_PHASE_CUSTOM_NOTES', payload: newNotes });
    } else {
      dispatch({ type: 'SET_PHASE_CUSTOM_NOTES', payload: notes });
    }
  };

  const value = {
    state,
    dispatch,
    setScriptInfo,
    setRoles,
    setFabledRoles,
    setTravelerRoles,
    setJinxedRoles,
    addSelectedFabledRole,
    removeSelectedFabledRole,
    addSelectedTravelerRole,
    removeSelectedTravelerRole,
    setDevilGuiseRoles,
    updateDevilGuiseRole,
    showToast,
    setLoading,
    parseScript,
    calculateAvailableStatuses,
    
    // 剧本列表相关函数
    loadScripts,
    markLogoAsFailed,
    
    // 魔典设置相关函数
    setDayBackground,
    setNightBackground,
    toggleHideRoleAbilities,
    toggleHideNightInstructions,
    
    // 魔典笔记相关函数
    setPhaseNotes,
    setPhaseCustomNotes,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// 自定义 Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
