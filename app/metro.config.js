// Lets Metro bundle the website's i18n dictionaries (../frontend/i18n) so the
// app and the site share one set of AZ / EN strings instead of two copies.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, "../frontend/i18n")];

module.exports = config;
