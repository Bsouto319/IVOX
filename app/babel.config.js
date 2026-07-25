module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["./babel-plugin-strip-dynamic-import.js"],
  };
};
