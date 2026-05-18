import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPTS_JSON_PATH = path.join(__dirname, '../public/scripts.json');
const JUBEN_DIR = path.join(__dirname, '../public/juben');

function main() {
  console.log('开始修复索引文件中的路径大小写问题...');

  if (!fs.existsSync(SCRIPTS_JSON_PATH)) {
    console.error(`scripts.json 不存在: ${SCRIPTS_JSON_PATH}`);
    return;
  }

  const scriptsData = JSON.parse(fs.readFileSync(SCRIPTS_JSON_PATH, 'utf-8'));

  const actualDirs = new Set(fs.readdirSync(JUBEN_DIR).filter(f => fs.statSync(path.join(JUBEN_DIR, f)).isDirectory()));

  console.log(`实际目录列表: ${Array.from(actualDirs).join(', ')}`);

  let fixedCount = 0;
  const newScripts = scriptsData.map(script => {
    if (!script.path) return script;

    const pathParts = script.path.split('/');
    if (pathParts.length >= 2) {
      const dirName = pathParts[1];
      const actualDir = Array.from(actualDirs).find(d => 
        d.toLowerCase() === dirName.toLowerCase()
      );
      
      if (actualDir && actualDir !== dirName) {
        console.log(`修复路径: "${script.path}" -> "${pathParts[0]}/${actualDir}/${pathParts.slice(2).join('/')}"`);
        fixedCount++;
        return {
          ...script,
          path: `${pathParts[0]}/${actualDir}/${pathParts.slice(2).join('/')}`
        };
      }
    }
    return script;
  });

  console.log(`\n共修复了 ${fixedCount} 个路径`);

  fs.writeFileSync(SCRIPTS_JSON_PATH, JSON.stringify(newScripts, null, 2), 'utf-8');
  console.log(`\n索引文件已更新: ${SCRIPTS_JSON_PATH}`);
}

main();