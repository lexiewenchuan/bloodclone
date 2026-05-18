import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Seat, RoleData, Status } from '../types';

// 座位状态类型
interface SeatState {
  seats: Seat[];
  nextId: number;
}

// 座位操作类型
type SeatAction =
  | { type: 'INIT_SEATS'; payload: number }
  | { type: 'ADD_SEAT' }
  | { type: 'REMOVE_SEAT' }
  | { type: 'REMOVE_SEAT_AT'; payload: number }
  | { type: 'ADD_SEAT_BEFORE'; payload: number }
  | { type: 'ADD_SEAT_AFTER'; payload: number }
  | { type: 'CLEAR_SEATS' }
  | { type: 'RESET_SEATS' }
  | { type: 'RENAME_SEAT'; payload: { index: number; name: string } }
  | { type: 'SWAP_SEATS'; payload: { index1: number; index2: number } }
  | { type: 'UPDATE_SEAT_ROLE'; payload: { index: number; role: RoleData | null } }
  | { type: 'TOGGLE_DEATH_STATUS'; payload: number }
  | { type: 'TOGGLE_VOTE_STATUS'; payload: number }
  | { type: 'TOGGLE_FLIP_STATUS'; payload: number }
  | { type: 'ADD_STATUS'; payload: { index: number; status: Status } }
  | { type: 'REMOVE_STATUS'; payload: { index: number; statusName: string; roleId: string } }
  | { type: 'CLEAR_STATUSES'; payload: number }
  | { type: 'SYNC_SEATS'; payload: Seat[] };

// 新建/重置座位时的默认玩家状态
// 说明：
// - 生死：统一重置为存活（isDead = false）
// - 阵营：暂不直接写值，由「角色初始阵营 + 翻转状态」推导，alignment 先留空
// - 拥有能力 / 认知覆盖 / 健康：先留空，为以后拓展使用
const defaultSeatFields = {
  isDead: false,
  hasVote: true,
  isFlipped: false,
  alignment: undefined as any,
  abilityRole: null as RoleData | null,
  perceivedRole: null as RoleData | null,
  health: undefined as any,
  statuses: [] as Status[],
};

// 初始状态
const initialState: SeatState = {
  seats: Array.from({ length: 0 }, (_, i) => ({
    id: i + 1,
    playerName: `玩家 ${i + 1}`,
    role: null,
    roleName: '',
    index: i,
    ...defaultSeatFields,
  })),
  nextId: 1,
};

