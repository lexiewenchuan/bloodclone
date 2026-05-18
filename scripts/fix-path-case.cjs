const fs = require('fs');
const path = require('path');

console.log('开始修复 scripts.json 中的路径大小写问题...');

// 读取 scripts.json
const scriptsPath = path.join(__dirname, '../public/scripts.json');
const scriptsData = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));

// 获取实际的目录名
const jubenDir = path.join(__dirname, '../public/juben');
const actualDirs = fs.readdirSync(jubenDir).filter(item => 
  fs.statSync(path.join(jubenDir, item)).isDirectory()
);

console.log('实际存在的目录:', actualDirs);

// 修复路径
let fixedCount = 0;
scriptsData.forEach(script => {
  if (script.path) {
    const parts = script.path.split('/');
    if (parts.length >= 2) {
      const dirName = parts[1];
      // 查找实际的目录名（大小写不敏感匹配）
      const actualDir = actualDirs.find(d => 
        d.toLowerCase() === dirName.toLowerCase()
      );
      
      if (actualDir && actualDir !== dirName) {
        parts[1] = actualDir;
        script.path = parts.join('/');
        fixedCount++;
        console.log(`修复路径: ${dirName} -> ${actualDir}`);
      }
    }
  }
});

// 保存修复后的文件
fs.writeFileSync(scriptsPath, JSON.stringify(scriptsData, null, 2));

console.log(`\n修复完成！共修复了 ${fixedCount} 个路径。`);
