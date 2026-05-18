
import { useState, useEffect, useMemo } from 'react';
import { ROUND_TABLE_LAYOUT } from '../constants/layout';

interface UseTableLayoutProps {
  seatCount: number;
  showGrimoireNote: boolean;
  splitRatio: number;
  onScaleFactorChange?: (scaleFactor: number) => void;
  containerWidth?: number;
  containerHeight?: number;
  /** 整屏视口宽高：未分屏时用此判断横/竖屏；分屏时用容器（左屏）宽高判断 */
  viewportWidth?: number;
  viewportHeight?: number;
}

interface TableLayout {
  tableWidth: number;
  tableHeight: number;
  tableRadius: number;
  /** 圆桌实际占地面积（外接正方形边长 = 2*tableRadius），用于 SVG/容器尺寸，避免四角留白 */
  contentSize: number;
  tokenRadius: number;
  tokenDistance: number;
  scaleFactor: number;
  tableCenterX: number;
  tableCenterY: number;
}

export function useTableLayout({
  seatCount,
  showGrimoireNote,
  splitRatio,
  onScaleFactorChange,
  containerWidth,
  containerHeight,
  viewportWidth,
  viewportHeight
}: UseTableLayoutProps): TableLayout {
  // 优先使用父级传入的「圆桌容器在设计空间中的尺寸」，这样窗口变窄时圆桌按可用空间计算、不会因整页 scale 而多出左右留白
  const [windowSize, setWindowSize] = useState({
    width: containerWidth ?? (typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth) : 1024),
    height: containerHeight ?? (typeof window !== 'undefined' ? (window.innerHeight || document.documentElement.clientHeight) : 768)
  });

  useEffect(() => {
    if (containerWidth != null && containerHeight != null && containerWidth > 0 && containerHeight > 0) {
      setWindowSize({ width: containerWidth, height: containerHeight });
      return;
    }

    const handleResize = () => {
      const width = window.innerWidth || document.documentElement.clientWidth;
      const height = window.innerHeight || document.documentElement.clientHeight;
      setWindowSize({ width, height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [containerWidth, containerHeight]);

  const { tableWidth, tableHeight, tableRadius } = useMemo(() => {
    const availableWidth = showGrimoireNote
      ? windowSize.width - 10
      : windowSize.width;
    const isLandscape = showGrimoireNote
      ? windowSize.width >= windowSize.height
      : (viewportWidth ?? windowSize.width) >= (viewportHeight ?? windowSize.height);
    // 圆桌与左右最小 50px、与上下最小 60px，先触限的一边决定尺寸（宽/高限制）
    const widthPadding = ROUND_TABLE_LAYOUT.MIN_MARGIN_HORIZONTAL * 2;
    const heightPadding = ROUND_TABLE_LAYOUT.MIN_MARGIN_VERTICAL * 2;
    const maxByWidth = Math.min(availableWidth - widthPadding, ROUND_TABLE_LAYOUT.MAX_WIDTH);
    const maxByHeight = Math.min(windowSize.height - heightPadding, ROUND_TABLE_LAYOUT.MAX_HEIGHT);
    // 分屏时始终用「宽高共同限制」，随分屏拖拽连续变化；未分屏时横屏按高度、竖屏按 min(宽,高)
    const baseSize = showGrimoireNote
      ? Math.min(maxByWidth, maxByHeight)
      : (isLandscape ? maxByHeight : Math.min(maxByWidth, maxByHeight));

    return {
      tableWidth: baseSize,
      tableHeight: baseSize,
      tableRadius: baseSize / ROUND_TABLE_LAYOUT.RADIUS_DIVISOR
    };
  }, [windowSize, showGrimoireNote, viewportWidth, viewportHeight]);

  // 计算缩放因子
  const scaleFactor = tableWidth / ROUND_TABLE_LAYOUT.BASE_SIZE;

  // 根据座位数量计算 Token 半径
  const tokenRadius = useMemo(() => {
    if (seatCount <= ROUND_TABLE_LAYOUT.SEAT_COUNT_THRESHOLD_SMALL) {
      return ROUND_TABLE_LAYOUT.TOKEN_RADIUS_LARGE * scaleFactor;
    } else if (seatCount <= ROUND_TABLE_LAYOUT.SEAT_COUNT_THRESHOLD_MEDIUM) {
      return ROUND_TABLE_LAYOUT.TOKEN_RADIUS_MEDIUM * scaleFactor;
    } else {
      return ROUND_TABLE_LAYOUT.TOKEN_RADIUS_SMALL * scaleFactor;
    }
  }, [seatCount, scaleFactor]);

  // 计算 Token 到圆心的距离
  const tokenDistance = tableRadius - tokenRadius;

  // 通知父组件 scaleFactor 变化
  useEffect(() => {
    onScaleFactorChange?.(scaleFactor);
  }, [scaleFactor, onScaleFactorChange]);

  const contentSize = 2 * tableRadius;

  return {
    tableWidth,
    tableHeight,
    tableRadius,
    contentSize,
    tokenRadius,
    tokenDistance,
    scaleFactor,
    tableCenterX: tableWidth / 2,
    tableCenterY: tableHeight / 2,
  };
}