// Reducer 函数
function seatReducer(state: SeatState, action: SeatAction): SeatState {
  switch (action.type) {
    case 'INIT_SEATS':
      return {
        seats: Array.from({ length: action.payload }, (_, i) => ({
          id: i + 1,
          playerName: '',
          role: null,
          roleName: '',
          index: i,
          ...defaultSeatFields,
        })),
        nextId: action.payload + 1,
      };

    case 'ADD_SEAT':
      const newId = state.seats.length + 1;
      return {
        ...state,
        seats: [
          ...state.seats,
          {
            id: newId,
            playerName: '',
            role: null,
            roleName: '',
            index: state.seats.length,
            ...defaultSeatFields,
          },
        ],
        nextId: newId + 1,
      };

    case 'REMOVE_SEAT':
      if (state.seats.length === 0) return state;
      return {
        ...state,
        seats: state.seats.slice(0, -1).map((seat, index) => ({
          ...seat,
          index,
        })),
      };

    case 'REMOVE_SEAT_AT':
      return {
        ...state,
        seats: state.seats.filter((_, index) => index !== action.payload).map((seat, index) => ({
          ...seat,
          index,
        })),
      };

    case 'ADD_SEAT_BEFORE': {
      const targetIndex = action.payload;
      const newSeat: Seat = {
        id: state.nextId,
        playerName: '',
        role: null,
        roleName: '',
        index: targetIndex,
        ...defaultSeatFields,
      };
      
      const newSeats = [...state.seats];
      newSeats.splice(targetIndex, 0, newSeat);
      
      return {
        ...state,
        seats: newSeats.map((seat, index) => ({ ...seat, index })),
        nextId: state.nextId + 1,
      };
    }

    case 'ADD_SEAT_AFTER': {
      const targetIndex = action.payload + 1;
      const newSeat: Seat = {
        id: state.nextId,
        playerName: '',
        role: null,
        roleName: '',
        index: targetIndex,
        ...defaultSeatFields,
      };
      
      const newSeats = [...state.seats];
      newSeats.splice(targetIndex, 0, newSeat);
      
      return {
        ...state,
        seats: newSeats.map((seat, index) => ({ ...seat, index })),
        nextId: state.nextId + 1,
      };
    }

    case 'CLEAR_SEATS':
      return {
        seats: [],
        nextId: 1,
      };

    case 'RESET_SEATS':
      // 保持座位数量和玩家名称，清除角色、状态、死亡状态等
      return {
        ...state,
        seats: state.seats.map(seat => ({
          ...seat,
          role: null,
          roleName: '',
          ...defaultSeatFields,
        }))
      };

    case 'RENAME_SEAT':
      return {
        ...state,
        seats: state.seats.map((seat, index) =>
          index === action.payload.index
            ? { ...seat, playerName: action.payload.name }
            : seat
        ),
      };

    case 'SWAP_SEATS':
      const newSeats = [...state.seats];
      // 保存两个座位的原始index
      const index1 = action.payload.index1;
      const index2 = action.payload.index2;
      // 保存两个座位的内容（除了index）
      const seat1 = { ...newSeats[index1] };
      const seat2 = { ...newSeats[index2] };
      // 交换内容，但保持原始index
      newSeats[index1] = {
        ...seat2,
        index: index1, // 保持原始index
        id: newSeats[index1].id // 保持原始id
      };
      newSeats[index2] = {
        ...seat1,
        index: index2, // 保持原始index
        id: newSeats[index2].id // 保持原始id
      };
      return {
        ...state,
        seats: newSeats,
      };

    case 'UPDATE_SEAT_ROLE':
      return {
        ...state,
        seats: state.seats.map((seat, index) =>
          index === action.payload.index
            ? { 
                ...seat, 
                role: action.payload.role, 
                roleName: action.payload.role?.name || '',
                isFlipped: false, // 切换角色后阵营自动转变（重置为默认）
                isDead: false,     // 所有玩家初始存活状态
                hasVote: true      // 重置投票状态
              }
            : seat
        ),
      };

    case 'TOGGLE_DEATH_STATUS':
      return {
        ...state,
        seats: state.seats.map((seat, index) => {
          if (index !== action.payload) return seat;
          const newIsDead = !seat.isDead;
          return {
            ...seat,
            isDead: newIsDead,
            // 如果复活（isDead变为false），则恢复投票标记
            hasVote: newIsDead ? seat.hasVote : true
          };
        }),
      };

    case 'TOGGLE_VOTE_STATUS':
      return {
        ...state,
        seats: state.seats.map((seat, index) =>
          index === action.payload
            ? { ...seat, hasVote: !seat.hasVote }
            : seat
        ),
      };

    case 'TOGGLE_FLIP_STATUS':
      return {
        ...state,
        seats: state.seats.map((seat, index) =>
          index === action.payload
            ? { ...seat, isFlipped: !seat.isFlipped }
            : seat
        ),
      };

    case 'ADD_STATUS': {
      const { index: targetIndex, status } = action.payload;
      const isDeathToken = status.name === '死亡'; // 精准匹配：提示标记「死亡」触发玩家置为死亡
      return {
        ...state,
        seats: state.seats.map((seat, index) =>
          index === targetIndex
            ? {
                ...seat,
                statuses: [...seat.statuses, status],
                ...(isDeathToken ? { isDead: true } : {}),
              }
            : seat
        ),
      };
    }

    case 'REMOVE_STATUS': {
      const { index: targetIndex, statusName, roleId } = action.payload;
      return {
        ...state,
        seats: state.seats.map((seat, index) => {
          if (index !== targetIndex) return seat;
          const nextStatuses = seat.statuses.filter((s) => {
            if (s.type === 'custom') return s.name !== statusName;
            return !(s.name === statusName && s.role?.id === roleId);
          });
          const hadDeathRemoved = statusName === '死亡' && seat.statuses.some(s => s.name === '死亡');
          const stillHasDeath = nextStatuses.some(s => s.name === '死亡');
          return {
            ...seat,
            statuses: nextStatuses,
            ...(hadDeathRemoved && !stillHasDeath ? { isDead: false } : {}),
          };
        }),
      };
    }

    case 'CLEAR_STATUSES':
      return {
        ...state,
        seats: state.seats.map((seat, index) =>
          index === action.payload ? { ...seat, statuses: [] } : seat
        ),
      };

    case 'SYNC_SEATS':
      return {
        ...state,
        seats: action.payload,
        nextId: Math.max(...action.payload.map(s => s.id), 0) + 1
      };

    default:
      return state;
  }
}

