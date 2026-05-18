# 小镇 API 开发约定

## 为什么要统一

- 前端直连 `*.workers.dev` 在某些网络下会超时或被墙。
- 小镇 HTTP 已通过 Vercel 代理（`/api/town/*` → Worker），只有**统一用 `VITE_TOWN_HTTP_BASE`（本站 API）** 拼 URL，请求才会走代理，避免「创建小镇 / 获取座位信息」等接口失败。
- WebSocket 需单独配置 `VITE_TOWN_WS_BASE`（Worker 自定义域名），也只在 `townClient` 里用。

## 约定

| 类型 | 做法 |
|------|------|
| **小镇 HTTP**（create、join、sit、occupancy、leave、deal-roles、me、update-settings、push-game-data 等） | 只在 `src/api/townClient.ts` 里实现，URL 一律用 **`getHttpBaseUrl()`** |
| **小镇 WebSocket** | 只通过 `townClient` 的 **`getTownWsUrl()`** 生成地址 |
| **调用方**（App.tsx、PlayerApp.tsx 等） | 只 import `townClient` 导出的函数并调用，**禁止**手写 `fetch(某 base + '/town/...')` 或使用 `VITE_TOWN_API_BASE` |

## 新增接口时

1. 在 **`src/api/townClient.ts`** 增加 `export async function 新接口名(...)`，内部用 `getHttpBaseUrl()` + `/town/路径` 发 fetch。
2. 在 **Worker** `worker/src/index.ts` 增加对应路由（若后端还没有）。
3. **不要**在组件或其它文件里为小镇接口单独写 fetch、也不要再读 `VITE_TOWN_API_BASE`。

## 相关文件

- 前端入口：`src/api/townClient.ts`
- 代理实现：`api/town-proxy.ts` + `vercel.json` 的 `/api/town/:path*` 重写
- WebSocket 配置说明：`docs/TOWN_WEBSOCKET_SETUP.md`
