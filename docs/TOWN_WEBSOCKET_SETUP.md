# 小镇 WebSocket 配置说明

**说书人端与玩家端的实时同步**（座位占用、剧本/座位数变更、发牌推送等）依赖 WebSocket。若未配置，或仍直连 `*.workers.dev` 且该域名在你网络下不可达，会出现**数据无法正常同步**。

## 必须完成：为 Worker 绑定自定义域名

让浏览器通过你自己的域名（如 `town.bloodclocktower.online`）连接 WebSocket，很多网络环境下自定义域名可访问而 `workers.dev` 被限制。

### 1. 在 Cloudflare 绑定自定义域名

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 选择你的小镇 Worker（如 `botc-town`）。
2. 打开 **Settings** → **Domains & Routes**（或 **Triggers** → **Custom Domains**）。
3. 点击 **Add Custom Domain**，填写子域，例如：`town.bloodclocktower.online`。
4. 若该域名已在 Cloudflare 托管，按提示完成即可；否则需先把域名 DNS 接入 Cloudflare 再添加。

### 2. 配置前端环境变量

在 **生产环境** 的 `.env.production` 中取消注释并填写（与你在 Cloudflare 填写的域名一致）：

```env
VITE_TOWN_WS_BASE=wss://town.bloodclocktower.online
```

然后重新构建并部署前端。之后 WebSocket 会连到 `wss://town.bloodclocktower.online/town/ws?...`，不再直连 `workers.dev`。

### 3. 验证

部署后在前台创建/加入小镇，说书人应能实时看到玩家坐下，玩家端也能收到剧本与发牌推送。在浏览器开发者工具 **Network** 面板中筛选 **WS**，应看到对 `town.bloodclocktower.online` 的 WebSocket 连接。
