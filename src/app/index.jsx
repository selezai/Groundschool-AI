import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { darkColors } from '../theme/theme';

export default function Index() {
  // _layout.js handles all redirection logic based on auth session.
  // This component should render a loading screen while redirection happens
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading Groundschool AI...</Text>
      <ActivityIndicator size="large" color={darkColors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkColors.background,
  },
  text: {
    color: darkColors.text,
    fontSize: 18,
    marginBottom: 20,
  },
  spinner: {
    marginTop: 10,
  },
});
