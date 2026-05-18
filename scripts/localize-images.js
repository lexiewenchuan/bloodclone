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
const SCRIPT_INDEX_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'script-index.ts');
const JUBEN_DIR = path.join(PROJECT_ROOT, 'public', 'juben');

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
      timeout: 10000, // 10秒超时
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
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

// 处理单个 JSON 文件
async function processJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data = JSON.parse(content);
    let modified = false;

    // 递归查找并替换图片 URL
    async function traverseAndReplace(obj) {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          await traverseAndReplace(obj[i]);
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
            // 检查是否是图片 URL (简单判断，或者只针对特定字段如 image, logo)
            if (key === 'image' || key === 'logo' || obj[key].match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
              const url = obj[key];
              const filename = getHashFilename(url);
              const localPath = path.join(DOWNLOAD_DIR, filename);
              const relativePath = `/blood-on-the-clocktower/image/downloaded/${filename}`; // 适配 base url

              const success = await downloadAndConvertImage(url, localPath);
              if (success) {
                obj[key] = relativePath;
                modified = true;
              }
            }
          } else {
            await traverseAndReplace(obj[key]);
          }
        }
      }
    }

    await traverseAndReplace(data);

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`📝 更新文件: ${path.relative(PROJECT_ROOT, filePath)}`);
    }
  } catch (error) {
    console.error(`❌ 处理文件失败: ${filePath}`, error.message);
  }
}

// 遍历目录下的所有 JSON 文件
async function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      await processDirectory(fullPath);
    } else if (file.endsWith('.json')) {
      await processJsonFile(fullPath);
    }
  }
}

// 处理 script-index.ts
async function processScriptIndex() {
  if (!fs.existsSync(SCRIPT_INDEX_PATH)) return;

  try {
    let content = fs.readFileSync(SCRIPT_INDEX_PATH, 'utf-8');
    const urlRegex = /"(https?:\/\/[^"]+)"/g;
    let match;
    let modified = false;
    const urlsToReplace = [];

    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[1];
      if (url.match(/\.(png|jpg|jpeg|webp|gif)$/i) || url.includes('logo') || url.includes('image')) {
         urlsToReplace.push(url);
      }
    }

    // 去重
    const uniqueUrls = [...new Set(urlsToReplace)];

    for (const url of uniqueUrls) {
      const filename = getHashFilename(url);
      const localPath = path.join(DOWNLOAD_DIR, filename);
      const relativePath = `/blood-on-the-clocktower/image/downloaded/${filename}`;

      const success = await downloadAndConvertImage(url, localPath);
      if (success) {
        // 全局替换该 URL
        content = content.split(`"${url}"`).join(`"${relativePath}"`);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(SCRIPT_INDEX_PATH, content, 'utf-8');
      console.log(`📝 更新文件: ${path.relative(PROJECT_ROOT, SCRIPT_INDEX_PATH)}`);
    }
  } catch (error) {
    console.error(`❌ 处理 script-index.ts 失败`, error.message);
  }
}

async function main() {
  console.log('🚀 开始本地化图片...');
  
  console.log('\n📦 处理 script-index.ts...');
  await processScriptIndex();

  console.log('\n📦 处理剧本 JSON 文件...');
  await processDirectory(JUBEN_DIR);

  console.log('\n✨ 图片本地化完成！');
}

main().catch(console.error);
