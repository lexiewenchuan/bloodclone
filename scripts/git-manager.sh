#!/bin/bash

# 获取当前脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 进入项目根目录
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

command="$1"
arg="$2"

if [ "$command" == "sync" ]; then
    echo -e "${YELLOW}🔄 正在同步代码到分支: $(git branch --show-current) ...${NC}"
    
    # 添加所有更改
    git add .
    
    # 提交更改
    if [ -n "$arg" ]; then
        git commit -m "$arg"
    else
        git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    # 推送到远程
    echo -e "${YELLOW}⬆️  正在推送到远程...${NC}"
    git push
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 代码已同步到 GitHub 和 Vercel！${NC}"
    else
        echo -e "${RED}❌ 推送失败，请检查网络或权限。${NC}"
        exit 1
    fi

elif [ "$command" == "release" ]; then
    # 确保没有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${RED}❌ 有未提交的更改，请先运行 npm run save${NC}"
        exit 1
    fi

    if [ -n "$2" ]; then
        VERSION="$2"
    else
        VERSION="v$(date +%Y%m%d-%H%M)"
    fi
    
    echo -e "${YELLOW}🚀 正在发布新版本: $VERSION${NC}"

    # 自动生成更新日志
    echo -e "${YELLOW}📝 正在生成更新日志...${NC}"
    node scripts/generate-changelog.cjs update "$VERSION"
    
    # 提交更新日志
    git add CHANGELOG.md
    git commit -m "docs: Update CHANGELOG.md for $VERSION"
    
    # 打标签
    git tag -a "$VERSION" -m "Release $VERSION"
    
    # 推送标签和代码
    git push origin "$VERSION"
    git push
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 版本 $VERSION 已发布！Vercel 将开始独立部署。${NC}"
        echo -e "${GREEN}运行 npm run versions 查看所有版本。${NC}"
    else
        echo -e "${RED}❌ 发布失败。${NC}"
        exit 1
    fi

elif [ "$command" == "undo" ]; then
    echo -e "${YELLOW}↩️  正在撤销上一次提交...${NC}"
    git revert HEAD --no-edit
    git push
    echo -e "${GREEN}✅ 已撤销上一次提交。${NC}"

elif [ "$command" == "reset" ]; then
    echo -e "${RED}⚠️  警告：此操作将强制回退到上一个版本，并且会丢失所有未保存的修改！${NC}"
    read -p "确认要继续吗？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git reset --hard HEAD^
        git push -f
        echo -e "${GREEN}✅ 已强制回退到上一版。${NC}"
    else
        echo -e "${YELLOW}操作已取消。${NC}"
    fi

elif [ "$command" == "history" ]; then
    echo -e "${YELLOW}📜 最近提交记录:${NC}"
    git log --pretty=format:"%C(yellow)%h%Creset - %C(cyan)%ad%Creset - %s %C(green)<%an>%Creset" --date=format:"%Y-%m-%d %H:%M" -n 10
    echo ""

elif [ "$command" == "goto" ]; then
    if [ -z "$arg" ]; then
        echo -e "${RED}❌ 请提供 Commit ID，例如: npm run goto a1b2c3d${NC}"
        exit 1
    fi
    
    echo -e "${RED}⚠️  警告：此操作将强制将代码库重置到版本 $arg${NC}"
    echo -e "${RED}⚠️  $arg 之后的所有修改都将丢失！${NC}"
    read -p "确认要继续吗？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git reset --hard "$arg"
        git push -f
        echo -e "${GREEN}✅ 已回退到版本 $arg${NC}"
    else
        echo -e "${YELLOW}操作已取消。${NC}"
    fi

elif [ "$command" == "versions" ]; then
    echo -e "${YELLOW}🔖 所有发布版本 (最新的在上面):${NC}"
    git tag -n --sort=-creatordate
    echo ""

else
    echo -e "${RED}❌ 未知命令: $command${NC}"
    echo "用法: ./git-manager.sh [sync|release|undo|reset|history|goto|versions]"
    exit 1
fi
