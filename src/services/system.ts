// ===== 系统配置服务（桌面版） =====
// 桌面版暂不提供系统设置访问

import { SystemSettingType, SystemSetting } from '../types';

const UNAVAILABLE_SETTINGS: SystemSettingType[] = [
  'brightness', 'volume', 'wifi', 'bluetooth', 'screen_timeout', 'dnd', 'ringer_mode',
];

export function getUnavailableSettings(): SystemSettingType[] {
  return [...UNAVAILABLE_SETTINGS];
}

export async function getSystemSetting(
  setting: SystemSettingType
): Promise<SystemSetting> {
  return {
    key: setting,
    label: setting,
    value: '桌面版不可用',
    readable: false,
    writable: false,
  };
}

export async function setSystemSetting(
  setting: SystemSettingType,
  value: string
): Promise<SystemSetting> {
  throw new Error(`系统设置"${setting}"在桌面版不可用`);
}
