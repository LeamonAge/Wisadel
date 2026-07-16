// 完全参照 DeepSeek 网页端配色
export const dsColors = {
  // 背景
  bg: '#1a1a1a',              // 主背景
  sidebarBg: '#212121',       // 侧边栏背景
  sidebarHover: '#2a2a2a',    // 侧边栏 hover
  inputBg: '#2a2a2a',         // 输入框背景
  cardBg: '#252525',          // 卡片背景

  // 文字
  textPrimary: '#ececec',     // 主文字
  textSecondary: '#888888',   // 次要文字
  textTertiary: '#555555',    // 三级文字

  // 强调色
  accent: '#4d6bfe',          // DeepSeek 蓝
  accentLight: '#6b84ff',     // 亮蓝
  accentBg: 'rgba(77,107,254,0.1)', // 蓝色背景

  // 功能色
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',

  // 边框
  border: '#333333',
  borderLight: '#2e2e2e',

  // 其他
  white: '#ffffff',
  userBubble: 'transparent',  // 用户消息无背景
  aiBubble: 'transparent',    // AI消息无背景
} as const;

export const dsSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const dsFontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
} as const;
