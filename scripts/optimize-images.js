#!/usr/bin/env node

/**
 * 图片优化脚本
 * 用于将 PNG 图片转换为 WebP 格式并压缩
 * 注意：需要安装 sharp 库：npm install sharp --save-dev
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// 图片目录（使用相对路径）
const imageDir = './public/image';
// 输出目录（使用原目录，直接替换）
const outputDir = imageDir;

// 确保目录存在
if (!fs.existsSync(imageDir)) {
  console.error('图片目录不存在:', imageDir);
  process.exit(1);
}

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 支持的输入格式
const supportedFormats = ['.png', '.jpg', '.jpeg'];

// 优化图片函数
async function optimizeImage(inputPath, outputPath) {
  try {
    console.log(`正在优化: ${path.basename(inputPath)}`);
    
    // 读取原始文件大小
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;
    
    // 压缩并转换为 WebP
    await sharp(inputPath)
      .webp({
        quality: 80, // 质量设置，可根据需要调整
        lossless: false
      })
      .toFile(outputPath);
    
    // 读取优化后文件大小
    const optimizedStats = fs.statSync(outputPath);
    const optimizedSize = optimizedStats.size;
    
    // 计算压缩率
    const compressionRatio = ((1 - optimizedSize / originalSize) * 100).toFixed(2);
    
    console.log(`优化完成: ${path.basename(outputPath)}`);
    console.log(`原始大小: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`优化大小: ${(optimizedSize / 1024).toFixed(2)} KB`);
    console.log(`压缩率: ${compressionRatio}%`);
    console.log('-------------------');
    
  } catch (error) {
    console.error(`优化失败: ${path.basename(inputPath)}`, error);
  }
}

// 遍历图片目录
async function processImages() {
  console.log('开始优化图片...');
  console.log('-------------------');
  
  const files = fs.readdirSync(imageDir);
  
  for (const file of files) {
    const inputPath = path.join(imageDir, file);
    const ext = path.extname(file).toLowerCase();
    
    // 只处理支持的格式
    if (supportedFormats.includes(ext)) {
      const baseName = path.basename(file, ext);
      const outputPath = path.join(outputDir, `${baseName}.webp`);
      
      await optimizeImage(inputPath, outputPath);
    }
  }
  
  console.log('图片优化完成！');
}

// 运行优化
processImages().catch(console.error);
