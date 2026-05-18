import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOWNLOAD_DIR = path.join(PROJECT_ROOT, 'public', 'image', 'downloaded');
const SCRIPTS_JSON_PATH = path.join(PROJECT_ROOT, 'public', 'scripts.json');

// 确保下载目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 生成 URL 的 MD5 哈希作为文件名
function getHashFilename(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  return `${hash}.webp`;
}

// 下载并转换图片
async function downloadAndConvertImage(url, outputPath) {
  if (fs.existsSync(outputPath)) {
    return true; // 已经存在，跳过
  }

  try {
    const response = await axios({
      url,
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    await sharp(response.data)
      .webp({ quality: 80 })
      .toFile(outputPath);

    console.log(`✅ 成功下载并转换: ${url} -> ${path.basename(outputPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ 下载失败: ${url}`, error.message);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(SCRIPTS_JSON_PATH)) {
    console.error('❌ 未找到 public/scripts.json 文件');
    process.exit(1);
  }

  const raw = fs.readFileSync(SCRIPTS_JSON_PATH, 'utf-8');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error('❌ 解析 public/scripts.json 失败:', error.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('❌ public/scripts.json 格式错误: 顶层应为数组');
    process.exit(1);
  }

  let modified = false;
  let processedCount = 0;
  let localizedCount = 0;

  for (const item of data) {
    const logo = typeof item.logo === 'string' ? item.logo.trim() : '';
    if (!logo || !logo.startsWith('http')) {
      continue;
    }

    processedCount++;

    const filename = getHashFilename(logo);
    const outputPath = path.join(DOWNLOAD_DIR, filename);
    const relativePath = `/image/downloaded/${filename}`;

    const success = await downloadAndConvertImage(logo, outputPath);
    if (success) {
      item.logo = relativePath;
      modified = true;
      localizedCount++;
    }
  }

  if (modified) {
    fs.writeFileSync(SCRIPTS_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(
      `\n✨ public/scripts.json 处理完成：共发现需要本地化的 logo ${processedCount} 个，其中成功 ${localizedCount} 个。`,
    );
  } else {
    console.log('\nℹ️ public/scripts.json 中未发现需要本地化的远程 logo，或全部已是本地路径。');
  }
}

main().catch((error) => {
  console.error('❌ 运行 localize-scripts-index 失败:', error);
  process.exit(1);
});

