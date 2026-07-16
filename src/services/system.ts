// ===== 系统配置服务 =====
//
// 当前实现状态：
// ✅ brightness — expo-brightness 原生支持，可用
// ⚠️ volume / wifi / bluetooth / screen_timeout / dnd / ringer_mode
//    — 需要原生 Android 模块（自定义 dev client 或 eject 后实现）
//    当前阶段返回可用性标记为 false，前端据此展示"暂不可用"
//
// 后续计划：通过 expo-modules API 创建自定义原生模块实现

import * as Brightness from 'expo-brightness';
import { SystemSettingType, SystemSetting } from '../types';

let _volumeCache = 0.5;

const UNAVAILABLE_SETTINGS: SystemSettingType[] = [
  'volume', 'wifi', 'bluetooth', 'screen_timeout', 'dnd', 'ringer_mode',
];

export function getUnavailableSettings(): SystemSettingType[] {
  return [...UNAVAILABLE_SETTINGS];
}

export async function getSystemSetting(
  setting: SystemSettingType
): Promise<SystemSetting> {
  switch (setting) {
    case 'brightness': {
      const val = await Brightness.getSystemBrightnessAsync();
      return {
        key: 'brightness',
        label: '屏幕亮度',
        value: Math.round(val * 100),
        readable: true,
        writable: true,
      };
    }
    case 'volume':
      return {
        key: 'volume',
        label: '媒体音量',
        value: Math.round(_volumeCache * 100),
        readable: false,
        writable: false,
      };
    case 'wifi':
      return {
        key: 'wifi',
        label: 'Wi-Fi',
        value: '不可用（需要原生模块）',
        readable: false,
        writable: false,
      };
    case 'bluetooth':
      return {
        key: 'bluetooth',
        label: '蓝牙',
        value: '不可用（需要原生模块）',
        readable: false,
        writable: false,
      };
    case 'screen_timeout':
      return {
        key: 'screen_timeout',
        label: '屏幕超时',
        value: '不可用（需要原生模块）',
        readable: false,
        writable: false,
      };
    case 'dnd':
      return {
        key: 'dnd',
        label: '勿扰模式',
        value: '不可用（需要原生模块）',
        readable: false,
        writable: false,
      };
    case 'ringer_mode':
      return {
        key: 'ringer_mode',
        label: '铃声模式',
        value: '不可用（需要原生模块）',
        readable: false,
        writable: false,
      };
    default:
      throw new Error(`未知系统设置: ${setting}`);
  }
}

export async function setSystemSetting(
  setting: SystemSettingType,
  value: string
): Promise<SystemSetting> {
  switch (setting) {
    case 'brightness': {
      const numVal = Math.min(1, Math.max(0, Number(value) / 100));
      await Brightness.setSystemBrightnessAsync(numVal);
      return {
        key: 'brightness',
        label: '屏幕亮度',
        value: Number(value),
        readable: true,
        writable: true,
      };
    }
    // 以下设置当前不可用，返回错误
    case 'volume':
    case 'wifi':
    case 'bluetooth':
    case 'screen_timeout':
    case 'dnd':
    case 'ringer_mode':
      throw new Error(
        `系统设置"${setting}"当前不可用。需要原生 Android 模块支持，将在后续版本中实现。`
      );
    default:
      throw new Error(`未知系统设置: ${setting}`);
  }
}
