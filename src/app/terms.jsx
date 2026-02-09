import React from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Stack } from 'expo-router';

const TermsOfServiceScreen = () => {
  const _lastUpdatedDate = 'May 18, 2025'; // Dynamically set or update as needed

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: 'Terms of Service',
          headerStyle: { backgroundColor: '#0a0e23' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { color: '#FFFFFF' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.mainTitle}>TERMS OF SERVICE</Text>
        <Text style={styles.paragraphBold}>Groundschool AI</Text>
        <Text style={styles.lastUpdated}>Effective Date: June 1, 2025</Text>
        <Text style={styles.lastUpdated}>Last Updated: June 1, 2025</Text>

        <Text style={styles.paragraph}>
          These Terms of Service ("Terms") govern your use of the Groundschool AI application and services ("Application," "Service") operated by Groundschool AI ("we," "our," or "us").
        </Text>
        <Text style={styles.paragraph}>
          By accessing or using our Application, you agree to be bound by these Terms. If you disagree with any part of these terms, then you may not access the Application.
        </Text>

        <Text style={styles.heading}>1. ACCOUNTS</Text>
        <Text style={styles.paragraph}>
          When you create an account with us, you must provide information that is accurate, complete, and current at all times. You agree to update your information promptly if it changes. Failure to provide accurate information constitutes a breach of these Terms, which may result in immediate termination of your account.
        </Text>
        <Text style={styles.paragraph}>
          You are responsible for:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Safeguarding the password and credentials you use to access the Application</Text>
          <Text style={styles.listItem}>- All activities that occur under your account, regardless of whether you authorized such activities</Text>
          <Text style={styles.listItem}>- Maintaining the confidentiality of your account information</Text>
        </View>
        <Text style={styles.paragraph}>
          You agree to:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Not disclose your password to any third party</Text>
          <Text style={styles.listItem}>- Not allow others to use your account</Text>
          <Text style={styles.listItem}>- Notify us immediately upon becoming aware of any breach of security or unauthorized use of your account</Text>
        </View>
        <Text style={styles.paragraph}>
          You must be at least 13 years old to use this Application. If you are between 13 and 18 years old (or the age of majority in your jurisdiction), you represent that you have reviewed these Terms with your parent or guardian and that they agree to these Terms on your behalf.
        </Text>

        <Text style={styles.heading}>2. USER CONTENT</Text>
        <Text style={styles.paragraph}>
          Our Application allows you to upload, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("User Content"). You are solely responsible for all User Content that you post, upload, or otherwise make available through the Application, including its legality, reliability, accuracy, and appropriateness.
        </Text>
        <Text style={styles.paragraphBold}>License Grant</Text>
        <Text style={styles.paragraph}>
          By posting User Content to the Application, you grant us a non-exclusive, worldwide, royalty-free license to use, copy, modify, create derivative works based upon, publicly display, publicly perform, and distribute your User Content solely for the purposes of:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Operating and providing the Application's services</Text>
          <Text style={styles.listItem}>- Improving our services</Text>
          <Text style={styles.listItem}>- Complying with legal obligations</Text>
        </View>
        <Text style={styles.paragraph}>
          This license terminates when you delete your User Content or your account, except that we may retain copies for legal compliance, safety, or security purposes.
        </Text>
        <Text style={styles.paragraphBold}>Content Ownership and Responsibilities</Text>
        <Text style={styles.paragraph}>
          You retain all ownership rights to your User Content. However, you represent and warrant that:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- You own the User Content or have obtained all necessary rights and permissions to use it and grant us the license described above</Text>
          <Text style={styles.listItem}>- Your User Content does not and will not infringe, violate, or misappropriate any third-party rights</Text>
          <Text style={styles.listItem}>- Your User Content complies with these Terms and all applicable laws</Text>
          <Text style={styles.listItem}>- Your User Content does not contain any confidential or proprietary information of third parties</Text>
        </View>
        <Text style={styles.paragraphBold}>Content Monitoring and Removal</Text>
        <Text style={styles.paragraph}>
          We reserve the right, but have no obligation, to monitor, review, or remove User Content that we determine, in our sole discretion, violates these Terms or applicable law. We may remove or disable access to any User Content at any time without prior notice.
        </Text>

        <Text style={styles.heading}>3. PRIVACY POLICY</Text>
        <Text style={styles.paragraph}>
          Your privacy is important to us. Please review our Privacy Policy (accessible via the 'About' section in your profile or by navigating to /privacy within the app), which also governs your use of the Application, to understand our practices regarding the collection and use of your information.
        </Text>

        <Text style={styles.heading}>4. INTELLECTUAL PROPERTY</Text>
        <Text style={styles.paragraph}>
          The Application and its original content (excluding User Content), features, functionality, design, and underlying technology are and will remain the exclusive property of Groundschool AI and its licensors. The Application is protected by copyright, trademark, patent, and other intellectual property laws of the United States and other countries.
        </Text>
        <Text style={styles.paragraph}>
          Our trademarks, service marks, and logos used in connection with the Application are trademarks or registered trademarks of Groundschool AI. Other company, product, and service names and logos used and displayed via the Application may be trademarks or service marks of their respective owners. Nothing in these Terms grants you any right or license to reproduce or otherwise use any Groundschool AI or third-party trademarks.
        </Text>

        <Text style={styles.heading}>5. PROHIBITED USES</Text>
        <Text style={styles.paragraph}>
          You agree not to use the Application:
        </Text>
        <Text style={styles.paragraphBold}>Legal Compliance:</Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- In violation of any applicable federal, state, local, or international law or regulation</Text>
          <Text style={styles.listItem}>- To engage in any unlawful, illegal, fraudulent, or harmful activities</Text>
        </View>
        <Text style={styles.paragraphBold}>Harmful Activities:</Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- To exploit, harm, or attempt to exploit or harm minors in any way</Text>
          <Text style={styles.listItem}>- To harass, abuse, or harm another person or group</Text>
          <Text style={styles.listItem}>- To transmit hate speech or content that promotes discrimination</Text>
        </View>
        <Text style={styles.paragraphBold}>Platform Integrity:</Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- To impersonate Groundschool AI, our employees, other users, or any other person or entity</Text>
          <Text style={styles.listItem}>- To interfere with, disrupt, or create an undue burden on the Application or networks connected to the Application</Text>
          <Text style={styles.listItem}>- To attempt to gain unauthorized access to any portion of the Application or any other systems or networks</Text>
        </View>
        <Text style={styles.paragraphBold}>Commercial Misuse:</Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- To transmit spam, chain letters, junk mail, or other unsolicited promotional materials</Text>
          <Text style={styles.listItem}>- For any commercial purpose without our express written consent</Text>
          <Text style={styles.listItem}>- To collect or harvest any personally identifiable information from the Application</Text>
        </View>
        <Text style={styles.paragraphBold}>Content Violations:</Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- To upload or transmit viruses, malware, or other malicious code</Text>
          <Text style={styles.listItem}>- To post content that infringes intellectual property rights</Text>
          <Text style={styles.listItem}>- To share false, misleading, or deceptive information</Text>
        </View>

        <Text style={styles.heading}>6. DMCA COMPLIANCE</Text>
        <Text style={styles.paragraph}>
          We respect intellectual property rights and expect our users to do the same. If you believe that your copyrighted work has been copied and is accessible through our Application in a way that constitutes copyright infringement, please contact our designated DMCA agent at groundschoolai@gmail.com.
        </Text>

        <Text style={styles.heading}>7. TERMINATION</Text>
        <Text style={styles.paragraphBold}>Termination by Us:</Text>
        <Text style={styles.paragraph}>
          We may terminate or suspend your account and access to the Application immediately, without prior notice, for any reason, including if you breach these Terms.
        </Text>
        <Text style={styles.paragraphBold}>Termination by You:</Text>
        <Text style={styles.paragraph}>
          You may terminate your account at any time by contacting us at groundschoolai@gmail.com.
        </Text>
        <Text style={styles.paragraphBold}>Effect of Termination:</Text>
        <Text style={styles.paragraph}>
          Upon termination:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Your right to use the Application will cease immediately</Text>
          <Text style={styles.listItem}>- We may delete your account and User Content</Text>
          <Text style={styles.listItem}>- Provisions of these Terms that by their nature should survive termination will survive, including intellectual property provisions, warranty disclaimers, indemnity, and limitations of liability</Text>
        </View>

        <Text style={styles.heading}>8. DISCLAIMERS</Text>
        <Text style={styles.paragraphBold}>AS IS BASIS:</Text>
        <Text style={styles.paragraph}>
          Your use of the Application is at your sole risk. The Application is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either express or implied.
        </Text>
        <Text style={styles.paragraphBold}>NO WARRANTIES:</Text>
        <Text style={styles.paragraph}>
          To the fullest extent permitted by law, Groundschool AI disclaims all warranties, express or implied, including but not limited to:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Implied warranties of merchantability, fitness for a particular purpose, and non-infringement</Text>
          <Text style={styles.listItem}>- Warranties that the Application will be uninterrupted, secure, or error-free</Text>
          <Text style={styles.listItem}>- Warranties regarding the accuracy, reliability, or completeness of content</Text>
        </View>
        <Text style={styles.paragraphBold}>THIRD-PARTY CONTENT:</Text>
        <Text style={styles.paragraph}>
          We are not responsible for any content, data, or services provided by third parties through our Application.
        </Text>

        <Text style={styles.heading}>9. LIMITATION OF LIABILITY</Text>
        <Text style={styles.paragraphBold}>EXCLUSION OF DAMAGES:</Text>
        <Text style={styles.paragraph}>
          To the fullest extent permitted by applicable law, in no event shall Groundschool AI, its officers, directors, employees, agents, partners, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Loss of profits, data, use, goodwill, or other intangible losses</Text>
          <Text style={styles.listItem}>- Personal injury or property damage</Text>
          <Text style={styles.listItem}>- Costs of procurement of substitute goods or services</Text>
        </View>
        <Text style={styles.paragraphBold}>LIMITATION OF TOTAL LIABILITY:</Text>
        <Text style={styles.paragraph}>
          Our total liability to you for all claims arising out of or relating to these Terms or your use of the Application shall not exceed the greater of: (a) $100, or (b) the amount you paid us in the 12 months preceding the claim.
        </Text>
        <Text style={styles.paragraphBold}>EXCEPTIONS:</Text>
        <Text style={styles.paragraph}>
          Some jurisdictions do not allow the exclusion or limitation of certain damages, so the above limitations may not apply to you.
        </Text>

        <Text style={styles.heading}>10. INDEMNIFICATION</Text>
        <Text style={styles.paragraph}>
          You agree to defend, indemnify, and hold harmless Groundschool AI and its officers, directors, employees, agents, partners, and affiliates from and against any claims, damages, obligations, losses, liabilities, costs, or expenses (including reasonable attorneys' fees) arising from:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Your use of the Application</Text>
          <Text style={styles.listItem}>- Your User Content</Text>
          <Text style={styles.listItem}>- Your violation of these Terms</Text>
          <Text style={styles.listItem}>- Your violation of any third-party rights</Text>
        </View>

        <Text style={styles.heading}>11. DISPUTE RESOLUTION</Text>
        <Text style={styles.paragraphBold}>Governing Law:</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed by and construed in accordance with the laws of [INSERT STATE/JURISDICTION], without regard to conflict of law principles.
        </Text>
        <Text style={styles.paragraphBold}>Jurisdiction:</Text>
        <Text style={styles.paragraph}>
          Any legal action or proceeding arising under these Terms will be brought exclusively in the federal or state courts located in [INSERT JURISDICTION], and you hereby consent to personal jurisdiction and venue therein.
        </Text>
        <Text style={styles.paragraphBold}>Arbitration Clause (Optional):</Text>
        <Text style={styles.paragraph}>
          [INSERT ARBITRATION CLAUSE IF DESIRED - Note: This requires careful consideration and legal review]
        </Text>

        <Text style={styles.heading}>12. FORCE MAJEURE</Text>
        <Text style={styles.paragraph}>
          We shall not be liable for any failure to perform our obligations under these Terms due to circumstances beyond our reasonable control, including but not limited to acts of God, war, terrorism, pandemic, government regulations, or network failures.
        </Text>

        <Text style={styles.heading}>13. GENERAL PROVISIONS</Text>
        <Text style={styles.paragraphBold}>Entire Agreement:</Text>
        <Text style={styles.paragraph}>
          These Terms constitute the entire agreement between you and Groundschool AI regarding the Application and supersede all prior agreements.
        </Text>
        <Text style={styles.paragraphBold}>Severability:</Text>
        <Text style={styles.paragraph}>
          If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full force and effect.
        </Text>
        <Text style={styles.paragraphBold}>Waiver:</Text>
        <Text style={styles.paragraph}>
          Our failure to enforce any right or provision of these Terms will not constitute a waiver of such right or provision.
        </Text>
        <Text style={styles.paragraphBold}>Assignment:</Text>
        <Text style={styles.paragraph}>
          You may not assign or transfer these Terms or your account without our prior written consent. We may assign these Terms without restriction.
        </Text>
        <Text style={styles.paragraphBold}>Headings:</Text>
        <Text style={styles.paragraph}>
          The headings in these Terms are for convenience only and have no legal effect.
        </Text>

        <Text style={styles.heading}>14. CHANGES TO TERMS</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these Terms at any time. We will provide notice of material changes by:
        </Text>
        <View style={styles.listContainer}>
          <Text style={styles.listItem}>- Posting the updated Terms on our Application</Text>
          <Text style={styles.listItem}>- Sending notice to the email address associated with your account</Text>
          <Text style={styles.listItem}>- Providing at least 30 days' notice before material changes take effect</Text>
        </View>
        <Text style={styles.paragraph}>
          Your continued use of the Application after any changes constitutes acceptance of the new Terms. If you do not agree to the modified Terms, you must stop using the Application.
        </Text>

        <Text style={styles.heading}>15. CONTACT INFORMATION</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at:
        </Text>
        <Text style={styles.paragraphBold}>Groundschool AI</Text>
        <Text style={styles.paragraph}>Email: groundschoolai@gmail.com</Text>

        <Text style={styles.paragraphBold}>
          By using our Application, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0', // Dark theme secondary text
    marginBottom: 15,
    textAlign: 'justify',
  },
  paragraphBold: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A0AEC0',
    marginBottom: 15,
    textAlign: 'justify',
    fontWeight: 'bold',
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
});

export default TermsOfServiceScreen;
