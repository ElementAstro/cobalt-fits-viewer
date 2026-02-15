# Onboarding Guide — 优化计划

## 执行摘要

为 COBALT FITS Viewer 添加完整的首次启动入门引导功能，帮助用户快速了解应用核心功能。采用全屏多步引导页模式，使用 heroui-native 组件和 react-native-reanimated 动画。

## 发现问题

- HIGH: 0 个
- MEDIUM: 1 个（缺少入门引导，新用户无法快速上手）
- LOW: 0 个

## 实施内容

### 新增文件

| 文件                                         | 用途                          |
| -------------------------------------------- | ----------------------------- |
| `src/stores/useOnboardingStore.ts`           | zustand + MMKV 持久化引导状态 |
| `src/components/common/OnboardingScreen.tsx` | 全屏引导页组件（含动画）      |

### 修改文件

| 文件                          | 修改内容                                       |
| ----------------------------- | ---------------------------------------------- |
| `src/app/_layout.tsx`         | 添加 `OnboardingGate` 组件，首次启动时展示引导 |
| `src/app/(tabs)/settings.tsx` | 添加"重新开始引导"按钮                         |
| `src/i18n/locales/en.ts`      | 添加 `onboarding` 英文翻译（38 条）            |
| `src/i18n/locales/zh.ts`      | 添加 `onboarding` 中文翻译（38 条）            |

### 引导步骤

| 步骤 | 主题       | 图标                | 内容              |
| ---- | ---------- | ------------------- | ----------------- |
| 1    | 欢迎       | telescope           | 应用介绍          |
| 2    | 导入 FITS  | folder-open-outline | 多种导入方式      |
| 3    | 查看与分析 | eye-outline         | 拉伸/色图/直方图  |
| 4    | 图库与目标 | images-outline      | 智能分组/目标管理 |
| 5    | 观测记录   | moon-outline        | 会话追踪/统计     |

### 使用的 heroui-native 组件

- `Card` + `Card.Body` — 功能特性卡片
- `Button` + `Button.Label` — 导航按钮（下一步/跳过/开始使用）
- `Separator` — 视觉分隔
- `useThemeColor` — 主题色适配

### 架构设计

```
App Launch → AnimatedSplashScreen → OnboardingGate
  ├─ 首次启动 → OnboardingScreen (5步引导)
  │   └─ 完成/跳过 → completeOnboarding() → 进入主界面
  └─ 非首次 → 直接进入主界面

Settings → "重新开始引导" → resetOnboarding() → 下次启动时重新展示
```

### 状态持久化

- Store: `useOnboardingStore` (zustand + MMKV)
- 持久化字段: `hasCompletedOnboarding`
- 存储 key: `onboarding-store`

## 工作量

- 总计: ~2.5 小时（中型任务）
