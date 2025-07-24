# GroundSchool AI Implementation Guide

## 🚨 Critical Issues & Important Notes

**‼️ IMMEDIATE ATTENTION REQUIRED ‼️**

*   **HARDCODED Supabase Keys:** The file `src/services/supabaseClient.js` currently contains **HARDCODED FALLBACK Supabase credentials**. This is a CRITICAL P0 SECURITY RISK if these are live production keys. They must be REMOVED IMMEDIATELY and replaced with non-functional placeholders or an error state if environment variables are not found.
*   **[MITIGATED by Gemini Switch] Non-Functional PDF Text Extraction:** The previous issue with PDF text extraction is addressed by switching to Google Gemini 2.5 Pro Preview, which processes PDF/image content directly. The app no longer relies on its own text extraction for AI input.
*   **PDF Export Functionality:** The `src/services/documentService.js` (`exportDocumentToPdf` function) now generates a basic PDF from the document's *extracted text content* using `expo-print`. It does not replicate original PDF layouts. *(Low/Medium Priority Enhancement)*
*   **Scheme Mismatch for Deep Linking:** `app.config.js` defines `scheme: 'myapp'`, while `src/services/authService.js` uses `groundschoolai://reset-password` for password reset redirection. This inconsistency needs to be resolved for deep linking to function correctly.

**Important Notes for Development & Documentation:**

*   **Google Gemini API Integration:** Requires implementing API calls to Gemini 2.5 Pro Preview, handling multimodal input (files), and robust prompt engineering for quality quiz generation. Dependency on Google Cloud services introduced. *(High Priority Implementation Task)*
*   **Gemini API Costs & Limits:** Monitor usage of the Gemini API, as costs are associated with requests, especially involving large files. Preview models may have stricter rate limits. *(Ongoing Monitoring)*
*   **Data Integrity - Quiz Questions:** Potential schema differences (`correct_answer` text vs. index) between `quiz_questions` and the offline `questions` table remain. Needs careful handling in prompt engineering for Gemini to ensure consistent output format, and robust validation during offline sync. *(Medium Priority Fix)*
*   **Supabase Table Names & Fields:** Note potential minor inconsistencies in table/field names (e.g., `questions` vs `quiz_questions`, `correct_answer` vs `correct_answer_index`) between different service files. These should be reconciled or clearly documented.
*   **Icon Configuration:** Icons in `app.config.js` are temporarily commented out due to previous build issues with `Jimp`. This should be revisited.
*   **Google Sign-In:** The `@react-native-google-signin/google-signin` plugin is present in `app.config.js`, suggesting intended or partial implementation. Its status should be verified and documented.

## Implementation Order Overview

1.  Core Architecture Setup
2.  Authentication & User Management
3.  Document Management
4.  AI Integration
5.  User-Facing Quiz Creation & Management
6.  Quiz Taking Experience
7.  Quiz Results & Analytics
8.  Offline Support
9.  UI/UX Implementation
10. Testing & Refinement

## Step 1: Core Architecture Setup

> **Note:** All monetary values, pricing, and cost examples in this document are now expressed in ZAR (South African Rand) and rounded to the nearest integer for clarity and local relevance.

### 1.1 Project Initialization

```diff
- Initialize a React Native project with Expo SDK 51
- Configure Expo for Web PWA support (manifest, service worker)
- Set up project structure with proper folder organization
- Initialize Git repository
```

### 1.2 Dependencies Installation

```bash
expo install expo-document-picker \
  @react-native-async-storage/async-storage \
  @react-native-community/netinfo \
  @react-navigation/native \
  @react-navigation/stack \
  react-native-screens \
  react-native-safe-area-context \
  sentry-expo
npm install @supabase/supabase-js
```

