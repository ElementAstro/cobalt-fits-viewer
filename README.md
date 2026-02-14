<div align="center">

# React Native Quick Starter

A batteries-included, production-ready React Native starter template.

Build cross-platform apps for **iOS**, **Android**, and **Web** from a single codebase.

[![CI](https://github.com/user/react-native-quick-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/user/react-native-quick-starter/actions/workflows/ci.yml)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-blue?logo=expo)](https://docs.expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**English** | [中文](./README.zh-CN.md)

</div>

## ✨ Features

- **[Expo SDK 54](https://docs.expo.dev/)** — Managed workflow for rapid development
- **[Expo Router 6](https://docs.expo.dev/router/introduction/)** — File-based routing with deep linking
- **[HeroUI Native](https://heroui.com/)** — Beautiful, themeable component library
- **[TailwindCSS 4](https://tailwindcss.com/) + [Uniwind](https://docs.uniwind.dev/)** — Utility-first styling with automatic dark mode
- **[React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)** — Performant 60fps animations
- **[@gorhom/bottom-sheet](https://gorhom.github.io/react-native-bottom-sheet/)** — Smooth bottom sheet interactions
- **[i18n-js](https://github.com/fnando/i18n)** — Internationalization (English & Chinese built-in)
- **TypeScript 5.9** — Full type safety with strict mode
- **Code Quality** — ESLint 9 (flat config) + Prettier + Commitlint + Husky + lint-staged
- **Testing** — Jest + React Native Testing Library with coverage reports
- **CI/CD** — GitHub Actions pipeline (type check → lint → test → build)

## 📦 Tech Stack

| Category     | Packages                                                                |
| ------------ | ----------------------------------------------------------------------- |
| Framework    | `expo` 54, `react` 19, `react-native` 0.81                              |
| Navigation   | `expo-router`, `react-native-screens`, `react-native-safe-area-context` |
| UI           | `heroui-native`, `@expo/vector-icons`, `@gorhom/bottom-sheet`           |
| Styling      | `tailwindcss` 4, `uniwind`, `tailwind-merge`, `tailwind-variants`       |
| Animation    | `react-native-reanimated`, `react-native-gesture-handler`               |
| Storage      | `@react-native-async-storage/async-storage`, `expo-secure-store`        |
| i18n         | `i18n-js`, `expo-localization`                                          |
| Utilities    | `expo-clipboard`, `expo-linear-gradient`, `react-native-svg`            |
| Code Quality | `eslint` 9, `prettier`, `commitlint`, `husky`, `lint-staged`            |
| Testing      | `jest`, `jest-expo`, `@testing-library/react-native`                    |

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** (recommended package manager)
- **iOS**: Xcode (for simulator)
- **Android**: Android Studio (for emulator)

### Installation

```sh
# Clone the repository
git clone https://github.com/user/react-native-quick-starter.git
cd react-native-quick-starter

# Install dependencies
pnpm install

# Start the development server
pnpm start
```

Then press `i` for iOS, `a` for Android, or `w` for Web.

## 📁 Project Structure

```text
src/
├── app/                  # File-based routes (Expo Router)
│   ├── _layout.tsx       # Root layout (Providers)
│   ├── index.tsx         # Entry redirect
│   ├── [...missing].tsx  # 404 catch-all page
│   └── (tabs)/           # Tab navigation group
│       ├── _layout.tsx   # Tab bar configuration
│       ├── index.tsx     # Home tab
│       └── explore.tsx   # Explore tab
├── i18n/                 # Internationalization
│   ├── locales/          # Translation files (en, zh)
│   ├── index.ts          # i18n instance setup
│   └── useI18n.ts        # React hook for translations
├── utils/
│   └── cn.ts             # className merge utility
├── global.css            # TailwindCSS + Uniwind + HeroUI styles
└── uniwind-types.d.ts    # Uniwind theme type definitions
```

## 📜 Available Scripts

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `pnpm start`         | Start the Expo development server |
| `pnpm ios`           | Run on iOS simulator              |
| `pnpm android`       | Run on Android emulator           |
| `pnpm web`           | Run in the web browser            |
| `pnpm lint`          | Run ESLint checks                 |
| `pnpm lint:fix`      | Run ESLint and auto-fix issues    |
| `pnpm format`        | Format code with Prettier         |
| `pnpm format:check`  | Check code formatting             |
| `pnpm test`          | Run unit tests                    |
| `pnpm test:watch`    | Run tests in watch mode           |
| `pnpm test:coverage` | Run tests with coverage report    |
| `pnpm typecheck`     | Run TypeScript type checking      |

## 🌍 Internationalization

Built-in i18n support powered by `i18n-js` and `expo-localization`. The app automatically detects the device language and falls back to English.

**Adding a new language:**

1. Create a new locale file in `src/i18n/locales/` (e.g., `ja.ts`)
2. Export it from `src/i18n/locales/index.ts`
3. Register it in `src/i18n/index.ts`

**Using translations in components:**

```tsx
import { useI18n } from "../i18n/useI18n";

function MyComponent() {
  const { t, locale, setLocale } = useI18n();
  return <Text>{t("tabs.home")}</Text>;
}
```

## 🚢 Deployment

Deploy on all platforms with [Expo Application Services (EAS)](https://expo.dev/eas):

| Platform      | Command              | Documentation                                                   |
| ------------- | -------------------- | --------------------------------------------------------------- |
| Web           | `npx eas-cli deploy` | [EAS Hosting](https://docs.expo.dev/eas/hosting/get-started/)   |
| iOS / Android | `npx eas-cli build`  | [EAS Build](https://docs.expo.dev/build/introduction/)          |
| OTA Updates   | `npx eas-cli update` | [EAS Update](https://docs.expo.dev/eas-update/getting-started/) |

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) before submitting a Pull Request.

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
