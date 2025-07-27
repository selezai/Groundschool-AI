import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Stack } from 'expo-router';

const PrivacyPolicyScreen = () => {
  const lastUpdatedDate = 'May 18, 2025'; // Dynamically set or update as needed

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: '#0a0e23' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { color: '#FFFFFF' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.mainTitle}>PRIVACY POLICY</Text>
        <Text style={styles.paragraphBold}>Groundschool AI</Text>
        <Text style={styles.lastUpdated}>Effective Date: June 1, 2025</Text>
        <Text style={styles.lastUpdated}>Last Updated: June 1, 2025</Text>

        <Text style={styles.paragraph}>
          This Privacy Policy describes how Groundschool AI ("we," "our," or "us") collects, uses, and shares personal information when you use our Groundschool AI application and related services (collectively, the "Application").
        </Text>
        <Text style={styles.paragraph}>
          By using our Application, you agree to the collection, use, and sharing of your information as described in this Privacy Policy. If you do not agree, please do not use the Application.
        </Text>

        <Text style={styles.heading}>1. INFORMATION WE COLLECT</Text>
        <Text style={styles.subHeading}>a. Information You Provide Directly</Text>
        <Text style={styles.paragraph}>
          We collect information you provide directly to us, such as:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItemBold}>Account Information: When you create an account, we collect your name, email address, password, and any other information you choose to provide.</Text>
          <Text style={styles.listItemBold}>User Content: We collect the documents, text, images, and other content you upload or generate within the Application for the purpose of creating quizzes and other study materials ("User Content").</Text>
          <Text style={styles.listItemBold}>Communications: If you contact us directly, we may receive additional information about you, such as your name, email address, the contents of your message, and any attachments.</Text>
          <Text style={styles.listItemBold}>Payment Information: If you make purchases through the Application, we may collect payment information through our third-party payment processors. We do not store full credit card numbers.</Text>
        </View>

        <Text style={styles.subHeading}>b. Information We Collect Automatically</Text>
        <Text style={styles.paragraph}>
          When you use our Application, we may automatically collect certain information, including:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItemBold}>Device Information: We collect information about the device you use to access the Application, such as IP address, device type, operating system, browser type, and unique device identifiers.</Text>
          <Text style={styles.listItemBold}>Usage Information: We collect information about your interactions with the Application, such as features used, pages viewed, quizzes taken, scores, time spent, and other activity data.</Text>
          <Text style={styles.listItemBold}>Log Data: Our servers automatically record information created by your use of the Application, which may include your IP address, access times, and error logs.</Text>
          <Text style={styles.listItemBold}>Cookies and Similar Technologies: We may use cookies and similar tracking technologies to collect information about your activity. You can control the use of cookies through your browser settings.</Text>
        </View>

        <Text style={styles.heading}>2. HOW WE USE YOUR INFORMATION</Text>
        <Text style={styles.paragraph}>
          We use the information we collect for various purposes, including:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItemBold}>To Provide and Improve the Application: To operate, maintain, and improve the features and functionality of our Application, including personalizing your experience.</Text>
          <Text style={styles.listItemBold}>To Create Quizzes: To process your User Content and generate quizzes and study materials as requested by you.</Text>
          <Text style={styles.listItemBold}>To Communicate with You: To send you updates, security alerts, support messages, and administrative information.</Text>
          <Text style={styles.listItemBold}>For Analytics and Research: To understand how users interact with our Application, identify trends, and develop new products and features.</Text>
          <Text style={styles.listItemBold}>For Security and Fraud Prevention: To protect the security of our Application, prevent fraud, and enforce our Terms of Service.</Text>
          <Text style={styles.listItemBold}>For Legal Compliance: To comply with applicable laws, regulations, and legal processes.</Text>
          <Text style={styles.listItemBold}>With Your Consent: For any other purpose for which you provide consent.</Text>
        </View>

        <Text style={styles.heading}>3. HOW WE SHARE YOUR INFORMATION</Text>
        <Text style={styles.paragraph}>
          We may share your information in the following circumstances:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItemBold}>Service Providers: We may share your information with third-party service providers who perform services on our behalf, such as cloud hosting (e.g., Supabase), payment processing, data analytics, email delivery, and customer support. These providers are obligated to protect your information and use it only for the purposes for which it was disclosed.</Text>
          <Text style={styles.listItemBold}>Legal Requirements: We may disclose your information if required by law, subpoena, or other legal process, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.</Text>
          <Text style={styles.listItemBold}>Business Transfers: In the event of a merger, acquisition, sale of assets, or bankruptcy, your information may be transferred as part of the transaction. We will notify you of any such change in ownership or control of your personal information.</Text>
          <Text style={styles.listItemBold}>Aggregated or De-identified Data: We may share aggregated or de-identified information that cannot reasonably be used to identify you for research, marketing, or other purposes.</Text>
          <Text style={styles.listItemBold}>With Your Consent: We may share your information with third parties if you have given us your explicit consent to do so.</Text>
        </View>
        <Text style={styles.paragraph}>
          We do not sell your personal information to third parties.
        </Text>

        <Text style={styles.heading}>4. YOUR CHOICES AND RIGHTS</Text>
        <Text style={styles.subHeading}>a. Account Information</Text>
        <Text style={styles.paragraph}>
          You can access and update certain account information through your profile settings in the Application. You may also request deletion of your account by contacting us at groundschoolai@gmail.com. Please note that some information may be retained for legal or operational purposes.
        </Text>
        <Text style={styles.subHeading}>b. User Content</Text>
        <Text style={styles.paragraph}>
          You can manage and delete your User Content through the Application. Deleting User Content may not immediately remove it from all our systems, and cached or archived copies may persist for a limited time.
        </Text>
        <Text style={styles.subHeading}>c. Communications Preferences</Text>
        <Text style={styles.paragraph}>
          You can opt-out of receiving promotional emails from us by following the unsubscribe instructions in those emails. You may still receive transactional or administrative emails related to your account or use of the Application.
        </Text>
        <Text style={styles.subHeading}>d. Cookies</Text>
        <Text style={styles.paragraph}>
          Most web browsers are set to accept cookies by default. You can usually choose to set your browser to remove or reject browser cookies. Note that if you choose to remove or reject cookies, this could affect the availability and functionality of our Application.
        </Text>
        <Text style={styles.subHeading}>e. Data Subject Rights (e.g., GDPR, CCPA)</Text>
        <Text style={styles.paragraph}>
          Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, delete, restrict processing, or object to processing of your data, and the right to data portability. To exercise these rights, please contact us at groundschoolai@gmail.com. We will respond to your request in accordance with applicable law.
        </Text>

        <Text style={styles.heading}>5. DATA SECURITY</Text>
        <Text style={styles.paragraph}>
          We implement reasonable administrative, technical, and physical security measures to protect your personal information from unauthorized access, use, alteration, or destruction. However, no security system is impenetrable, and we cannot guarantee the absolute security of your information.
        </Text>

        <Text style={styles.heading}>6. DATA RETENTION</Text>
        <Text style={styles.paragraph}>
          We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. We will delete or anonymize your information when it is no longer needed.
        </Text>

        <Text style={styles.heading}>7. INTERNATIONAL DATA TRANSFERS</Text>
        <Text style={styles.paragraph}>
          Your information may be transferred to, stored, and processed in countries other than your own, including the United States, where our servers are located. Data protection laws in these countries may differ from those in your jurisdiction. By using our Application, you consent to the transfer of your information to these countries.
        </Text>

        <Text style={styles.heading}>8. CHILDREN'S PRIVACY</Text>
        <Text style={styles.paragraph}>
          Our Application is not intended for children under the age of 13 (or a higher age threshold if required by applicable law). We do not knowingly collect personal information from children under this age. If we become aware that we have collected personal information from a child without parental consent, we will take steps to delete such information.
        </Text>

        <Text style={styles.heading}>9. THIRD-PARTY LINKS AND SERVICES</Text>
        <Text style={styles.paragraph}>
          Our Application may contain links to third-party websites or services that are not operated by us. This Privacy Policy does not apply to third-party practices. We encourage you to review the privacy policies of any third-party sites or services you visit.
        </Text>

        <Text style={styles.heading}>10. CHANGES TO THIS PRIVACY POLICY</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on our Application and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
        </Text>

        <Text style={styles.heading}>11. CONTACT US</Text>
        <Text style={styles.paragraph}>
          If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
        </Text>
        <Text style={styles.paragraphBold}>Groundschool AI</Text>
        <Text style={styles.paragraph}>Email: groundschoolai@gmail.com</Text>

        <Text style={styles.paragraphBold}>
          By using our Application, you acknowledge that you have read, understood, and agree to the terms of this Privacy Policy.
        </Text>

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
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF', // Dark theme primary text
    marginBottom: 10,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 14,
    color: '#A0AEC0', // Dark theme secondary text
    textAlign: 'center',
    marginBottom: 20,
  },
  importantNotice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444', // Dark theme error/warning text
    backgroundColor: '#191E38', // Dark theme surface for notice box
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF4444', // Dark theme error/warning border
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF', // Dark theme primary text
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748', // Dark theme border/divider
    paddingBottom: 5,
  },
  subHeading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF', // Dark theme primary text (subheadings can also be primary)
    marginTop: 15,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0', // Dark theme secondary text
    marginBottom: 15,
    textAlign: 'justify',
  },
  listContainer: {
    marginLeft: 10,
    marginBottom: 15,
  },
  listItem: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0', // Dark theme secondary text
    marginBottom: 5,
  },
  paragraphBold: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0',
    marginBottom: 15,
    textAlign: 'justify',
    fontWeight: 'bold',
  },
  listItemBold: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0',
    marginBottom: 5,
    fontWeight: 'bold',
  },
});

export default PrivacyPolicyScreen;