*   Create `src/lib/supabaseClient.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

*   Confirm `src/services/deepSeekService.js` has correct API URL and key usage.
*   Install any UI libraries or custom theming (we use our theme and ThemedButton component).

### 1.3 Environment Configuration

Environment variables are crucial for security and configuration. They are managed using a `.env` file at the project root and exposed to the application via `app.config.js`.

1.  **Create `.env` file:**
    At the root of your project, create a file named `.env` with the following variables:

    ```dotenv
    # Supabase Configuration
    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

    # Google Gemini API Configuration
    GOOGLE_API_KEY=your_google_cloud_api_key_here
    # Or use service account credentials if preferred
    # GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

    # Sentry Configuration (Optional)
    SENTRY_DSN=your_sentry_dsn_here
    ```
    **Note:** The specific variable name for the Google key (`GOOGLE_API_KEY`) might change depending on the chosen authentication method (API Key vs. Service Account). Ensure secure storage of API keys.

2.  **Expose Variables via `app.config.js`:**
    The `app.config.js` file uses `dotenv/config` to load these variables from `.env` into `process.env`. It then explicitly maps them to the `extra` object to make them accessible via `expo-constants`.

    ```javascript
    // In app.config.js
    import 'dotenv/config';

    export default {
      expo: {
        // ... other configurations
        extra: {
          GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
          EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
          EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          // GOOGLE_APPLICATION_CREDENTIALS can also be added here if using service account
          // SENTRY_DSN can also be added here if needed by Constants.expoConfig.extra
          eas: {
            projectId: 'your_eas_project_id', // Replace with your actual EAS project ID
          },
        },
        // ... other configurations
      },
    };
    ```

3.  **Accessing Variables in Code:**
    *   **Via `expo-constants` (Recommended for services like `supabaseClient.js`):**
        ```javascript
        import Constants from 'expo-constants';

        const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        const deepSeekApiKey = Constants.expoConfig?.extra?.DEEPSEEK_API_KEY;
        ```
    *   **Via `@env` (using `react-native-dotenv` for components/services not using `expo-constants`):**
        Ensure your `babel.config.js` is set up for `react-native-dotenv`:
        ```javascript
        // In babel.config.js
        module.exports = function(api) {
          api.cache(true);
          return {
            presets: ['babel-preset-expo'],
            plugins: [
              ['module:react-native-dotenv', {
                moduleName: '@env',
                path: '.env',
                safe: false, // Set to true to require all variables to be defined
                allowUndefined: true, // Set to false to error on undefined variables
              }]
            ]
          };
        };
        ```
        Then import in your files:
        ```javascript
        import { DEEPSEEK_URL, DEEPSEEK_API_KEY } from '@env';
        // Note: SUPABASE_URL and SUPABASE_ANON_KEY might be named differently in .env if also using @env for them
        ```

**Important Security Note:** Never commit your actual API keys or sensitive credentials directly into `app.config.js` or any other version-controlled file. Use the `.env` file for this, and ensure `.env` is listed in your `.gitignore` file.

### 1.4 Supabase Client Setup (`src/services/supabaseClient.js`)

The Supabase client is configured in `src/services/supabaseClient.js`.

*   **Initialization:** Uses `createClient` from `@supabase/supabase-js`.
*   **Credentials:** Retrieves `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `Constants.expoConfig.extra`.
    *   **🚨 CRITICAL:** This file currently contains hardcoded fallback credentials. THESE MUST BE REMOVED.
*   **Storage Adapter:** Uses a custom `AsyncStorageAdapter` to enable session persistence with `@react-native-async-storage/async-storage`.
*   **Auth Options:** Configured with `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`, and `debug: true` (consider setting debug to false for production).
*   **`initializeSupabase()` function:** Sets up an `onAuthStateChange` listener for logging session events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) and checks for an existing session on app start.
*   **Helper Functions:** Includes `getCurrentUser()` to retrieve the current authenticated user.

### 1.5 Navigation Setup (Expo Router)

The application uses Expo Router for file-system based routing.

*   **Structure:** Navigation is primarily managed by the directory structure within `src/app/`. Files like `(tabs)/index.js`, `auth/LoginScreen.js`, etc., define routes.
*   **Layouts:** Layout files (e.g., `src/app/(tabs)/_layout.js`) define shared UI for groups of routes (like tab bars).
*   **Entry Point:** `expo-router/entry` is likely the app's entry point, managed by Expo.
*   **Key Screens Organized:** Screens are typically located in `src/screens/` and then referenced or structured within `src/app/` for Expo Router.

### 1.6 Theming (`src/theme/theme.js`)

A centralized theming approach is used, managed in `src/theme/theme.js`.

*   **Exports:** Provides `colors`, `spacing`, `typography` objects.
*   **`useTheme` Hook:** A custom hook, `useTheme`, allows components to access theme properties.
*   **`Themed` Components:** Components like `ThemedText`, `ThemedView`, `ThemedButton` (if they exist or are planned) would utilize these theme properties for consistent styling.

### 1.7 Core Services (`src/services/`)

Several core services support the application's functionality:

*   **`loggerService.js`:** Provides standardized logging throughout the application (e.g., `logger.info()`, `logger.error()`). This is crucial for debugging and monitoring.
*   **`errorHandlingService.js` (Conceptual):** While not explicitly detailed in file views, a dedicated error handling service is good practice. It might integrate with Sentry or provide global error catching.
*   **`sentryService.js` (Conceptual / via `sentry-expo`):** Sentry is included in dependencies, and `SENTRY_DSN` is an env variable. Initialization and usage would typically be in a dedicated service or at the app's root to capture errors and performance data.

## Step 2: Authentication & User Management

Authentication is managed via Supabase, with UI and state handling in the app.

### 2.1 Authentication Context (`src/contexts/AuthContext.js`)

`AuthContext` is central to managing user authentication state across the application.

*   **Provider:** `AuthProvider` wraps the application (likely in `src/app/_layout.js` or a root component) to provide auth state and functions to all components.
*   **State:** Manages `user`, `session`, `isLoading`, and potentially `error` states related to authentication.
*   **Functions:** Exposes functions like `signIn`, `signUp`, `signOut`, `sendPasswordResetEmail`, `updateUserMetadata`.
*   **Session Persistence:** Loads initial session from `AsyncStorage` (via `supabase.auth.getSession()` and `onAuthStateChange`).
*   **Interaction:** Calls methods from `authService.js` to perform actual authentication operations with Supabase.

### 2.2 Authentication Service (`src/services/authService.js`)

`authService.js` acts as a bridge between the `AuthContext` (and UI components) and Supabase's authentication API.

*   **Supabase Interaction:** Directly calls `supabase.auth` methods like `signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`.
*   **Profile Management:** Includes logic to create a user profile in the `profiles` table upon successful sign-up (e.g., `createProfile` function).
*   **Error Handling:** Implements try/catch blocks and logs errors using `loggerService`.
*   **Session Handling:** May include functions to store/retrieve session or user data from `AsyncStorage` if not fully managed by `supabase-js` client's adapter.

