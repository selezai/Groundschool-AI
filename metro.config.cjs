const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force ES module output for web
config.transformer.unstable_allowRequireContext = true;
config.transformer.enableBabelRCLookup = false;

// Explicitly configure web target
config.resolver.platforms = ['web', 'native', 'ios', 'android'];

// Add custom transformer options for web
if (process.env.EXPO_PLATFORM === 'web') {
  config.transformer.babelTransformerPath = require.resolve('metro-react-native-babel-transformer');
  config.transformer.unstable_enableSymlinks = true;
}

module.exports = config;
