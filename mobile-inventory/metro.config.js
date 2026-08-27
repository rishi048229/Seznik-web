const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Ignore 'react-native' field in node_modules package.json to prevent Metro from trying
// to build uncompiled TypeScript files from @tanstack/query-core and @tanstack/react-query.
config.resolver.mainFields = ['module', 'main'];

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  '@shared': path.resolve(workspaceRoot, 'shared'),
};

module.exports = config;
