<div align="center">

# 🔭 Cobalt FITS Viewer

**跨平台 FITS 文件查看器与天文图像处理工具。**

在 **iOS**、**Android** 和 **Web** 上查看、分析、叠加和转换天文 FITS 图像。

[![CI](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-blue?logo=expo)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[English](./README.md) | **中文**

</div>

---

## ✨ 特性

### 🌌 FITS & 天文

- **FITS 文件管理** — 导入、浏览、搜索、标签和整理 FITS 文件，支持批量操作
- **FITS 图像查看器** — 8 种拉伸算法、16 种色彩映射、直方图、像素检查器、HDU 选择、网格叠加、十字准线、小地图、标注
- **FITS 头信息查看器** — 查看和编辑 FITS 头信息，支持关键字搜索
- **帧分类引擎** — 内置 `light/dark/flat/bias/darkflat/unknown`，支持自定义类型与规则（`header`/`filename`、`exact/contains/regex`、优先级）、报表统计口径配置与一键历史重分类
- **图像叠加** — 均值、中值、Sigma 裁剪、最小/最大、Winsorized、加权叠加，支持星点对齐与暗场/平场校准
- **双向格式转换** — 完整支持 `FITS ↔ PNG/JPEG/WebP/TIFF/BMP`，FITS 导出（`.fits` / `.fits.gz`），支持批量转换
- **RAW 格式导入** — 检测常见相机 RAW 格式（如 `DNG/CR2/CR3/NEF/ARW/RAF/ORF/RW2`），通过 `Skia` + `image-js` 降级链解码
- **RGB 合成** — 将单色 FITS 合成彩色图像，支持基础与高级合成模式
- **图像编辑器** — 裁剪、旋转、翻转、模糊、锐化、校准、星点标注
- **图像对比** — 并排对比处理前后的图像
- **天文测量集成** — 通过 [Astrometry.net](https://nova.astrometry.net) 进行解析定位，支持 WCS 导出与校准结果
- **观测目标** — 追踪星系、星云、星团，含曝光进度、滤镜计划与统计分析
- **观测记录** — 日历视图、时间线、观测日志、统计、日历同步
- **图库** — 网格/列表/时间线视图、相册、智能相册、批量导出、回收站与恢复
- **位置标记** — 自动标记观测地点，含交互式地图视图与收藏地点
- **视频支持** — 使用相机录制观测视频，支持画中画播放
- **备份与恢复** — 云端备份至 Google Drive、OneDrive、Dropbox 和 WebDAV
- **局域网传输** — 通过局域网在设备间传输 FITS 文件

### 📱 应用 & 平台

- **[Expo SDK 54](https://docs.expo.dev/)** — 托管工作流，集成 EAS 构建、更新与托管
- **[Expo Router 6](https://docs.expo.dev/router/introduction/)** — 基于文件的路由系统，支持深度链接（`cobalt://`）
- **[HeroUI Native](https://heroui.com/)** — 美观且可定制的组件库，支持深色模式
- **[TailwindCSS 4](https://tailwindcss.com/) + [Uniwind](https://docs.uniwind.dev/)** — 原子化样式，自动适配深色模式
- **[React Native Skia](https://shopify.github.io/react-native-skia/)** — GPU 加速 2D 渲染
- **[Zustand](https://zustand-demo.pmnd.rs/)** — 17 个持久化状态仓库（MMKV 存储）
- **[i18n-js](https://github.com/fnando/i18n)** — 国际化支持（内置中英文）
- **TypeScript 5.9** — 严格模式下的完整类型安全
- **59 个自定义 Hook** — 覆盖所有功能领域
- **100+ 组件** — 按领域组织于 13 个组件目录中
- **代码质量** — ESLint 9 + Prettier + Commitlint + Husky + lint-staged
- **CI/CD** — GitHub Actions（类型检查 → 代码检查 → 格式检查 → 测试 → 构建）
- **E2E 测试** — Maestro Android 导航测试 + 路由一致性验证

## 📦 技术栈

| 分类        | 依赖包                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| 框架        | `expo` 54, `react` 19, `react-native` 0.81                                  |
| 导航        | `expo-router` 6, `react-native-screens`, `react-native-safe-area-context`   |
| UI 组件     | `heroui-native`, `@expo/vector-icons`, `@gorhom/bottom-sheet`               |
| 样式        | `tailwindcss` 4, `uniwind`, `tailwind-merge`, `tailwind-variants`           |
| 渲染        | `@shopify/react-native-skia`, `react-native-svg`                            |
| 动画        | `react-native-reanimated`, `react-native-gesture-handler`                   |
| 状态管理    | `zustand` 5（17 个仓库，MMKV 持久化）                                       |
| FITS        | `fitsjs-ng`, `pako`                                                         |
| 图像        | `expo-image`, `expo-image-manipulator`, `image-js`, `geotiff`, `libheif-js` |
| 视频        | `expo-video`, `expo-video-thumbnails`, `ffmpeg-kit-react-native`            |
| 存储        | `@react-native-async-storage/async-storage`, `expo-secure-store`            |
| 位置 & 地图 | `expo-location`, `expo-maps`, `leaflet` + `react-leaflet`（Web）            |
| 日历        | `expo-calendar`                                                             |
| 认证        | `expo-auth-session`, `@react-native-google-signin/google-signin`            |
| 国际化      | `i18n-js`, `expo-localization`                                              |
| 列表        | `@shopify/flash-list`                                                       |
| 代码质量    | `eslint` 9, `prettier`, `commitlint`, `husky`, `lint-staged`                |
| 测试        | `jest` 29, `jest-expo`, `@testing-library/react-native`                     |

## 🚀 快速开始

### 环境要求

- **Node.js** >= 20
- **pnpm** >= 10（推荐的包管理器）
- **iOS**：需要 Xcode 15+（用于模拟器 / 真机构建）
- **Android**：需要 Android Studio（用于模拟器 / 真机构建）

> [!NOTE]
> FITS 像素渲染使用 `@shopify/react-native-skia`，需要原生模块。无法在 Expo Go 中运行——请使用[开发构建](https://docs.expo.dev/develop/development-builds/introduction/)。

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

启动后按 **`i`** 打开 iOS，**`a`** 打开 Android，**`w`** 打开浏览器。

### 环境变量

| 变量                  | 是否必需 | 说明                                 |
| --------------------- | -------- | ------------------------------------ |
| `GOOGLE_MAPS_API_KEY` | 可选     | Google Maps API 密钥（Android 地图） |

在项目根目录创建 `.env.local` 文件用于本地开发。

## 📁 项目结构

```text
src/
├── app/                       # 基于文件的路由（Expo Router 6）
│   ├── _layout.tsx            # 根布局（全局 Provider、引导页）
│   ├── index.tsx              # 入口重定向
│   ├── [...missing].tsx       # 404 兜底页面
│   ├── (tabs)/                # 标签页导航（5 个标签）
│   │   ├── index.tsx          # 文件 — FITS 文件管理
│   │   ├── gallery.tsx        # 图库 — 图像浏览
│   │   ├── targets.tsx        # 目标 — 观测目标
│   │   ├── sessions.tsx       # 观测 — 观测记录
│   │   └── settings.tsx       # 设置
│   ├── viewer/[id].tsx        # FITS 图像查看器
│   ├── header/[id].tsx        # FITS 头信息查看器
│   ├── editor/[id].tsx        # 图像编辑器
│   ├── stacking/              # 图像叠加
│   ├── compose/               # RGB 合成（基础 + 高级）
│   ├── convert/               # 格式转换（单个 + 批量）
│   ├── album/[id].tsx         # 相册详情
│   ├── target/                # 目标详情 + 统计
│   ├── session/[id].tsx       # 观测详情
│   ├── map/                   # 地图视图
│   ├── astrometry/            # 天文测量 + 结果查看
│   ├── compare/               # 图像对比
│   ├── backup/                # 备份管理
│   ├── video/[id].tsx         # 视频播放器
│   └── settings/              # 设置子页面
│       ├── appearance.tsx     # 主题与显示
│       ├── viewer.tsx         # 查看器默认值
│       ├── gallery.tsx        # 图库偏好
│       ├── processing.tsx     # 处理设置
│       ├── observation.tsx    # 观测配置
│       ├── storage.tsx        # 存储管理
│       ├── licenses.tsx       # 开源许可证
│       └── about.tsx          # 关于与版本信息
├── components/                # 100+ 可复用 UI 组件
│   ├── common/                # 通用（EmptyState、LoadingOverlay、...）
│   ├── fits/                  # FITS 查看器（SkiaCanvas、Histogram、...）
│   ├── files/                 # 文件管理（FileList、ImportSheet、...）
│   ├── gallery/               # 图库（GridView、AlbumCard、...）
│   ├── targets/               # 目标（TargetCard、ExposureProgress、...）
│   ├── sessions/              # 观测（SessionCard、Timeline、...）
│   ├── converter/             # 转换器（FormatPicker、BatchProgress、...）
│   ├── editor/                # 编辑器（Toolbar、CropOverlay、...）
│   ├── astrometry/            # 天文测量（JobStatus、ResultViewer、...）
│   ├── backup/                # 备份（ProviderPicker、RestoreDialog、...）
│   ├── video/                 # 视频（Player、ThumbnailGrid、...）
│   ├── map/                   # 地图（MapView、SiteMarker、...）
│   └── settings/              # 设置（ThemePicker、LanguageSwitch、...）
├── hooks/                     # 59 个自定义 React Hook
├── stores/                    # 17 个 Zustand 状态仓库（MMKV 持久化）
├── lib/                       # 核心业务逻辑
│   ├── fits/                  # FITS 解析、元数据、写入
│   ├── stacking/              # 对齐、校准、星点检测
│   ├── converter/             # 格式转换、批量处理
│   ├── gallery/               # 相册、缩略图、帧分类器
│   ├── targets/               # 目标管理、坐标计算
│   ├── sessions/              # 观测检测、观测日志
│   ├── astrometry/            # Astrometry.net 客户端、WCS 导出
│   ├── backup/                # 云端提供商（GDrive、OneDrive、...）
│   ├── calendar/              # 日历集成
│   ├── viewer/                # 查看器逻辑
│   ├── image/                 # 图像处理工具
│   ├── video/                 # 视频处理
│   ├── map/                   # 地图叠加层、聚类
│   ├── logger/                # 日志系统（含导出）
│   ├── theme/                 # 主题配置、字体预设
│   └── utils/                 # 文件管理、像素计算、图像导出
├── i18n/                      # 国际化（en、zh）
├── utils/                     # 通用工具（cn.ts 等）
├── global.css                 # TailwindCSS + Uniwind + HeroUI 样式
└── uniwind-types.d.ts         # Uniwind 主题类型定义
```

## 📜 可用脚本

| 命令                   | 说明                           |
| ---------------------- | ------------------------------ |
| `pnpm start`           | 启动 Expo 开发服务器           |
| `pnpm ios`             | 在 iOS 模拟器上运行            |
| `pnpm android`         | 在 Android 模拟器上运行        |
| `pnpm web`             | 在浏览器中运行                 |
| `pnpm build`           | 导出 Web 构建                  |
| `pnpm lint`            | 运行 ESLint 检查               |
| `pnpm lint:fix`        | 运行 ESLint 并自动修复         |
| `pnpm format`          | 使用 Prettier 格式化代码       |
| `pnpm format:check`    | 检查代码格式                   |
| `pnpm test`            | 运行单元测试                   |
| `pnpm test:watch`      | 以监听模式运行测试             |
| `pnpm test:coverage`   | 运行测试并生成覆盖率报告       |
| `pnpm test:app`        | 仅运行应用路由测试             |
| `pnpm test:app:parity` | 验证所有路由都有对应的测试文件 |
| `pnpm typecheck`       | 运行 TypeScript 类型检查       |
| `pnpm e2e:parity`      | 验证 E2E 路由一致性            |
| `pnpm e2e:android`     | 运行 Maestro Android E2E 测试  |

## 🧪 测试

### 单元测试

测试使用 **Jest** + **jest-expo** + **@testing-library/react-native**。测试文件按就近原则放置在源码旁的 `__tests__/` 目录中。

```sh
pnpm test              # 运行全部测试
pnpm test:coverage     # 运行并生成覆盖率报告
pnpm test:watch        # 监听模式
pnpm test:app          # 仅运行应用路由测试
```

### E2E 测试

E2E 测试使用 [Maestro](https://maestro.mobile.dev/) 编写 Android 流程：

```sh
pnpm e2e:android       # 运行 Maestro 测试套件
pnpm e2e:parity        # 验证路由一致性
```

Maestro 流程定义在 `.maestro/flows/` 中，按套件组织在 `.maestro/suites/` 中。

### 提交前检查

Husky + lint-staged 在每次提交时自动运行：

- **pre-commit** — 对暂存的 `.ts/.tsx` 文件运行 ESLint 修复 + Prettier 格式化
- **commit-msg** — 通过 commitlint 验证 [Conventional Commits](https://www.conventionalcommits.org/) 格式

## 🌍 国际化

内置 `i18n-js` 和 `expo-localization` 驱动的国际化支持。应用会自动检测设备语言，默认回退到英文。

**支持的语言：** 英文（`en`）、中文（`zh`）

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

### EAS 构建配置

项目使用 [Expo Application Services (EAS)](https://expo.dev/eas)，在 `eas.json` 中预配置了多个构建方案：

| 配置方案      | 分发方式 | 说明                       |
| ------------- | -------- | -------------------------- |
| `development` | 内部     | 本地测试用开发客户端       |
| `e2e-test`    | 内部     | E2E 测试构建（APK）        |
| `preview`     | 内部     | 内部预览构建               |
| `production`  | 商店     | 生产构建（自动递增版本号） |

### 部署命令

| 平台          | 命令                 | 文档                                                            |
| ------------- | -------------------- | --------------------------------------------------------------- |
| Web           | `npx eas-cli deploy` | [EAS Hosting](https://docs.expo.dev/eas/hosting/get-started/)   |
| iOS / Android | `npx eas-cli build`  | [EAS Build](https://docs.expo.dev/build/introduction/)          |
| OTA 热更新    | `npx eas-cli update` | [EAS Update](https://docs.expo.dev/eas-update/getting-started/) |

OTA 更新已启用，使用 `checkAutomatically: "ON_ERROR_RECOVERY"` 策略和 `appVersion` 运行时版本控制。

## ⚠️ 平台说明

| 功能                     | iOS | Android | Web |
| ------------------------ | --- | ------- | --- |
| FITS Skia 渲染           | ✅  | ✅      | ❌  |
| 相机 / 视频录制          | ✅  | ✅      | ❌  |
| Google Maps              | ✅  | ✅      | 🔄  |
| 日历同步                 | ✅  | ✅      | ❌  |
| 位置标记                 | ✅  | ✅      | 🔄  |
| 云端备份（OAuth）        | ✅  | ✅      | ❌  |
| 触觉反馈                 | ✅  | ✅      | ❌  |
| 文件系统访问             | ✅  | ✅      | 🔄  |
| Leaflet 地图（Web 替代） | ❌  | ❌      | ✅  |

> ✅ = 完全支持 · 🔄 = 部分支持 / 降级方案 · ❌ = 不可用

## ⚙️ 注意事项

- **fitsjs 补丁** — `pnpm postinstall` 会运行 `scripts/patch-fitsjs.mjs` 修补 fitsjs-ng。更新 fitsjs-ng 后请验证补丁是否仍然适用。
- **Skia 原生模块** — `@shopify/react-native-skia` 需要开发构建，FITS 渲染无法在 Expo Go 中工作。
- **MMKV 持久化** — Zustand 仓库使用 persist 中间件。更改仓库结构需要迁移逻辑，否则用户数据会丢失。
- **i18n 同步** — `en.ts` 和 `zh.ts` 必须具有相同的键结构——目前没有构建时缺失键检查。
- **天文测量 API 密钥** — 解析定位需要 API 密钥。从 [nova.astrometry.net](https://nova.astrometry.net) 获取并通过 `expo-secure-store` 存储。
- **Web 与原生差异** — 部分功能在 Web 上行为不同或不可用。参见上方平台说明表。

## 📚 文档

详细文档位于 [`llmdoc/`](./llmdoc/) 目录：

- **[概述](./llmdoc/overview/)** — 项目概述、核心模块、基础设施
- **[架构](./llmdoc/architecture/)** — 路由、状态管理、FITS 模块、叠加、图库、天文测量
- **[操作指南](./llmdoc/guides/)** — 添加页面、添加翻译、管理观测、图像叠加
- **[参考文档](./llmdoc/reference/)** — 数据模型、导出格式、i18n 键、编码规范

## 🤝 参与贡献

欢迎贡献！请在提交 Pull Request 之前阅读 [贡献指南](./CONTRIBUTING.md) 和 [行为准则](./CODE_OF_CONDUCT.md)。

### 贡献者快速入门

```sh
git checkout -b feat/my-feature    # 创建功能分支
pnpm typecheck && pnpm lint        # 提交前验证
pnpm test                          # 运行测试
git commit -m "feat: 添加功能"      # 需要遵循 Conventional Commits
```

## 📄 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。

## 🙏 致谢

- **[fitsjs-ng](https://github.com/AsteroidOS/fitsjs-ng)** — JavaScript FITS 文件解析
- **[Shopify/react-native-skia](https://github.com/Shopify/react-native-skia)** — GPU 加速 2D 渲染
- **[HeroUI](https://heroui.com/)** — React Native 组件库
- **[Expo](https://expo.dev/)** — 通用 React Native 平台
- **[Astrometry.net](https://nova.astrometry.net)** — 天文测量解析定位服务
