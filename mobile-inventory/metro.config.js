const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore 'react-native' field in node_modules package.json to prevent Metro from trying
// to build uncompiled TypeScript files from @tanstack/query-core and @tanstack/react-query.
config.resolver.mainFields = ['module', 'main'];

module.exports = config;
