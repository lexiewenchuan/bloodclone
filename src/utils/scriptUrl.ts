/**
 * 根据剧本的 filePath 构造用于 fetch 的完整 URL。
 * 对路径逐段 encodeURIComponent，避免文件名中的 +、空格等字符在线上被误解析导致 404。
 *
 * 约定：任何地方需要「按 path 请求剧本 JSON」时，必须且只能调用本函数，禁止手拼 baseUrl + path。
 * 否则含 + 等字符的剧本在线上会 404。新增预加载/导出/离线等逻辑时请复用此函数。
 */
export function buildScriptFetchUrl(filePath: string): string {
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = origin ? `${origin}${basePath}/` : basePath + '/';
  const normalizedPath = filePath.replace(/^\/+/, '').replace(/^public\//, '');
  const encodedPath = normalizedPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return baseUrl ? new URL(encodedPath, baseUrl).href : `${basePath}/${encodedPath}`;
}
