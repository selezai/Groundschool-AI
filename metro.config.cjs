const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force ES module output for web
config.transformer.unstable_allowRequireContext = true;
config.transformer.enableBabelRCLookup = false;

// Explicitly configure web target
config.resolver.platforms = ['web', 'native', 'ios', 'android'];

// Stub react-native-svg on web (required for posthog-react-native to build)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg' && platform === 'web') {
    return {
      filePath: path.resolve(__dirname, 'src/stubs/react-native-svg.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add custom transformer options for web
if (process.env.EXPO_PLATFORM === 'web') {
  config.transformer.babelTransformerPath = require.resolve('metro-react-native-babel-transformer');
  config.transformer.unstable_enableSymlinks = true;
}

module.exports = config;
