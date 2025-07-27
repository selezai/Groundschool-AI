import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../services/supabaseClient';
import logger from '../services/loggerService';

export default function StorageSetupScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const createDocumentsBucket = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      // First check if the bucket exists
      logger.info('StorageSetup: Checking if documents bucket exists...');
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        logger.error('StorageSetup: Error listing buckets:', listError);
        setError(`Error listing buckets: ${listError.message}`);
        return;
      }
      
      const existingBucket = buckets.find(bucket => bucket.name === 'documents');
      
      if (existingBucket) {
        logger.info('StorageSetup: The documents bucket already exists.', existingBucket);
        setResult({
          message: 'The documents bucket already exists.',
          bucket: existingBucket
        });
        return;
      }
      
      // Create the bucket
      logger.info('StorageSetup: Creating documents bucket...');
      const { data, error } = await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      
      if (error) {
        logger.error('StorageSetup: Error creating bucket:', error);
        setError(`Error creating bucket: ${error.message}`);
        return;
      }
      
      logger.info('StorageSetup: Documents bucket created successfully:', data);
      setResult({
        message: 'Documents bucket created successfully!',
        bucket: data
      });
      
    } catch (err) {
      logger.error('StorageSetup: Unexpected error:', err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setupBucketPolicies = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      // We'll use the REST API directly for this part
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active session. Please log in first.');
        return;
      }
      
      // Execute SQL directly using the Supabase REST API
      const { error } = await supabase.rpc('setup_storage_policies', {
        bucket_id: 'documents'
      });
      
      if (error) {
        logger.error('StorageSetup: Error setting up policies:', error);
        setError(`Error setting up policies: ${error.message}`);
        return;
      }
      
      logger.info('StorageSetup: Storage policies created successfully');
      setResult({
        message: 'Storage policies created successfully!'
      });
      
    } catch (err) {
      logger.error('StorageSetup: Unexpected error setting up policies:', err);
      setError(`Unexpected error setting up policies: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Storage Setup' }} />
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Supabase Storage Setup</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button}
            onPress={createDocumentsBucket}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Bucket...' : 'Create Documents Bucket'}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.infoText}>
            This will create the 'documents' storage bucket in your Supabase project.
          </Text>
        </View>
        
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
          <Text style={styles.infoTitle}>Manual Policy Setup</Text>
          <Text style={styles.infoText}>
            After creating the bucket, you need to set up RLS policies in the Supabase dashboard:
          </Text>
          
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>
              {`-- Create policy to allow users to upload to their own folder
CREATE POLICY "Users can upload to their own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow users to read their own files
CREATE POLICY "Users can read their own files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);`}
            </Text>
          </View>
          
          <Text style={styles.infoText}>
            Run this SQL in the Supabase SQL Editor to set up the policies.
          </Text>
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
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
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
  codeBlock: {
    backgroundColor: '#263238',
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  codeText: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
