const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro"); // make sure this import exists

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Apply uniwind modifications before exporting
const uniwindConfig = withUniwindConfig(config, {
  // relative path to your global.css file
  cssEntryFile: "./src/global.css",
  // optional: path to typings
  dtsFile: "./src/uniwind-types.d.ts",
});

const previousResolveRequest = uniwindConfig.resolver?.resolveRequest;

uniwindConfig.resolver = {
  ...uniwindConfig.resolver,
  resolveRequest(context, moduleName, platform) {
    if (platform === "web" && moduleName === "@fxpineau/moc-wasm") {
      return {
        filePath: path.resolve(__dirname, "src/shims/moc-wasm.web.ts"),
        type: "sourceFile",
      };
    }

    if (typeof previousResolveRequest === "function") {
      return previousResolveRequest(context, moduleName, platform);
    }

    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = uniwindConfig;
