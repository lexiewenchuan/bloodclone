
# 剧本管理指南 (Script Management Guide)

本文档旨在规范《血染钟楼》辅助工具的剧本上传和管理流程，确保新剧本能被系统正确识别和加载，避免因文件名、编码或资源路径问题导致的加载失败。

---

## 📋 1. 准备工作

在上传新剧本之前，请确保您的剧本文件符合以下要求：

*   **文件格式**：必须是标准的 `.json` 文件。
*   **文件编码**：必须是 `UTF-8` 编码。
    *   ⚠️ **禁止使用带 BOM 头的 UTF-8**（Windows 记事本默认可能会添加 BOM，会导致解析失败）。
    *   推荐使用 VS Code 或 Sublime Text 编辑并保存。
*   **Logo 图片**：
    *   剧本 JSON 中的 `logo` 字段必须是有效的 URL（以 `http://` 或 `https://` 开头）。
    *   确保图片链接可以直接访问，没有防盗链限制。

---

## 🚫 2. 命名规范（重要）

文件名和目录名不仅影响文件存储，还直接关系到 URL 的生成。为了确保跨平台（Windows/Mac/Linux）和 Web 访问的兼容性，请严格遵守以下规则：

*   **禁止使用特殊字符**：
    *   ❌ `#` (井号) - 会被浏览器解析为锚点，导致请求截断。
    *   ❌ `&` (和号) - 会被解析为 URL 参数分隔符。
    *   ❌ `?` (问号) - URL 参数标识。
    *   ❌ ` ` (空格) - 虽然可以编码，但容易引起混淆，建议替换。
*   **推荐命名方式**：
    *   ✅ 使用**下划线** `_` 或**连字符** `-` 代替空格和特殊符号。
    *   ✅ 仅使用中文、英文、数字、`.`、`_`、`-`。
    *   示例：
        *   ❌ `SUI染钟楼投稿&火乐杯剧本/#死无定数-Matt.json`
        *   ✅ `SUI染钟楼投稿_and_火乐杯剧本/死无定数-Matt.json`
*   **关于 `+` 等字符**：加载剧本时会对路径做 URL 编码（见下方「开发约定」），因此文件名中的 `+` 等不会导致 404；若已有剧本含 `+`，无需改名。

---

## 👩‍💻 2.1 开发约定（与编辑器/IDE 无关）

凡在代码中**根据剧本的 path/filePath 去 fetch 剧本 JSON** 时，必须使用统一工具，避免手拼 URL 导致特殊字符 404：

*   **唯一入口**：使用 `src/utils/scriptUrl.ts` 中的 **`buildScriptFetchUrl(filePath)`** 得到请求 URL，不要手写 `baseUrl + path` 或自行拼接。
*   **新增/修改加载逻辑**：预加载、导出、离线等任何「按 path 请求剧本」的代码，都应复用 `buildScriptFetchUrl`，不要重复实现编码逻辑。

这样无论使用 Cursor、VS Code、JetBrains 等何种编辑器和协作方式，只要按上述约定编码，新增剧本都不会因路径中的 `+`、空格等再出现 404。

---

## 🛠️ 3. 上传与发布流程

每次添加新剧本时，请严格按照以下步骤操作：

### 步骤 1: 放入文件
将您的 `.json` 剧本文件放入 `public/juben` 目录下的合适子目录中。

### 步骤 2: 执行规范化脚本 (自动修复)
在项目根目录下运行以下命令。该脚本会自动扫描 `public/juben` 目录，执行以下操作：
1.  自动重命名包含 `#`、`&`、空格的文件和目录。
2.  自动去除 `.json` 文件的 UTF-8 BOM 头。

```bash
npm run normalize
```

> **注意**：请观察控制台输出，确认是否有文件被重命名或修复。

### 步骤 3: 生成索引
运行以下命令重新生成 `public/juben-index.json` 索引文件。该命令会扫描所有剧本，提取元数据并生成列表。

```bash
npm run generate-script-index
```

> **检查点**：观察控制台输出，确认生成的剧本数量是否符合预期，是否有报错信息（如 Logo 无效警告）。

### 步骤 4: 本地验证
启动本地开发服务器进行验证：

```bash
npm run dev
```

打开浏览器（通常是 `http://localhost:5173`），尝试加载新添加的剧本。
*   ✅ **成功**：剧本能正常显示角色列表。
*   ❌ **失败**：如果一直 Loading 或报错，请检查控制台（F12 -> Console / Network）的错误信息。

### 步骤 5: 提交代码
确认无误后，将改动提交到 Git 仓库。

```bash
git add .
git commit -m "feat: 新增剧本 [剧本名称]"
git push
```

---

## ❓ 常见问题排查

| 现象 | 可能原因 | 解决方案 |
|Data | Cause | Solution |
| :--- | :--- | :--- |
| **加载时提示 "SyntaxError: Unexpected token <"** | 1. 文件名含 `#` 或 `&` 导致请求了错误的路径（返回了 index.html）<br>2. 文件路径在索引中未更新 | 1. 运行 `npm run normalize` 修复文件名<br>2. 运行 `npm run generate-script-index` 更新索引 |
| **加载时提示 "SyntaxError: Unexpected token ﻿"** | JSON 文件包含 BOM 头 | 运行 `npm run normalize` 自动去除 BOM |
| **剧本列表中没有新剧本** | 索引文件未更新 | 运行 `npm run generate-script-index` |
| **图片无法显示** | 图片 URL 无效或有防盗链 | 检查 JSON 中的 `logo` 字段，尝试在浏览器直接打开该链接 |

---

## 🔧 维护工具说明

项目内置了以下维护脚本（位于 `scripts/` 目录）：

*   `normalize-scripts.js` (`npm run normalize`): 文件名清洗、BOM 去除。
*   `generate-script-index.js` (`npm run generate-script-index`): 索引生成、元数据提取、重复检测。

请定期运行这些工具以保持剧本库的健康状态。
