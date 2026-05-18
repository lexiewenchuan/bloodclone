import fs from 'fs';
import path from 'path';

const jubenDir = './public/juben';
const scriptIndexPath = './src/data/script-index.ts';

function sanitize(str) {
    return str
        .replace(/[& \(\),·！\?？!（）]/g, '_') // 替换特殊字符为下划线
        .replace(/_{2,}/g, '_')               // 压缩连续的下划线
        .replace(/^_|_$/g, '');               // 移除首尾下划线
}

// 1. 扫描并重命名所有剧本文件
function processDirectory(dir) {
    const items = fs.readdirSync(dir);
    const map = new Map(); // oldId -> newId

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            const result = processDirectory(fullPath);
            result.forEach((v, k) => map.set(k, v));
        } else if (item.endsWith('.json')) {
            const oldId = item.replace('.json', '');
            const newId = sanitize(oldId);
            
            if (oldId !== newId) {
                const newPath = path.join(dir, newId + '.json');
                console.log(`Renaming: ${item} -> ${newId}.json`);
                fs.renameSync(fullPath, newPath);
            }
            map.set(oldId, newId);
        }
    }
    return map;
}

console.log('Starting sanitization...');
const idMap = processDirectory(jubenDir);

// 2. 更新 script-index.ts
let content = fs.readFileSync(scriptIndexPath, 'utf-8');
let updatedCount = 0;

idMap.forEach((newId, oldId) => {
    // 匹配 "id": "oldId"
    const regex = new RegExp(`"id": "${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
    if (regex.test(content)) {
        content = content.replace(regex, `"id": "${newId}"`);
        updatedCount++;
    }
});

fs.writeFileSync(scriptIndexPath, content);
console.log(`Finished! Updated ${updatedCount} script IDs in script-index.ts.`);
