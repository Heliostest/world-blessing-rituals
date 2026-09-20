const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  if (/^react(?:\/|$)|^react-dom(?:\/|$)/.test(name))
    return {
      type: "sourceFile",
      filePath: require.resolve(name, { paths: [projectRoot] }),
    };
  return originalResolve
    ? originalResolve(context, name, platform)
    : context.resolveRequest(context, name, platform);
};
module.exports = config;
