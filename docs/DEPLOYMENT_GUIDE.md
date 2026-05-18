# 血染工具部署指南

本文档提供了将血染工具从本地开发环境部署到互联网的完整流程，包括GitHub仓库设置、代码推送和Vercel部署。

## 目录

- [项目准备](#项目准备)
- [GitHub仓库设置](#github仓库设置)
- [SSH密钥配置](#ssh密钥配置)
- [代码推送](#代码推送)
- [Vercel部署](#vercel部署)
- [版本管理](#版本管理)
- [常见问题解决方案](#常见问题解决方案)

## 项目准备

### 1. 检查项目结构

确保项目目录结构正确，包含以下关键文件：

```
血染工具/
├── package.json         # 项目依赖配置
├── vite.config.ts       # Vite构建配置
├── tsconfig.json        # TypeScript配置
├── src/                 # 源代码目录
├── public/              # 静态资源目录
└── dist/                # 构建产物目录
```

### 2. 清理项目

移除不需要的文件和目录：

```bash
# 删除不需要的目录
rm -rf agent-skills antigravity-skills

# 创建合理的.gitignore文件
cat > .gitignore << EOF
# 依赖目录
node_modules/

# 构建产物
dist/
build/
deploy/

# 日志文件
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# 编辑器文件
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# 环境变量
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
EOF
```

### 3. 构建项目

确保项目能够正常构建：

```bash
npm run build
```

构建成功后，会生成 `dist` 目录，包含可部署的静态文件。

## GitHub仓库设置

### 1. 创建GitHub仓库

1. **访问GitHub**：[https://github.com](https://github.com)
2. **登录账号**：使用您的GitHub账号登录
3. **创建仓库**：
   - 点击右上角的 "+" 图标，选择 "New repository"
   - 填写仓库信息：
     - Repository name: `blood-on-the-clocktower`
     - Description: 血染钟楼游戏工具
     - Visibility: 选择 "Public" 或 "Private"
   - 点击 "Create repository"

### 2. 初始化Git仓库（如果还没有）

```bash
# 初始化Git仓库
git init

# 添加文件
git add .

# 提交初始代码
git commit -m "Initial commit"
```

### 3. 配置远程仓库

```bash
# 添加远程仓库（替换为您的GitHub用户名）
git remote add origin https://github.com/arelchan/blood-on-the-clocktower.git

# 查看远程仓库配置
git remote -v
```

## SSH密钥配置

由于GitHub不再支持密码认证，我们需要使用SSH密钥进行认证。

### 1. 检查是否已有SSH密钥

```bash
ls -la ~/.ssh/
```

如果看到 `id_ed25519` 和 `id_ed25519.pub` 文件，说明已有SSH密钥。

### 2. 生成SSH密钥（如果没有）

```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

执行过程中：
- 按回车使用默认路径
- 按回车设置空密码（或设置密码）

### 3. 添加SSH密钥到ssh-agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### 4. 在GitHub上添加SSH密钥

1. **复制SSH公钥内容**：
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

2. **登录GitHub**，进入：
   - Settings → SSH and GPG keys

3. **添加SSH密钥**：
   - 点击 "New SSH key"
   - Title: 填写一个描述性名称（如 "MBA Laptop"）
   - Key type: 选择 "Authentication Key"
   - Key: 粘贴复制的公钥内容
   - 点击 "Add SSH key"

### 5. 修改远程仓库URL为SSH协议

```bash
git remote set-url origin git@github.com:arelchan/blood-on-the-clocktower.git

# 验证远程仓库配置
git remote -v
```

## 代码推送

### 1. 推送前检查

在推送代码前，确保执行以下检查：

- **检查.gitignore文件**：确保构建和部署所需的文件和目录没有被错误地添加到.gitignore中，特别是：
  - `scripts/` 目录：包含构建脚本，如 `generate-script-index.js`，必须包含在版本控制中
  - `package.json` 和 `package-lock.json`：包含依赖信息，必须包含在版本控制中
  - `vite.config.ts` 和 `tsconfig.json`：构建配置文件，必须包含在版本控制中

- **检查构建脚本**：确保构建脚本能够正常执行：
  ```bash
  # 测试构建脚本
  npm run generate-script-index
  ```

- **检查依赖**：确保所有依赖都已正确安装：
  ```bash
  # 安装依赖
  npm install
  
  # 测试构建
  npm run build
  ```

### 2. 推送代码到GitHub

```bash
# 推送代码并设置上游分支
git push -u origin main
```

### 3. 验证推送结果

访问GitHub仓库页面，确认代码已成功推送，特别是：
- `scripts/` 目录是否存在
- 构建配置文件是否存在
- 最新的提交是否包含所有必要的更改

### 4. 推送注意事项

1. **不要忽略构建脚本**：`scripts/` 目录包含构建过程中必需的脚本，如 `generate-script-index.js`，必须包含在版本控制中。

2. **检查文件权限**：确保脚本文件具有执行权限：
   ```bash
   chmod +x scripts/generate-script-index.js
   ```

3. **验证CI/CD流程**：推送后，检查Vercel控制台中的构建状态，确保部署成功。

4. **版本控制最佳实践**：
   - 使用有意义的提交消息
   - 定期推送代码，避免一次推送大量更改
   - 对于重大更改，创建分支进行开发和测试

5. **常见推送错误及解决方案**：
   - **MODULE_NOT_FOUND**：检查是否缺少必要的文件或目录
   - **构建失败**：检查构建脚本和依赖配置
   - **权限错误**：检查文件权限和SSH密钥配置

## Vercel部署

Vercel是一个优秀的前端部署平台，支持自动构建和部署。

### 1. 访问Vercel官网

[https://vercel.com](https://vercel.com)

### 2. 登录/注册

使用GitHub账号登录Vercel（推荐），这样可以直接导入GitHub仓库。

### 3. 导入项目

1. **点击 "Add New"** → "Project"
2. **从GitHub仓库列表中选择**：`arelchan/blood-on-the-clocktower`
3. **点击 "Import"**

### 4. 配置部署设置

- **Framework Preset**: 选择 "Vite"
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Root Directory**: 保持为空（使用默认）
- **环境变量（重要）**：若站点访问地址是根路径（如 `xxx.vercel.app`），请在 **Settings → Environment Variables** 中添加：
  - 名称：`VITE_BASE_URL`，值：`/`
  - 这样剧本、脚本等资源会从根路径加载，否则会 404。

### 5. 点击 "Deploy"

Vercel会自动开始构建和部署过程。

### 6. 获取部署链接

部署完成后，Vercel会生成一个唯一的URL（如 `blood-on-the-clocktower.vercel.app`）。

复制这个链接，这就是您的网站的公开访问地址。

## 版本管理

本项目已内置了一套自动化的版本管理脚本，极大地简化了日常开发、发布和回滚流程。

详细指南请参考项目根目录下的 [VERSION_CONTROL.md](../VERSION_CONTROL.md)。

### 常用命令速查

- **提交代码**: `npm run save` (自动同步到 GitHub)
- **发布版本**: `npm run release` (自动打 Tag 并触发独立部署)
- **查看版本**: `npm run versions`
- **回滚代码**: `npm run undo` (撤销最近一次提交) 或 `npm run goto` (回退到指定版本)

⚠️ **注意**: 建议优先使用上述 `npm` 命令进行操作，而不是直接使用原始的 `git` 命令，以确保流程的规范性和安全性。

## 常见问题解决方案

### 1. GitHub推送失败

#### 问题：网络连接问题
- **解决方案**：检查网络连接，尝试使用SSH协议

#### 问题：权限问题
- **解决方案**：确保您有GitHub仓库的推送权限，检查SSH密钥配置

#### 问题：文件太大
- **解决方案**：确保 `.gitignore` 正确配置，避免推送大文件

### 2. Vercel部署失败

#### 问题：构建错误
- **解决方案**：检查构建日志，修复代码中的错误

#### 问题：依赖问题
- **解决方案**：确保 `package.json` 中的依赖正确，尝试删除 `node_modules` 并重新安装

#### 问题：配置问题
- **解决方案**：检查Vercel的构建配置是否正确

### 3. 网站访问问题

#### 问题：DNS缓存
- **解决方案**：新域名可能需要24-48小时才能全球生效

#### 问题：CDN缓存
- **解决方案**：尝试清除浏览器缓存或使用无痕模式访问

#### 问题：部署状态
- **解决方案**：检查Vercel控制台中的部署状态

### 4. SSH密钥问题

#### 问题：SSH连接失败
- **解决方案**：
  ```bash
  # 测试SSH连接
  ssh -T git@github.com
  
  # 检查SSH代理
  eval "$(ssh-agent -s)"
  ssh-add ~/.ssh/id_ed25519
  ```

#### 问题：SSH密钥权限错误
- **解决方案**：
  ```bash
  chmod 600 ~/.ssh/id_ed25519
  chmod 644 ~/.ssh/id_ed25519.pub
  ```

### 5. TypeScript类型错误

#### 问题：构建失败，提示"Cannot find name 'Script'"或类似的类型错误
- **原因**：TypeScript文件中使用了某个类型，但没有从类型定义文件中导入它
- **解决方案**：
  1. 检查类型定义文件（通常在`src/types/index.ts`），确认类型是否已定义
  2. 在使用该类型的文件中添加正确的导入语句
  例如：
  ```typescript
  // 在AppContext.tsx中添加
  import { Script } from '../types';
  ```
  3. 重新运行构建命令：
  ```bash
  npm run build
  ```

### 6. 中国大陆访问慢/无法访问
- **推荐方案**: 使用 **Vercel + 国内域名 (腾讯云/阿里云)**。
- 详情请参考专门的指南：[🇨🇳 中国大陆访问部署指南](./CN_DEPLOY_GUIDE.md)。
- Gitee Pages 目前已暂停个人服务，不再推荐作为首选方案。

## 后续优化

### 1. 环境变量管理

在Vercel控制台中，进入项目 → Settings → Environment Variables，添加需要的环境变量。

### 2. 自定义域名

在Vercel控制台中，进入项目 → Settings → Domains，添加您自己的域名。

### 3. 集成后端功能

使用Vercel Serverless Functions：在项目根目录创建 `api` 文件夹，编写后端API代码。

### 4. CI/CD配置

使用GitHub Actions自动化测试和部署流程：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run test

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
```

## 设备支持

### 移动端限制
为了保证最佳的说书人体验，本工具目前仅支持 PC 端访问。
- **检测机制**: 自动识别移动设备 User Agent 或屏幕宽度。
- **用户反馈**: 移动端访问时会展示全屏提示，引导用户切换至 PC 端。
- **部署影响**: 无论部署在何处，此限制都会生效。如需调试移动端视图，可在 PC 浏览器开发者工具中模拟移动设备。

## 总结

通过本文档的步骤，您可以：

1. **准备项目**：清理和构建项目
2. **设置GitHub仓库**：创建仓库并配置远程连接
3. **配置SSH密钥**：使用SSH协议进行安全认证
4. **推送代码**：将代码推送到GitHub仓库
5. **部署到Vercel**：自动构建和部署网站
6. **管理版本**：实现代码的版本控制和回退
7. **解决问题**：应对常见的部署问题

祝您部署顺利！