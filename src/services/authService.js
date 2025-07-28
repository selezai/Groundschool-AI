import { supabase } from './supabaseClient'; // Use the newly created client
import logger from './loggerService'; // Assuming loggerService exists or will be created
import { getDefaultPlanForNewUsers, calculateTrialEndDate, shouldAutoUpgradeNewUsers } from '../config/featureFlags';
import posthogService from './posthogService';

// --- Profile Management ---

/**
 * Creates a user profile in the 'profiles' table.
 * Typically called after successful sign-up.
 * @param {string} userId - The user's ID from auth.users.
 * @param {object} profileData - Data like username, full_name.
 */
const createProfile = async (userId, profileData = {}) => {
  try {
    logger.info(`Attempting to create/update profile (upsert) for userId: ${userId}`, { profileData });

    // Apply feature flag for default plan assignment
    const defaultPlan = getDefaultPlanForNewUsers();
    const planEndDate = shouldAutoUpgradeNewUsers() ? calculateTrialEndDate() : null;
    
    // Set default plan and status for new users based on feature flag
    const planDefaults = {
      plan: defaultPlan,
      plan_status: defaultPlan === 'captains_club' ? 'active' : 'basic',
      plan_period_end: planEndDate ? planEndDate.toISOString() : null,
    };
    
    // Log feature flag usage for monitoring
    if (shouldAutoUpgradeNewUsers()) {
      logger.info(`[FeatureFlag] Auto-upgrading new user to Captain's Club`, {
        userId,
        plan: defaultPlan,
        trialEndDate: planEndDate,
        isPermanent: planEndDate === null
      });
      
      // Track feature flag usage in PostHog
      posthogService.capture('user_auto_upgraded_to_captains_club', {
        user_id: userId,
        feature_flag: 'AUTO_UPGRADE_NEW_USERS_TO_CAPTAINS_CLUB',
        plan_assigned: defaultPlan,
        trial_end_date: planEndDate,
        is_permanent_access: planEndDate === null,
        upgrade_method: 'feature_flag_auto_upgrade'
      });
    }

    const upsertPayload = {
      id: userId,
      updated_at: new Date(),
      ...planDefaults, // Apply feature flag defaults first
      ...profileData, // User-provided data can override defaults if needed
    };

    // The Supabase trigger 'handle_new_user' already populates 'email' from 'auth.users'.
    // If 'profileData' inadvertently contains an 'email' field, it might overwrite the trigger's value
    // or be redundant. For now, we assume 'profileData' primarily contains other details
    // like 'full_name', 'username', 'avatar_url'.

    const { data, error } = await supabase
      .from('profiles')
      .upsert(upsertPayload, {
        onConflict: 'id', // Use 'id' column to detect conflict for upsert
      })
      .select() // Return the created or updated profile
      .single();  // Expect a single record

    if (error) {
      // This would catch errors not related to the primary key conflict (which upsert handles),
      // such as RLS issues, other constraint violations, or network problems.
      logger.error('Error upserting profile:', { userId, message: error.message, code: error.code, details: error.details, stack: error.stack });
      throw error;
    }

    logger.info(`Profile upserted successfully for userId: ${userId}`, { profile: data });
    return data;

  } catch (err) {
    // Catch any other exceptions from the try block or re-thrown errors.
    logger.error('Exception in createProfile (upsert logic):', { userId, message: err.message, code: err.code, stack: err.stack });
    // Rethrow the error to be handled by the caller (e.g., signUp function)
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to create or update user profile.');
  }
};

/**
 * Updates a user's profile data.
 * @param {string} userId - The user's ID.
 * @param {object} updates - The profile fields to update.
 */
const updateProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user profile:', { userId, error });
      throw error;
    }
    logger.info('User profile updated successfully:', { userId });
    return data;
  } catch (error) {
    logger.error('Exception during profile update:', { userId, error });
    throw new Error('Failed to update user profile.');
  }
};

/**
 * Fetches a user's profile.
 * @param {string} userId - The user's ID.
 */
const getProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: Row not found, which is okay if profile doesn't exist yet
      logger.error('Error fetching user profile:', { userId, error });
      throw error;
    }
    return data;
  } catch (error) {
    logger.error('Exception during profile fetch:', { userId, error });
    throw new Error('Failed to fetch user profile.');
  }
};


// --- Authentication ---

/**
 * Signs up a new user.
 * @param {string} email
 * @param {string} password
 * @param {object} metadata - Optional metadata for the user.
 * @param {object} profileData - Optional data for the profile table.
 */
const signUp = async (email, password, metadata = {}, profileData = {}) => {
  try {
    logger.info('Attempting user sign up:', { email });
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // User metadata stored in auth.users.user_metadata
      },
    });

    if (authError) {
      logger.error('Supabase sign up error:', { email, error: authError });
      throw authError;
    }

    if (!authData.user) {
      logger.error('Sign up completed but no user data returned.', { email });
      // This might happen if email confirmation is required and not yet done
      // Depending on flow, might return success or throw specific error
      return { user: null, session: null, message: 'Sign up initiated, check email for confirmation.' };
    }

    logger.info('Supabase sign up successful, creating profile...', { userId: authData.user.id });

    // Create profile after successful sign up
    await createProfile(authData.user.id, profileData);

    logger.info('User sign up and profile creation complete.', { userId: authData.user.id });
    return { user: authData.user, session: authData.session };

  } catch (error) {
    logger.error('Exception during sign up process:', { email, error });
    // Rethrow specific Supabase errors or a generic one
    throw error instanceof Error ? error : new Error('Sign up failed.');
  }
};

/**
 * Signs in a user.
 * @param {string} email
 * @param {string} password
 */
const signIn = async (email, password) => {
  try {
    logger.info('Attempting user sign in:', { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error('Supabase sign in error:', { email, error });
      throw error;
    }

    logger.info('User sign in successful.', { userId: data.user?.id });
    return { user: data.user, session: data.session };
  } catch (error) {
    logger.error('Exception during sign in process:', { email, error });
    throw error instanceof Error ? error : new Error('Sign in failed.');
  }
};

/**
 * Signs out the current user.
 */
const signOut = async () => {
  try {
    logger.info('Attempting user sign out.');
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error('Supabase sign out error:', error);
      throw error;
    }
    logger.info('User sign out successful.');
  } catch (error) {
    logger.error('Exception during sign out process:', error);
    throw new Error('Sign out failed.');
  }
};

/**
 * Sends a password reset email.
 * @param {string} email
 */
const sendPasswordResetEmail = async (email) => {
  try {
    logger.info('Attempting to send password reset email:', { email });
    // Use the scheme defined in app.config.js
    const redirectUrl = 'myapp://reset-password'; // Ensure this matches app.config.js scheme
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      logger.error('Supabase password reset error:', { email, error });
      throw error;
    }
    logger.info('Password reset email sent successfully.', { email });
  } catch (error) {
    logger.error('Exception during password reset process:', { email, error });
    throw new Error('Failed to send password reset email.');
  }
};

/**
 * Updates the user's password (when logged in).
 * @param {string} newPassword
 */
const updateUserPassword = async (newPassword) => {
  try {
    logger.info('Attempting to update user password.');
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      logger.error('Supabase password update error:', error);
      throw error;
    }
    logger.info('User password updated successfully.');
    return data;
  } catch (error) {
    logger.error('Exception during password update:', error);
    throw new Error('Failed to update password.');
  }
};

/**
 * Updates user metadata.
 * @param {object} metadata
 */
const updateUserMetadata = async (metadata) => {
 try {
    logger.info('Attempting to update user metadata.');
    const { data, error } = await supabase.auth.updateUser({ data: metadata });
     if (error) {
      logger.error('Supabase user metadata update error:', error);
      throw error;
    }
    logger.info('User metadata updated successfully.');
    return data;
  } catch (error) {
    logger.error('Exception during user metadata update:', error);
    throw new Error('Failed to update user metadata.');
  }
};


// Export all functions
export const authService = {
  signUp,
  signIn,
  signOut,
  sendPasswordResetEmail,
  updateUserPassword,
  updateUserMetadata,
  createProfile,
  updateProfile,
  getProfile,
};
