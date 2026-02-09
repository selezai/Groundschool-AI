module.exports = function(api) {
  api.cache(true);
  
  const isTest = process.env.NODE_ENV === 'test';
  const isWeb = process.env.EXPO_PLATFORM === 'web';
  
  // Exclude reanimated plugin for tests and web builds
  // Reanimated 4 can cause issues on iOS Safari
  const plugins = (isTest || isWeb) ? [] : ['react-native-reanimated/plugin'];
  
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
