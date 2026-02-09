import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    expo: {
      ...config.expo, // Merges with base config.expo, specific overrides follow
      name: 'Groundschool AI',
      slug: 'groundschool-ai',
      version: '1.0.0',
      orientation: 'portrait',
      icon: './public/assets/logo.png', // Main application icon - MOVED TO PUBLIC/ASSETS
      userInterfaceStyle: 'light',
      splash: {
        image: './assets/transparent.png',
        resizeMode: 'contain',
        backgroundColor: '#0a0e23'
      },
      assetBundlePatterns: [
        '**/*'
      ],
      ios: {
        ...(config.expo?.ios || {}),
        supportsTablet: true,
        bundleIdentifier: 'com.groundschoolai.app' // Explicitly set Bundle ID
      },
      android: {
        ...(config.expo?.android || {}),
        package: 'com.groundschoolai.app', // Explicitly set Package Name
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png', // You'll need to create this file: assets/adaptive-icon.png
          backgroundColor: '#ffffff'
        }
      },
      web: {
        ...(config.expo?.web || {}),
        favicon: './public/assets/round.png',
        bundler: 'metro', // Recommended for PWAs with Expo
        output: 'single', // Generates a single index.html for SPA deployment
        indexHtml: './web/index.html', // Explicitly use our custom index.html
        splash: { // Web PWA splash screen configuration
          image: './assets/transparent.png',
          resizeMode: 'contain',
          backgroundColor: '#0a0e23',
        },
        manifest: {
          name: 'Groundschool AI',
          short_name: 'GroundschoolAI',
          description: 'AI-Powered Aviation Exam Preparation',
          display: 'standalone', // Makes the PWA feel like a native app
          orientation: 'portrait',
          start_url: '/', // Entry point of the PWA
          background_color: '#ffffff', // Splash screen background for PWA
          theme_color: '#4F46E5', // Affects the browser UI color on mobile
          icons: [
            {
              src: '/assets/logo.png', // Absolute path from domain root (logo.png is at dist/assets) - UPDATED
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable' // Important for PWA icons
            },
            {
              src: '/assets/logo.png', // Absolute path from domain root (logo.png is at dist/assets) - UPDATED
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      },
      // Existing scheme, plugins, and extra config:
      scheme: 'myapp', 
      plugins: [
        "expo-router",
        // "sentry-expo" 
        // Add other plugins as needed
      ],
      extra: {
        eas: {
          projectId: process.env.EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID_HERE' 
        },
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY, 
      },
    },
  };
};
