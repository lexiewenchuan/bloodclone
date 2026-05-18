import fs from 'fs';
import path from 'path';

const jubenDir = './public/juben';

function renameFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
            renameFiles(fullPath);
        } else if (item.includes('#')) {
            const newName = item.replace(/#/g, '');
            const newPath = path.join(dir, newName);
            console.log(`Renaming: ${fullPath} -> ${newPath}`);
            fs.renameSync(fullPath, newPath);
        }
    }
}

renameFiles(jubenDir);

// 同时更新 script-index.ts
const scriptIndexPath = './src/data/script-index.ts';
let content = fs.readFileSync(scriptIndexPath, 'utf-8');
// 简单的字符串替换，因为 id 里也包含 #
const newContent = content.replace(/"id": "#/g, '"id": "');
fs.writeFileSync(scriptIndexPath, newContent);
console.log('Updated script-index.ts');
