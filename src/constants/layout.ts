
// RoundTable 布局常量
export const ROUND_TABLE_LAYOUT = {
  /** 圆桌与左右的最小距离（px），先触限时以宽度为限 */
  MIN_MARGIN_HORIZONTAL: 50,
  /** 圆桌与上下的最小距离（px），先触限时以高度为限 */
  MIN_MARGIN_VERTICAL: 60,
  /** 竖屏时圆桌离水平方向两边（左右）的留白（px） */
  PADDING_PORTRAIT_HORIZONTAL: 24,
  /** 横屏时圆桌离水平方向两边（左右）的留白（px） */
  PADDING_LANDSCAPE_HORIZONTAL: 12,
  /** 竖屏时圆桌离垂直方向两边（上下）的留白（px） */
  HEIGHT_PADDING_PORTRAIT: 100,
  /** 横屏时圆桌离垂直方向两边（上下）的留白（px） */
  HEIGHT_PADDING_LANDSCAPE: 60,
  MAX_WIDTH: 1050,
  MAX_HEIGHT: 1050,
  RADIUS_DIVISOR: 2.3,
  
  // 座位数量阈值
  SEAT_COUNT_THRESHOLD_SMALL: 10,
  SEAT_COUNT_THRESHOLD_MEDIUM: 15,

  // 令牌半径
  TOKEN_RADIUS_LARGE: 58,
  TOKEN_RADIUS_MEDIUM: 47,
  TOKEN_RADIUS_SMALL: 40.5,
  
  // 基础参考尺寸（用于计算缩放比例）
  BASE_SIZE: 750,
};

// Seat 组件布局常量
export const SEAT_LAYOUT = {
  BASE_TOKEN_RADIUS: 37.5,
  
  // 提示标记 Token 相关
  STATUS_TOKEN_SIZE_FACTOR: 0.5,
  STATUS_TOKEN_GAP: 5,
  
  // 座位信息相关
  SEAT_INFO_WIDTH: 80,
  SEAT_INFO_HEIGHT: 30,
  SEAT_INFO_OFFSET_Y_FACTOR: 1.05,
  
  // 令牌容器相关
  TOKEN_CONTAINER_OFFSET: 45,
  TOKEN_CONTAINER_PADDING: 15,
  TOKEN_CONTAINER_WIDTH_EXTRA: 55,
  TOKEN_CONTAINER_HEIGHT_EXTRA: 25,
  
  // 添加提示标记按钮偏移
  ADD_STATUS_OFFSET: 25,
};
