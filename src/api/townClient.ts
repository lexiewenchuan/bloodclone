/**
 * 小镇 API 统一入口。
 * - 所有小镇 HTTP 请求必须在本文件中实现，且使用 getHttpBaseUrl() 拼 URL（走本站代理）。
 * - 新增接口：在此文件增加 export async function，内部只用 getHttpBaseUrl()，不要在其它文件中手写 /town/xxx 或 VITE_TOWN_API_BASE。
 * 详见 .cursor/rules/town-api.mdc 与 docs/TOWN_API_CONVENTION.md
 */
export type TownRole = 'host' | 'player';

export interface CreateTownResult {
  townId: string;
  hostToken: string;
}

export interface JoinTownResult {
  townId: string;
  userId: string;
  role: TownRole;
  seatCount: number;
}

export interface DealRolesSeatPayload {
  seatIndex: number;
  roleId: string;
  roleName: string;
  playerName: string;
  isDead: boolean;
  hasVote: boolean;
}

const BASE_URL =
  (import.meta.env && (import.meta.env as any).VITE_TOWN_API_BASE) ||
  (typeof window !== 'undefined' && (window as any).__TOWN_API_BASE__) ||
  '';

const HTTP_BASE_URL =
  (import.meta.env && (import.meta.env as any).VITE_TOWN_HTTP_BASE) ||
  BASE_URL;

/** WebSocket 专用 base（建议用 Worker 自定义域名，避免 workers.dev 被墙） */
const WS_BASE_URL =
  (import.meta.env && (import.meta.env as any).VITE_TOWN_WS_BASE) || '';

function getBaseUrl(): string {
  if (BASE_URL) return BASE_URL.replace(/\/+$/, '');
  // 默认走与前端同源，前端可通过反向代理到 Cloudflare Worker
  return '';
}

function getHttpBaseUrl(): string {
  if (HTTP_BASE_URL) return HTTP_BASE_URL.replace(/\/+$/, '');
  return getBaseUrl();
}

/** 用于 WebSocket 的 base URL：优先 VITE_TOWN_WS_BASE，否则用 API base（https->wss），否则同源 */
export function getTownWsUrl(params: { townId: string; userId?: string; hostToken?: string }): string {
  let u: string;
  if (WS_BASE_URL) {
    u = WS_BASE_URL.replace(/\/+$/, '');
    if (!/^wss?:\/\//i.test(u)) u = u.replace(/^https/, 'wss').replace(/^http/, 'ws');
  } else {
    const base = getBaseUrl() || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '');
    u = base ? base.replace(/^https/, 'wss').replace(/^http/, 'ws') : `ws://${typeof window !== 'undefined' ? window.location.host : 'localhost'}`;
  }
  const url = new URL(u + '/town/ws');
  url.searchParams.set('townId', params.townId);
  if (params.hostToken) url.searchParams.set('hostToken', params.hostToken);
  if (params.userId) url.searchParams.set('userId', params.userId);
  return url.toString();
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `请求失败: ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') {
        message = data.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function createTown(params: {
  scriptName: string;
  seatCount: number;
}): Promise<CreateTownResult> {
  const res = await fetch(`${getHttpBaseUrl()}/town/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<CreateTownResult>(res);
}

export async function joinTown(params: { townId: string }): Promise<JoinTownResult> {
  const res = await fetch(`${getHttpBaseUrl()}/town/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<JoinTownResult>(res);
}

export interface TownOccupancySeat {
  seatIndex: number;
  occupied: boolean;
}

export async function sitDown(params: {
  townId: string;
  userId: string;
  seatIndex: number;
}): Promise<void> {
  const res = await fetch(`${getHttpBaseUrl()}/town/sit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

export async function getTownOccupancy(params: {
  townId: string;
  hostToken: string;
}): Promise<{ seats: TownOccupancySeat[] }> {
  const url = `${getHttpBaseUrl()}/town/occupancy?townId=${encodeURIComponent(params.townId)}&hostToken=${encodeURIComponent(params.hostToken)}`;
  const res = await fetch(url, { method: 'GET' });
  return handleResponse<{ seats: TownOccupancySeat[] }>(res);
}

export async function leaveTown(params: {
  townId: string;
  userId: string;
}): Promise<void> {
  const res = await fetch(`${getHttpBaseUrl()}/town/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}


export async function dealRoles(params: {
  townId: string;
  hostToken: string;
  seats: DealRolesSeatPayload[];
}): Promise<void> {
  const res = await fetch(`${getHttpBaseUrl()}/town/deal-roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

/** 说书人更新小镇设置（剧本/座位数），会推送给所有已连接玩家 */
export async function updateTownSettings(params: {
  townId: string;
  hostToken: string;
  scriptName?: string;
  seatCount?: number;
}): Promise<void> {
  const res = await fetch(`${getHttpBaseUrl()}/town/update-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

/** 进入白天时由说书人调用，将本局游戏数据（角色等）推送给所有玩家 */
export async function pushGameData(params: {
  townId: string;
  hostToken: string;
  seats: DealRolesSeatPayload[];
}): Promise<void> {
  const res = await fetch(`${getHttpBaseUrl()}/town/push-game-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

/** 玩家端：获取当前座位/角色信息（与 /town/me 一致，走 HTTP 代理） */
export interface TownMeResponse {
  townId: string | null;
  scriptName: string;
  seat: {
    seatIndex: number;
    roleId: string;
    roleName: string;
    playerName: string;
    isDead: boolean;
    hasVote: boolean;
  } | null;
  mySeatIndex: number | null;
  seatCount?: number;
}

export async function getTownMe(params: { townId: string; userId: string }): Promise<TownMeResponse> {
  const url = `${getHttpBaseUrl()}/town/me?townId=${encodeURIComponent(params.townId)}&userId=${encodeURIComponent(params.userId)}`;
  const res = await fetch(url, { method: 'GET' });
  return handleResponse<TownMeResponse>(res);
}