// Context 类型
interface SeatContextType {
  state: SeatState;
  dispatch: React.Dispatch<SeatAction>;
  addSeat: () => void;
  removeSeat: () => void;
  removeSeatAt: (index: number) => void;
  clearSeats: () => void;
  renameSeat: (index: number, name: string) => void;
  swapSeats: (index1: number, index2: number) => void;
  updateSeatRole: (index: number, role: RoleData | null) => void;
  toggleDeathStatus: (index: number) => void;
  toggleVoteStatus: (index: number) => void;
  toggleFlipStatus: (index: number) => void;
  addStatus: (index: number, status: Status) => void;
  removeStatus: (index: number, statusName: string, roleId: string) => void;
  clearStatuses: (index: number) => void;
  resetSeats: () => void;
  initSeats: (count: number) => void;
}

// 创建 Context
const SeatContext = createContext<SeatContextType | undefined>(undefined);

// Provider 组件
interface SeatProviderProps {
  children: ReactNode;
}

export function SeatProvider({ children }: SeatProviderProps) {
  const [state, dispatch] = useReducer(seatReducer, initialState);

  // 初始化座位
  const initSeats = (count: number) => {
    dispatch({ type: 'INIT_SEATS', payload: count });
  };

  // 添加座位
  const addSeat = () => {
    dispatch({ type: 'ADD_SEAT' });
  };

  // 移除座位
  const removeSeat = () => {
    dispatch({ type: 'REMOVE_SEAT' });
  };

  // 移除指定座位
  const removeSeatAt = (index: number) => {
    dispatch({ type: 'REMOVE_SEAT_AT', payload: index });
  };

  // 清除座位
  const clearSeats = () => {
    dispatch({ type: 'CLEAR_SEATS' });
  };

  // 重命名座位
  const renameSeat = (index: number, name: string) => {
    dispatch({ type: 'RENAME_SEAT', payload: { index, name } });
  };

  // 交换座位
  const swapSeats = (index1: number, index2: number) => {
    dispatch({ type: 'SWAP_SEATS', payload: { index1, index2 } });
  };

  // 更新座位角色
  const updateSeatRole = (index: number, role: RoleData | null) => {
    dispatch({ type: 'UPDATE_SEAT_ROLE', payload: { index, role } });
  };

  // 切换死亡状态
  const toggleDeathStatus = (index: number) => {
    dispatch({ type: 'TOGGLE_DEATH_STATUS', payload: index });
  };

  // 切换投票状态
  const toggleVoteStatus = (index: number) => {
    dispatch({ type: 'TOGGLE_VOTE_STATUS', payload: index });
  };

  // 切换翻转状态
  const toggleFlipStatus = (index: number) => {
    dispatch({ type: 'TOGGLE_FLIP_STATUS', payload: index });
  };

  // 添加提示标记
  const addStatus = (index: number, status: Status) => {
    dispatch({ type: 'ADD_STATUS', payload: { index, status } });
  };

  // 移除状态
  const removeStatus = (index: number, statusName: string, roleId: string) => {
    dispatch({ type: 'REMOVE_STATUS', payload: { index, statusName, roleId } });
  };

  // 清除状态
  const clearStatuses = (index: number) => {
    dispatch({ type: 'CLEAR_STATUSES', payload: index });
  };

  // 重置座位（保持座位数量和玩家名称，清除角色和状态）
  const resetSeats = () => {
    dispatch({ type: 'RESET_SEATS' });
  };

  const value = {
    state,
    dispatch,
    addSeat,
    removeSeat,
    removeSeatAt,
    clearSeats,
    renameSeat,
    swapSeats,
    updateSeatRole,
    toggleDeathStatus,
    toggleVoteStatus,
    toggleFlipStatus,
    addStatus,
    removeStatus,
    clearStatuses,
    resetSeats,
    initSeats,
  };

  return <SeatContext.Provider value={value}>{children}</SeatContext.Provider>;
}

// 自定义 Hook
export function useSeat() {
  const context = useContext(SeatContext);
  if (context === undefined) {
    throw new Error('useSeat must be used within a SeatProvider');
  }
  return context;
}
