import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  Modal
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext'; // Assuming useAuth provides session/user
import { supabase } from '../services/supabaseClient'; // Direct Supabase client
import logger from '../services/loggerService';
import { darkColors, spacing, typography, createThemedStyles } from '../theme/theme';

const SettingsScreen = () => {
  // Initialize styles at the component level
  const styles = getStyles();
  
  const router = useRouter();
  const { user, session } = useAuth(); // Get user from AuthContext

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // State for Change Password Modal
  const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Fetch profile data on load
  const fetchProfile = useCallback(async () => {
    if (!user) {
      logger.warn('SettingsScreen:fetchProfile', 'No user session found.');
      setIsLoading(false);
      setError('User not authenticated. Please log in again.');
      // Optionally, redirect to login if no user
      // router.replace('/login'); 
      return;
    }

    logger.info('SettingsScreen:fetchProfile', 'Fetching profile for user:', { userId: user.id });
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') { // Row not found
          logger.warn('SettingsScreen:fetchProfile', 'No profile found for user, creating one might be an option or this is an issue.', { userId: user.id });
          // Profile might not exist if trigger failed or old user, allow creating one implicitly by saving.
        } else {
          logger.error('SettingsScreen:fetchProfile', 'Error fetching profile', { userId: user.id, error: fetchError });
          setError(fetchError.message || 'Failed to load profile.');
          throw fetchError;
        }
      }
      
      if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (e) {
      logger.error('SettingsScreen:fetchProfile', 'Exception fetching profile', { userId: user.id, error: e });
      setError(e.message || 'An unexpected error occurred while fetching your profile.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async () => {
    if (!user) {
      Alert.alert('Error', 'You are not logged in.');
      return;
    }

    setIsSaving(true);
    setError(null);
    logger.info('SettingsScreen:handleSaveProfile', 'Attempting to save profile for user:', { userId: user.id });

    try {
      const updates = {
        id: user.id, // Ensure ID is part of updates for upsert
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date(),
      };

      // Upsert will insert if no row matches user.id, or update if it does.
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' }); 

      if (saveError) {
        logger.error('SettingsScreen:handleSaveProfile', 'Error saving profile', { userId: user.id, error: saveError });
        setError(saveError.message || 'Failed to save profile.');
        Alert.alert('Error', saveError.message || 'Could not save profile. Please try again.');
        throw saveError;
      }

      logger.info('SettingsScreen:handleSaveProfile', 'Profile saved successfully for user:', { userId: user.id });
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (e) {
      logger.error('SettingsScreen:handleSaveProfile', 'Exception saving profile', { userId: user.id, error: e });
      setError(e.message || 'An unexpected error occurred while saving.');
      // Alert already shown if it's a Supabase error
      if (!(e.message.includes('Failed to save profile'))) {
        Alert.alert('Error', 'An unexpected error occurred.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openChangePasswordModal = () => {
    logger.info('SettingsScreen:openChangePasswordModal', 'Change password button pressed, opening modal.');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordChangeError('');
    setIsChangePasswordModalVisible(true);
  };

  const handleConfirmPasswordChange = async () => {
    logger.info('SettingsScreen:handleConfirmPasswordChange', 'Attempting to change password.');
    setPasswordChangeError('');

    if (!newPassword || !confirmNewPassword) {
      setPasswordChangeError('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) { // Example: Basic length validation
        setPasswordChangeError('Password must be at least 6 characters long.');
        return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        logger.error('SettingsScreen:handleConfirmPasswordChange', 'Error updating password', { error: updateError });
        setPasswordChangeError(updateError.message || 'Failed to update password.');
        throw updateError;
      }

      logger.info('SettingsScreen:handleConfirmPasswordChange', 'Password updated successfully.');
      Alert.alert('Success', 'Password updated successfully!');
      setIsChangePasswordModalVisible(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      // Error already set if it's a Supabase error with a message
      // For other exceptions, ensure a generic message is shown if not already set by Supabase error.
      if (!passwordChangeError) {
          setPasswordChangeError('An unexpected error occurred.');
      }
      logger.error('SettingsScreen:handleConfirmPasswordChange', 'Exception during password update', { error: e });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color={darkColors.text} />
        <Text style={styles.loadingText}>Loading Settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Settings', headerTintColor: darkColors.text, headerStyle: { backgroundColor: darkColors.background } }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.header}>Edit Profile</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            editable={!isSaving}
            autoCapitalize="words"
            textContentType="name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Avatar URL</Text>
          <TextInput
            style={styles.input}
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://example.com/avatar.png"
            placeholderTextColor={darkColors.textSecondary}
            keyboardType="url"
            editable={!isSaving}
            autoCapitalize="none"
            textContentType="URL"
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={darkColors.text} />
          ) : (
            <Text style={styles.buttonText}>Save Profile</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.header}>Account</Text>
        <TouchableOpacity 
          style={[styles.button, styles.changePasswordButton]}
          onPress={openChangePasswordModal} // Updated onPress
        >
          <Text style={styles.buttonText}>Change Password</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isChangePasswordModalVisible}
        onRequestClose={() => {
          setIsChangePasswordModalVisible(!isChangePasswordModalVisible);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Change Password</Text>
            
            {passwordChangeError ? (
              <Text style={styles.modalErrorText}>{passwordChangeError}</Text>
            ) : null}

            <Text style={styles.modalLabel}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={darkColors.textSecondary}
              editable={!isUpdatingPassword}
            />

            <Text style={styles.modalLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm new password"
              placeholderTextColor={darkColors.textSecondary}
              editable={!isUpdatingPassword}
            />

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary, isUpdatingPassword && styles.buttonDisabled]}
              onPress={handleConfirmPasswordChange}
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <ActivityIndicator color={darkColors.text} />
              ) : (
                <Text style={styles.modalButtonText}>Update Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => setIsChangePasswordModalVisible(false)}
              disabled={isUpdatingPassword}
            >
              <Text style={[styles.modalButtonText, { color: darkColors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// Create themed styles using the centralized theme system
const getStyles = createThemedStyles((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  containerCentered: { // For loading state
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.s,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
  },
  container: { // ScrollView style
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.m,
  },
  header: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: theme.spacing.m,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    fontSize: theme.typography.body.fontSize,
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
  },
  changePasswordButton: { 
    backgroundColor: theme.colors.cardBorder,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  // Modal Styles
  modalOverlay: { 
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.l,
    borderRadius: theme.spacing.xs,
    width: '90%', 
    alignItems: 'stretch', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modalInput: { 
    backgroundColor: theme.colors.cardBorder, 
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing.m, 
  },
  modalButtonContainer: { 
    flexDirection: 'row',
    justifyContent: 'space-around', 
    marginTop: theme.spacing.md,
  },
  modalButton: { 
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    flex: 1, 
    marginHorizontal: theme.spacing.xs, 
  },
  modalButtonSecondary: { 
    backgroundColor: theme.colors.cardBorder,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
  modalButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
  },
  modalButtonSecondaryText: {
    color: theme.colors.text,
  },
  modalErrorText: {
    color: theme.colors.error,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
    fontSize: theme.typography.caption.fontSize,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}));

export default SettingsScreen;
