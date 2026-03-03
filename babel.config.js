/* global module */
/** @type {(api: import("@babel/core").ConfigAPI) => import("@babel/core").TransformOptions} */
module.exports = function (api) {
  api.cache.forever();
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
