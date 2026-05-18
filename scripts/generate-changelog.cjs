
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');
const CHANGELOG_JSON_PATH = path.join(__dirname, '../src/data/changelog.json');

// Emojis mapping for commit types
const TYPE_EMOJIS = {
  feat: '✨ 新增功能',
  fix: '🐛 问题修复',
  docs: '📚 文档更新',
  style: '💎 样式调整',
  refactor: '📦 代码重构',
  perf: '🚀 性能优化',
  test: '🚨 测试相关',
  build: '🛠 构建系统',
  ci: '⚙️ CI配置',
  chore: '♻️ 其他杂项',
  revert: '🗑 回滚操作'
};

// Helper to run git commands
function runGit(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}

// Get all tags sorted by date (newest first)
function getAllTags() {
  const tagsOutput = runGit('git tag --sort=-creatordate');
  return tagsOutput.split('\n').filter(t => t.trim());
}

// Get commits between two refs
function getCommits(fromRef, toRef) {
  const logFormat = '%s|%h|%ad|%an'; // subject|hash|date|author
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const command = `git log ${range} --pretty=format:"${logFormat}" --date=short`;
  const logs = runGit(command);
  
  if (!logs) return [];

  return logs.split('\n').map(line => {
    const parts = line.split('|');
    if (parts.length < 3) return null;
    const [subject, hash, date, author] = parts;
    return { subject, hash, date, author };
  }).filter(c => c);
}

// Group commits by type
function groupCommits(commits) {
  const groups = {};
  
  commits.forEach(commit => {
    const match = commit.subject.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
    let type = 'chore';
    let scope = '';
    let message = commit.subject;

    if (match) {
      type = match[1];
      scope = match[2];
      message = match[3];
    } else {
        if (message.startsWith('fix')) type = 'fix';
        else if (message.startsWith('feat')) type = 'feat';
        else if (message.startsWith('docs')) type = 'docs';
        else if (message.startsWith('style')) type = 'style';
        else if (message.startsWith('refactor')) type = 'refactor';
        else if (message.startsWith('perf')) type = 'perf';
        else if (message.startsWith('test')) type = 'test';
        else type = 'chore';
    }
    
    type = type.toLowerCase();
    if (!groups[type]) groups[type] = [];
    groups[type].push({ scope, message, hash: commit.hash, author: commit.author });
  });

  return groups;
}

