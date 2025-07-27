import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../services/supabaseClient';
import logger from '../services/loggerService';

export default function CreateBucketScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const createBucket = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      // First check if the bucket exists
      logger.info('CreateBucket: Checking if documents bucket exists...');
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        logger.error('CreateBucket: Error listing buckets:', listError);
        setError(`Error listing buckets: ${listError.message}`);
        return;
      }
      
      const existingBucket = buckets.find(bucket => bucket.name === 'documents');
      
      if (existingBucket) {
        logger.info('CreateBucket: The documents bucket already exists.', existingBucket);
        setResult({
          message: 'The documents bucket already exists.',
          bucket: existingBucket
        });
        return;
      }
      
      // Create the bucket
      logger.info('CreateBucket: Creating documents bucket...');
      const { data, error } = await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      
      if (error) {
        logger.error('CreateBucket: Error creating bucket:', error);
        setError(`Error creating bucket: ${error.message}`);
        return;
      }
      
      logger.info('CreateBucket: Documents bucket created successfully:', data);
      setResult({
        message: 'Documents bucket created successfully!',
        bucket: data
      });
      
    } catch (err) {
      logger.error('CreateBucket: Unexpected error:', err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Create Storage Bucket' }} />
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Create Documents Bucket</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={createBucket}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating Bucket...' : 'Create Documents Bucket'}
          </Text>
        </TouchableOpacity>
        
        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Success!</Text>
            <Text style={styles.resultText}>{result.message}</Text>
            {result.bucket && (
              <Text style={styles.resultDetails}>
                Bucket ID: {result.bucket.id}{'\n'}
                Created At: {new Date(result.bucket.created_at).toLocaleString()}
              </Text>
            )}
          </View>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Next Steps</Text>
          <Text style={styles.infoText}>
            After creating the bucket, you need to set up RLS policies in the Supabase dashboard:
          </Text>
          
          <Text style={styles.infoText}>
            1. Go to the Storage section in your Supabase dashboard{'\n'}
            2. Click on the "documents" bucket{'\n'}
            3. Click on "Policies" in the left sidebar{'\n'}
            4. Create the following policies:{'\n'}
          </Text>
          
          <View style={styles.policyContainer}>
            <Text style={styles.policyTitle}>Policy 1: Users can upload to their own folder</Text>
            <Text style={styles.policyDetails}>
              - Operation: INSERT{'\n'}
              - Policy definition: storage.foldername(name)[1] = auth.uid()::text
            </Text>
          </View>
          
          <View style={styles.policyContainer}>
            <Text style={styles.policyTitle}>Policy 2: Users can update their own files</Text>
            <Text style={styles.policyDetails}>
              - Operation: UPDATE{'\n'}
              - Policy definition: storage.foldername(name)[1] = auth.uid()::text
            </Text>
          </View>
          
          <View style={styles.policyContainer}>
            <Text style={styles.policyTitle}>Policy 3: Users can read their own files</Text>
            <Text style={styles.policyDetails}>
              - Operation: SELECT{'\n'}
              - Policy definition: storage.foldername(name)[1] = auth.uid()::text
            </Text>
          </View>
          
          <View style={styles.policyContainer}>
            <Text style={styles.policyTitle}>Policy 4: Users can delete their own files</Text>
            <Text style={styles.policyDetails}>
              - Operation: DELETE{'\n'}
              - Policy definition: storage.foldername(name)[1] = auth.uid()::text
            </Text>
          </View>
        </View>
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
  resultContainer: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#1b5e20',
    marginBottom: 8,
  },
  resultDetails: {
    fontSize: 14,
    color: '#388e3c',
    fontFamily: 'monospace',
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
  infoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0d47a1',
    marginBottom: 12,
  },
  policyContainer: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 6,
  },
  policyDetails: {
    fontSize: 14,
    color: '#424242',
    fontFamily: 'monospace',
  },
});