### 2.3 Supabase Authentication Integration

Details of how Supabase Auth is utilized:

*   **User Table:** Supabase automatically manages an `auth.users` table.
*   **`profiles` Table:** A public `profiles` table (schema: `id (UUID, foreign key to auth.users.id)`, `username`, `full_name`, `avatar_url`, `updated_at`) stores additional public user information. `authService.js` handles creating entries here.
*   **Row Level Security (RLS):** RLS policies on the `profiles` table are crucial:
    *   Users can view all profiles (`SELECT`).
    *   Users can only insert their own profile (`INSERT` with `auth.uid() = user_id`).
    *   Users can only update their own profile (`UPDATE` with `auth.uid() = user_id`).
*   **Password Reset:** Uses `supabase.auth.resetPasswordForEmail`. Requires email setup in Supabase and a redirect URL. The current redirect in `authService.js` is `groundschoolai://reset-password`. This should match the `scheme` in `app.config.js` (currently `myapp`). **This mismatch needs resolution.**
*   **Email Templates:** Supabase provides email templates for confirmation, password reset, etc., which should be customized.
*   **Google Sign-In:** The `@react-native-google-signin/google-signin` plugin is installed, and `expo-secure-store` is present. This suggests an intention for Google Sign-In. Implementation would involve:
    *   Configuring Google Cloud Console credentials.
    *   Using the plugin to get an ID token.
    *   Signing into Supabase with the Google ID token (`supabase.auth.signInWithIdToken`).
    The extent of its current implementation needs verification.

## Step 3: Document Management

This section covers how users upload, store, process, and manage their study documents.

### 3.1 Document Upload

Users can upload documents (PDFs, images) through the application.

*   **Interface:** Likely a dedicated screen (e.g., part of `QuizCreationScreen.js` or a separate document management screen) using `expo-document-picker` to select files.
*   **Initial Handling:** Selected files are initially processed by `documentProcessingService.js` for URI handling and potentially basic metadata extraction.
*   **Offline Queuing:** If the device is offline during an attempt to create or upload document metadata, `documentService.js` (for metadata) and `offlineService.js` (for file blob and metadata) will queue the operation.

*   **File Storage (Blobs):** Actual document files (PDFs, images) are intended to be uploaded to Supabase Storage.
    *   `offlineService.js` handles uploading cached files from `FileSystem.cacheDirectory` when online.
*   **Metadata Storage (`documents` table):** Metadata about documents (title, user_id, content_url, type, etc.) is stored in the Supabase database.

### 3.3 Document Processing

Upon successful upload to Supabase Storage:

*   **File Reference:** The application obtains the URL or identifier for the uploaded file in Supabase Storage.
*   **Metadata Update:** Essential metadata (file type, user ID, Supabase storage path, title) is saved to the `documents` table in the Supabase database.
*   **No App-Side Extraction for AI:** Text extraction within the mobile app is **no longer required** for the primary AI quiz generation flow. The file itself (or its reference) will be passed directly to the Google Gemini API during quiz generation (see Step 4).
*   *(Optional: Retain basic text extraction logic if needed for other features, like displaying a text preview, but clearly separate it from the AI quiz generation path.)*

### 3.4 Document Service (`src/services/documentService.js`)

This service manages the metadata of documents in the Supabase `documents` table.

## Step 4: AI Integration & Quiz Generation (Google Gemini 2.5 Pro Preview)

This step details how the application interacts with Google Gemini 2.5 Pro Preview to generate quizzes directly from uploaded documents. The core logic resides primarily within the `quizService.js`.

### 4.1 Gemini API Client Setup

*   **Authentication:** Initialize the Google AI client (e.g., using the `@google/generative-ai` SDK for Node.js/backend functions or potentially a Cloud Function wrapper called from the app). Securely load the `GOOGLE_API_KEY` or use service account credentials.
*   **Model Selection:** Specify `gemini-2.5-pro-preview` (or the latest available identifier) as the target model.

### 4.2 Quiz Generation Request Flow

1.  **User Trigger:** The user selects an uploaded document and requests quiz generation, specifying the number of questions.
2.  **Get Document Info:** Retrieve the document's metadata from the `documents` table, including its storage path/URL in Supabase Storage.
3.  **Prepare API Input:**
    *   Construct the input payload for the Gemini API. This will typically include:
        *   **File Data:** The PDF or image file itself. This might involve downloading the file temporarily from Supabase Storage to pass its content, or using a mechanism where Gemini can access the file via its URL (check Gemini API documentation for supported methods).
        *   **Prompt:** A carefully crafted prompt instructing Gemini to:
            *   Act as an expert aviation ground school instructor.
            *   Analyze the provided document (PDF/image).
            *   Generate a specified number of multiple-choice questions based *only* on the document's content.
            *   Format questions in SACAA style (if applicable).
            *   Include 4 options (A, B, C, D).
            *   Clearly indicate the correct answer.
            *   Provide a brief explanation for the correct answer, referencing the document context.
            *   Return the output as a structured JSON array.
    *   **Parameters:** Include parameters like the number of questions requested.
