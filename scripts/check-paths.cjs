const fs = require('fs');
const path = require('path');

console.log('检查 public 和 dist 目录的差异...\n');

const publicDir = path.join(__dirname, '../public/juben');
const distDir = path.join(__dirname, '../dist/juben');

// 检查 Botc世界杯优选 目录
const botcPublic = path.join(publicDir, 'Botc世界杯优选');
const botcDist = path.join(distDir, 'Botc世界杯优选');

console.log('public 目录:', botcPublic);
console.log('dist 目录:', botcDist);
console.log('public 目录存在:', fs.existsSync(botcPublic));
console.log('dist 目录存在:', fs.existsSync(botcDist));

// 检查特定文件
const testFile = '双生超新星v3.0.0-Hystrex.json';
const testFilePublic = path.join(botcPublic, testFile);
const testFileDist = path.join(botcDist, testFile);

console.log('\n测试文件:', testFile);
console.log('public 文件存在:', fs.existsSync(testFilePublic));
console.log('dist 文件存在:', fs.existsSync(testFileDist));

if (fs.existsSync(testFilePublic) && fs.existsSync(testFileDist)) {
  const publicContent = fs.readFileSync(testFilePublic, 'utf8');
  const distContent = fs.readFileSync(testFileDist, 'utf8');
  console.log('文件内容一致:', publicContent === distContent);
}

// 检查 scripts.json
const scriptsPublic = path.join(__dirname, '../public/scripts.json');
const scriptsDist = path.join(__dirname, '../dist/scripts.json');

console.log('\nscripts.json:');
console.log('public 文件存在:', fs.existsSync(scriptsPublic));
console.log('dist 文件存在:', fs.existsSync(scriptsDist));

if (fs.existsSync(scriptsPublic) && fs.existsSync(scriptsDist)) {
  const publicScripts = JSON.parse(fs.readFileSync(scriptsPublic, 'utf8'));
  const distScripts = JSON.parse(fs.readFileSync(scriptsDist, 'utf8'));
  
  // 查找双生超新星剧本
  const testScriptPublic = publicScripts.find(s => s.name.includes('双生超新星v3.0.0-Hystrex'));
  const testScriptDist = distScripts.find(s => s.name.includes('双生超新星v3.0.0-Hystrex'));
  
  console.log('\n双生超新星剧本:');
  console.log('public 中路径:', testScriptPublic?.path);
  console.log('dist 中路径:', testScriptDist?.path);
}
