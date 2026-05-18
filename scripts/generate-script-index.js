import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JUBEN_DIR = path.join(__dirname, '../public/juben');
const OUTPUT_FILE = path.join(__dirname, '../public/juben-index.json');
const DOWNLOAD_DIR = path.join(__dirname, '../public/image/downloaded');

// 确保下载目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 统计信息
const stats = {
    filesScanned: 0,
    filesValid: 0,
    imagesToDownload: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    retried: 0,
    filesModified: 0,
    namesCleaned: 0
};

// 生成 URL 的 MD5 哈希作为文件名
function getHashFilename(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return `${hash}.webp`;
}

// 校验 URL 有效性
async function validateUrl(url, timeout = 5000) {
    if (!url || !url.startsWith('http')) return false;

    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        const request = client.request(url, {
            method: 'HEAD',
            timeout: timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(true);
            } else if (res.statusCode === 404) {
                resolve(false);
            } else {
                resolve(true);
            }
            res.resume();
        });

        request.on('error', (err) => {
            if (err.code === 'ENOTFOUND') {
                resolve(false);
            } else {
                resolve(true);
            }
        });

        request.on('timeout', () => {
            request.destroy();
            resolve(true);
        });

        request.end();
    });
}

function isValidScript(data) {
    if (!Array.isArray(data)) {
        return false;
    }

    let hasMeta = false;
    let hasValidRole = false;

    for (const item of data) {
        if (!item || typeof item !== 'object') continue;

        if (item.id === '_meta' || (item.name && !item.team && !item.ability)) {
            if (item.name) {
                hasMeta = true;
            }
        }

        if (item.name && item.team && item.ability) {
            hasValidRole = true;
        }
    }

    return hasMeta && hasValidRole;
}

function extractMeta(data) {
    const meta = data.find(item => item && item.id === '_meta') ||
                 data.find(item => item && item.author && !item.team && !item.ability) ||
                 data.find(item => item && item.name && !item.team && !item.ability);

    return {
        name: (meta?.name || '').trim(),
        author: (meta?.author || '').trim(),
        logo: (meta?.logo || '').trim()
    };
}

// 清洗剧本名称
function cleanName(name) {
    if (!name || typeof name !== 'string') return null;
    
    let cleaned = name;
    let original = name;
    let reasons = [];
    
    // 规则1: 去除 # 前缀
    if (cleaned.startsWith('#')) {
        cleaned = cleaned.substring(1).trim();
        reasons.push('去除#前缀');
    }
    
    // 规则2: 去除数字#前缀 (如 666#旁观者清)
    const numHashMatch = cleaned.match(/^(\d+)#(.+)$/);
    if (numHashMatch) {
        cleaned = numHashMatch[2].trim();
        reasons.push('去除数字#前缀');
    }
    
    // 规则3: 去除 数字_ 前缀 (如 1_866_劳资蜀道山)
    const numUnderscoreMatch = cleaned.match(/^(\d+_)+(.+)$/);
    if (numUnderscoreMatch) {
        cleaned = numUnderscoreMatch[2].trim();
        reasons.push('去除数字_前缀');
    }
    
    // 规则4: 去除 -作者名 后缀
    // 作者名可以包含字母、数字、空格、下划线
    const authorMatch = cleaned.match(/^(.+?)(\s*-\s*[A-Za-z][A-Za-z0-9_\s]*)$/);
    if (authorMatch) {
        const beforeAuthor = authorMatch[1].trim();
        if (beforeAuthor && beforeAuthor.length > 0) {
            cleaned = beforeAuthor;
            reasons.push('去除作者后缀');
        }
    }
    
    if (cleaned !== original) {
        return {
            original,
            cleaned,
            reasons: reasons.join(', ')
        };
    }
    
    return null;
}

// 清洗并更新剧本名称
function cleanAndUpdateScriptName(data, fullPath) {
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item || typeof item !== 'object') continue;
        
        // 判断是否为 meta 项
        const isMeta = item.id === '_meta' || 
                       (item.name && !item.team && !item.ability) ||
                       (item.name && item.author && !item.team);
        
        if (isMeta && item.name) {
            const result = cleanName(item.name);
            if (result) {
                item.original_name = result.original;
                item.name = result.cleaned;
                return {
                    original: result.original,
                    cleaned: result.cleaned,
                    reasons: result.reasons
                };
            }
        }
    }
    return null;
}

