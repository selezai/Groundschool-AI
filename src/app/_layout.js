import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router'; // Import usePathname
import { useAuth } from '../contexts/AuthContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import { ThemeProvider, darkColors, spacing, typography } from '../theme/theme';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import logger from '../services/loggerService';

export default function RootLayoutNav() {
  // 1. Construct the theme object
  const currentTheme = {
    colors: darkColors,
    spacing,
    typography,
    isDarkMode: true, // Assuming dark mode is the default
  };

  // 2. Create styles for RootLayoutNav using the constructed theme
  const styles = createRootLayoutStyles(currentTheme);
  
  const { session, isAuthReady, isProcessingAuth } = useAuth(); // Use isAuthReady explicitly, isProcessingAuth for potential future use here or in screens
  const router = useRouter();
  const pathname = usePathname(); // Use usePathname

  useEffect(() => {
    logger.debug('RootLayoutNav', 'useEffect triggered', { isAuthReady, hasSession: !!session, pathname });

    // Only proceed with navigation logic if the initial auth check is complete
    if (!isAuthReady) {
      logger.debug('RootLayoutNav', 'isAuthReady is false, initial auth check not complete. useEffect will wait.');
      return;
    }

    const inAuthFlow = pathname === '/login' || pathname === '/register'; // Consider other auth routes like register
    const isRootPath = pathname === '/';
    logger.debug('RootLayoutNav', 'Auth flow check', { inAuthFlow, isRootPath, pathname });

    if (session && isRootPath) {
      // If user is authenticated and at root path, redirect to home
      logger.debug('RootLayoutNav', 'Condition 0: session && isRootPath. Redirecting to /(drawer)/home', { hasSession: !!session, isRootPath });
      router.replace('/(drawer)/home');
    } else if (!session && !inAuthFlow) {
      logger.debug('RootLayoutNav', 'Condition 1: !session && !inAuthFlow. Redirecting to /login', { hasSession: !!session, inAuthFlow });
      router.replace('/login');
    } else if (session && inAuthFlow) {
      logger.debug('RootLayoutNav', 'Condition 2: session && inAuthFlow. Redirecting to /(drawer)/home', { hasSession: !!session, inAuthFlow });
      router.replace('/(drawer)/home');
    } else {
      logger.debug('RootLayoutNav', 'No redirect conditions met or already on correct screen.');
    }
  }, [session, isAuthReady, pathname, router]);

  // Show loading indicator only during the initial auth readiness check
  if (!isAuthReady) {
    // Show a custom loading component while checking auth state.
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  // If session is null and we are not in auth flow, router.replace will handle it.
  // If session is available, or if we are in auth flow, render the stack.
  return (
    <ThemeProvider value={currentTheme}>
      <NetworkProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="login" 
            options={{ 
              title: 'Login',
              headerShown: false, 
              headerStyle: {
                backgroundColor: '#FFFFFF',
              },
            }} 
          />
        </Stack>
      </NetworkProvider>
    </ThemeProvider>
  );
}

// Define styles for RootLayoutNav directly, not using createThemedStyles/useTheme
// This function will create styles using the theme object passed to it.
const createRootLayoutStyles = (theme) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