4.  **Call Gemini API:** Send the request to the Gemini API's `generateContent` (or equivalent multimodal) endpoint. This should be an asynchronous call.
5.  **Handle Response:**
    *   **Parse JSON:** On success, parse the JSON response containing the array of generated questions.
    *   **Validate:** Perform basic validation on the received data structure.
    *   **Error Handling:** Catch potential API errors (rate limits, invalid input, processing errors, network issues) and provide appropriate feedback to the user or log the error. Handle cases where the AI might fail to generate the requested number of questions.

### 4.3 Storing the Quiz

1.  **Create Quiz Record:** Insert a new record into the `quizzes` table, linking it to the user and the source document.
2.  **Store Questions:** Insert each validated question (text, options, correct answer, explanation) into the `quiz_questions` table, linking them to the newly created quiz ID. Ensure the `correct_answer` format matches the database schema (e.g., store the letter 'A', 'B', 'C', or 'D').

### 4.4 User Feedback

*   Provide real-time feedback to the user about the quiz generation status (e.g., "Analyzing document...", "Generating questions...", "Saving quiz...").
*   Notify the user upon successful completion or if an error occurred.

### 4.5 Key Considerations

*   **Prompt Engineering is Crucial:** The quality and relevance of generated questions heavily depend on the prompt. Iterative refinement will be necessary.
*   **File Handling:** Efficiently handling file transfer/access between Supabase Storage and the Gemini API is important. Using server-side functions (e.g., Supabase Edge Functions, Google Cloud Functions) might be more robust and secure than handling API keys and file downloads directly in the mobile client.
*   **Asynchronous Nature:** Use background tasks or serverless functions for the potentially long-running API calls to avoid blocking the UI.
*   **Cost Monitoring:** Track API usage associated with quiz generation.

### Appendix B: Services

*   **`authService.js`:** Handles user authentication, registration, password reset, and profile management. Interacts with Supabase Auth.
*   **`documentService.js`:** Manages document CRUD operations, including upload to Supabase Storage. Handles offline queuing via `offlineService.js`.
*   **`documentProcessingService.js`:** Manages document metadata in Supabase. May still include text extraction for non-AI features (e.g., preview).
*   **`quizService.js`:** Handles quiz generation logic. Obtains document references, interacts with the **Google Gemini 2.5 Pro Preview API** (potentially via a backend function wrapper) to generate questions from documents, and manages storing quizzes and questions in Supabase.
*   **`geminiService.js`:** (New) Provides a dedicated interface to the Google Gemini API for generating questions directly from document files.
*   **`offlineService.js`:** Manages offline operation queuing and synchronization when connectivity is restored. Uses AsyncStorage for local data persistence.

### Appendix C: API Usage

*   **Supabase API:** Used for authentication, database operations, and storage. Requires URL and anonymous key.
*   **Google Gemini API:** Used via Google Cloud Platform. Specifically targeting the **Gemini 2.5 Pro Preview** model for its multimodal capabilities to generate multiple-choice questions directly from PDF and image file content. Requires Google Cloud API Key or Service Account authentication.
*   **Sentry API (Optional):** Used for error tracking and monitoring. Requires DSN.

## Third-Party Services & Integrations

### PayFast Payment Gateway Integration

**Objective:** Integrate PayFast for handling user subscription payments.

**Status:** Successfully Implemented and Resolved.

**Key Components:**
*   **Supabase Edge Function (`generate-payfast-payment-data`):** Responsible for securely generating the necessary payment parameters and the PayFast signature on the server-side.
*   **Client-Side Logic:** Initiates the payment request to the Edge Function and redirects the user to PayFast with the returned data.

**Resolution Details (PayFast Signature & Deployment):**

A persistent issue involved PayFast signature mismatches and deployment failures of the `generate-payfast-payment-data` Edge Function. The root causes and solutions were:

1.  **Incorrect URL Parameter Encoding:**
    *   **Problem:** PayFast requires a specific encoding scheme (spaces as `+`, apostrophes as `%27`, and other standard URL encoding). Initial implementations did not fully adhere to this.
    *   **Solution:** A `payfastEncode` function was implemented within the Edge Function to correctly encode each parameter value before constructing the signature string. This function ensures:
        *   Standard URL encoding via `encodeURIComponent`.
        *   Replacement of `%20` (space) with `+`.
        *   Manual encoding of apostrophes (`'`) to `%27`.

2.  **MD5 Hashing Module Issue in Deno Environment:**
    *   **Problem:** The Supabase Edge Function (Deno environment) failed to build and deploy when attempting to import the `Md5` class directly from `https://deno.land/std@0.204.0/hash/md5.ts`. This resulted in a "Module not found" error during the deployment bundling phase, preventing updated code from becoming active.
    *   **Solution:** The MD5 hashing mechanism was switched to use the Web Crypto API, which is globally available in Deno:
        *   Removed the problematic import: `import { Md5 } from "https://deno.land/std@0.204.0/hash/md5.ts";`
        *   Replaced the `new Md5().update(string).toString()` logic with:
            ```typescript
            const signatureDigest = await crypto.subtle.digest(
              "MD5",
              new TextEncoder().encode(signatureString)
            );
            const signature = Array.from(new Uint8Array(signatureDigest), b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
            ```
        *   This change allowed the Edge Function to build and deploy successfully with the correct signature generation logic.