// Generate markdown for a version
function generateVersionEntry(version, date, commits) {
  const groups = groupCommits(commits);
  let entry = `## ${version} - (${date})\n`;
  
  const typeOrder = ['feat', 'fix', 'perf', 'refactor', 'style', 'docs', 'test', 'build', 'ci', 'chore', 'revert'];
  const presentTypes = Object.keys(groups).sort((a, b) => {
    const idxA = typeOrder.indexOf(a);
    const idxB = typeOrder.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  if (presentTypes.length === 0) {
      entry += `- *No significant changes detected.*\n`;
      return entry;
  }

  presentTypes.forEach(type => {
    const typeLabel = TYPE_EMOJIS[type] || `🔧 ${type}`;
    entry += `### ${typeLabel}\n`;
    groups[type].forEach(commit => {
      const scopeStr = commit.scope ? `**${commit.scope}**: ` : '';
      entry += `- ${scopeStr}${commit.message}\n`;
    });
    entry += '\n';
  });

  return entry;
}

function parseExistingChangelog(content) {
    const entries = [];
    let header = '';
    
    const lines = content.split('\n');
    let currentVersion = null;
    let currentDate = null;
    let currentBuffer = [];
    
    for (let line of lines) {
        // Match lines like: ## v2.0.0 - Description (2024-01-01) or ## v1.0.0 - (2024-01-01)
        const versionMatch = line.match(/^## (v[^\s]+) - .*?\((\d{4}-\d{2}-\d{2})\)/);
        
        if (versionMatch) {
            if (currentVersion) {
                entries.push({
                    version: currentVersion,
                    date: currentDate,
                    content: currentBuffer.join('\n')
                });
            } else {
                header = currentBuffer.join('\n');
            }
            currentVersion = versionMatch[1];
            currentDate = versionMatch[2];
            currentBuffer = [line];
        } else {
            currentBuffer.push(line);
        }
    }
    
    if (currentVersion) {
        entries.push({
            version: currentVersion,
            date: currentDate,
            content: currentBuffer.join('\n')
        });
    } else if (!header && currentBuffer.length > 0) {
        header = currentBuffer.join('\n');
    }
    
    return { header, entries };
}

function generateJson(entries) {
    const jsonEntries = entries.map(entry => {
        // Handle rename v2.0.0 -> v1.2.0
        let version = entry.version;
        let title = '';
        
        // Parse title from the first line of content if possible
        // e.g. "## v2.0.0 - 剧本加载重构与规范化 (2026-02-20)"
        const firstLine = entry.content.split('\n')[0];
        // Match ## vX.X.X - Title (Date)
        const match = firstLine.match(/^## v[^\s]+ - (.*?) \(/);
        if (match && match[1]) {
            title = match[1].trim();
        }
        
        // Parse sections (### Type)
        const sections = [];
        const lines = entry.content.split('\n');
        let currentSection = null;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('### ')) {
                if (currentSection) sections.push(currentSection);
                currentSection = {
                    title: line.replace('### ', '').trim(),
                    items: []
                };
            } else if (line.trim().startsWith('- ') && currentSection) {
                // Remove markdown link syntax [text](url) -> text
                let itemText = line.trim().substring(2);
                itemText = itemText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                itemText = itemText.replace(/\*\*(.*?)\*\*/g, '$1');
                
                currentSection.items.push(itemText);
            }
        }
        if (currentSection) sections.push(currentSection);
        
        // If no sections found, try to parse as simple list
        if (sections.length === 0) {
             const items = [];
             for (let i = 1; i < lines.length; i++) {
                 const line = lines[i];
                 if (line.trim().startsWith('- ')) {
                     let itemText = line.trim().substring(2);
                     itemText = itemText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                     itemText = itemText.replace(/\*\*(.*?)\*\*/g, '$1');
                     items.push(itemText);
                 }
             }
             if (items.length > 0) {
                 sections.push({ title: 'Update', items });
             }
        }

        return {
            version,
            date: entry.date,
            title,
            content: sections
        };
    });
    
    // Ensure directory exists
    const dir = path.dirname(CHANGELOG_JSON_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(CHANGELOG_JSON_PATH, JSON.stringify(jsonEntries, null, 2));
    console.log(`Changelog JSON generated at ${CHANGELOG_JSON_PATH}`);
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0]; // 'update' or 'regenerate'

  if (mode === 'update') {
      const version = args[1];
      if (!version) {
          console.error('Usage: node generate-changelog.cjs update <version>');
          process.exit(1);
      }
      
      const tags = getAllTags();
      const lastTag = tags.length > 0 ? tags[0] : null;
      const commits = getCommits(lastTag, 'HEAD');
      
      const today = new Date().toISOString().split('T')[0];
      const newEntry = generateVersionEntry(version, today, commits);
      
      let content = '';
      if (fs.existsSync(CHANGELOG_PATH)) {
          content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
      } else {
          content = '# 更新日志 (Changelog)\n\n所有版本的更新记录将在此处列出。\n\n';
      }
      
      if (content.includes(`## ${version} -`)) {
          console.log(`Version ${version} already exists in CHANGELOG.md. Skipping.`);
          return;
      }

      const firstEntryIndex = content.indexOf('## ');
      if (firstEntryIndex !== -1) {
          content = content.slice(0, firstEntryIndex) + newEntry + '\n' + content.slice(firstEntryIndex);
      } else {
          content += '\n' + newEntry;
      }
      
      fs.writeFileSync(CHANGELOG_PATH, content);
      console.log(`Changelog updated for ${version}`);
      
      // Update JSON
      const { entries } = parseExistingChangelog(content);
      generateJson(entries);

  } else if (mode === 'regenerate') {
      console.log('Regenerating full changelog (merging with existing)...');
      
      let oldContent = '';
      if (fs.existsSync(CHANGELOG_PATH)) {
          oldContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
      }
      
      const { header, entries: existingEntries } = parseExistingChangelog(oldContent);
      const existingVersions = new Set(existingEntries.map(e => e.version));
      
      const tags = getAllTags(); // Newest first by creator date
      const allEntries = [];
      const usedVersions = new Set();
      
      // First, add all tags in order
      for (let i = 0; i < tags.length; i++) {
          const tag = tags[i];
          
          // Skip internal/nightly tags and v2.0.0 (which is manually mapped to v1.2.0)
          if (tag === 'v2.0.0' || tag.startsWith('v20')) continue;

          let entryContent = '';
          let date = '';
          
          // Check if we have existing content for this tag
          const existingEntry = existingEntries.find(e => e.version === tag);
          if (existingEntry) {
              entryContent = existingEntry.content;
              date = existingEntry.date;
          } else {
              console.log(`Generating missing entry for ${tag}...`);
              const prevTag = (i + 1 < tags.length) ? tags[i + 1] : null;
              date = runGit(`git log -1 --format=%ad --date=short ${tag}`);
              const commits = getCommits(prevTag, tag);
              entryContent = generateVersionEntry(tag, date, commits).trim();
          }
          
          allEntries.push({
              version: tag,
              date: date,
              content: entryContent,
              isTag: true,
              order: i
          });
          usedVersions.add(tag);
      }

      // Then, add any manual entries that are NOT tags
      const manualEntries = existingEntries.filter(e => !usedVersions.has(e.version));
      
      for (const entry of manualEntries) {
           // Try to find insertion point based on date
           // Since we want newest first, we look for the first item that is older (date <= entry.date)
           // But if dates are equal, we need a tie-breaker.
           // For manual entries (like v1.1.14), we assume they are older than tags on the same day if semantic version is lower?
           // Actually, let's just insert them based on date comparison.
           
           let inserted = false;
           for (let i = 0; i < allEntries.length; i++) {
               const current = allEntries[i];
               if (entry.date > current.date) {
                   allEntries.splice(i, 0, { ...entry, isTag: false });
                   inserted = true;
                   break;
               } else if (entry.date === current.date) {
                   // Same date: prefer tags? or semver?
                   // Example: v1.3.0 (Tag) vs v1.1.14 (Manual). 
                   // v1.3.0 is newer (semantically larger). So v1.1.14 should be AFTER.
                   // So if entry.version < current.version, continue to find a later spot.
                   // Simple string compare for now since we don't have semver lib
                   // But be careful with v2.0.0 vs v10.0.0
                   
                   // Let's use localeCompare with numeric option
                   const cmp = entry.version.localeCompare(current.version, undefined, { numeric: true, sensitivity: 'base' });
                   if (cmp > 0) {
                       // entry is larger, so newer? Insert before current.
                       allEntries.splice(i, 0, { ...entry, isTag: false });
                       inserted = true;
                       break;
                   }
               }
           }
           
           if (!inserted) {
               allEntries.push({ ...entry, isTag: false });
           }
      }
      
      // Reconstruct content
      let newContent = header.trim() ? header : '# 更新日志 (Changelog)\n\n所有版本的更新记录将在此处列出。\n\n';
      if (!newContent.endsWith('\n\n')) newContent += '\n';
      if (!newContent.endsWith('\n')) newContent += '\n';
      
      for (const entry of allEntries) {
          newContent += entry.content.trim() + '\n\n';
      }
      
      // Backup old changelog
      if (fs.existsSync(CHANGELOG_PATH)) {
          fs.copyFileSync(CHANGELOG_PATH, CHANGELOG_PATH + '.bak');
      }
      
      // Update CHANGELOG.md
      fs.writeFileSync(CHANGELOG_PATH, newContent);
      console.log('Changelog regenerated successfully.');
      
      // Generate JSON
      const { entries: finalEntries } = parseExistingChangelog(newContent);
      generateJson(finalEntries);
  } else {
      console.log('Usage: node generate-changelog.cjs [update <version> | regenerate]');
  }
}

main();
