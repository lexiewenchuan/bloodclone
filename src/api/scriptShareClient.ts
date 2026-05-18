const BASE_URL =
  (import.meta.env && (import.meta.env as any).VITE_TOWN_API_BASE) ||
  (typeof window !== 'undefined' && (window as any).__TOWN_API_BASE__) ||
  '';

const HTTP_BASE_URL =
  (import.meta.env && (import.meta.env as any).VITE_TOWN_HTTP_BASE) ||
  BASE_URL;

function getBaseUrl(): string {
  if (BASE_URL) return BASE_URL.replace(/\/+$/, '');
  // 默认走与前端同源，前端可通过反向代理到 Cloudflare Worker
  return '';
}

function getHttpBaseUrl(): string {
  if (HTTP_BASE_URL) return HTTP_BASE_URL.replace(/\/+$/, '');
  return getBaseUrl();
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `请求失败: ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof (data as any).error === 'string') {
        message = (data as any).error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export interface SharedScriptIndexItem {
  id: string;
  name: string;
  author: string;
  logo?: string;
  types?: string[];
  data: any[];
  createdAt: number;
}

export interface UploadSharedScriptResult {
  ok: boolean;
  id?: string;
  name?: string;
  author?: string;
  createdAt?: number;
  error?: string;
  errors?: string[];
}

/** 上传并分享剧本 JSON 文本 */
export async function uploadSharedScript(rawJson: string): Promise<UploadSharedScriptResult> {
  const res = await fetch(`${getHttpBaseUrl()}/scripts/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: rawJson }),
  });
  return handleResponse<UploadSharedScriptResult>(res);
}

/** 获取所有已分享剧本的索引与数据 */
export async function fetchSharedScriptsIndex(): Promise<SharedScriptIndexItem[]> {
  const res = await fetch(`${getHttpBaseUrl()}/scripts/shared-index`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<SharedScriptIndexItem[]>(res);
}

