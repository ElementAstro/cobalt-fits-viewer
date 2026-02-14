export default {
  common: {
    goHome: "Go Home",
  },
  tabs: {
    home: "Home",
    explore: "Explore",
  },
  home: {
    title: "Quick Starter",
    subtitle: "Expo Router + HeroUI Native + Uniwind",
    readyToBuild: "Ready to Build",
    readyDescription:
      "This template includes everything you need to start building a React Native app with file-based routing, beautiful UI components, and utility-first styling.",
    quickActions: "> quick_actions",
    exploreFeatures: "Explore Features",
    editFile: "Edit src/app/(tabs)/index.tsx",
    startCustomizing: "> Start customizing by editing the files in ",
  },
  explore: {
    title: "Explore",
    subtitle: "What's included in this template",
    features: {
      expoRouter: "Expo Router",
      expoRouterDesc: "File-based routing for React Native apps",
      heroui: "HeroUI Native",
      herouiDesc: "Beautiful, accessible component library",
      uniwind: "Uniwind + TailwindCSS",
      uniwindDesc: "Utility-first styling with dark mode support",
      bottomSheet: "Bottom Sheet",
      bottomSheetDesc: "Smooth bottom sheet interactions via @gorhom/bottom-sheet",
      reanimated: "Reanimated",
      reanimatedDesc: "Performant animations with react-native-reanimated",
      secureStore: "Secure Store",
      secureStoreDesc: "Encrypted key-value storage via expo-secure-store",
      i18n: "Internationalization",
      i18nDesc: "Multi-language support via expo-localization & i18n-js",
    },
  },
  notFound: {
    title: "Page Not Found",
    description: "The page you're looking for doesn't exist.",
  },
} as const;
