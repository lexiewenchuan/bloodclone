const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'public/juben');
let deletedCount = 0;

function hasValidRoles(data) {
    if (Array.isArray(data)) {
        return data.some(item => 
            item.team === 'townsfolk' || 
            item.team === 'outsider' || 
            item.team === 'minion' || 
            item.team === 'demon'
        );
    } else if (typeof data === 'object' && data !== null) {
        return (
            (Array.isArray(data.townsfolk) && data.townsfolk.length > 0) ||
            (Array.isArray(data.outsider) && data.outsider.length > 0) ||
            (Array.isArray(data.minion) && data.minion.length > 0) ||
            (Array.isArray(data.demon) && data.demon.length > 0)
        );
    }
    return false;
}

function cleanInvalidFiles(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            cleanInvalidFiles(fullPath);
        } else if (file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8').trim();
                // 检查是否以 < 开头 (HTML)
                if (content.startsWith('<') || content.startsWith('<!DOCTYPE')) {
                    console.log(`删除无效文件 (HTML): ${fullPath}`);
                    fs.unlinkSync(fullPath);
                    deletedCount++;
                } else {
                    // 尝试解析 JSON
                    try {
                        const data = JSON.parse(content);
                        // 检查是否有有效角色
                        if (!hasValidRoles(data)) {
                            console.log(`删除无效文件 (无有效角色): ${fullPath}`);
                            fs.unlinkSync(fullPath);
                            deletedCount++;
                        }
                        // 检查 name 是否存在 (可选，因为我们有回退机制，但如果完全没内容也不行)
                        // 不过根据用户反馈，有些剧本可能只有 id 没有 name，我们暂时保留，
                        // 因为 build_index_final.py 已经有了从文件名回退的机制。
                        // 这里主要关注是否真的是一个 BotC 剧本文件。
                    } catch (e) {
                        console.log(`删除无效文件 (JSON 解析失败): ${fullPath}`);
                        fs.unlinkSync(fullPath);
                        deletedCount++;
                    }
                }
            } catch (err) {
                console.error(`读取文件失败: ${fullPath}`, err);
            }
        }
    }
}

console.log('开始清理无效 JSON 文件...');
cleanInvalidFiles(targetDir);
console.log(`清理完成，共删除了 ${deletedCount} 个无效文件。`);
