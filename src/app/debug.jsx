import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { checkSupabaseSetup } from '../utils/checkSupabaseSetup';
import logger from '../services/loggerService';

export default function DebugScreen() {
  // Security: Block access in production environment
  const isProduction = process.env.EXPO_PUBLIC_ENV === 'production';
  
  if (isProduction) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Access Denied' }} />
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedTitle}>🔒 Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            Debug and diagnostics pages are not available in production for security reasons.
          </Text>
        </View>
      </View>
    );
  }
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      logger.info('Debug: Running Supabase setup check');
      const checkResults = await checkSupabaseSetup();
      setResults(checkResults);
      logger.info('Debug: Supabase setup check completed', checkResults);
    } catch (err) {
      logger.error('Debug: Error running Supabase setup check', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Debug & Diagnostics' }} />
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Supabase Resource Check</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={runCheck}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Check...' : 'Check Supabase Resources'}
          </Text>
        </TouchableOpacity>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {results && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>Results:</Text>
            
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Documents Table:</Text>
              <Text style={[
                styles.resultValue, 
                results.documentsTable ? styles.success : styles.failure
              ]}>
                {results.documentsTable ? '✅ Exists' : '❌ Missing'}
              </Text>
            </View>
            
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Documents Storage Bucket:</Text>
              <Text style={[
                styles.resultValue, 
                results.documentsBucket ? styles.success : styles.failure
              ]}>
                {results.documentsBucket ? '✅ Exists' : '❌ Missing'}
              </Text>
            </View>
            
            {results.errors && results.errors.length > 0 && (
              <View style={styles.errorsContainer}>
                <Text style={styles.sectionTitle}>Issues Found:</Text>
                {results.errors.map((err, index) => (
                  <Text key={index} style={styles.errorItem}>
                    {index + 1}. {err}
                  </Text>
                ))}
              </View>
            )}
            
            {(!results.documentsTable || !results.documentsBucket) && (
              <View style={styles.instructionsContainer}>
                <Text style={styles.sectionTitle}>Setup Instructions:</Text>
                
                {!results.documentsTable && (
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionTitle}>1. Create the 'documents' table in Supabase:</Text>
                    <Text style={styles.instructionText}>
                      - Go to your Supabase dashboard{'\n'}
                      - Navigate to the "Table Editor" section{'\n'}
                      - Click "Create a new table"{'\n'}
                      - Name the table "documents"{'\n'}
                      - Add the following columns:{'\n'}
                      {'  '}* id (type: uuid, primary key, default: gen_random_uuid()){'\n'}
                      {'  '}* user_id (type: uuid, not null){'\n'}
                      {'  '}* title (type: text, not null){'\n'}
                      {'  '}* file_path (type: text, not null){'\n'}
                      {'  '}* document_type (type: text, not null){'\n'}
                      {'  '}* status (type: text, not null){'\n'}
                      {'  '}* created_at (type: timestamp with time zone, default: now()){'\n'}
                      {'  '}* updated_at (type: timestamp with time zone, default: now()){'\n'}
                      - Enable Row Level Security (RLS){'\n'}
                      - Create a policy named "Users can only access their own documents"{'\n'}
                      - Set the policy to: auth.uid() = user_id{'\n'}
                      - Apply this to all operations (SELECT, INSERT, UPDATE, DELETE)
                    </Text>
                  </View>
                )}
                
                {!results.documentsBucket && (
                  <View style={styles.instructionItem}>
                    <Text style={styles.instructionTitle}>2. Create the 'documents' storage bucket:</Text>
                    <Text style={styles.instructionText}>
                      - In your Supabase dashboard, navigate to the "Storage" section{'\n'}
                      - Click "Create a new bucket"{'\n'}
                      - Name the bucket "documents"{'\n'}
                      - Set the privacy to "Private" (authenticated access only){'\n'}
                      - Create a policy to allow users to upload files to their own folder:{'\n'}
                      {'  '}* Policy name: "Users can upload to their own folder"{'\n'}
                      {'  '}* Policy definition: storage.foldername(object) = auth.uid()::text{'\n'}
                      {'  '}* Apply to: INSERT, UPDATE{'\n'}
                      - Create another policy to allow users to read their own files:{'\n'}
                      {'  '}* Policy name: "Users can read their own files"{'\n'}
                      {'  '}* Policy definition: storage.foldername(object) = auth.uid()::text{'\n'}
                      {'  '}* Apply to: SELECT
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorText: {
    color: '#b71c1c',
  },
  resultsContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultLabel: {
    fontSize: 16,
    flex: 1,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  success: {
    color: '#2e7d32',
  },
  failure: {
    color: '#c62828',
  },
  errorsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  errorItem: {
    marginBottom: 8,
    color: '#bf360c',
  },
  instructionsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  instructionItem: {
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2e7d32',
  },
  instructionText: {
    lineHeight: 20,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});
