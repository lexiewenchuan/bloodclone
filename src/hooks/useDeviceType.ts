// 统一使用桌面端布局：移除手机/平板的单独分支
// 该 Hook 现在只作为语义包装，始终返回桌面设备信息。

export function useDeviceType() {
  return {
    deviceType: 'desktop' as const,
    isMobile: false,
    isDesktop: true
  };
}