import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { Image, View, Text, StyleSheet } from 'react-native';
import { ThemeProvider, darkColors, spacing, typography } from '../../theme/theme';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Drawer-based navigation layout for the main app screens.
 * This component defines the drawer navigator and provides the theme to its child screens.
 */
export default function DrawerLayout() {
  const { session, profile } = useAuth();

  // Manually construct the theme object. This is necessary because Expo Router layouts
  // can have issues consuming context from parent layouts during initialization.
  const theme = {
    colors: darkColors,
    spacing,
    typography,
    isDarkMode: true,
  };

  // Create styles manually using the theme object.
  const styles = StyleSheet.create({
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerLogo: {
      width: 30,
      height: 30,
      marginRight: 10,
    },
    headerTitleText: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: theme.typography.h3.fontWeight,
      color: theme.colors.text,
    },
  });

  if (!session) {
    return null;
  }

  // Wrap the Drawer in a ThemeProvider to make the theme available to all child screens.
  return (
    <ThemeProvider value={theme}>
      <Drawer
        initialRouteName="home"
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
            borderBottomWidth: 1,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: theme.colors.text,
          },
          headerTintColor: theme.colors.text,
          headerRight: () => null,
          drawerStyle: {
            backgroundColor: theme.colors.surface,
            width: 260,
          },
          drawerActiveTintColor: theme.colors.primary,
          drawerInactiveTintColor: theme.colors.secondary,
          drawerLabelStyle: {
            fontSize: 16,
            fontWeight: '500',
            marginLeft: -15,
          },
          drawerActiveBackgroundColor: theme.colors.base300,
        }}
      >
        <Drawer.Screen
          name="home"
          options={{
            title: 'Home',
            headerTitle: () => (
              <View style={styles.headerTitleContainer}>
                <Image
                  source={require('../../../assets/transparent.png')}
                  style={styles.headerLogo}
                />
                <Text style={styles.headerTitleText}>Groundschool AI</Text>
              </View>
            ),
            drawerIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="quizzes"
          options={{
            title: 'Exams',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="school-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            title: 'Profile',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="captains-club"
          options={{
            title: "Captain's Club",
            drawerIcon: ({ focused, color, size }) => (
              <Ionicons
                name={profile?.plan === 'basic' || focused ? 'star' : 'star-outline'}
                size={size}
                color={profile?.plan === 'basic' ? theme.colors.primary : color}
              />
            ),
            drawerLabelStyle: {
              marginLeft: -15,
              fontWeight: '500',
              fontSize: 16,
              color: profile?.plan === 'basic' ? theme.colors.primary : undefined,
            },
          }}
        />
        <Drawer.Screen
          name="feedback"
          options={{
            title: 'User Feedback',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-outline" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </ThemeProvider>
  );
}


