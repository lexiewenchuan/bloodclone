import fs from 'fs';
import path from 'path';

const jubenDir = '/Users/chenweixiang/trea/血染工具/juben';
const publicJubenDir = '/Users/chenweixiang/trea/血染工具/public/juben';
const scriptIndexPath = '/Users/chenweixiang/trea/血染工具/src/data/script-index.ts';

const directories = [
  { name: '0213 7-9人中型剧本', type: '7-9人中型剧本' },
  { name: '0213 华灯角色设计大赛', type: '华灯角色设计大赛' },
  { name: '0213 华灯剧本创作大赛', type: '华灯剧本创作大赛' },
  { name: '0213 经典混合', type: '经典混合' },
  { name: '0213 山雨欲来体验剧本', type: '山雨欲来体验剧本' },
  { name: '0213 特别的玩法', type: '特别的玩法' },
  { name: '0213 汀西维尔', type: '汀西维尔' },
  { name: '0213 旋转木马', type: '旋转木马' },
  { name: '0213 botc', type: 'botc世界杯优选' }
];

// Current scripts in index
const currentScripts = [
  { id: '暗流涌动', name: '暗流涌动', author: '', type: '官方', content: null },
  { id: '黯月初升', name: '黯月初升', author: '', type: '官方', content: null },
  { id: '梦殒春宵', name: '梦殒春宵', author: '', type: '官方', content: null },
  { id: '无上愉悦汀', name: '无上愉悦·汀', author: '', type: '官方', content: null },
  { id: '窃窃私语汀', name: '窃窃私语·汀', author: '', type: '官方', content: null },
  { id: '九转千层', name: '九转千层', author: 'Henrik', type: 'botc世界杯优选', content: null },
  { id: '偷天换日', name: '偷天换日', author: '', type: 'botc世界杯优选', content: null },
  { id: '全面肃清', name: '全面肃清', author: 'Soup', type: 'botc世界杯优选', content: null },
  { id: '回旋迷阵', name: '回旋迷阵', author: 'Kyle J', type: 'botc世界杯优选', content: null },
  { id: '大权在握v4', name: '大权在握v4', author: '', type: 'botc世界杯优选', content: null },
  { id: '好事多磨', name: '好事多磨', author: '', type: 'botc世界杯优选', content: null },
  { id: '尔虞我诈', name: '尔虞我诈', author: '', type: 'botc世界杯优选', content: null },
  { id: '心理博弈X-Habby', name: '心理博弈', author: 'Habby', type: 'botc世界杯优选', content: null },
  { id: '心理博弈XI-Habby', name: '心理博弈XI', author: 'Habby', type: 'botc世界杯优选', content: null },
  { id: '心理博弈v8.0.0', name: '心理博弈', author: 'Habby', type: 'botc世界杯优选', content: null },
  { id: '心理博弈v9.0.0-Habby', name: '心理博弈v9.0.0', author: 'Habby', type: 'botc世界杯优选', content: null },
  { id: '恶魔谜城v7', name: '恶魔谜城v7', author: 'Cosmo', type: 'botc世界杯优选', content: null },
  { id: '杳无音信', name: '杳无音信v4.2', author: 'OJ', type: 'botc世界杯优选', content: null },
  { id: '横行霸道', name: '横行霸道', author: 'Manny', type: 'botc世界杯优选', content: null },
  { id: '横行霸道V5.0-Manny', name: '横行霸道v5', author: 'Manny', type: 'botc世界杯优选', content: null },
  { id: '欲盖弥彰', name: '欲盖弥彰', author: 'Milk', type: 'botc世界杯优选', content: null },
  { id: '生日宴会', name: '生日宴会！', author: '', type: 'botc世界杯优选', content: null },
  { id: '瞒天过海v8', name: '瞒天过海v8', author: 'Lau', type: 'botc世界杯优选', content: null },
  { id: '瞒天过海v9.0.0-Lau', name: '瞒天过海v9.0.0', author: 'Lau', type: 'botc世界杯优选', content: null },
  { id: '蓝榭街区', name: '蓝榭街区', author: 'Noname', type: 'botc世界杯优选', content: null },
  { id: '觅影寻踪', name: '觅影寻踪', author: 'Narninian & Zaba', type: 'botc世界杯优选', content: null },
  { id: '觅影寻踪v6.1.0-NarninianZaba', name: '觅影寻踪v6.1.0', author: 'Narninian & Zaba', type: 'botc世界杯优选', content: null },
  { id: '醉歌乱舞', name: '醉歌乱舞', author: '', type: 'botc世界杯优选', content: null },
  { id: '银河漫步', name: '银河漫步', author: 'Ekin', type: 'botc世界杯优选', content: null },
  { id: '银河漫步v2.2.0-Ekin', name: '银河漫步v2.2.0', author: 'Ekin', type: 'botc世界杯优选', content: null }
];

const newScripts = [];

for (const dir of directories) {
  const dirPath = path.join(jubenDir, dir.name);
  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory not found: ${dirPath}`);
    continue;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let content;
    try {
      content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.warn(`Skipping invalid JSON file: ${filePath}`);
      continue;
    }
    
    let name = '';
    let author = '';
    
    // Try to find _meta
    const meta = content.find(item => item.id === '_meta');
    if (meta) {
      name = meta.name || '';
      author = meta.author || '';
    }
    
    // If name is still empty, parse from filename
    if (!name) {
      // Filename pattern like "#Name-Author.json" or "123#Name-Author.json"
      const baseName = file.replace('.json', '');
      const parts = baseName.split('#');
      const mainPart = parts.length > 1 ? parts[1] : parts[0];
      const subParts = mainPart.split('-');
      name = subParts[0] || baseName;
      author = subParts[1] || '';
    }

    const scriptId = file.replace('.json', '');
    
    // Check if it already exists in currentScripts or newScripts
    const exists = currentScripts.some(s => s.id === scriptId && s.type === dir.type) || 
                   newScripts.some(s => s.id === scriptId && s.type === dir.type);
    
    if (!exists) {
      newScripts.push({
        id: scriptId,
        name: name,
        author: author,
        type: dir.type,
        content: null
      });
    }

    // Copy file to public
    const targetDir = path.join(publicJubenDir, dir.type);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(filePath, path.join(targetDir, file));
  }
}

const allScripts = [...currentScripts, ...newScripts];

// Generate the script-index.ts content
const tsContent = `import { Script } from '../types';

// 剧本仓库
const scriptRepository: Script[] = ${JSON.stringify(allScripts, null, 2)};

export default scriptRepository;
`;

fs.writeFileSync(scriptIndexPath, tsContent);
console.log(`Successfully updated ${scriptIndexPath} with ${allScripts.length} scripts.`);
