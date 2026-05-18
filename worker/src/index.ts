export interface Env {
  TOWN_DO: DurableObjectNamespace;
  REGISTRY_DO: DurableObjectNamespace;
}

const TOWN_CODE_REGEX = /^\d{4}$/;

function parseTownCode(townId: unknown): string | null {
  const s = String(townId ?? '').trim();
  return TOWN_CODE_REGEX.test(s) ? s : null;
}

function getTownStub(env: Env, townId: string): DurableObjectStub | null {
  if (!TOWN_CODE_REGEX.test(townId)) return null;
  const id = env.TOWN_DO.idFromName('town-' + townId);
  return env.TOWN_DO.get(id);
}

interface TownPlayer {
  userId: string;
  name: string;
}

interface TownSeatDeal {
  seatIndex: number;
  roleId: string;
  roleName: string;
  playerName: string;
  isDead: boolean;
  hasVote: boolean;
}

interface TownState {
  townId: string;
  hostToken: string;
  createdAt: number;
  scriptName?: string;
  seatCount?: number;
  players: TownPlayer[];
  /** 座位号 -> 坐在该座的玩家 userId */
  seatAssignments: Record<number, string>;
  lastDeal?: {
    at: number;
    seats: TownSeatDeal[];
  };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ==================== 剧本分享相关类型与工具函数 ====================

const VALID_CORE_TEAMS = new Set(['townsfolk', 'outsider', 'minion', 'demon']);

function hasNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

interface UploadedScriptMeta {
  id?: string;
  name?: string;
  author?: string;
  logo?: string;
  type?: string | string[];
}

interface SharedScriptStoredItem {
  id: string;
  name: string;
  author: string;
  logo?: string;
  types: string[];
  data: any[];
  createdAt: number;
  fingerprint_core: string;
  fingerprint_roles: string;
  fingerprint_full: string;
}

function normalizeTeamText(team: unknown): string | null {
  if (typeof team !== 'string') return null;
  const s = team.trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  if (lower === 'townsfolk') return 'townsfolk';
  if (lower === 'outsider') return 'outsider';
  if (lower === 'minion') return 'minion';
  if (lower === 'demon') return 'demon';
  if (lower === 'fabled') return 'fabled';
  if (lower === 'traveler' || lower === 'traveller') return 'traveler';
  if (lower === 'jinx' || lower === 'jinxed') return 'jinxed';

  const noSpace = s.replace(/\s+/g, '');

  if (noSpace.includes('镇民') || noSpace.includes('好人') || noSpace.includes('善良镇民') || noSpace.includes('善良阵营')) {
    return 'townsfolk';
  }
  if (noSpace.includes('外来者') || noSpace.includes('外乡人')) {
    return 'outsider';
  }
  if (noSpace.includes('爪牙') || noSpace.includes('随从') || noSpace.includes('帮凶')) {
    return 'minion';
  }
  if (noSpace.includes('恶魔') || noSpace.includes('魔王')) {
    return 'demon';
  }
  if (noSpace.includes('传奇') || noSpace.includes('传说') || lower.includes('fabled')) {
    return 'fabled';
  }
  if (noSpace.includes('旅人') || noSpace.includes('旅客') || noSpace.includes('旅行者')) {
    return 'traveler';
  }
  if (noSpace.includes('相克') || noSpace.includes('克制') || lower.includes('jinx')) {
    return 'jinxed';
  }
  return null;
}

function extractRoleNameSetsFromUploaded(data: any): {
  coreNames: string[];
  fabledNames: string[];
  jinxedNames: string[];
} {
  const core = new Set<string>();
  const fabled = new Set<string>();
  const jinxed = new Set<string>();

  const pushFromItem = (item: any) => {
    if (!item || typeof item !== 'object') return;
    const name = (item as any).name;
    if (!hasNonEmptyText(name)) return;
    const teamNorm = normalizeTeamText((item as any).team);
    if (!teamNorm) return;
    const normName = (name as string).trim();
    if (!normName) return;
    if (teamNorm === 'fabled') {
      fabled.add(normName);
    } else if (teamNorm === 'jinxed') {
      jinxed.add(normName);
    } else if (VALID_CORE_TEAMS.has(teamNorm)) {
      core.add(normName);
    }
  };

  if (Array.isArray(data)) {
    data.forEach(pushFromItem);
  } else if (data && typeof data === 'object') {
    Object.values(data).forEach((v) => {
      if (Array.isArray(v)) {
        v.forEach(pushFromItem);
      }
    });
  }

  return {
    coreNames: Array.from(core).sort(),
    fabledNames: Array.from(fabled).sort(),
    jinxedNames: Array.from(jinxed).sort(),
  };
}

function canonicalizeJson(value: any): any {
  if (Array.isArray(value)) {
    return value.map((v) => canonicalizeJson(v));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    Object.keys(value)
      .sort()
      .forEach((k) => {
        result[k] = canonicalizeJson((value as any)[k]);
      });
    return result;
  }
  return value;
}

function computeFingerprintsForUploaded(data: any): {
  fingerprint_core: string;
  fingerprint_roles: string;
  fingerprint_full: string;
} | null {
  const { coreNames, fabledNames, jinxedNames } = extractRoleNameSetsFromUploaded(data);
  if (!coreNames.length) return null;

  const corePayload = JSON.stringify(coreNames);
  const rolesPayload = JSON.stringify({ core: coreNames, fabled: fabledNames, jinxed: jinxedNames });
  const canonical = canonicalizeJson(data);
  const fullPayload = JSON.stringify(canonical);

  const fpCore = crypto.subtle ? '' : ''; // placeholder to satisfy TS, real hashing below

  // Cloudflare Workers 里没有 Node 的 crypto.hashSync，这里用 Web Crypto 的 digest + 手写 hex 辅助
  // 但在同步代码路径里我们不能 await，所以退而求其次：使用简单的 hash 函数（非加密强度，但足够比较用）

  const simpleHash = (input: string): string => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const chr = input.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return `h${hash >>> 0}`;
  };

