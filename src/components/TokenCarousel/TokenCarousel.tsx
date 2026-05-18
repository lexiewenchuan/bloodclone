import React, { useState, useEffect } from 'react';
import './TokenCarousel.css';

interface TokenCarouselProps {
  children: React.ReactNode;
  visibleCount?: number;
  step?: number;
}

const TokenCarousel: React.FC<TokenCarouselProps> = ({ 
  children, 
  visibleCount = 3, 
  step = 3 
}) => {
  const [startIndex, setStartIndex] = useState(0);
  const items = React.Children.toArray(children);
  const totalItems = items.length;

  // 当 items 变化时，如果 startIndex 超出范围，重置
  useEffect(() => {
    if (startIndex >= totalItems && totalItems > 0) {
      setStartIndex(Math.max(0, totalItems - visibleCount));
    }
  }, [totalItems, startIndex, visibleCount]);

  const handlePrev = () => {
    setStartIndex(prev => Math.max(0, prev - step));
  };

  const handleNext = () => {
    setStartIndex(prev => Math.min(totalItems - visibleCount, prev + step));
  };

  // 如果没有足够的项目来滚动，直接展示所有，不需要按钮
  if (totalItems <= visibleCount) {
    return (
      <div className="token-carousel-container">
        <div className="token-carousel-content">
          {items}
        </div>
      </div>
    );
  }

  const visibleItems = items.slice(startIndex, startIndex + visibleCount);

  return (
    <div className="token-carousel-container">
      {/* 内容区域 */}
      <div className="token-carousel-content">
        {visibleItems}
      </div>

      {/* 按钮区域 - 放在右侧 */}
      <div className="carousel-controls">
        <button 
          className="carousel-btn prev-btn" 
          onClick={handlePrev}
          disabled={startIndex === 0}
          title="向前翻页"
          style={{ opacity: startIndex === 0 ? 0.3 : 1, cursor: startIndex === 0 ? 'default' : 'pointer' }}
        >
          <i className="fa fa-chevron-left"></i>
        </button>

        <button 
          className="carousel-btn next-btn" 
          onClick={handleNext}
          disabled={startIndex + visibleCount >= totalItems}
          title="向后翻页"
          style={{ opacity: startIndex + visibleCount >= totalItems ? 0.3 : 1, cursor: startIndex + visibleCount >= totalItems ? 'default' : 'pointer' }}
        >
          <i className="fa fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default TokenCarousel;
