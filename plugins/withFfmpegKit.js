/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  withDangerousMod,
  withGradleProperties,
  withPodfileProperties,
  withPlugins,
  withProjectBuildGradle,
  createRunOncePlugin,
} = require("expo/config-plugins");
const { createGeneratedHeaderComment, removeGeneratedContents, mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const DEFAULT_PACKAGE = "full";
const TAG_ANDROID = "cobalt-ffmpeg-kit-android-package";
const TAG_IOS = "cobalt-ffmpeg-kit-ios-pod";

function appendContents({ src, newSrc, tag, comment }) {
  const header = createGeneratedHeaderComment(newSrc, tag, comment);
  if (!src.includes(header)) {
    let sanitizedTarget = removeGeneratedContents(src, tag);
    if (sanitizedTarget) sanitizedTarget += "\n";
    const contentsToAdd = [
      header,
      newSrc,
      `${comment} @generated end ${tag}`,
    ].join("\n");
    return {
      contents: (sanitizedTarget ?? src) + contentsToAdd,
      didMerge: true,
      didClear: !!sanitizedTarget,
    };
  }
  return { contents: src, didClear: false, didMerge: false };
}

function withAndroidFfmpegPackage(config, packageName = DEFAULT_PACKAGE) {
  const withPackage = withProjectBuildGradle(config, (nextConfig) => {
    if (nextConfig.modResults.language !== "groovy") {
      throw new Error("Cannot configure ffmpeg-kit package because build.gradle is not groovy.");
    }
    nextConfig.modResults.contents = appendContents({
      tag: TAG_ANDROID,
      src: nextConfig.modResults.contents,
      newSrc: `ext { ffmpegKitPackage = "${packageName}" }`,
      comment: "//",
    }).contents;
    return nextConfig;
  });

  return withGradleProperties(withPackage, (nextConfig) => {
    const pickFirstKey = "android.packagingOptions.pickFirsts";
    const pickFirstValue =
      "lib/x86/libc++_shared.so,lib/x86_64/libc++_shared.so,lib/armeabi-v7a/libc++_shared.so,lib/arm64-v8a/libc++_shared.so";
    const existing = nextConfig.modResults.find((entry) => entry.type === "property" && entry.key === pickFirstKey);
    if (existing) {
      existing.value = pickFirstValue;
    } else {
      nextConfig.modResults.push({
        type: "property",
        key: pickFirstKey,
        value: pickFirstValue,
      });
    }
    return nextConfig;
  });
}

function withIosFfmpegPackage(config, packageName = DEFAULT_PACKAGE) {
  const withProps = withPodfileProperties(config, (nextConfig) => {
    nextConfig.modResults["ffmpeg-kit-react-native.subspecs"] = [packageName];
    return nextConfig;
  });

  return withDangerousMod(withProps, [
    "ios",
    async (nextConfig) => {
      const fs = require("node:fs/promises");
      const path = require("node:path");
      const podfilePath = path.join(nextConfig.modRequest.platformProjectRoot, "Podfile");
      const contents = await fs.readFile(podfilePath, "utf8");
      const merged = mergeContents({
        tag: TAG_IOS,
        src: contents,
        newSrc:
          "  pod 'ffmpeg-kit-react-native', :subspecs => podfile_properties['ffmpeg-kit-react-native.subspecs'] || ['full'], :podspec => File.join(File.dirname(`node --print \"require.resolve('ffmpeg-kit-react-native/package.json')\"`), 'ffmpeg-kit-react-native.podspec')",
        anchor: /use_native_modules/,
        offset: 0,
        comment: "#",
      });
      await fs.writeFile(podfilePath, merged.contents, "utf8");
      return nextConfig;
    },
  ]);
}

function withFfmpegKit(config, props = {}) {
  const packageName = props.package || DEFAULT_PACKAGE;
  return withPlugins(config, [
    [(cfg) => withIosFfmpegPackage(cfg, packageName)],
    [(cfg) => withAndroidFfmpegPackage(cfg, packageName)],
  ]);
}

module.exports = createRunOncePlugin(withFfmpegKit, "withFfmpegKit", "1.0.0");