  return {
    fingerprint_core: simpleHash(corePayload),
    fingerprint_roles: simpleHash(rolesPayload),
    fingerprint_full: simpleHash(fullPayload),
  };
}

function extractUploadedMeta(data: any[]): UploadedScriptMeta | null {
  if (!Array.isArray(data)) return null;

  const metaById = data.find((item) => item && typeof item === 'object' && item.id === '_meta');
  if (metaById) return metaById as UploadedScriptMeta;

  const metaByAuthor = data.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      hasNonEmptyText((item as any).name) &&
      hasNonEmptyText((item as any).author) &&
      !hasNonEmptyText((item as any).team),
  );
  if (metaByAuthor) return metaByAuthor as UploadedScriptMeta;

  const metaByNameOnly = data.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      hasNonEmptyText((item as any).name) &&
      !hasNonEmptyText((item as any).team) &&
      !hasNonEmptyText((item as any).ability),
  );
  if (metaByNameOnly) return metaByNameOnly as UploadedScriptMeta;

  return null;
}

function collectCoreRoles(data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const team = (item as any).team;
    if (!hasNonEmptyText(team)) return false;
    const teamText = team.trim().toLowerCase();
    return VALID_CORE_TEAMS.has(teamText);
  });
}

function validateUploadedScript(data: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('剧本数据格式错误：根节点必须是数组');
    return { ok: false, errors };
  }

  const meta = extractUploadedMeta(data);
  if (!meta || !hasNonEmptyText(meta.name)) {
    errors.push('缺少剧本 meta 数据（至少需要 name）');
  }

  const coreRoles = collectCoreRoles(data);
  if (coreRoles.length === 0) {
    errors.push('缺少核心阵营有效角色（team 为 townsfolk/outsider/minion/demon）');
  }

  // 对每个核心阵营角色，要求至少具备 id/name/ability/image 四个基础字段
  const requiredFields = ['id', 'name', 'ability', 'image'] as const;
  for (const role of coreRoles) {
    const missing: string[] = [];
    for (const field of requiredFields) {
      if (!hasNonEmptyText((role as any)[field])) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      const roleId = (role as any).id || (role as any).name || '未知角色';
      errors.push(`核心角色 ${roleId} 缺少必填字段: ${missing.join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 剧本分享相关接口（通过 REGISTRY_DO 实现持久化）
    if (pathname === '/scripts/upload' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const registryStub = env.REGISTRY_DO.get(env.REGISTRY_DO.idFromName('registry'));
      const res = await registryStub.fetch('https://internal/scripts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/scripts/shared-index' && request.method === 'GET') {
      const registryStub = env.REGISTRY_DO.get(env.REGISTRY_DO.idFromName('registry'));
      const res = await registryStub.fetch('https://internal/scripts/shared-index', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/create' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const rawSeatCount = (body as any)?.seatCount;
      const seatCount =
        Number.isInteger(rawSeatCount) && typeof rawSeatCount === 'number'
          ? (rawSeatCount as number)
          : Number(rawSeatCount ?? 0) || 0;
      const hostToken = crypto.randomUUID();
      const registryStub = env.REGISTRY_DO.get(env.REGISTRY_DO.idFromName('registry'));
      const codeRes = await registryStub.fetch('https://internal/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const codeData = (await codeRes.json().catch(() => ({}))) as { code?: string };
      const townId = codeData?.code;
      if (!townId) {
        return jsonResponse({ error: '无法分配小镇号，请稍后重试' }, 503);
      }
      const stub = getTownStub(env, townId);
      if (!stub) return jsonResponse({ error: '无效小镇号' }, 400);

      await stub.fetch('https://internal/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          townId,
          hostToken,
          scriptName: body?.scriptName ?? '',
          seatCount,
        }),
      });

      return jsonResponse({ townId, hostToken });
    }

    if (pathname === '/town/join' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = parseTownCode(body?.townId);
      if (!townId) {
        return jsonResponse({ error: '请输入 4 位数字小镇号' }, 400);
      }
      const stub = getTownStub(env, townId);
      if (!stub) return jsonResponse({ error: '无效小镇号' }, 400);
      const res = await stub.fetch('https://internal/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ townId }),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/sit' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = parseTownCode(body?.townId as string);
      const userId = body?.userId as string | undefined;
      const seatIndex = body?.seatIndex as number | undefined;
      if (!townId || !userId || seatIndex === undefined || seatIndex < 0) {
        return jsonResponse({ error: '缺少小镇号、userId 或 seatIndex' }, 400);
      }
      const stub = env.TOWN_DO.get(env.TOWN_DO.idFromName('town-' + townId));
      const res = await stub.fetch('https://internal/sit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ townId, userId, seatIndex }),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/occupancy' && request.method === 'GET') {
      const townId = parseTownCode(url.searchParams.get('townId') || '');
      const hostToken = url.searchParams.get('hostToken') || undefined;
      if (!townId || !hostToken) {
        return jsonResponse({ error: '缺少小镇号或 hostToken' }, 400);
      }
      const stub = env.TOWN_DO.get(env.TOWN_DO.idFromName('town-' + townId));
      const res = await stub.fetch(
        `https://internal/occupancy?hostToken=${encodeURIComponent(hostToken)}`,
        { method: 'GET' },
      );
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/leave' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = parseTownCode(body?.townId as string);
      const userId = body?.userId as string | undefined;
      if (!townId || !userId) {
        return jsonResponse({ error: '缺少小镇号或 userId' }, 400);
      }
      const stub = env.TOWN_DO.get(env.TOWN_DO.idFromName('town-' + townId));
      const res = await stub.fetch('https://internal/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ townId, userId }),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/deal-roles' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = parseTownCode(body?.townId as string);
      const hostToken = body?.hostToken as string | undefined;
      const seats = (body?.seats as TownSeatDeal[] | undefined) ?? [];
      if (!townId || !hostToken) {
        return jsonResponse({ error: '缺少小镇号或 hostToken' }, 400);
      }
      const stub = env.TOWN_DO.get(env.TOWN_DO.idFromName('town-' + townId));
      const res = await stub.fetch('https://internal/deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ townId, hostToken, seats }),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/me' && request.method === 'GET') {
      const townId = parseTownCode(url.searchParams.get('townId') || '');
      const userId = url.searchParams.get('userId') || undefined;
      if (!townId || !userId) {
        return jsonResponse({ error: '缺少小镇号或 userId' }, 400);
      }
      const stub = env.TOWN_DO.get(env.TOWN_DO.idFromName('town-' + townId));
      const res = await stub.fetch(`https://internal/me?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/ws' && request.method === 'GET') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426, headers: CORS_HEADERS });
      }
      const townId = parseTownCode(url.searchParams.get('townId') || '');
      if (!townId) {
        return jsonResponse({ error: '缺少小镇号' }, 400);
      }
      const stub = getTownStub(env, townId);
      if (!stub) return jsonResponse({ error: '无效小镇号' }, 400);
      return stub.fetch(request);
    }

    if (pathname === '/town/update-settings' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = parseTownCode(body?.townId as string);
      const hostToken = body?.hostToken as string | undefined;
      if (!townId || !hostToken) {
        return jsonResponse({ error: '缺少小镇号或 hostToken' }, 400);
      }
      const stub = getTownStub(env, townId);
      if (!stub) return jsonResponse({ error: '无效小镇号' }, 400);
      const res = await stub.fetch('https://internal/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken, scriptName: body?.scriptName, seatCount: body?.seatCount }),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    if (pathname === '/town/push-game-data' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = parseTownCode(body?.townId as string);
      const hostToken = body?.hostToken as string | undefined;
      const seats = (body?.seats as TownSeatDeal[] | undefined) ?? [];
      if (!townId || !hostToken) {
        return jsonResponse({ error: '缺少小镇号或 hostToken' }, 400);
      }
      const stub = getTownStub(env, townId);
      if (!stub) return jsonResponse({ error: '无效小镇号' }, 400);
      const res = await stub.fetch('https://internal/push-game-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken, seats }),
      });
      const data = await res.json().catch(() => ({}));
      return jsonResponse(data, res.status);
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },
};

/** 按 session 存的 WebSocket（server 端），key: "host" | "player:"+userId */
const WS_KEYS = { host: 'host' as const, player: (userId: string) => `player:${userId}` as const };

export class TownDurableObject {
  private state: DurableObjectState;
  private env: Env;
  private data: TownState | null = null;
  private sessions = new Map<string, WebSocket>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private broadcastToHost(payload: object): void {
    const ws = this.sessions.get(WS_KEYS.host);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        this.sessions.delete(WS_KEYS.host);
      }
    }
  }

  private broadcastToPlayers(payload: object): void {
    const msg = JSON.stringify(payload);
    for (const [key, ws] of this.sessions) {
      if (key.startsWith('player:') && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg);
        } catch {
          this.sessions.delete(key);
        }
      }
    }
  }

  private getOccupancyPayload(state: TownState): { type: string; seats: { seatIndex: number; occupied: boolean }[] } {
    const seatCount = state.seatCount ?? 0;
    const seats = Array.from({ length: seatCount }, (_, i) => ({
      seatIndex: i,
      occupied: !!(state.seatAssignments && state.seatAssignments[i]),
    }));
    return { type: 'occupancy', seats };
  }

  private async releaseCode(townId: string): Promise<void> {
    const registryStub = this.env.REGISTRY_DO.get(this.env.REGISTRY_DO.idFromName('registry'));
    await registryStub.fetch('https://internal/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: townId }),
    });
  }

  private async load(): Promise<TownState | null> {
    if (this.data) return this.data;
    const stored = await this.state.storage.get<TownState>('state');
    const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
    if (stored && Date.now() - stored.createdAt > TWENTY_FOUR_H) {
      await this.releaseCode(stored.townId);
      await this.state.storage.delete('state');
      this.data = null;
      return null;
    }
    this.data = stored ?? null;
    return this.data;
  }

  private async save(state: TownState): Promise<void> {
    this.data = state;
    await this.state.storage.put('state', state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.includes('/ws') && request.headers.get('Upgrade') === 'websocket') {
      const townId = parseTownCode(url.searchParams.get('townId') || '');
      const hostToken = url.searchParams.get('hostToken') || undefined;
      const userId = url.searchParams.get('userId') || undefined;
      const state = await this.load();
      if (!state) {
        return new Response(JSON.stringify({ error: '小镇不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.accept();
      if (hostToken && hostToken === state.hostToken) {
        this.sessions.delete(WS_KEYS.host);
        this.sessions.set(WS_KEYS.host, server);
      } else if (userId) {
        this.sessions.set(WS_KEYS.player(userId), server);
        try {
          const occupancyPayload = this.getOccupancyPayload(state);
          server.send(
            JSON.stringify({
              type: 'settings',
              scriptName: state.scriptName ?? '',
              seatCount: state.seatCount ?? 0,
              // 玩家端需要初始座位占用信息，避免多名玩家坐同一座
              occupancy: occupancyPayload.seats,
            }),
          );
        } catch {
          this.sessions.delete(WS_KEYS.player(userId));
        }
      } else {
        server.close(1008, '需要 hostToken 或 userId');
        return new Response(null, { status: 400 });
      }
      server.addEventListener('close', () => {
        if (hostToken) this.sessions.delete(WS_KEYS.host);
        else if (userId) this.sessions.delete(WS_KEYS.player(userId));
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (pathname.endsWith('/init') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = body?.townId as string | undefined;
      const hostToken = body?.hostToken as string | undefined;
      if (!townId || !hostToken) {
        return new Response(JSON.stringify({ error: '缺少 townId 或 hostToken' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const initial: TownState = {
        townId,
        hostToken,
        createdAt: Date.now(),
        scriptName: body?.scriptName ?? '',
        seatCount: body?.seatCount ?? 0,
        players: [],
        seatAssignments: {},
      };
      await this.save(initial);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.endsWith('/join') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const townId = body?.townId as string | undefined;
      if (!townId) {
        return new Response(JSON.stringify({ error: '缺少 townId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const state = await this.load();
      if (!state) {
        return new Response(JSON.stringify({ error: '小镇不存在，请确认小镇号正确' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!state.seatAssignments) state.seatAssignments = {};
      const userId = crypto.randomUUID();
      const player: TownPlayer = { userId, name: '' };
      state.players = [...state.players, player];
      await this.save(state);
      return new Response(
        JSON.stringify({
          townId: state.townId,
          userId,
          role: 'player',
          seatCount: state.seatCount ?? 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (pathname.endsWith('/sit') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const userId = body?.userId as string | undefined;
      const seatIndex = body?.seatIndex as number | undefined;
      if (userId === undefined || seatIndex === undefined || seatIndex < 0) {
        return new Response(JSON.stringify({ error: '缺少 userId 或 seatIndex' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const state = await this.load();
      if (!state) {
        return new Response(JSON.stringify({ error: '小镇不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!state.seatAssignments) state.seatAssignments = {};
      const seatCount = state.seatCount ?? 0;
      if (seatIndex >= seatCount) {
        return new Response(JSON.stringify({ error: '座位号无效' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // 同一玩家换座位时，先清理掉 TA 在其他座位上的占用
      for (const [idx, uid] of Object.entries(state.seatAssignments)) {
        if (uid === userId && Number(idx) !== seatIndex) {
          delete state.seatAssignments[Number(idx)];
        }
      }
      state.seatAssignments[seatIndex] = userId;
      await this.save(state);
      this.broadcastToHost(this.getOccupancyPayload(state));
      // 广播座位占用状态给所有玩家
      const seatCount_tmp = state.seatCount ?? 0;
      const seatOccupancy = Array.from({ length: seatCount_tmp }, (_, i) => ({
        seatIndex: i,
        occupied: !!(state.seatAssignments && state.seatAssignments[i]),
      }));
      this.broadcastToPlayers({
        type: 'seat_occupancy_update',
        occupancy: seatOccupancy,
      });
      const playerWs = this.sessions.get(WS_KEYS.player(userId));
      if (playerWs && playerWs.readyState === WebSocket.OPEN) {
        try {
          playerWs.send(JSON.stringify({ type: 'sit_ok', seatIndex }));
        } catch {
          this.sessions.delete(WS_KEYS.player(userId));
        }
      }
      return new Response(JSON.stringify({ ok: true, seatIndex }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.endsWith('/occupancy') && request.method === 'GET') {
      const urlObj = new URL(request.url);
      const hostToken = urlObj.searchParams.get('hostToken') || undefined;
      const state = await this.load();
      if (!hostToken || !state || hostToken !== state.hostToken) {
        return new Response(JSON.stringify({ error: '无权查看' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!state) {
        return new Response(JSON.stringify({ seats: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const seatCount = state.seatCount ?? 0;
      const seats = Array.from({ length: seatCount }, (_, i) => ({
        seatIndex: i,
        occupied: !!(state.seatAssignments && state.seatAssignments[i]),
      }));
      return new Response(JSON.stringify({ seats }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.endsWith('/leave') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const userId = body?.userId as string | undefined;
      if (!userId) {
        return new Response(JSON.stringify({ error: '缺少 userId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const state = (await this.load()) ?? null;
      if (state) {
        state.players = state.players.filter(p => p.userId !== userId);
        if (state.seatAssignments) {
          for (const k of Object.keys(state.seatAssignments)) {
            if (state.seatAssignments[Number(k)] === userId) {
              delete state.seatAssignments[Number(k)];
              break;
            }
          }
        }
        await this.save(state);
        this.sessions.delete(WS_KEYS.player(userId));
        if (state.players.length > 0) {
          this.broadcastToHost(this.getOccupancyPayload(state));
          // 广播座位占用状态给所有玩家
          const seatCount_tmp = state.seatCount ?? 0;
          const seatOccupancy = Array.from({ length: seatCount_tmp }, (_, i) => ({
            seatIndex: i,
            occupied: !!(state.seatAssignments && state.seatAssignments[i]),
          }));
          this.broadcastToPlayers({
            type: 'seat_occupancy_update',
            occupancy: seatOccupancy,
          });
        }
        if (state.players.length === 0) {
          await this.releaseCode(state.townId);
          await this.state.storage.delete('state');
          this.data = null;
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.endsWith('/deal') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const hostToken = body?.hostToken as string | undefined;
      const seats = (body?.seats as TownSeatDeal[] | undefined) ?? [];
      const state = await this.load();
      if (!state) {
        return new Response(JSON.stringify({ error: '小镇不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!hostToken || hostToken !== state.hostToken) {
        return new Response(JSON.stringify({ error: '无权下发角色' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      state.lastDeal = {
        at: Date.now(),
        seats,
      };
      await this.save(state);
      // 下发角色后立即将本局游戏数据推送给所有玩家（此时玩家只能看到自己的角色）
      this.broadcastToPlayers({ type: 'game_data', seats });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.endsWith('/me') && request.method === 'GET') {
      const urlObj = new URL(request.url);
      const userId = urlObj.searchParams.get('userId') || undefined;
      if (!userId) {
        return new Response(JSON.stringify({ error: '缺少 userId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const state = await this.load();
      const seatCount = state ? (state.seatCount ?? 0) : 0;
      if (!state) {
        return new Response(
          JSON.stringify({
            townId: null,
            scriptName: '',
            seat: null,
            mySeatIndex: null,
            seatCount: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      const seatAssignments = state.seatAssignments || {};
      let mySeatIndex: number | null = null;
      for (const [idx, uid] of Object.entries(seatAssignments)) {
        if (uid === userId) {
          mySeatIndex = Number(idx);
          break;
        }
      }
      if (mySeatIndex === null || !state.lastDeal) {
        return new Response(
          JSON.stringify({
            townId: state.townId,
            scriptName: state.scriptName ?? '',
            seat: null,
            mySeatIndex,
            seatCount,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      const seat = state.lastDeal.seats.find(s => s.seatIndex === mySeatIndex) ?? null;
      return new Response(
        JSON.stringify({
          townId: state.townId,
          scriptName: state.scriptName ?? '',
          seat,
          mySeatIndex,
          seatCount,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (pathname.endsWith('/update-settings') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const hostToken = body?.hostToken as string | undefined;
      const scriptName = body?.scriptName as string | undefined;
      const seatCount = body?.seatCount as number | undefined;
      const state = await this.load();
      if (!state || !hostToken || hostToken !== state.hostToken) {
        return new Response(JSON.stringify({ error: '无权修改' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (scriptName !== undefined) state.scriptName = scriptName;
      if (seatCount !== undefined && Number.isInteger(seatCount) && seatCount >= 0) state.seatCount = seatCount;
      await this.save(state);
      // 构建座位占用数据
      const seatCount_tmp = state.seatCount ?? 0;
      const seatOccupancy = Array.from({ length: seatCount_tmp }, (_, i) => ({
        seatIndex: i,
        occupied: !!(state.seatAssignments && state.seatAssignments[i]),
      }));
      this.broadcastToPlayers({
        type: 'settings',
        scriptName: state.scriptName ?? '',
        seatCount: state.seatCount ?? 0,
        occupancy: seatOccupancy,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.endsWith('/push-game-data') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const hostToken = body?.hostToken as string | undefined;
      const seats = (body?.seats as TownSeatDeal[] | undefined) ?? [];
      const state = await this.load();
      if (!state || !hostToken || hostToken !== state.hostToken) {
        return new Response(JSON.stringify({ error: '无权推送' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      state.lastDeal = { at: Date.now(), seats };
      await this.save(state);
      this.broadcastToPlayers({ type: 'game_data', seats });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

/** 分配未使用的 4 位小镇号 */
export class TownRegistry {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 小镇号分配
    if (pathname.endsWith('/take') && request.method === 'POST') {
      const used = (await this.state.storage.get<number[]>('used')) ?? [];
      const usedSet = new Set(used);
      // 4 位数共 9000 个 (1000～9999)，用满则直接返回
      if (usedSet.size >= 9000) {
        return new Response(
          JSON.stringify({ error: '4 位小镇号已全部用完，请稍后再试或联系管理员' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }
      let code: string;
      for (let i = 0; i < 100; i++) {
        const n = 1000 + Math.floor(Math.random() * 9000);
        code = String(n);
        if (!usedSet.has(n)) {
          usedSet.add(n);
          await this.state.storage.put('used', Array.from(usedSet));
          return new Response(JSON.stringify({ code }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: '暂无可用小镇号，请重试' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 释放小镇号
    if (pathname.endsWith('/release') && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const code = parseTownCode(body?.code);
      if (!code) {
        return new Response(JSON.stringify({ error: '无效的小镇号' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const used = (await this.state.storage.get<number[]>('used')) ?? [];
      const n = parseInt(code, 10);
      const next = used.filter((v) => v !== n);
      if (next.length === used.length) {
        return new Response(JSON.stringify({ ok: true, released: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await this.state.storage.put('used', next);
      return new Response(JSON.stringify({ ok: true, released: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ==================== 剧本分享相关逻辑 ====================

    if (pathname.endsWith('/scripts/upload') && request.method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const raw = body?.raw as unknown;
      if (typeof raw !== 'string') {
        return new Response(
          JSON.stringify({ ok: false, error: '请求体缺少 raw 字段或类型错误' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return new Response(
          JSON.stringify({ ok: false, error: `JSON 解析失败: ${(e as Error).message}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const { ok, errors } = validateUploadedScript(data);
      if (!ok) {
        return new Response(
          JSON.stringify({ ok: false, error: errors[0], errors }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const meta = extractUploadedMeta(data) || {};
      const id = `shared_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = Date.now();

      const stored =
        (await this.state.storage.get<SharedScriptStoredItem[]>('sharedScripts')) ?? [];

      const types: string[] = Array.isArray(meta.type)
        ? meta.type
        : meta.type
        ? [meta.type]
        : [];

      const fpInfo = computeFingerprintsForUploaded(data);
      if (!fpInfo) {
        return new Response(
          JSON.stringify({ ok: false, error: '无法为该剧本计算指纹，请检查角色配置是否完整' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 后端去重：若已存在相同完整指纹的分享剧本，则拒绝继续分享
      const duplicate = stored.some(
        (item) => item.fingerprint_full && item.fingerprint_full === fpInfo.fingerprint_full,
      );
      if (duplicate) {
        return new Response(
          JSON.stringify({ ok: false, error: '该剧本内容已存在，请不要重复分享' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const item: SharedScriptStoredItem = {
        id,
        name: meta.name || '未命名剧本',
        author: meta.author || '',
        logo: meta.logo,
        types,
        data,
        createdAt,
        fingerprint_core: fpInfo.fingerprint_core,
        fingerprint_roles: fpInfo.fingerprint_roles,
        fingerprint_full: fpInfo.fingerprint_full,
      };

      stored.push(item);
      await this.state.storage.put('sharedScripts', stored);

      return new Response(
        JSON.stringify({
          ok: true,
          id,
          name: item.name,
          author: item.author,
          createdAt,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (pathname.endsWith('/scripts/shared-index') && request.method === 'GET') {
      const stored =
        (await this.state.storage.get<SharedScriptStoredItem[]>('sharedScripts')) ?? [];

      // 对存量数据做一次指纹补全（迁移）
      let needSave = false;
      for (const item of stored) {
        if (!item.fingerprint_core || !item.fingerprint_roles || !item.fingerprint_full) {
          const fp = computeFingerprintsForUploaded(item.data);
          if (fp) {
            item.fingerprint_core = fp.fingerprint_core;
            item.fingerprint_roles = fp.fingerprint_roles;
            item.fingerprint_full = fp.fingerprint_full;
            needSave = true;
          }
        }
      }
      if (needSave) {
        await this.state.storage.put('sharedScripts', stored);
      }

      // 按创建时间倒序返回
      stored.sort((a, b) => b.createdAt - a.createdAt);

      return new Response(JSON.stringify(stored), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}
