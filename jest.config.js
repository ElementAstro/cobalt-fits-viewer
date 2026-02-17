/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|i18n-js|heroui-native|tailwind-merge|tailwind-variants)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testPathIgnorePatterns: [
    "\\\\node_modules\\\\",
    "src/app/__tests__/testUtils",
    "src/hooks/__tests__/helpers",
  ],
  moduleNameMapper: {
    "\\.css$": "<rootDir>/__mocks__/styleMock.js",
  },
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageDirectory: "coverage",
};
