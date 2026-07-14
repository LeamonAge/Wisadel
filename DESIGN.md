# 理智 (Sanity) — 手机版 AI Agent 应用设计文档

> 版本: v0.3.0 | 日期: 2026-07-15 | 作者: 虾宝

---

## 1. 产品定位

### 1.1 一句话描述
**手机上的 AI Agent 应用**——像 DeepSeek App 一样简洁好用，但不止于对话，还能操控手机本地文件和系统配置。

### 1.2 核心差异点
| 对比维度 | DeepSeek App | 理智 (Sanity) |
|---------|-------------|--------------|
| 对话 | ✅ | ✅ |
| 文件操作 | ❌ | ✅ 读写本地文件 |
| 系统配置 | ❌ | ✅ 修改系统设置 |
| 费用系统 | 免费 | ✅ "理智" Token 消耗 |
| Agent 能力 | 无 | ✅ 工具调用 + 自主执行 |

---

## 2. 技术架构

### 2.1 技术栈
```
┌─────────────────────────────────┐
│         React Native            │  跨平台 UI (iOS + Android)
├─────────────────────────────────┤
│  React Navigation (路由)         │
│  Zustand (状态管理)              │
│  react-native-fs (文件系统)      │
│  react-native-system-setting    │  系统配置修改
│  AsyncStorage / MMKV (本地存储)  │
├─────────────────────────────────┤
│     API 层 (多源 + 自定义)       │  DeepSeek / 后续扩展 / 自定义
├─────────────────────────────────┤
│      理智系统 (本地实现)         │  AsyncStorage 本地存储
└─────────────────────────────────┘
```

### 2.2 目录结构 (规划)
```
san-app/
├── app/                    # Expo Router / 页面
│   ├── (tabs)/             # 底部 Tab
│   │   ├── chat.tsx        # 对话首页
│   │   ├── files.tsx       # 文件浏览
│   │   ├── settings.tsx    # 系统配置
│   │   └── profile.tsx     # 我的 (理智余额)
│   ├── chat/[id].tsx       # 单个对话
│   └── _layout.tsx         # 根布局
├── src/
│   ├── components/         # 通用组件
│   │   ├── MessageBubble   # 消息气泡 (仿 DeepSeek)
│   │   ├── ThinkingBlock   # 思考过程展示
│   │   ├── SanityBar       # 顶部理智余额条
│   │   └── FilePicker      # 文件选择器
│   ├── services/
│   │   ├── api.ts          # DeepSeek API 封装
│   │   ├── filesystem.ts   # 文件操作服务
│   │   └── system.ts       # 系统配置服务
│   ├── stores/
│   │   ├── chatStore.ts    # 对话状态
│   │   ├── sanityStore.ts  # 理智余额 & 消费记录
│   │   └── settingsStore.ts
│   ├── hooks/
│   ├── utils/
│   └── types/
├── android/                # Android 原生模块 (优先)
├── package.json
└── app.json
```

---

## 3. UI 设计规范

### 3.1 参考：手机版 DeepSeek 布局特点
- **纯黑/深色背景**为主（#1a1a2e ~ #0f0f1a）
- **底部输入框**，圆角，带语音/附件按钮
- **消息气泡**：用户右侧（蓝紫色渐变），AI 左侧（深灰）
- **顶部简洁导航**：标题居中或左对齐，右侧功能按钮
- **Markdown 渲染**：代码块有独立深色背景，行内代码高亮
- **思考过程**折叠块（可展开/收起）

### 3.2 理智 (Sanity) 的 UI 差异化
| 元素 | DeepSeek 风格 | 理智独有 |
|------|-------------|---------|
| 顶部栏 | 标题 + 右侧按钮 | 标题 + **理智余额** 🧠 |
| 输入框 | 单行文本 | 文本 + **@文件** + ⚙️系统指令 |
| 消息气泡 | 对话 | 对话 + **工具调用结果卡片** |
| 侧边栏 | 对话列表 | 对话列表 + 理智消耗记录 |

### 3.3 配色方案
```
主背景:    #0D0D1A (极深蓝黑)
卡片背景:  #1A1A2E
气泡-用户: #6C63FF → #3F3D9E (蓝紫渐变)
气泡-AI:   #1E1E32
强调色:    #7C6FF7 (紫)
文字-主:   #E8E8F0
文字-次:   #8888A0
代码块:    #12121F
成功:      #4CAF50
警告:      #FF9800
错误:      #FF5252
```