function extractContent(data) {
    const roles = {};
    const roleCounts = {
        townsfolk: 0,
        outsider: 0,
        minion: 0,
        demon: 0,
        traveler: 0,
        fabled: 0
    };

    for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        if (item.id === '_meta' || (item.name && !item.team && !item.ability)) continue;

        if (item.name && item.team) {
            let team = item.team.toLowerCase();
            if (team === '镇民') team = 'townsfolk';
            else if (team === '外来者') team = 'outsider';
            else if (team === '爪牙') team = 'minion';
            else if (team === '恶魔') team = 'demon';
            else if (team === '旅行者') team = 'traveler';
            else if (team === '传奇角色') team = 'fabled';
            
            if (roleCounts.hasOwnProperty(team)) {
                roleCounts[team]++;
            }
            
            roles[item.name] = (item.ability || '').trim();
        }
    }
    
    return { roleCounts, roles };
}

function isScriptContentEqual(contentA, contentB) {
    if (!contentA || !contentB) return false;

    const teams = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler', 'fabled'];
    for (const team of teams) {
        if (contentA.roleCounts[team] !== contentB.roleCounts[team]) return false;
    }
    
    const rolesA = Object.keys(contentA.roles);
    const rolesB = Object.keys(contentB.roles);
    
    if (rolesA.length !== rolesB.length) return false;
    
    for (const name of rolesA) {
        if (!contentB.roles.hasOwnProperty(name)) return false;
        if (contentA.roles[name] !== contentB.roles[name]) return false;
    }
    
    return true;
}

// 并发控制函数
async function asyncPool(poolLimit, array, iteratorFn) {
    const ret = [];
    const executing = [];
    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item, array));
        ret.push(p);

        if (poolLimit <= array.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(ret);
}

// 第一阶段：扫描所有文件，收集需要下载的图片
async function collectImages(dir, baseType = '', imageMap = new Map(), filesToProcess = []) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await collectImages(fullPath, item, imageMap, filesToProcess);
        } else if (item.endsWith('.json')) {
            stats.filesScanned++;
            try {
                let content = fs.readFileSync(fullPath, 'utf-8');
                if (content.charCodeAt(0) === 0xFEFF) {
                    content = content.slice(1);
                }
                const data = JSON.parse(content);

                if (isValidScript(data)) {
                    stats.filesValid++;
                    const meta = extractMeta(data);
                    const contentInfo = extractContent(data);
                    const relativePath = path.relative(JUBEN_DIR, fullPath).split(path.sep).join('/');
                    
                    const fileNameId = path.basename(item, '.json');
                    
                    // 清洗剧本名称
                    let nameCleanResult = null;
                    for (let i = 0; i < data.length; i++) {
                        const item = data[i];
                        if (!item || typeof item !== 'object') continue;
                        
                        const isMeta = item.id === '_meta' || 
                                       (item.name && !item.team && !item.ability) ||
                                       (item.name && item.author && !item.team);
                        
                        if (isMeta && item.name) {
                            nameCleanResult = cleanName(item.name);
                            if (nameCleanResult) {
                                item.original_name = nameCleanResult.original;
                                item.name = nameCleanResult.cleaned;
                                stats.namesCleaned++;
                                console.log(`[名称清洗] ${fileNameId}: "${nameCleanResult.original}" -> "${nameCleanResult.cleaned}" (${nameCleanResult.reasons})`);
                                break;
                            }
                        }
                    }
                    
                    // 使用清洗后的名称
                    const scriptName = nameCleanResult ? nameCleanResult.cleaned : meta.name;
                    
                    // 收集需要下载的图片
                    const imagesToReplace = [];
                    const logoToReplace = null;
                    
                    // 收集角色图片
                    for (let i = 0; i < data.length; i++) {
                        const role = data[i];
                        if (role && typeof role === 'object' && role.image && role.image.startsWith('http')) {
                            const url = role.image;
                            const filename = getHashFilename(url);
                            const localPath = `/blood-on-the-clocktower/image/downloaded/${filename}`;
                            
                            if (!imageMap.has(url)) {
                                imageMap.set(url, {
                                    filename,
                                    localPath,
                                    downloaded: false
                                });
                                stats.imagesToDownload++;
                            }
                            
                            imagesToReplace.push({
                                index: i,
                                url: url,
                                localPath: localPath
                            });
                        }
                    }
                    
                    // 收集剧本 logo
                    if (meta.logo && meta.logo.startsWith('http')) {
                        const url = meta.logo;
                        const filename = getHashFilename(url);
                        const localPath = `/blood-on-the-clocktower/image/downloaded/${filename}`;
                        
                        if (!imageMap.has(url)) {
                            imageMap.set(url, {
                                filename,
                                localPath,
                                downloaded: false
                            });
                            stats.imagesToDownload++;
                        }
                        
                        filesToProcess.push({
                            fullPath,
                            data,
                            fileNameId,
                            relativePath,
                            type: baseType,
                            scriptName,
                            author: meta.author,
                            meta,
                            contentInfo,
                            imagesToReplace,
                            logoToReplace: {
                                url: meta.logo,
                                localPath
                            },
                            nameCleaned: !!nameCleanResult
                        });
                    } else {
                        filesToProcess.push({
                            fullPath,
                            data,
                            fileNameId,
                            relativePath,
                            type: baseType,
                            scriptName,
                            author: meta.author,
                            meta,
                            contentInfo,
                            imagesToReplace,
                            logoToReplace: null,
                            nameCleaned: !!nameCleanResult
                        });
                    }
                }
            } catch (error) {
                console.warn(`无法解析文件 ${item}:`, error.message);
            }
        }
    }

    return { imageMap, filesToProcess };
}

