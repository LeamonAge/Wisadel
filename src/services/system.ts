// ===== 系统配置服务（为原生模块预留接口） =====
// 目前使用 expo-brightness 等 Expo SDK
// 高级功能（WiFi/蓝牙等）需要 eject 后使用原生模块

import * as Brightness from 'expo-brightness';
import { SystemSettingType, SystemSetting } from '../types';

let _volumeCache = 0.5;

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
        readable: true,
        writable: true,
      };
    case 'wifi':
      return {
        key: 'wifi',
        label: 'Wi-Fi',
        value: true,
        readable: true,
        writable: true,
      };
    case 'bluetooth':
      return {
        key: 'bluetooth',
        label: '蓝牙',
        value: false,
        readable: true,
        writable: true,
      };
    case 'screen_timeout':
      return {
        key: 'screen_timeout',
        label: '屏幕超时',
        value: 60,
        readable: true,
        writable: true,
      };
    case 'dnd':
      return {
        key: 'dnd',
        label: '勿扰模式',
        value: false,
        readable: true,
        writable: true,
      };
    case 'ringer_mode':
      return {
        key: 'ringer_mode',
        label: '铃声模式',
        value: 'normal',
        readable: true,
        writable: true,
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
    case 'volume': {
      const numVal = Math.min(100, Math.max(0, Number(value)));
      _volumeCache = numVal / 100;
      return {
        key: 'volume',
        label: '媒体音量',
        value: numVal,
        readable: true,
        writable: true,
      };
    }
    case 'wifi':
      return {
        key: 'wifi',
        label: 'Wi-Fi',
        value: value === 'true',
        readable: true,
        writable: true,
      };
    case 'bluetooth':
      return {
        key: 'bluetooth',
        label: '蓝牙',
        value: value === 'true',
        readable: true,
        writable: true,
      };
    case 'screen_timeout':
      return {
        key: 'screen_timeout',
        label: '屏幕超时',
        value: Number(value),
        readable: true,
        writable: true,
      };
    case 'dnd':
      return {
        key: 'dnd',
        label: '勿扰模式',
        value: value === 'true',
        readable: true,
        writable: true,
      };
    case 'ringer_mode':
      return {
        key: 'ringer_mode',
        label: '铃声模式',
        value,
        readable: true,
        writable: true,
      };
    default:
      throw new Error(`未知系统设置: ${setting}`);
  }
}
