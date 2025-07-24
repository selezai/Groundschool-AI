import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExpoRoot } from 'expo-router';
// import { registerRootComponent } from 'expo'; // This is in index.js
import { ThemeProvider as ReactNavigationThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { Appearance } from 'react-native';

// Import contexts
import { AuthProvider } from './src/contexts/AuthContext';
// Removed: import { ThemeProvider } from './src/theme/theme'; // File does not exist

import { darkColors } from './src/theme/theme';

// Define your custom themes
const MyDarkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface, // 'surface' from theme.js maps to 'card'
    text: darkColors.text,
    border: darkColors.border, // Use theme.js border
    notification: darkColors.error, // Use theme.js error for notification
    // Additional custom colors for convenience, not standard in React Navigation theme
    // but can be accessed via useTheme().colors.customProperty if added here
    placeholder: darkColors.subtext, 
    secondaryText: darkColors.subtext,
    accent: darkColors.primary, // or darkColors.accent if defined and different
    muted: darkColors.neutral, // or a specific muted color if defined in darkColors
    errorText: darkColors.error, // specific for error messages
  },
};

export default function App() {
  // Force dark theme as per application design
  const currentTheme = MyDarkTheme;

  return (
    <SafeAreaProvider>
      <ReactNavigationThemeProvider value={currentTheme}>
        <AuthProvider>
          {/* Expo Router handles navigation based on src/app directory */}
          <ExpoRoot context={require.context('./src/app', true, /\.(js|jsx)$/)} />
          <StatusBar style="light" />
        </AuthProvider>
      </ReactNavigationThemeProvider>
    </SafeAreaProvider>
  );
}

// registerRootComponent(App); // This call is in index.js
