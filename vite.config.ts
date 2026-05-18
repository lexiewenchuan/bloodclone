import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 开发时用根路径；生产时默认 /blood-on-the-clocktower/（如 GitHub Pages 子路径），部署到 Vercel 根路径时在环境变量设 VITE_BASE_URL=/
  base: process.env.NODE_ENV === 'development'
    ? '/'
    : (process.env.VITE_BASE_URL || '/blood-on-the-clocktower/'),
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@mui/material', '@mui/icons-material']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: 'localhost',  // 避免 host:true 在某些环境下触发 uv_interface_addresses 报错导致无法启动
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    // 本地开发时 /api/town/* 没有 Vercel 处理，代理到线上 API（与生产一致）
    proxy: {
      '/api/town': {
        target: 'https://www.bloodclocktower.online',
        changeOrigin: true,
      },
    },
  },
})