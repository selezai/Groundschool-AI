import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { createThemedStyles, useTheme } from '../../theme/theme';

const CaptainsClubScreen = () => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();
  const { profile, handleSubscription, isSubscribing } = useAuth();

  const handleUpgradePress = () => {
    if (isSubscribing) return;
    handleSubscription();
  };

  const renderBenefit = (icon, title, description) => (
    <View style={styles.benefitItem}>
      <Ionicons name={icon} size={28} color={theme.colors.primary} style={styles.benefitIcon} />
      <View style={styles.benefitTextContainer}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDescription}>{description}</Text>
      </View>
    </View>
  );

  const renderSubscribedView = () => (
    <View style={styles.subscribedContainer}>
      <Ionicons name="shield-checkmark" size={80} color={theme.colors.primary} />
      <Text style={styles.subscribedTitle}>You are a Captain's Club Member!</Text>
      <Text style={styles.subscribedText}>
        You have full access to all premium features. Thank you for your support!
      </Text>
      <TouchableOpacity style={styles.manageButton} onPress={() => router.push('/(drawer)/profile')}>
        <Text style={styles.manageButtonText}>Manage Subscription</Text>
      </TouchableOpacity>
    </View>
  );

  const renderUpgradeView = () => (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Upgrade to Captain's Club</Text>
        <Text style={styles.headerSubtitle}>Unlock exclusive features and elevate your study experience.</Text>
      </View>

      <View style={styles.benefitsContainer}>
        {renderBenefit("star-outline", "Unlimited Exam Generation", "Create as many practice exams as you need, whenever you need them.")}
        {renderBenefit("archive-outline", "Full Exam History", "Access and review all your past exams to track your progress.")}
        {renderBenefit("cloud-upload-outline", "Increased Storage (500MB)", "Store more documents and study materials without worry.")}
      </View>

      <TouchableOpacity 
        style={[styles.upgradeButton, isSubscribing && styles.disabledButton]} 
        onPress={handleUpgradePress}
        disabled={isSubscribing}
      >
        {isSubscribing ? (
          <ActivityIndicator size="small" color={theme.colors.primaryContent} />
        ) : (
          <Text style={styles.upgradeButtonText}>Upgrade Now - R99/month</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Captain's Club" }} />
      {profile?.plan === 'captains_club' ? renderSubscribedView() : renderUpgradeView()}
    </SafeAreaView>
  );
};

const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    padding: theme.spacing.m,
  },
  headerContainer: {
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  benefitsContainer: {
    marginBottom: theme.spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.l,
  },
  benefitIcon: {
    marginRight: theme.spacing.m,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
  },
  benefitDescription: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    marginTop: theme.spacing.xxs,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.m,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  upgradeButtonText: {
    color: theme.colors.primaryContent,
    fontSize: theme.typography.h3.fontSize,
    fontWeight: 'bold',
  },
  subscribedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.l,
  },
  subscribedTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.l,
  },
  subscribedText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginTop: theme.spacing.m,
  },
  manageButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.m,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 8,
  },
  manageButtonText: {
    color: theme.colors.primaryContent,
    fontSize: theme.typography.h3.fontSize,
    fontWeight: 'bold',
  },
}));

export default CaptainsClubScreen;
