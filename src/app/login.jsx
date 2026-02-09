import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Alert, TouchableOpacity, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { darkColors, createThemedStyles } from '../theme/theme';
import logger from '../services/loggerService';
import posthogService from '../services/posthogService';

export default function LoginScreen() {
  // Initialize styles at the component level
  const styles = getStyles();
  
  // 1. State declarations (useState)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState(''); // Ensure name state is declared here
  const [uiError, setUiError] = useState(null);

  // 2. Context and Router hooks
  const { signIn, signUp, session, isProcessingAuth } = useAuth();
  const _router = useRouter();
  // Log component mount, unmount, and uiError updates
  useEffect(() => {
    logger.debug('login:useEffect', 'Component mounted or uiError updated', { uiError });
    return () => {
      logger.debug('login:useEffect', 'Component unmounted', { lastUiError: uiError });
    };
  }, [uiError]);

  // Log screen focus and blur
  useFocusEffect(
    useCallback(() => {
      logger.debug('login:useFocusEffect', 'Screen focused', { uiError });
      
      // Track screen view
      posthogService.screen('Login Screen', {
        is_signup_mode: isSignUp,
        has_error: !!uiError,
      });
      
      return () => {
        logger.debug('login:useFocusEffect', 'Screen blurred', { lastUiError: uiError });
      };
    }, [uiError, isSignUp])
  );



  // Helper function for email validation
  const isValidEmail = (emailToTest) => {
    // Basic regex for email validation - you can use a more comprehensive one if needed
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToTest);
  };

  // Handle forgot password functionality
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      const message = 'Please enter your email address first.';
      if (Platform.OS === 'web') {
        setUiError(message);
      } else {
        Alert.alert('Email Required', message);
      }
      return;
    }

    if (!isValidEmail(email)) {
      const message = 'Please enter a valid email address.';
      if (Platform.OS === 'web') {
        setUiError(message);
      } else {
        Alert.alert('Invalid Email', message);
      }
      return;
    }

    try {
      await authService.sendPasswordResetEmail(email);
      const successMessage = `Password reset email sent to ${email}. Please check your inbox and follow the instructions to reset your password.`;
      
      if (Platform.OS === 'web') {
        setUiError(null); // Clear any previous errors
        Alert.alert('Reset Email Sent', successMessage);
      } else {
        Alert.alert('Reset Email Sent', successMessage);
      }
      
      logger.info('Password reset email sent successfully', { email });
    } catch (error) {
      logger.error('Failed to send password reset email', { email, error });
      const errorMessage = 'Failed to send password reset email. Please try again later.';
      
      if (Platform.OS === 'web') {
        setUiError(errorMessage);
      } else {
        Alert.alert('Reset Failed', errorMessage);
      }
    }
  };

  const toggleMode = () => {
    logger.debug('login:toggleMode', 'Switching authentication mode');
    setUiError(null);
    logger.debug('login:toggleMode', 'UI error cleared, switching to', { newMode: !isSignUp ? 'signup' : 'signin' });
    setName('');
    setConfirmPassword(''); // Clear confirm password when switching modes
    setIsSignUp(!isSignUp);
  };

  const handleAuth = async () => {
    logger.debug('login:handleAuth', 'Authentication process started');
    setUiError(null);
    logger.debug('login:handleAuth', 'Starting authentication flow');

    // Email format validation
    if (!isValidEmail(email)) {
      const errorMessage = 'Please enter a valid email address.';
      if (Platform.OS === 'web') {
        setUiError(errorMessage);
      } else {
        Alert.alert('Invalid Email', errorMessage);
      }
      return;
    }

    if ((isSignUp && !name) || !email || !password || (isSignUp && !confirmPassword)) {
      Alert.alert('Error', isSignUp ? 'Please fill in all fields.' : 'Please enter both email and password.');
      return;
    }

    // Password confirmation validation for signup
    if (isSignUp && password !== confirmPassword) {
      const errorMessage = 'Passwords do not match. Please try again.';
      if (Platform.OS === 'web') {
        setUiError(errorMessage);
      } else {
        Alert.alert('Password Mismatch', errorMessage);
      }
      return;
    }
    // setIsLoading(true); // Removed, AuthContext handles isProcessingAuth
    try {
      if (isSignUp) {
        logger.info('LoginScreen: Attempting signup for', email);
        const { error } = await signUp({ email, password, profileData: { full_name: name } });
        if (error) {
          logger.error('LoginScreen: Signup failed', error, { errorMessage: error.message, errorName: error.name, errorStatus: error.status });
          if (Platform.OS === 'web') {
            if (error.message && error.message.toLowerCase().includes('user already registered')) {
              setUiError('This email is already registered. Please try logging in.');
            } else {
              setUiError(error.message || 'Could not create account. Please try again.');
            }
          } else {
            // For non-web, show a simplified Alert for signup errors
            let alertTitle = 'Signup Failed';
            let alertMessage = 'Could not create your account at this time. Please try again later.'; // Generic default
            if (error.message && error.message.toLowerCase().includes('user already registered')) {
              alertMessage = 'This email is already registered. Please try logging in.';
            } else if (error.message && error.message.toLowerCase().includes('check your email for a confirmation link')) {
              // This case might actually be a success from Supabase's perspective if email confirmation is pending
              alertTitle = 'Signup Almost Complete';
              alertMessage = error.message; // Supabase message is good here
            } else if (error.message && (error.message.toLowerCase().includes('weak password') || error.message.toLowerCase().includes('password should be at least 6 characters'))) {
              alertMessage = error.message; // Supabase message is usually direct and helpful
            } else if (error.message) {
              // For other specific messages from Supabase that might be user-friendly
              alertMessage = error.message;
            }
            Alert.alert(alertTitle, alertMessage);
          }
        } else {
          logger.info('LoginScreen: Signup successful for', email);
          Alert.alert('Signup Successful', 'Your account has been created. Please check your email for verification if required.');
          setIsSignUp(false);
        }
      } else {
        logger.debug('login:handleAuth', 'Attempting sign in');
        const { error } = await signIn({ email, password });
        logger.debug('login:handleAuth', 'Sign in completed', { hasError: !!error });
        logger.debug('login:handleAuth', 'Checking for authentication errors');
        if (error) {
          logger.error('login:handleAuth', 'Authentication error occurred:', error);
          // Determine if this is a network connectivity issue
          const isNetworkError = 
            error.message?.toLowerCase().includes('failed to fetch') ||
            error.message?.toLowerCase().includes('network request failed') ||
            error.name?.includes('FetchError') ||
            error.status === 0 || // Status 0 often indicates network issues
            error.code === 'ENOTFOUND' ||
            error.code === 'NETWORK_ERROR';

          // Determine a user-friendly message based on error type
          let userFriendlyMessage = '';
          let errorTitle = 'Login Failed';
          
          if (isNetworkError) {
            errorTitle = 'Network Error';
            userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
          } else if (error.message?.toLowerCase().includes('invalid login credentials')) {
            userFriendlyMessage = 'Invalid email or password. Please try again.';
          } else if (error.message?.toLowerCase().includes('too many requests')) {
            userFriendlyMessage = 'Too many login attempts. Please try again later.';
          } else if (error.message?.toLowerCase().includes('email not confirmed')) {
            userFriendlyMessage = 'Please verify your email address before logging in.';
          } else {
            // Default fallback message
            userFriendlyMessage = error.message || 'An error occurred during login. Please try again.';
          }

          // Log detailed error information
          logger.error('Login error details:', { 
            errorType: isNetworkError ? 'Network Error' : 'Authentication Error',
            errorName: error.name,
            errorMessage: error.message,
            errorStatus: error.status,
            errorCode: error.code
          });

          if (Platform.OS === 'web') {
            // For web, set uiError to display inline
            setUiError(userFriendlyMessage);
            logger.debug('LoginScreen', 'Called setUiError for web');
          } else {
            // For non-web, show a simplified Alert with guidance
            Alert.alert(
              errorTitle, 
              userFriendlyMessage,
              isNetworkError ? [
                { text: 'Check Settings', onPress: () => Linking.openSettings() },
                { text: 'OK', style: 'default' }
              ] : [{ text: 'OK', style: 'default' }]
            );
          }
        } else {
          logger.debug('login:handleAuth', 'Authentication successful');
        }
      }
    } catch (err) {
      logger.error(`LoginScreen: Catch block error during ${isSignUp ? 'signup' : 'login'}`, err);
      Alert.alert(`${isSignUp ? 'Signup' : 'Login'} Error`, err.message || 'An unexpected error occurred.');
    }
    // setIsLoading(false); // Removed, AuthContext handles isProcessingAuth
  };

  if (session) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ActivityIndicator size="large" color={darkColors.primary} />
        <Text style={styles.title}>Already logged in, redirecting...</Text>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Text style={styles.title}>{isSignUp ? 'Create Account' : 'GroundSchool AI Login'}</Text>
      {uiError && Platform.OS === 'web' && (
        <Text style={styles.errorText}>
          {uiError}
        </Text>
      )}
      {/* The non-web uiError display with WEB_DEBUG_ERROR prefix is removed as uiError will only be set for web. */}
      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={darkColors.subtext}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={darkColors.subtext}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={darkColors.subtext}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="Repeat Password"
          placeholderTextColor={darkColors.subtext}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
      )}
      {isProcessingAuth ? (
        <ActivityIndicator size="large" color={darkColors.primary} />
      ) : (
        <TouchableOpacity
          style={[styles.button, isProcessingAuth && { opacity: 0.7 }]}
          onPress={handleAuth}
          disabled={isProcessingAuth}
        >
          {isProcessingAuth ? ( // Changed from isLoading
            <ActivityIndicator color={darkColors.primaryContent} />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Login'}</Text>
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
        <Text style={styles.toggleButtonText}>
          {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
        </Text>
      </TouchableOpacity>
      {!isSignUp && (
        <TouchableOpacity style={styles.forgotPasswordButton} onPress={handleForgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

// Create themed styles using the utility function
const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.l,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.typography.h2.fontSize,
    marginBottom: theme.spacing.xl - 2,
    textAlign: 'center',
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: theme.spacing.m - 1,
    paddingHorizontal: theme.spacing.m - 1,
    fontSize: theme.typography.body.fontSize,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  },
  button: {
    height: 50,
    paddingVertical: theme.spacing.s,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs + 2,
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    fontSize: theme.typography.body.fontSize + 2,
    fontWeight: '600',
    color: theme.colors.primaryContent,
  },
  toggleButton: {
    marginTop: theme.spacing.m + 4,
    alignItems: 'center',
    padding: theme.spacing.xs + 2,
  },
  toggleButtonText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '500',
    color: theme.colors.link,
  },
  errorText: {
    marginBottom: theme.spacing.xs + 2,
    textAlign: 'center',
    fontSize: theme.typography.caption.fontSize + 2,
    color: theme.colors.error,
  },
  forgotPasswordButton: {
    marginTop: theme.spacing.m + 4,
    alignItems: 'center',
    padding: theme.spacing.xs + 2,
  },
  forgotPasswordText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '500',
    color: theme.colors.link,
  },
}));