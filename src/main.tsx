import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import PlayerApp from './PlayerApp';
import './assets/styles/main.css';

// 触摸设备：全局禁用文字 / 图片复制与长按菜单
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const isTouchDevice =
    'ontouchstart' in window ||
    (navigator && (navigator.maxTouchPoints || (navigator as any).msMaxTouchPoints) > 0);

  if (isTouchDevice) {
    document.documentElement.classList.add('touch-device');

    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener('contextmenu', preventDefault);
    window.addEventListener('selectstart', preventDefault);
    window.addEventListener('dragstart', preventDefault);
  }
}

const search = typeof window !== 'undefined' ? window.location.search : '';
const isPlayerMode = search.includes('mode=player');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isPlayerMode ? <PlayerApp /> : <App />}
  </React.StrictMode>,
);