### 3.4 字体排版
- 中文字体: 系统默认 (PingFang SC / Noto Sans SC)
- 代码: JetBrains Mono / Fira Code
- 消息正文: 15sp
- 时间/辅助: 12sp
- 标题: 20sp Bold

---

## 4. 功能模块设计

### 4.1 对话模块 (Chat)

#### 4.1.1 消息类型
```typescript
type MessageType = 
  | 'text'           // 普通文本
  | 'thinking'       // AI 思考过程
  | 'tool_call'      // 工具调用 (文件操作/系统配置)
  | 'tool_result'    // 工具调用结果
  | 'error'          // 错误信息
  | 'sanity_cost'    // 理智消耗通知
```

#### 4.1.2 思考过程展示
- **默认折叠**，显示 "思考中..." 
- 点击展开后显示完整推理过程
- 用不同颜色/样式区分思考内容（你之前提到的问题：AI 输出不分段、没有特殊标志、思考过程看不到 → 在这里解决）

#### 4.1.3 工具调用卡片
当 AI 调用工具时，显示特殊卡片：
```
┌──────────────────────────────┐
│ 🔧 正在执行: 读取文件         │
│ 📄 /sdcard/Documents/readme.md│
│ ⏳ 执行中...                  │
└──────────────────────────────┘
```
执行完成后：
```
┌──────────────────────────────┐
│ ✅ 执行完成: 读取文件         │
│ 📄 /sdcard/Documents/readme.md│
│ 📊 消耗: 🧠 3                 │
└──────────────────────────────┘
```

### 4.2 文件模块 (Files)

#### 4.2.1 能力范围
- 📂 浏览本地文件系统
- 📄 读取文件内容（文本、JSON、代码等）
- ✏️ 写入/创建文件
- 🗑️ 删除文件（需二次确认）
- 🔍 搜索文件
- 📋 文件详情（大小、修改时间、权限）

#### 4.2.2 权限处理
- 首次使用请求存储权限
- Android: `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` / `MANAGE_EXTERNAL_STORAGE`（直接 APK 分发，无需通过 Google Play 审核，可申请完整存储权限）
- **所有文件操作均需用户确认**（安全底线）
- Android 11+ 需处理分区存储 (Scoped Storage) 限制，通过 `MANAGE_EXTERNAL_STORAGE` 获取完整访问

#### 4.2.3 理智消耗定价
| 操作 | 消耗 (🧠) |
|------|----------|
| 浏览目录 | 1 |
| 读取文件 | 2 |
| 写入文件 | 5 |
| 删除文件 | 3 |

### 4.3 系统配置模块 (Settings)

#### 4.3.1 可修改的系统配置
| 配置项 | Android |
|--------|---------|
| 屏幕亮度 | ✅ |
| 音量 | ✅ |
| Wi-Fi 开关 | ✅ |
| 蓝牙开关 | ✅ |
| 屏幕超时 | ✅ |
| 勿扰模式 | ✅ (需通知权限) |
| 铃声模式 | ✅ |
| 飞行模式 | ❌ (需要 root) |

> ⚠️ 系统配置修改需要用户明确授权，且每次执行前弹窗确认。

#### 4.3.2 理智消耗定价
| 操作 | 消耗 (🧠) |
|------|----------|
| 读取系统状态 | 1 |
| 修改系统配置 | 5 |
| 批量修改 | 10 |

### 4.4 理智系统 (Sanity System)

#### 4.4.1 概念
- **理智 (Sanity)** = 应用内虚拟货币
- 每次 API 调用 / 工具执行消耗理智
- 理智不足时无法执行操作
- 用户通过充值获得理智

#### 4.4.2 定价模型
```
API 对话 (每轮):  🧠 1
  - 含思考过程:  +🧠 2
  - 含工具调用:  +按工具计费

文件操作:       🧠 2-5 (按操作)
系统配置修改:    🧠 5-10
```

#### 4.4.3 数据模型
```typescript
interface SanityState {
  balance: number;           // 当前余额
  totalConsumed: number;     // 累计消耗
  totalRecharged: number;    // 累计充值
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: 'consume' | 'recharge';
  amount: number;
  description: string;
  timestamp: number;
  relatedChatId?: string;
}
```

#### 4.4.4 UI 展示
- **顶部状态栏**：🧠 1,234（实时余额）
- **消费提示**：对话中消息气泡底部显示 "🧠 -2"
- **充值页面**：理智包购买（类似游戏体力系统）
- **消费记录**：明细列表，按时间排序

---

## 5. API 设计

