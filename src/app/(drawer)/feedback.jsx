import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { darkColors } from '../../theme/theme'; // Assuming your theme colors are here

const FeedbackScreen = () => {
  const handleSendFeedback = async () => {
    const email = 'groundschoolai@gmail.com';
    const subject = 'Groundschool AI App Feedback';
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Cannot Open Email Client',
          'We could not open your email client. Please send your feedback manually to groundschoolai@gmail.com'
        );
      }
    } catch (error) {
      console.error('Failed to open mailto link', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please send your feedback manually to groundschoolai@gmail.com'
      );
    }
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'User Feedback' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Submit Your Feedback</Text>
        <Text style={styles.placeholderText}>
          We value your input! Tap the button below to open your email client and send us your thoughts, suggestions, or report any issues.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleSendFeedback}>
          <Text style={styles.buttonText}>Send Feedback via Email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: darkColors.background, // Use background color from theme
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: darkColors.background, // Use background color from theme
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: darkColors.text, // Use text color from theme
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: darkColors.text, // Use text color from theme
    textAlign: 'center',
    marginBottom: 20, // Increased margin
  },
  button: {
    backgroundColor: darkColors.primary, // Use primary color from theme
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25, // More rounded corners
    marginTop: 20,
    minWidth: 250, // Ensure button is a decent width
    alignItems: 'center', // Center text in button
  },
  buttonText: {
    color: darkColors.background, // Text color that contrasts with primary
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 16,
    color: darkColors.text, // Use text color from theme
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default FeedbackScreen;
