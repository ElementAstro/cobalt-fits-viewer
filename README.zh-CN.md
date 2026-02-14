<div align="center">

# Cobalt FITS Viewer

跨平台 FITS 文件查看器与天文图像处理工具。

在 **iOS**、**Android** 和 **Web** 上查看、分析、叠加和转换天文 FITS 图像。

[![CI](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-blue?logo=expo)](https://docs.expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[English](./README.md) | **中文**

</div>

## ✨ 特性

### FITS & 天文

- **FITS 文件管理** — 导入、浏览、搜索、标签和整理 FITS 文件
- **FITS 图像查看器** — 拉伸、色彩映射、直方图、像素信息、HDU 选择、网格叠加、十字准线、小地图
- **图像叠加** — 均值、中值、Sigma 裁剪、最小/最大、Winsorized、加权叠加，支持对齐
- **格式转换器** — 将 FITS 转换为 PNG / JPEG / WebP，内置预设（网页、打印、天文后期处理）
- **RGB 合成** — 将单色 FITS 合成彩色图像
- **观测目标** — 追踪星系、星云、星团，含曝光进度和滤镜计划
- **观测记录** — 日历视图、时间线、观测日志、统计、日历同步
- **图库** — 网格/列表/时间线视图、相册、智能相册、批量导出
- **位置标记** — 自动标记观测地点，含地图视图

### 应用 & 平台

- **[Expo SDK 54](https://docs.expo.dev/)** — 托管工作流，快速开发
- **[Expo Router 6](https://docs.expo.dev/router/introduction/)** — 基于文件的路由系统，支持深度链接
- **[HeroUI Native](https://heroui.com/)** — 美观且可定制的组件库
- **[TailwindCSS 4](https://tailwindcss.com/) + [Uniwind](https://docs.uniwind.dev/)** — 原子化样式，自动适配深色模式
- **[React Native Skia](https://shopify.github.io/react-native-skia/)** — GPU 加速 2D 渲染，用于 FITS 图像
- **[Zustand](https://zustand-demo.pmnd.rs/)** — 轻量级状态管理
- **[i18n-js](https://github.com/fnando/i18n)** — 国际化支持（内置中英文）
- **TypeScript 5.9** — 严格模式下的完整类型安全
- **代码质量** — ESLint 9（扁平配置）+ Prettier + Commitlint + Husky + lint-staged
- **CI/CD** — GitHub Actions 自动化流水线（类型检查 → 代码检查 → 测试 → 构建）

## 📦 技术栈

| 分类        | 依赖包                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| 框架        | `expo` 54, `react` 19, `react-native` 0.81                              |
| 导航        | `expo-router`, `react-native-screens`, `react-native-safe-area-context` |
| UI 组件     | `heroui-native`, `@expo/vector-icons`, `@gorhom/bottom-sheet`           |
| 样式        | `tailwindcss` 4, `uniwind`, `tailwind-merge`, `tailwind-variants`       |
| 渲染        | `@shopify/react-native-skia`, `react-native-svg`                        |
| 动画        | `react-native-reanimated`, `react-native-gesture-handler`               |
| 状态管理    | `zustand`                                                               |
| FITS        | `fitsjs-ng`, `pako`                                                     |
| 存储        | `@react-native-async-storage/async-storage`, `expo-secure-store`        |
| 位置 & 地图 | `expo-location`, `expo-maps`                                            |
| 日历        | `expo-calendar`                                                         |
| 国际化      | `i18n-js`, `expo-localization`                                          |
| 代码质量    | `eslint` 9, `prettier`, `commitlint`, `husky`, `lint-staged`            |
| 测试        | `jest`, `jest-expo`, `@testing-library/react-native`                    |

## 🚀 快速开始

### 环境要求

- **Node.js** >= 20
- **pnpm**（推荐的包管理器）
- **iOS**：需要安装 Xcode（用于模拟器）
- **Android**：需要安装 Android Studio（用于模拟器）

### 安装

```sh
# 克隆仓库
git clone https://github.com/ElementAstro/cobalt-fits-viewer.git
cd cobalt-fits-viewer

# 安装依赖
pnpm install

# 启动开发服务器
pnpm start
```

启动后按 `i` 打开 iOS 模拟器，`a` 打开 Android 模拟器，`w` 打开 Web 浏览器。

## 📁 项目结构

```text
src/
├── app/                  # 基于文件的路由（Expo Router）
│   ├── _layout.tsx       # 根布局（全局 Provider）
│   ├── index.tsx         # 入口重定向
│   ├── [...missing].tsx  # 404 兜底页面
│   ├── (tabs)/           # 标签页导航分组
│   │   ├── index.tsx     # 文件标签（FITS 文件管理）
│   │   ├── gallery.tsx   # 图库标签（图像浏览）
│   │   ├── targets.tsx   # 目标标签（观测目标）
│   │   ├── sessions.tsx  # 观测标签（观测记录）
│   │   └── settings.tsx  # 设置标签
│   ├── viewer/           # FITS 图像查看器
│   ├── header/           # FITS 头信息查看器
│   ├── editor/           # 图像编辑器
│   ├── stacking/         # 图像叠加
│   ├── compose/          # RGB 合成
│   ├── convert/          # 格式转换
│   ├── album/            # 相册详情
│   ├── target/           # 目标详情
│   ├── session/          # 观测详情
│   └── map/              # 地图视图
├── components/           # 可复用 UI 组件
│   ├── common/           # 通用组件（EmptyState、LoadingOverlay 等）
│   ├── fits/             # FITS 专用组件
│   ├── gallery/          # 图库组件
│   ├── targets/          # 目标组件
│   ├── sessions/         # 观测组件
│   └── converter/        # 转换器组件
├── hooks/                # 自定义 React Hooks
├── stores/               # Zustand 状态管理
├── lib/                  # 核心业务逻辑
│   ├── fits/             # FITS 文件解析
│   ├── stacking/         # 图像叠加算法
│   ├── converter/        # 格式转换
│   ├── gallery/          # 图库逻辑
│   ├── targets/          # 目标管理
│   ├── sessions/         # 观测管理
│   ├── calendar/         # 日历集成
│   ├── logger/           # 日志系统
│   ├── backup/           # 备份与恢复
│   ├── theme/            # 主题配置
│   └── utils/            # 工具函数
├── i18n/                 # 国际化（en、zh）
├── utils/                # 通用工具
├── global.css            # TailwindCSS + Uniwind + HeroUI 样式
└── uniwind-types.d.ts    # Uniwind 主题类型定义
```

## 📜 可用脚本

| 命令                 | 说明                     |
| -------------------- | ------------------------ |
| `pnpm start`         | 启动 Expo 开发服务器     |
| `pnpm ios`           | 在 iOS 模拟器上运行      |
| `pnpm android`       | 在 Android 模拟器上运行  |
| `pnpm web`           | 在浏览器中运行           |
| `pnpm lint`          | 运行 ESLint 检查         |
| `pnpm lint:fix`      | 运行 ESLint 并自动修复   |
| `pnpm format`        | 使用 Prettier 格式化代码 |
| `pnpm format:check`  | 检查代码格式             |
| `pnpm test`          | 运行单元测试             |
| `pnpm test:watch`    | 以监听模式运行测试       |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm typecheck`     | 运行 TypeScript 类型检查 |

## 🌍 国际化

内置 `i18n-js` 和 `expo-localization` 驱动的国际化支持。应用会自动检测设备语言，默认回退到英文。

**添加新语言：**

1. 在 `src/i18n/locales/` 目录下创建新的语言文件（如 `ja.ts`）
2. 在 `src/i18n/locales/index.ts` 中导出
3. 在 `src/i18n/index.ts` 中注册

**在组件中使用翻译：**

```tsx
import { useI18n } from "../i18n/useI18n";

function MyComponent() {
  const { t, locale, setLocale } = useI18n();
  return <Text>{t("viewer.stretch")}</Text>;
}
```

## 🚢 部署

使用 [Expo Application Services (EAS)](https://expo.dev/eas) 部署到所有平台：

| 平台          | 命令                 | 文档                                                            |
| ------------- | -------------------- | --------------------------------------------------------------- |
| Web           | `npx eas-cli deploy` | [EAS Hosting](https://docs.expo.dev/eas/hosting/get-started/)   |
| iOS / Android | `npx eas-cli build`  | [EAS Build](https://docs.expo.dev/build/introduction/)          |
| OTA 热更新    | `npx eas-cli update` | [EAS Update](https://docs.expo.dev/eas-update/getting-started/) |

## 🤝 参与贡献

欢迎贡献！请在提交 Pull Request 之前阅读 [贡献指南](./CONTRIBUTING.md)。

## 📄 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。
