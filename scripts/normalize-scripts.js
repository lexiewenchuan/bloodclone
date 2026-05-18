
/**
 * 剧本文件规范化脚本
 * 用于自动修复剧本文件的命名和编码问题
 * 
 * 功能：
 * 1. 递归扫描 public/juben 目录
 * 2. 自动重命名包含特殊字符（#, &, 空格等）的文件和目录
 * 3. 自动去除 .json 文件的 UTF-8 BOM 头
 * 
 * 使用方法：
 * node scripts/normalize-scripts.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JUBEN_DIR = path.join(__dirname, '../public/juben');

// 定义需要替换的字符映射
const REPLACEMENTS = [
    { regex: /#/g, replacement: '' },           // 移除 #
    { regex: /&/g, replacement: '_and_' },      // 替换 & 为 _and_
    { regex: /\s+/g, replacement: '_' },        // 替换空格为 _
    // 可以继续添加其他规则
];

/**
 * 清洗文件名
 * @param {string} name 原始文件名
 * @returns {string} 清洗后的文件名
 */
function sanitizeName(name) {
    let newName = name;
    for (const { regex, replacement } of REPLACEMENTS) {
        newName = newName.replace(regex, replacement);
    }
    return newName;
}

/**
 * 递归处理目录
 * @param {string} dir 当前处理的目录路径
 */
function processDirectory(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`Directory not found: ${dir}`);
        return;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // 1. 处理目录名
            const sanitizedDirName = sanitizeName(item);
            let currentDirPath = fullPath;

            if (sanitizedDirName !== item) {
                const newDirPath = path.join(dir, sanitizedDirName);
                if (fs.existsSync(newDirPath)) {
                    console.warn(`[SKIP] Target directory already exists: ${item} -> ${sanitizedDirName}`);
                    // 如果重命名失败，继续处理原目录
                } else {
                    fs.renameSync(fullPath, newDirPath);
                    console.log(`[RENAME DIR] ${item} -> ${sanitizedDirName}`);
                    currentDirPath = newDirPath; // 更新当前路径
                }
            }

            // 递归处理子目录
            processDirectory(currentDirPath);

        } else if (item.endsWith('.json')) {
            // 2. 处理文件名
            let currentFilePath = fullPath;
            const sanitizedFileName = sanitizeName(item);

            if (sanitizedFileName !== item) {
                const newFilePath = path.join(dir, sanitizedFileName);
                if (fs.existsSync(newFilePath)) {
                    console.warn(`[SKIP] Target file already exists: ${item} -> ${sanitizedFileName}`);
                } else {
                    fs.renameSync(fullPath, newFilePath);
                    console.log(`[RENAME FILE] ${item} -> ${sanitizedFileName}`);
                    currentFilePath = newFilePath;
                }
            }

            // 3. 处理文件内容 (BOM)
            processFileContent(currentFilePath);
        }
    }
}

/**
 * 处理文件内容（去除 BOM）
 * @param {string} filePath 文件路径
 */
function processFileContent(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        
        // 检查 BOM (EF BB BF)
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            const newContent = buffer.subarray(3);
            fs.writeFileSync(filePath, newContent);
            console.log(`[FIX BOM] Removed BOM from: ${path.basename(filePath)}`);
        }
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
    }
}

// 主程序
console.log('Starting script normalization...');
console.log(`Scanning directory: ${JUBEN_DIR}`);
processDirectory(JUBEN_DIR);
console.log('Normalization complete.');