### 5.1 DeepSeek API 封装
```typescript
// 对话请求
POST https://api.deepseek.com/v1/chat/completions
Headers:
  Authorization: Bearer {api_key}
Body: {
  model: "deepseek-chat",
  messages: [...],
  tools: [...],          // 工具定义
  tool_choice: "auto",
  stream: true
}
```

### 5.2 架构说明：无后端模式
- 客户端**直连**各 API 提供商
- 支持多 API 源：DeepSeek（默认）、后续扩展 OpenAI / Claude 等、**自定义 API**（用户自行填入 Endpoint + Key）
- API Key 由用户在设置中自行填入，存储在 `EncryptedSharedPreferences`（Android 加密存储）
- 理智系统完全在本地实现
- 无需注册/登录，单机使用

### 5.3 API 源管理
```typescript
interface ApiSource {
  id: string;
  name: string;           // 显示名 "DeepSeek" / "自定义"
  type: 'builtin' | 'custom';
  endpoint: string;       // API 端点
  apiKey: string;         // 加密存储
  models: string[];       // 可用模型列表
  enabled: boolean;
}
```

### 5.3 统一错误结构
```json
{
  "code": 40001,
  "message": "理智不足",
  "requestId": "req_abc123",
  "timestamp": "2026-07-15T00:31:00+08:00"
}
```

---

## 6. 安全设计

### 6.1 文件操作安全
- ✅ 所有文件操作需用户确认
- ✅ 禁止访问系统关键目录（/system, /data/data 其他应用）
- ✅ 操作日志完整记录
- ✅ 文件类型白名单（禁止执行二进制）

### 6.2 系统配置安全
- ✅ 每次修改前弹窗确认
- ✅ 可回滚配置项提供撤销功能
- ✅ 禁止修改安全相关设置（锁屏密码、生物识别等）

### 6.3 API Key 安全
- ✅ API Key 由用户自行填入，存储在 Android `EncryptedSharedPreferences`
- ✅ Key 仅用于直连 DeepSeek API，不上传任何第三方服务器
- ✅ 支持 Key 有效性检测（设置页一键测试）
- ✅ 理智余额等用户数据存本地 `AsyncStorage`，不依赖云端

---

## 7. 开发路线图

### Phase 1: MVP (2-3 周)
- [x] React Native 项目初始化
- [ ] 基础对话 UI (仿 DeepSeek 布局)
- [ ] DeepSeek API 对接
- [ ] 消息气泡 + Markdown 渲染
- [ ] 思考过程折叠展示
- [ ] 理智余额显示 (本地模拟)

### Phase 2: 核心功能 (2-3 周)
- [ ] 文件浏览 + 读写
- [ ] 系统配置读取 + 修改
- [ ] 工具调用卡片 UI
- [ ] 理智消耗统计

### Phase 3: 完善 + 发布 (2-3 周)
- [ ] 理智充值系统（对接支付 SDK：微信/支付宝）
- [ ] 多 API 源 + 自定义 API
- [ ] 消费记录导出
- [ ] 打包发布 APK
- [ ] GitHub Releases 自动更新机制

---

## 8. 命名

| 项目 | 名称 |
|------|------|
| 产品名 | 理智 (Sanity) |
| 包名 (Android) | com.sanity.app |
| 代号 | san-app |
| 虚拟货币 | 理智 / 🧠 |
| Slogan | "有理智的 AI 助手" |

---

## 9. 已确认决策

| # | 问题 | 决策 |
|---|------|------|
| 1 | 后端服务器 | ❌ 不需要，客户端直连 API |
| 2 | 分发方式 | APK 直接分发（不走 Google Play） |
| 3 | 平台 | Android 优先，先不做 iOS |
| 4 | 图标 | 暂不设计，后期补充 |
| 5 | API Key | 用户自行填入，本地加密存储 |
| 6 | 理智系统 | 纯本地实现，无后端 |
| 7 | API 源 | DeepSeek + 后续扩展 + 自定义 API |
| 8 | 理智充值 | 对接支付 SDK（微信/支付宝） |
| 9 | 更新机制 | GitHub Releases 检测 + 下载安装 |

## 10. 待讨论事项

1. **自定义 API 兼容性**：用户填入的 API 需要兼容 OpenAI Chat Completions 格式，是否做格式校验/自动适配？
2. **支付 SDK**：微信支付和支付宝 SDK 接入审批需要企业资质，个人开发者方案待定

---

> 📝 本文档为初版设计，后续根据讨论迭代更新。
