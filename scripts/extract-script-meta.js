import fs from 'fs';
import path from 'path';

// 剧本目录
const SCRIPT_DIR = path.join(process.cwd(), 'public', 'juben');
// 输出索引文件
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'script-index.ts');

// 确保输出目录存在
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

// 提取单个剧本的元数据和完整内容
function extractScriptData(scriptPath, filename) {
  try {
    const content = fs.readFileSync(scriptPath, 'utf8');
    const data = JSON.parse(content);
    
    // 寻找id为_meta的条目
    let targetMetaEntry = data.find(item => item.id === '_meta');
    
    // 如果没找到，尝试寻找id为meta的条目
    if (!targetMetaEntry) {
      targetMetaEntry = data.find(item => item.id === 'meta');
    }
    
    if (!targetMetaEntry) {
      console.warn(`警告: 剧本 ${filename} 缺少 meta 条目`);
      return null;
    }
    
    // 提取基本信息
    return {
      id: filename.replace('.json', ''),
      filename,
      name: targetMetaEntry.name || filename.replace('.json', ''),
      logo: targetMetaEntry.logo || '',
      type: '官方', // 默认为官方类型
      content: data // 直接嵌入完整内容
    };
  } catch (error) {
    console.error(`错误处理剧本 ${filename}:`, error.message);
    return null;
  }
}

// 遍历目录提取所有剧本数据
function buildScriptIndex() {
  console.log('开始提取剧本数据...');
  
  const scriptIndex = [];
  const scriptNames = new Set();
  
  // 遍历官方已发行剧本目录
  const officialDir = path.join(SCRIPT_DIR, '官方已发行剧本');
  if (fs.existsSync(officialDir)) {
    const officialFiles = fs.readdirSync(officialDir);
    
    for (const file of officialFiles) {
      if (file.endsWith('.json') && !file.startsWith('-')) {
        const scriptPath = path.join(officialDir, file);
        const data = extractScriptData(scriptPath, `官方已发行剧本/${file}`);
        if (data && !scriptNames.has(data.name)) {
          scriptIndex.push(data);
          scriptNames.add(data.name);
        }
      }
    }
  }
  
  console.log(`成功提取 ${scriptIndex.length} 个剧本的数据`);
  
  // 生成TypeScript文件
  const tsContent = `// 剧本数据索引
// 自动生成，请勿手动修改

interface ScriptMeta {
  id: string;
  filename: string;
  name: string;
  logo: string;
  type: string;
  content: any[];
}

export const scriptIndex: ScriptMeta[] = ${JSON.stringify(scriptIndex, null, 2)};

export default scriptIndex;
`;
  
  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, tsContent);
  console.log(`剧本索引已生成到 ${OUTPUT_FILE}`);
}

// 运行脚本
buildScriptIndex();