3.  **PayFast Sandbox Signature Troubleshooter Tool:**
    *   **Observation:** The official PayFast sandbox signature troubleshooter tool was found to be unreliable for validating the raw payload string, often producing misleading errors (e.g., "cancel url format is invalid") even when the final signature generation and encoding were correct according to PayFast's documented examples and requirements. Testing with actual sandbox transactions proved to be the definitive validation method.

**Outcome:**
With these fixes, the `generate-payfast-payment-data` Edge Function deploys correctly, generates the accurate PayFast signature, and users are successfully redirected to the PayFast payment page to complete their transactions. This resolves a critical blocker for the payment upgrade flow.

---

## Key Screens Implementation

Based on the PRD and logo, implement these key screens first:

### Home Dashboard

```jsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Ionicons } from '@expo/vector-icons';

// Import custom components
import QuizCard from '../components/QuizCard';
import PerformanceChart from '../components/PerformanceChart';
import LoadingIndicator from '../components/LoadingIndicator';

const HomeScreen = () => {
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();
  const supabase = useSupabaseClient();

  useEffect(() => {
    // Fetch user data when component mounts
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigation.navigate('Login');
        return;
      }
      
      // Fetch recent quizzes
      const { data: quizzes, error: quizzesError } = await supabase
        .from('quiz_attempts')
        .select(`
          id, 
          score, 
          completed_at,
          quizzes:quiz_id (title, question_count)
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(5);
      
      if (quizzesError) throw quizzesError;
      
      // Fetch performance data
      const { data: performance, error: performanceError } = await supabase
        .rpc('get_user_performance_by_week', { user_id: user.id });
      
      if (performanceError) throw performanceError;
      
      setRecentQuizzes(quizzes || []);
      setPerformanceData(performance || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header with logo */}
        <View style={styles.header}>
          <Image
            source={require('../assets/groundschool-ai-logo.png')}
            style={styles.logo}
          />
          <Text style={styles.headerText}>GroundSchool AI</Text>
        </View>
        
        {/* Quick action buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('DocumentUpload')}
          >
            <Ionicons name="cloud-upload-outline" size={24} color="white" />
            <Text style={styles.buttonText}>Upload Document</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('DocumentLibrary')}
          >
            <Ionicons name="library-outline" size={24} color="#3B82F6" />
            <Text style={styles.secondaryButtonText}>My Documents</Text>
          </TouchableOpacity>
        </View>
        
        {/* Performance summary */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Performance Summary</Text>
          {performanceData.length > 0 ? (
            <PerformanceChart data={performanceData} />
          ) : (
            <Text style={styles.emptyStateText}>
              Complete your first quiz to see performance data
            </Text>
          )}
        </View>
        
        {/* Recent quizzes */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recent Quizzes</Text>
          {recentQuizzes.length > 0 ? (
            recentQuizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                title={quiz.quizzes.title}
                score={quiz.score}
                date={new Date(quiz.completed_at).toLocaleDateString()}
                questionCount={quiz.quizzes.question_count}
                onPress={() => navigation.navigate('QuizDetails', { quizId: quiz.quiz_id })}
              />
            ))
          ) : (
            <Text style={styles.emptyStateText}>
              You haven't taken any quizzes yet
            </Text>
          )}
        </View>
      </ScrollView>
      
      {/* Floating action button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewQuiz')}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111827',
  },
  emptyStateText: {
    color: '#6B7280',
    textAlign: 'center',
    padding: 24,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: '#FBBF24',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default HomeScreen;
```

## Monetization Implementation Guide

For implementing the subscription model:

```javascript
// Subscription plans configuration
const subscriptionPlans = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      '5 document uploads per month',
      '25 questions per quiz',
      '1-week history retention',
    ],
    limits: {
      documentUploadsPerMonth: 5,
      questionsPerQuiz: 25,
      historyRetentionDays: 7,
    }
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 4.99,
    features: [
      'Unlimited document uploads',
      '100 questions per quiz',
      '1-month history retention',
      'Advanced analytics',
    ],
    limits: {
      documentUploadsPerMonth: Infinity,
      questionsPerQuiz: 100,
      historyRetentionDays: 30,
    }
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 9.99,
    features: [
      'Everything in Basic',
      'Unlimited history',
      'Priority processing',
      'Enhanced analytics',
      'Offline mode',
    ],
    limits: {
      documentUploadsPerMonth: Infinity,
      questionsPerQuiz: 100,
      historyRetentionDays: Infinity,
    }
  },
  instructor: {
    id: 'instructor',
    name: 'Instructor',
    price: 19.99,
    features: [
      'Everything in Premium',
      'Student management',
      'Custom quiz creation',
      'Quiz sharing',
      'Student performance tracking',
    ],
    limits: {
      documentUploadsPerMonth: Infinity,
      questionsPerQuiz: 200,
      historyRetentionDays: Infinity,
      studentManagement: true,
      quizSharing: true,
    }
  }
};

// Function to check if user has reached their plan limits
function checkUserPlanLimits(user, action) {
  const userPlan = user.subscription || 'free';
  const planDetails = subscriptionPlans[userPlan];
  
  switch (action.type) {
    case 'UPLOAD_DOCUMENT':
      return checkDocumentUploadLimit(user, planDetails);
    case 'GENERATE_QUIZ':
      return {
        allowed: true,
        maxQuestions: planDetails.limits.questionsPerQuiz
      };
    case 'ACCESS_HISTORY':
      const daysAgo = (Date.now() - new Date(action.date).getTime()) / (1000 * 60 * 60 * 24);
      return {
        allowed: daysAgo <= planDetails.limits.historyRetentionDays
      };
    default:
      return { allowed: true };
  }
}

// Helper function to check document upload limits
async function checkDocumentUploadLimit(user, planDetails) {
  // If unlimited uploads, allow immediately
  if (planDetails.limits.documentUploadsPerMonth === Infinity) {
    return { allowed: true };
  }
  
  // Get the first day of current month
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Check how many documents user has uploaded this month
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id)
    .gte('uploaded_at', firstDayOfMonth.toISOString());
  
  if (error) {
    console.error('Error checking document upload limit:', error);
    return { allowed: false, error: 'Failed to check upload limit' };
  }
  
  return {
    allowed: count < planDetails.limits.documentUploadsPerMonth,
    currentCount: count,
    limit: planDetails.limits.documentUploadsPerMonth,
    remaining: planDetails.limits.documentUploadsPerMonth - count
  };
}
```

## Progressive Web App Implementation

Here's the key configuration for setting up the PWA:

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  // Your Next.js config
});
```

```json
// public/manifest.json
{
  "name": "GroundSchool AI",
  "short_name": "GroundSchool",
  "description": "AI-powered aviation exam preparation",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#3B82F6",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Follow these instructions to make the following change to my code document.

Instruction: Update Steps 9 (UI/UX) and 10 (Testing). Create Appendix A (Database Schema). Integrate PWA setup, auth bypass history, stale data fix, and web rendering fix from memories into relevant sections.

Code Edit:
```
{{ ... }}
*   (If granularity allows) Performance on questions related to specific documents or content chunks.

## Step 9: UI/UX Implementation

This section covers the visual design, user experience, and component-level implementation of the user interface.

### 9.1 Core UI Components & Styling

*   **Theming:** Consistent styling is achieved using `src/theme/theme.js`, which provides `colors`, `spacing`, and `typography`. The `useTheme` hook allows components to access these theme properties.
*   **Key Components:** While a full component audit wasn't performed, the codebase likely includes common custom components such as:
    *   `ThemedButton`, `ThemedText`, `ThemedView` (or similar pattern for applying theme).
    *   Custom `Card` components for displaying information (e.g., quizzes, documents).
    *   Styled input fields for forms.
    *   Navigation elements (headers, tab bars) configured via Expo Router layouts.
*   **Design System:** Refer to the "UI Design Guidelines" section at the end of this document for the intended color palette, typography, and design principles.

### 9.2 Screen Structure & Navigation

*   **Screen Organization:** UI screens are primarily located in `src/screens/` (e.g., `HomeScreen.js`, `LoginScreen.js`, `QuizCreationScreen.js`, etc.).
*   **Navigation:** Expo Router is used for file-system based routing, with route definitions in `src/app/`. Layouts (e.g., `src/app/(tabs)/_layout.js`) manage shared UI like tab bars and navigation headers.

### 9.3 Accessibility & Responsiveness

*   **Accessibility (A11y):** Standard React Native accessibility props (e.g., `accessibilityLabel`, `accessibilityHint`, `accessible`) should be used for interactive elements to ensure usability for users with disabilities. Proper color contrast as defined in the theme also contributes to accessibility.
*   **Responsiveness:** The application should be designed to adapt to various screen sizes, particularly for web/PWA and tablet support on native.

## Step 10: Testing & Refinement

Ensuring application quality through testing and code refinement.

### 10.1 Linting & Code Quality

*   **ESLint:** The project should have ESLint configured to enforce code style and catch common errors. Based on previous sessions (Memory `8d1dda39-3f36-4162-85f5-3b906ab09deb`), known linting issues included:
    *   `Platform not defined` errors.
    *   Jest globals (`jest`, `expect`, `it`) not defined in test files.
    *   Parsing errors in older/unused files.
    *   Warnings for unused variables, React Hook dependencies, and unused imports.
    These should be systematically addressed.

### 10.2 Unit & Integration Testing

*   **Unit Tests:** Focus on testing individual functions and components in isolation.
    *   **Services:** Test business logic within services (e.g., `authService.js`, `quizService.js`, `documentService.js`, `offlineService.js`) using mocked dependencies (like Supabase client or AI API calls).
    *   **Components:** Test UI components for rendering and basic interactions.
*   **Integration Tests:** Test the interaction between multiple components or services.
    *   **User Flows:** Key user flows like authentication, document upload, quiz creation, offline data sync should be tested.

### 10.3 End-to-End (E2E) Testing

*   Consider tools like Detox or Appium for native E2E testing, and Cypress or Playwright for PWA E2E testing to simulate real user scenarios across the application.

### 10.4 Quality Assurance (QA)

*   **Manual Testing:** Thorough manual testing across different devices (iOS, Android) and web browsers (for PWA) is essential.
*   **Device Compatibility:** Test on a range of physical devices and emulators/simulators.
*   **Error Tracking:** Sentry (`sentry-expo`) is set up for error tracking and performance monitoring. Ensure it's correctly initialized and reporting issues.

### 10.5 Known Issues & Historical Context (from Memory)

*   **Authentication Password Issues:** The project historically faced persistent "Password cannot be empty" errors, particularly with browser autofill. Various fixes were attempted, including type conversion, DOM event handling, and lenient Supabase client validation. At points, emergency authentication bypasses were implemented for login and registration to unblock development (Memories `9587dbc6-c4e1-4911-a398-a38f0a079c8c`, `f0044fbb-06c5-470f-8320-82025ac57e23`, `ad594ccf-acf7-430f-8f7a-83cad81468b2`, `d67da084-8d9b-4874-b953-9ebf91f23bc7`, `a8685f76-c7fe-499c-ba72-6d7e65232050`). While these issues are believed to be resolved or the bypasses removed, this context is important if similar problems resurface.
*   **Stale Document Data:** An issue where `DocumentLibraryScreen.js` displayed stale data after uploads was resolved by using the `useFocusEffect` hook to refresh data when the screen gains focus (Memory `e9f112e4-c68d-40b0-b2c4-717d78196ecf`).

## Progressive Web App (PWA) Setup & Web Rendering

Information based on Memory `fe7f03b5-03d6-4445-aedf-7ac512be6ee2` and `eb547c7a-df72-4ee0-bbc2-5798f7b7befb`.

*   **Service Worker:**
    *   Registration is configured in `src/web/serviceWorkerRegistration.js`.
    *   A comprehensive `service-worker.js` file is implemented with multiple cache strategies (static, data, document caches), offline support, and background sync capabilities.
*   **Web Manifest (`app.json` / `app.config.js` web section):
    *   Configured with app name, short name, icons, theme colors, and `display: "standalone"`.
*   **PWA Features:** The app aims to support offline functionality, installability, background sync, and responsive design for web.
*   **Web Initialization & Rendering:**
    *   A custom entry point (e.g., `index.js`) conditionally loads web or native code.
    *   Proper DOM styling for the root element and usage of `AppRegistry` with a wrapper component for the main `App` ensure correct rendering in the browser.
    *   CSS styling for flex layouts is explicitly handled.
    *   The `package.json` main entry point was fixed to use the custom entry file.
    *   A custom webpack plugin (`BufferMimePlugin`) resolved a Buffer MIME error.

## UI Design Guidelines

{{ ... }}

## Appendix A: Database Schema

This appendix outlines the primary Supabase database tables used by GroundSchool AI.

### 1. `auth.users`
*   **Managed by:** Supabase Auth
*   **Purpose:** Stores core user authentication information (email, encrypted password, user ID, etc.).
*   **Key Columns:** `id` (UUID, primary key), `email`, `encrypted_password`, `created_at`, `updated_at`.

### 2. `profiles`
*   **Purpose:** Stores additional public user information linked to `auth.users`.
*   **RLS Policies:**
    *   Users can view all profiles.
    *   Users can only insert their own profile (`auth.uid() = user_id`).
    *   Users can only update their own profile (`auth.uid() = user_id`).
*   **Key Columns:**
    *   `id` (UUID, primary key, foreign key references `auth.users.id`)
    *   `username` (TEXT)
    *   `full_name` (TEXT)
    *   `avatar_url` (TEXT, URL to user's avatar image in Supabase Storage)
    *   `updated_at` (TIMESTAMP WITH TIME ZONE)

### 3. `documents`
*   **Purpose:** Stores metadata about user-uploaded documents.
*   **Key Columns:**
    *   `id` (UUID, primary key)
    *   `user_id` (UUID, foreign key references `auth.users.id`)
    *   `title` (TEXT, user-defined title or filename)
    *   `file_path` (TEXT, path to the document in Supabase Storage)
    *   `content_url` (TEXT, public URL if applicable)
    *   `document_type` (TEXT, e.g., 'pdf', 'png', 'jpg')
    *   `content` (TEXT, extracted text content from the document - **Note: For PDFs, this is currently placeholder text**)
    *   `status` (TEXT, e.g., 'pending', 'processing', 'completed', 'error')
    *   `created_at` (TIMESTAMP WITH TIME ZONE)
    *   `updated_at` (TIMESTAMP WITH TIME ZONE)

### 4. `quizzes`
*   **Purpose:** Stores metadata for quizzes generated from documents.
*   **Key Columns:**
    *   `id` (UUID, primary key)
    *   `user_id` (UUID, foreign key references `auth.users.id`)
    *   `document_id` (UUID, foreign key references `documents.id`)
    *   `title` (TEXT, quiz title)
    *   `num_questions` (INTEGER)
    *   `options` (JSONB, e.g., quiz generation parameters if any)
    *   `created_at` (TIMESTAMP WITH TIME ZONE)
    *   `updated_at` (TIMESTAMP WITH TIME ZONE)

### 5. `quiz_questions` (Primary table for online quiz questions)
*   **Purpose:** Stores individual questions belonging to a quiz.
*   **Key Columns:**
    *   `id` (UUID, primary key)
    *   `quiz_id` (UUID, foreign key references `quizzes.id`)
    *   `text` (TEXT, the question itself)
    *   `options` (JSONB, array of answer choices, e.g., `[{text: "Option A"}, {text: "Option B"}]`)
    *   `correct_answer` (TEXT, the text of the correct answer - **Note:** Some AI prompts ask for an index, this needs to be consistent with generation and checking logic.)
    *   `explanation` (TEXT, explanation for the correct answer)
    *   `question_type` (TEXT, e.g., 'multiple-choice')
    *   `created_at` (TIMESTAMP WITH TIME ZONE)

### 6. `questions` (Potentially used by `offlineService.js` for caching/syncing)
*   **Purpose:** Appears to be used by `offlineService.js` for caching and syncing questions. Its schema might differ slightly.
*   **Key Columns (Inferred):**
    *   `id` (UUID or TEXT)
    *   `quiz_id` (UUID or TEXT)
    *   `text` (TEXT)
    *   `options` (JSONB)
    *   `correct_answer_index` (INTEGER, index of the correct option - **Note:** This differs from `quiz_questions.correct_answer` which is text. This discrepancy should be resolved.)
    *   `explanation` (TEXT)
*   **Recommendation:** Standardize on a single questions table schema (`quiz_questions`) for both online and offline operations if possible, or clearly document the mapping/transformation between them.

### 7. `quiz_attempts`
*   **Purpose:** Stores records of user attempts at quizzes.
*   **Key Columns:**
    *   `id` (UUID, primary key)
    *   `user_id` (UUID, foreign key references `auth.users.id`)
    *   `quiz_id` (UUID, foreign key references `quizzes.id`)
    *   `score` (INTEGER or FLOAT, e.g., number correct or percentage)
    *   `answers` (JSONB, user's selected answers for each question, e.g., `[{question_id: "uuid", selected_option_index: 1}]`)
    *   `completed_at` (TIMESTAMP WITH TIME ZONE)
    *   `created_at` (TIMESTAMP WITH TIME ZONE)

This concludes the main implementation steps. Further sections might include Deployment, Maintenance, etc.

## Recent Stability Improvements & Bug Fixes (Session of 2025-05-13)

This section details critical bug fixes and stability enhancements implemented to improve the PWA's reliability, particularly for web export and runtime behavior.

### 1. Resolved `ReferenceError: useAuth is not defined` in Quiz Generation

*   **Symptom:** The application crashed when navigating to the "Create Quiz" screen (`src/app/(tabs)/generate-quiz.jsx`). Web exports (`npx expo export -p web`) also failed due to this unresolved reference.
*   **Root Cause:** The `useAuth` hook, essential for accessing user session information, was being called within `generate-quiz.jsx` without the corresponding import statement from `AuthContext`.
*   **Solution:**
    1.  Identified the missing import via code inspection and build error logs.
    2.  Added the import statement: `import { useAuth } from '../../contexts/AuthContext';`.
    3.  Iteratively corrected the relative path of the import (from `../../../context/AuthContext` to `../../context/AuthContext` and finally to `../../contexts/AuthContext`) until the module resolved correctly and the web export succeeded.
*   **Impact:** The quiz generation screen is now functional, and web exports complete successfully regarding this issue.

### 2. Addressed Offline Service File System Initialization Error on Web

*   **Symptom:** During `npx expo export -p web`, error logs indicated "Failed to initialize offline files directory" originating from `src/services/offlineService.js`.
*   **Root Cause:** The `offlineService.js` attempted to create a directory using `FileSystem.cacheDirectory`. However, `FileSystem.cacheDirectory` is `null` in the web environment, leading to an invalid path (`"null/offline_files/"`) and an error when `FileSystem.makeDirectoryAsync` was called.
*   **Solution:**
    1.  Imported `Platform` from `react-native` in `offlineService.js`.
    2.  Conditionally skipped the directory creation logic if `Platform.OS === 'web'`.
    3.  Added a log message to indicate when directory creation is skipped on web.
*   **Impact:** Web exports no longer show this error, and the application initializes without attempting incompatible file system operations on the web. Offline *file* caching on the web is effectively disabled by this, but `AsyncStorage`-based queuing remains.

### 3. Enhanced `NetInfo` Stability for Web in `offlineService.js`

*   **Symptom:** The application crashed with `TypeError: Cannot read properties of undefined (reading 'isInternetReachable')` when navigating to certain pages like "My Documents" or "My Quizzes." The error originated from `NetworkContext.js`, which relies on `offlineService.js` for network status.
*   **Root Cause:** `@react-native-community/netinfo` (used by `offlineService.js`) was providing an `undefined` state object or a state object missing the `isInternetReachable` property when running on the web. Accessing `state.isConnected` on this undefined/incomplete object caused the TypeError.
*   **Solution (in `src/services/offlineService.js`):**
    1.  **Robust `NetInfo.fetch()` Handling:** In `getNetworkStatus()`, added checks to ensure the `state` object from `NetInfo.fetch()` is not null/undefined and that `state.isConnected` is a boolean before using it. If checks fail or an error occurs, `isConnected` defaults to `false`.
    2.  **Robust `NetInfo.addEventListener` Handling:**
        *   Wrapped the event listener's callback logic in a `try...catch` block.
        *   Added similar checks for the `eventState` object and `eventState.isConnected` within the listener. If checks fail or an error is caught, `isConnected` defaults to `false`.
*   **Impact:** The application no longer crashes due to unexpected `NetInfo` behavior on the web. It now defaults to an 'offline' state if network connectivity cannot be reliably determined, preventing the TypeError and improving overall PWA stability.