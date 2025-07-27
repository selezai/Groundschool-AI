import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Linking
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // For potential icons next to FAQs or links

const faqs = [
  {
    question: 'How do I create a new quiz?',
    answer: 'You can create a new quiz from your main dashboard or by navigating to the "Create Quiz" section. Look for the \'+\' icon or a button labeled "Create Quiz."' 
  },
  {
    question: 'How are my quiz scores calculated?',
    answer: 'Quiz scores are typically calculated based on the number of correct answers out of the total number of questions. Some quizzes might have different scoring mechanisms, which will be indicated.'
  },
  {
    question: 'Can I upload my own documents for studying?',
    answer: 'Yes, Groundschool AI allows you to upload your study documents. Navigate to the "My Documents" section and look for an "Upload" or "Add Document" option.'
  },
  {
    question: 'How does the AI assist in my learning?',
    answer: 'The AI in Groundschool AI helps by generating relevant quiz questions from your documents, identifying areas where you might need more focus, and potentially offering personalized study recommendations.'
  },
  {
    question: 'What if I forget my password?',
    answer: 'If you forget your password, you can use the "Forgot Password?" link on the login screen. You\'ll receive an email with instructions to reset it. You can also change your current password from the Settings screen.'
  },
  {
    question: 'How do I update my profile information (name, avatar)?',
    answer: 'You can update your full name and avatar URL by navigating to the Profile screen and then selecting "Settings."' 
  }
];

const HelpSupportScreen = () => {
  const supportEmail = 'groundschoolai@gmail.com';

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${supportEmail}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Help & Support',
          headerStyle: { backgroundColor: '#0a0e23' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { color: '#FFFFFF' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.mainTitle}>Help & Support</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            For any assistance or queries, please email us at:
          </Text>
          <TouchableOpacity onPress={handleEmailPress}>
            <Text style={styles.emailLink}>{supportEmail}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions (FAQs)</Text>
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <View style={styles.questionContainer}>
                <Ionicons name="help-circle-outline" size={22} color="#A0AEC0" style={styles.faqIcon} />
                <Text style={styles.faqQuestion}>{faq.question}</Text>
              </View>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e23', // Dark theme background
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF', // Dark theme text primary
    marginBottom: 25,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF', // Dark theme text primary
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748', // Dark theme border
    paddingBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0', // Dark theme text secondary
    marginBottom: 10,
  },
  emailLink: {
    fontSize: 16,
    lineHeight: 24,
    color: '#8dffd6', // Dark theme primary/link color
    textDecorationLine: 'underline',
  },
  faqItem: {
    marginBottom: 20,
    backgroundColor: '#191E38', // Dark theme surface color
    padding: 15,
    borderRadius: 8,
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  faqIcon: { // This style is for the Ionicons component wrapper, not the icon color itself
    marginRight: 8,
  },
  faqQuestion: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF', // Dark theme text primary
    flexShrink: 1,
  },
  faqAnswer: {
    fontSize: 15,
    lineHeight: 22,
    color: '#A0AEC0', // Dark theme text secondary
    paddingLeft: 30,
  },
});

export default HelpSupportScreen;
