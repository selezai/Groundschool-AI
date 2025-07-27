import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const AboutScreen = () => {
  const router = useRouter();
  const appVersion = '1.0.0';
  const companyName = 'Groundschool AI';
  const currentYear = new Date().getFullYear();
  const appDescription = 'Groundschool AI is your intelligent partner for aviation ground school studies. Create quizzes from your documents, test your knowledge, and prepare effectively for your exams.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'About Groundschool AI',
          headerStyle: { backgroundColor: '#0a0e23' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { color: '#FFFFFF' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.headerContainer}>
          {/* You can replace this with an actual logo if you have one */}
          <Image 
            source={{ uri: 'https://placehold.co/100x100/191E38/FFFFFF?text=GSAI&font=raleway' }} 
            style={styles.logo}
          />
          <Text style={styles.appName}>Groundschool AI</Text>
          <Text style={styles.appVersion}>Version {appVersion}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.paragraph}>{appDescription}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal Information</Text>
          <TouchableOpacity style={styles.linkItem} onPress={() => router.push('/terms')}>
            <Ionicons name="document-text-outline" size={22} color="#8dffd6" style={styles.linkIcon} />
            <Text style={styles.linkText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color="#A0AEC0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkItem} onPress={() => router.push('/privacy')}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#8dffd6" style={styles.linkIcon} />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#A0AEC0" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.copyrightText}>© {currentYear} {companyName}. All rights reserved.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e23', // Dark theme page background
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#191E38', // Dark theme surface color for header section
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748', // Dark theme border
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 15,
  },
  appName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF', // Dark theme primary text
    marginBottom: 5,
  },
  appVersion: {
    fontSize: 16,
    color: '#A0AEC0', // Dark theme secondary text
  },
  section: {
    backgroundColor: '#191E38', // Dark theme surface color for sections
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2D3748', // Dark theme border
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF', // Dark theme primary text
    marginBottom: 15,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0', // Dark theme secondary text
    textAlign: 'left',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748', // Dark theme border
  },
  linkItemNoBorder: {
    borderBottomWidth: 0,
  },
  linkIcon: {
    marginRight: 15,
  },
  linkText: {
    flex: 1,
    fontSize: 17,
    color: '#8dffd6', // Dark theme link color
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#A0AEC0', // Dark theme secondary text
    marginBottom: 5,
  },
  copyrightText: {
    fontSize: 13,
    color: '#A0AEC0', // Dark theme secondary text
    textAlign: 'center',
  },
});

export default AboutScreen;
