export default {
  common: {
    goHome: "返回首页",
  },
  tabs: {
    home: "首页",
    explore: "探索",
  },
  home: {
    title: "快速启动",
    subtitle: "Expo Router + HeroUI Native + Uniwind",
    readyToBuild: "准备就绪",
    readyDescription:
      "此模板包含了构建 React Native 应用所需的一切：基于文件的路由、精美的 UI 组件和实用优先的样式系统。",
    quickActions: "> 快捷操作",
    exploreFeatures: "探索功能",
    editFile: "编辑 src/app/(tabs)/index.tsx",
    startCustomizing: "> 开始自定义，编辑 ",
  },
  explore: {
    title: "探索",
    subtitle: "此模板包含的功能",
    features: {
      expoRouter: "Expo Router",
      expoRouterDesc: "基于文件的 React Native 路由系统",
      heroui: "HeroUI Native",
      herouiDesc: "美观、无障碍的组件库",
      uniwind: "Uniwind + TailwindCSS",
      uniwindDesc: "支持深色模式的实用优先样式",
      bottomSheet: "Bottom Sheet",
      bottomSheetDesc: "通过 @gorhom/bottom-sheet 实现流畅的底部弹窗交互",
      reanimated: "Reanimated",
      reanimatedDesc: "使用 react-native-reanimated 实现高性能动画",
      secureStore: "Secure Store",
      secureStoreDesc: "通过 expo-secure-store 实现加密键值存储",
      i18n: "国际化",
      i18nDesc: "通过 expo-localization 和 i18n-js 实现多语言支持",
    },
  },
  notFound: {
    title: "页面未找到",
    description: "您访问的页面不存在。",
  },
} as const;