// 第二阶段：批量下载所有图片
async function downloadAllImages(imageMap, isRetry = false) {
    const entries = Array.from(imageMap.entries());
    let completed = 0;
    
    await asyncPool(20, entries, async ([url, info]) => {
        const localPath = path.join(DOWNLOAD_DIR, info.filename);
        
        // 重试模式下，跳过已下载的
        if (isRetry && info.downloaded) {
            completed++;
            return;
        }
        
        // 普通模式下，如果文件已存在则跳过
        if (!isRetry && fs.existsSync(localPath)) {
            stats.skipped++;
            imageMap.get(url).downloaded = true;
            completed++;
            if (completed % 50 === 0) {
                console.log(`  进度: ${completed}/${imageMap.size}`);
            }
            return;
        }
        
        try {
            const response = await axios({
                url,
                responseType: 'arraybuffer',
                timeout: 15000, // 重试时增加超时时间
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            await sharp(response.data)
                .webp({ quality: 80 })
                .toFile(localPath);
            
            if (isRetry) {
                stats.retried++;
            } else {
                stats.downloaded++;
            }
            imageMap.get(url).downloaded = true;
        } catch (error) {
            if (!isRetry) {
                stats.failed++;
            }
            // 下载失败，保持原状态
        }
        
        completed++;
        if (completed % 50 === 0) {
            console.log(`  进度: ${completed}/${imageMap.size}`);
        }
    });
}

// 下载图片（包含重试机制）
async function downloadImagesWithRetry(imageMap) {
    console.log(`\n🚀 开始下载 ${imageMap.size} 张图片...`);
    
    // 第一轮下载
    await downloadAllImages(imageMap, false);
    
    console.log(`✅ 第一轮下载完成`);
    
    // 如果有失败的，进行第二轮重试
    if (stats.failed > 0) {
        const failedCount = stats.failed;
        console.log(`\n🔄 开始重试 ${failedCount} 张失败的图片...`);
        
        // 重置失败计数（重试成功会累加到 retried）
        stats.failed = 0;
        
        await downloadAllImages(imageMap, true);
        
        console.log(`✅ 重试完成，成功重试: ${stats.retried} 张`);
    }
}

// 第三阶段：批量修改文件
async function modifyFiles(filesToProcess, imageMap) {
    console.log(`\n🔄 开始修改 ${filesToProcess.length} 个剧本文件...`);
    
    for (const fileInfo of filesToProcess) {
        let isModified = false;
        
        // 替换角色图片
        for (const replace of fileInfo.imagesToReplace) {
            const info = imageMap.get(replace.url);
            if (info && info.downloaded) {
                const role = fileInfo.data[replace.index];
                role.original_image = role.image;
                role.image = replace.localPath;
                isModified = true;
            }
        }
        
        // 替换剧本 logo
        if (fileInfo.logoToReplace) {
            const info = imageMap.get(fileInfo.logoToReplace.url);
            if (info && info.downloaded) {
                const meta = fileInfo.data.find(item => item && (item.id === '_meta' || (item.name && !item.team && !item.ability)));
                if (meta) {
                    meta.original_logo = meta.logo;
                    meta.logo = fileInfo.logoToReplace.localPath;
                    isModified = true;
                }
            }
        }
        
        // 名称清洗的修改也需要保存
        if (fileInfo.nameCleaned) {
            isModified = true;
        }
        
        if (isModified) {
            fs.writeFileSync(fileInfo.fullPath, JSON.stringify(fileInfo.data, null, 2), 'utf-8');
            stats.filesModified++;
        }
    }
    
    console.log(`✅ 修改完成，共修改 ${stats.filesModified} 个文件`);
}

async function generateIndex() {
    console.log('🔍 第一阶段：扫描所有剧本文件...');
    
    if (!fs.existsSync(JUBEN_DIR)) {
        console.error(`剧本目录不存在: ${JUBEN_DIR}`);
        return;
    }

    const { imageMap, filesToProcess } = await collectImages(JUBEN_DIR);
    
    console.log(`  扫描完成: ${stats.filesScanned} 个文件`);
    console.log(`  有效剧本: ${stats.filesValid} 个`);
    console.log(`  需要下载的图片: ${imageMap.size} 张`);
    
    // 第二阶段：下载所有图片（自动重试失败的）
    await downloadImagesWithRetry(imageMap);
    
    // 第三阶段：修改文件
    await modifyFiles(filesToProcess, imageMap);
    
    // 第四阶段：生成索引
    console.log('\n📋 第四阶段：生成索引...');
    
    const scripts = filesToProcess.map(fileInfo => ({
        id: fileInfo.fileNameId,
        name: fileInfo.scriptName,
        author: fileInfo.author || null,
        logo: fileInfo.data.find(item => item && (item.id === '_meta' || (item.name && !item.team && !item.ability)))?.logo || null,
        type: [fileInfo.type],
        filePath: `juben/${fileInfo.relativePath}`,
        _fileName: fileInfo.fileNameId,
        _dirName: fileInfo.type,
        _content: fileInfo.contentInfo
    }));

    // 剧本去重和合并逻辑
    const uniqueScripts = new Map();

    for (const script of scripts) {
        if (!uniqueScripts.has(script.name)) {
            uniqueScripts.set(script.name, [script]);
        } else {
            const existingVersions = uniqueScripts.get(script.name);
            let foundMatch = false;

            for (const existingScript of existingVersions) {
                if (isScriptContentEqual(existingScript._content, script._content)) {
                    for (const type of script.type) {
                        if (!existingScript.type.includes(type)) {
                            existingScript.type.push(type);
                        }
                    }
                    if (!existingScript.logo && script.logo) existingScript.logo = script.logo;
                    if (!existingScript.author && script.author) existingScript.author = script.author;
                    
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                existingVersions.push(script);
            }
        }
    }
    
    const finalScripts = [];
    for (const versions of uniqueScripts.values()) {
        finalScripts.push(...versions);
    }
    
    // 校验 Logo
    let invalidLogoCount = 0;
    await asyncPool(10, finalScripts, async (script) => {
        if (!script.author || script.author.trim() === '') {
            script.author = null;
        }

        if (script.logo && script.logo.startsWith('http')) {
            const isValid = await validateUrl(script.logo);
            if (!isValid) {
                console.log(`[警告] 剧本 "${script.name}" (${script.id}) 的 Logo 无效: ${script.logo}`);
                script.logo = null;
                invalidLogoCount++;
            }
        }
    });
    
    // 清理临时字段
    finalScripts.forEach(s => {
        delete s._content;
        delete s._fileName;
        delete s._dirName;
    });

    const output = {
        version: Date.now(),
        scripts: finalScripts
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
    
    // 打印统计
    console.log('\n' + '='.repeat(50));
    console.log('📊 处理完成！统计信息:');
    console.log('='.repeat(50));
    console.log(`扫描文件: ${stats.filesScanned} 个`);
    console.log(`有效剧本: ${stats.filesValid} 个`);
    console.log(`合并后剧本: ${finalScripts.length} 个`);
    console.log(`无效 Logo: ${invalidLogoCount} 个`);
    console.log('-'.repeat(50));
    console.log(`需要下载图片: ${stats.imagesToDownload} 张`);
    console.log(`✅ 成功下载: ${stats.downloaded} 张`);
    console.log(`⏭️  重复跳过: ${stats.skipped} 张`);
    console.log(`❌ 下载失败: ${stats.failed} 张`);
    console.log(`🔄 成功重试: ${stats.retried} 张`);
    console.log(`📝 修改文件: ${stats.filesModified} 个`);
    console.log(`🧹 名称清洗: ${stats.namesCleaned} 个`);
    console.log('='.repeat(50));
    console.log(`📁 索引文件已生成: ${OUTPUT_FILE}`);
}

function watchFiles() {
    console.log('监听剧本文件变化...');
    
    const watcher = chokidar.watch(JUBEN_DIR, {
        ignored: /(^|[\/\\])\../, 
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 100
        },
        usePolling: true,
        interval: 100
    });

    let isBuilding = false;

    const debouncedGenerate = async () => {
        if (isBuilding) return;
        isBuilding = true;
        try {
            await generateIndex();
        } catch (err) {
            console.error('构建失败:', err);
        } finally {
            isBuilding = false;
        }
    };

    watcher
        .on('add', (path) => {
            console.log(`文件已添加: ${path}`);
            debouncedGenerate();
        })
        .on('change', (path) => {
            console.log(`文件已修改: ${path}`);
            debouncedGenerate();
        })
        .on('unlink', (path) => {
            console.log(`文件已删除: ${path}`);
            debouncedGenerate();
        })
        .on('error', (error) => {
            console.error('监听错误:', error);
        })
        .on('ready', () => {
            console.log('文件监听器已就绪');
        });
}

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');

// 启动
(async () => {
    await generateIndex();

    if (watchMode) {
        watchFiles();
        console.log('文件监听已启动，按 Ctrl+C 停止');
    }
})();
