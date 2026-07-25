const path = require("path");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [require.resolve("babel-preset-expo")],
    plugins: [path.join(__dirname, "babel-plugin-strip-dynamic-import.js")],
  };
};
