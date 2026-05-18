// 角色数据类型
export interface RoleData {
  id: string;
  name: string;
  team: string;
  ability: string;
  image: string;
  firstNight: number;
  otherNight: number;
  setup: boolean | number | string;
  reminders: string[];
  remindersGlobal: string[];
  firstNightReminder: string;
  otherNightReminder: string;
  name_eng: string;
  edition: string;
}

// 传奇角色数据类型
export interface FabledData {
  id: string;
  name: string;
  team: string;
  ability: string;
  image: string;
  firstNight: number;
  otherNight: number;
  setup: boolean | number | string;
  reminders: string[];
  remindersGlobal: string[];
  firstNightReminder: string;
  otherNightReminder: string;
  edition: string;
  name_eng: string;
}

// 相克角色数据类型
export interface JinxedData {
  id: string;
  name: string;
  team: string;
  ability: string;
  image: string;
  setup: boolean | number | string;
}

// 元数据类型
export interface MetaData {
  id: string;
  logo: string;
  name: string;
  townsfolkName: string;
  author: string;
  type?: string;
}

// 解析结果类型
export interface ParseResult {
  meta: MetaData | null;
  townsfolk: RoleData[];
  outsider: RoleData[];
  minion: RoleData[];
  demon: RoleData[];
  fabled: FabledData[];
  traveler: FabledData[];
  jinxed: JinxedData[];
}

// 剧本信息类型
export interface ScriptInfo {
  id?: string;
  name: string;
  author: string;
  logo: string;
  type?: string;
}

// 角色团队类型
export interface RoleTeam {
  type: string;
  name: string;
  roles: (RoleData | FabledData)[];
  color: string;
}

// 游戏配置类型
export interface GameConfig {
  townsfolk: number;
  outsider: number;
  minion: number;
  demon: number;
}

// 玩家生死状态
export type LifeStatus = 'alive' | 'dead';

// 玩家阵营
export type Alignment = 'good' | 'evil';

// 玩家健康状态（清醒 / 中毒 / 醉酒）
export type HealthStatus = 'sober' | 'poisoned' | 'drunk';

// 座位类型（玩家状态）
export interface Seat {
  id: number;          // 座位ID
  playerName: string;  // 玩家名称
  role: RoleData | null;    // 角色数据（真实身份）
  roleName: string;    // 角色名称
  index: number;       // 座位索引
  // 生死：存活 / 死亡（与 isDead 一致：存活 = !isDead，死亡 = isDead）
  isDead: boolean;
  hasVote: boolean;    // 是否有投票标记
  // 阵营：善良 / 邪恶（isFlipped 为展示用翻转状态）
  isFlipped: boolean;
  /** 阵营：善良 | 邪恶，默认由角色 team 推导 */
  alignment?: Alignment;
  /** 拥有能力：拥有哪个具体角色的能力（可能与本座角色不同） */
  abilityRole?: RoleData | null;
  /** 认知覆盖：自以为自己是什么角色，但实际可能不是 */
  perceivedRole?: RoleData | null;
  /** 健康：清醒 | 中毒 | 醉酒 */
  health?: HealthStatus;
  statuses: Status[];  // 提示标记列表
}

// 状态类型
export interface Status {
  name: string;
  role?: RoleData;
  type: 'global' | 'local' | 'custom';
  addedAt?: {
    phase: 'night' | 'day';
    count: number;
  };
}

// Toast 通知类型
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// 状态选项类型
export interface StatusOption {
  name: string;
  role: RoleData;
  type: 'global' | 'local';
}

// 剧本选择器类型
export interface Script {
  id: string;
  name: string;
  author: string;
  type: string[];
  content: any[] | null;
  logo?: string;
  /** 剧本 JSON 相对路径；按此 path 请求时须用 utils/scriptUrl 的 buildScriptFetchUrl 构造 URL，勿手拼 */
  filePath?: string;
  isOfficial?: boolean;
  sortOrder?: number;
}

// 游戏阶段类型
export type GamePhaseType = 'night' | 'day';

export interface GamePhase {
  type: GamePhaseType;
  count: number; // 第 X 夜/天
  seats: Seat[];
  devilGuiseRoles: (RoleData | null)[];
  selectedFabledRoles: FabledData[];
  selectedTravelerRoles: FabledData[];
}

// 应用状态类型
export interface AppState {
  seats: Seat[];
  devilGuiseRoles: (RoleData | null)[];
  fabledRoles: FabledData[];
  travelerRoles: FabledData[];
  selectedFabledRoles: FabledData[];
  selectedTravelerRoles: FabledData[];
  scriptInfo: ScriptInfo;
  roles: {
    townsfolk: RoleData[];
    outsider: RoleData[];
    minion: RoleData[];
    demon: RoleData[];
  };
  currentLanguage?: string;
  toasts: Toast[];
  isLoading: boolean;
  
  // 时间线相关
  history: GamePhase[];
  currentPhaseIndex: number;
}
