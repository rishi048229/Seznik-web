const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(projectRoot);

// Ignore 'react-native' field in node_modules package.json to prevent Metro from trying
// to build uncompiled TypeScript files from @tanstack/query-core and @tanstack/react-query.
config.resolver.mainFields = ['module', 'main'];

// ONLY watch the necessary 'shared' directory instead of the entire monorepo root.
// Watching the whole workspaceRoot on Windows forces Metro to crawl backend, frontend,
// admin-panel, .git, dist, and hundreds of thousands of files, drastically slowing reload times.
config.watchFolders = [sharedRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Block crawling into unrelated directories in the parent monorepo
config.resolver.blockList = [
  new RegExp(path.resolve(workspaceRoot, 'backend').replace(/\\/g, '\\\\') + '.*'),
  new RegExp(path.resolve(workspaceRoot, 'frontend').replace(/\\/g, '\\\\') + '.*'),
  new RegExp(path.resolve(workspaceRoot, 'admin-panel').replace(/\\/g, '\\\\') + '.*'),
  new RegExp(path.resolve(workspaceRoot, '.git').replace(/\\/g, '\\\\') + '.*'),
];

config.resolver.extraNodeModules = {
  '@shared': sharedRoot,
};

module.exports = config;

