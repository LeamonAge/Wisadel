// 配色常量 — 基于应用图标主色调（深红/黑/银灰）
// 图标：深黑 + 银灰 + 深红
// #000000(34%)  #C0C0C0(21%)  #C00000(5.3%)  #404040(3.6%)

// ===== 暗色主题 =====
export const darkColors = {
  bg: '#080808',
  card: '#141414',
  bubbleUser: ['#C00000', '#800000'] as const,
  bubbleAi: '#1A1A1A',
  accent: '#C00000',
  accentLight: '#E04040',
  textPrimary: '#EEEEEE',
  textSecondary: '#808080',
  codeBg: '#0F0F0F',
  success: '#4CAF50',
  warning: '#D08040',
  error: '#C00000',
  border: '#2A2A2A',
  inputBg: '#121212',
  tabBar: '#0A0A0A',
  statusBar: 'light' as const,
  name: '暗色' as const,
} as const;

// ===== 亮色主题 =====
export const lightColors = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  bubbleUser: ['#C00000', '#A00000'] as const,
  bubbleAi: '#EEEEEE',
  accent: '#C00000',
  accentLight: '#D04040',
  textPrimary: '#1A1A1A',
  textSecondary: '#888888',
  codeBg: '#F0F0F0',
  success: '#4CAF50',
  warning: '#D08040',
  error: '#C00000',
  border: '#E0E0E0',
  inputBg: '#FFFFFF',
  tabBar: '#FAFAFA',
  statusBar: 'dark' as const,
  name: '亮色' as const,
} as const;

// ===== 主题类型 =====
export type ThemeColors = typeof darkColors;

// ===== 理智消耗定价 =====
export const SanityCosts = {
  message: 1,
  thinking: 2,
  fileRead: 2,
  fileWrite: 5,
  fileDelete: 3,
  fileBrowse: 1,
  systemRead: 1,
  systemModify: 5,
  systemBatch: 10,
};

// ===== API 源预设 =====
export const ApiPresets = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'builtin' as const,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  },
};

// ===== 默认设置 =====
export const DefaultSettings = {
  activeApiSourceId: 'deepseek',
  activeModel: 'deepseek-v4-pro',
  sanityPerMessage: 1,
  sanityPerFileRead: 2,
  sanityPerFileWrite: 5,
  sanityPerFileDelete: 3,
  sanityPerSystemModify: 5,
};
