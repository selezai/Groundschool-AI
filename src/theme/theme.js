import React, { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';
// Appearance and useColorScheme are no longer needed as we are forcing dark theme.

// lightColors object is removed as it's no longer used.

export const darkColors = {
  // Application's actual dark theme palette
  background: '#0a0e23',
  surface: '#191E38', // Used for cards, inputs
  primary: '#8dffd6', // Accent color for buttons, interactive elements
  primaryContent: '#0a0e23', // Text color for primary buttons
  secondary: '#A0AEC0', // Secondary actions or elements
  secondaryContent: '#191E38', // Text for secondary buttons/elements
  accent: '#8dffd6', // Kept for consistency, same as primary
  accentContent: '#0a0e23', // Text for accent elements
  neutral: '#2D3748', // Neutral elements, borders
  neutralContent: '#A0AEC0', // Text for neutral elements
  base100: '#0a0e23', // Base background
  base200: '#191E38', // Slightly lighter background shade
  base300: '#2D3748', // Even lighter background shade or distinct sections
  baseContent: '#FFFFFF', // General content text on base backgrounds
  info: '#3ABFF8',
  infoContent: '#002B3D',
  success: '#36D399',
  successContent: '#003320',
  warning: '#FBBD23',
  warningContent: '#382800',
  error: '#EF4444', // Error messages, icons
  errorContent: '#FFFFFF', // Text on error elements

  // Specific mappings for React Navigation theme structure if needed,
  // but primarily using the above for direct component styling.
  // These are what LoginScreen's current mapping expects e.g. appTheme.colors.text
  text: '#FFFFFF',         // Primary text color (maps to textPrimary from your palette)
  card: '#191E38',         // Card/surface background (maps to surface from your palette)
  border: '#2D3748',       // Border color (maps to border from your palette)
  // subtext: "#A0AEC0",    // Secondary/muted text (maps to textSecondary from your palette)
  // The LoginScreen uses appTheme.colors.subtext, so let's define it.
  subtext: '#A0AEC0',       // For placeholders or less important text
  textSecondary: '#A0AEC0', // Explicitly define for secondary text elements
  link: '#8dffd6'          // Link color
};

export const spacing = {
  xxs: 4,
  xs: 8,
  s: 12,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  h3: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  h4: {
    fontSize: 18,
    fontWeight: '600', // Semibold
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  button: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
  // Add more text styles (e.g., subtitle, label) as needed
};

// Theme context
const ThemeContext = createContext(null); // Initialize with null or a default theme structure

// Theme provider component
export const ThemeProvider = ({ children, value }) => {
  // If a value is explicitly passed (e.g., from RootLayoutNav), use it.
  // Otherwise, construct a default one (though RootLayoutNav should always pass one).
  const themeToProvide = value || {
    colors: darkColors, // Default to darkColors if no value prop is provided
    spacing,
    typography,
    isDarkMode: true, // Default assumption
  };

  // logger.debug('ThemeProvider rendering with theme:', themeToProvide);
  return <ThemeContext.Provider value={themeToProvide}>{children}</ThemeContext.Provider>;
};

// Custom hook to use the theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Utility function to create themed styles
export const createThemedStyles = (styleCreator) => {
  // This function is what getStyles becomes.
  // It will be called inside the component render, so useTheme() is valid here.
  return () => { 
    const actualThemeFromHook = useTheme(); // Try to get theme directly here
    if (!actualThemeFromHook) {
      console.warn('createThemedStyles (INNER FALLBACK): useTheme() returned undefined. Falling back to default dark theme.');
      const fallbackTheme = { colors: darkColors, spacing, typography, isDarkMode: true };
      return StyleSheet.create(styleCreator(fallbackTheme));
    }
    return StyleSheet.create(styleCreator(actualThemeFromHook));
  };
};

// Default export for convenience if needed, though named exports are primary
const defaultTheme = {
  colors: darkColors, // Default to dark theme
  spacing,
  typography,
  isDarkMode: true, // Always true
};

export default defaultTheme;
