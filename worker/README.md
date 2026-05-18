# 小镇后端（Cloudflare Worker + Durable Objects）

这是「血染钟楼」线上发牌用的小镇后端，部署到 Cloudflare Workers 后，前端才能创建小镇、加入小镇、下发角色。

---

## 你需要做的（4 步）

### 1. 安装并登录 Cloudflare

在电脑上打开终端，执行：

```bash
npm install -g wrangler
wrangler login
```

`wrangler login` 会打开浏览器，用你的 Cloudflare 账号登录并授权即可。

---

### 2. 开通 workers.dev 子域名（首次必做）

若从未用过 Cloudflare Workers，需要先“激活”一次：

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 左侧点 **Workers & Pages**
3. 进入后系统会自动为你创建一个 `xxx.workers.dev` 子域名（只需进一次即可）

完成后回到终端执行下面的部署。

---

### 3. 部署 Worker

在本项目**根目录**（血染工具）下执行：

```bash
cd worker
npm install
npx wrangler deploy
```

部署成功后会看到类似输出：

```
Published botc-town (1.23 sec)
  https://botc-town.你的子域名.workers.dev
```

**把这一行里的完整地址复制下来**（不要带末尾斜杠），例如：  
`https://botc-town.xxx.workers.dev`

---

### 4. 让前端连上这个地址

在项目**根目录**（血染工具，不是 worker 里）新建或编辑 `.env` 和 `.env.production`：

**`.env`**（本地开发时用）：

```
VITE_TOWN_API_BASE=https://botc-town.你的子域名.workers.dev
```

**`.env.production`**（打包上线时用）：

```
VITE_TOWN_API_BASE=https://botc-town.你的子域名.workers.dev
```

把上面的地址换成你在第 2 步复制的那个。

然后重新启动前端或重新打包：

- 本地：`npm run dev`
- 打包：`npm run build`

---

## 完成后

- **说书人**：打开正常的前端地址 → 右上菜单 → 「游戏」Tab → 创建小镇 / 发牌。
- **玩家**：打开 **同一前端地址 + `?mode=player`**（例如 `https://你的网站/?mode=player`）→ 输入小镇号和自己名字 → 加入后等说书人发牌即可看到自己的角色。

如有报错，先确认：1）第 2 步的地址是否填进 `.env`；2）前端是否重新 build 或重启 dev。
