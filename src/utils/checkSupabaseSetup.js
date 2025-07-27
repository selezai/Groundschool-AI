import { supabase } from '../services/supabaseClient';
import logger from '../services/loggerService';

/**
 * Utility function to check if the Supabase setup is correct for the documents feature
 * This checks for the existence of the documents table and storage bucket
 */
export const checkSupabaseSetup = async () => {
  const results = {
    documentsTable: false,
    documentsBucket: false,
    errors: []
  };

  try {
    // Check if the documents table exists
    logger.info('Checking if documents table exists...');
    const { error: tableCheckError } = await supabase
      .from('documents')
      .select('count')
      .limit(1);
    
    if (tableCheckError) {
      if (tableCheckError.code === '42P01') { // PostgreSQL code for undefined_table
        results.errors.push('The documents table does not exist in the database.');
        logger.error('Documents table does not exist.', tableCheckError);
      } else {
        results.errors.push(`Error checking documents table: ${tableCheckError.message}`);
        logger.error('Error checking documents table:', tableCheckError);
      }
    } else {
      results.documentsTable = true;
      logger.info('Documents table exists and is accessible.');
    }

    // Check if the documents storage bucket exists
    logger.info('Checking if documents storage bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      results.errors.push(`Error checking storage buckets: ${bucketsError.message}`);
      logger.error('Error checking storage buckets:', bucketsError);
    } else {
      const documentsBucket = buckets.find(bucket => bucket.name === 'documents');
      if (documentsBucket) {
        results.documentsBucket = true;
        logger.info('Documents storage bucket exists.');
      } else {
        results.errors.push('The documents storage bucket does not exist.');
        logger.error('Documents storage bucket does not exist.');
      }
    }

    return results;
  } catch (error) {
    results.errors.push(`Unexpected error: ${error.message}`);
    logger.error('Unexpected error during Supabase setup check:', error);
    return results;
  }
};

// Export a function to run the check and display results
export const runSupabaseSetupCheck = async () => {
  try {
    const results = await checkSupabaseSetup();
    
    console.log('\n=== Supabase Setup Check Results ===');
    console.log(`Documents Table: ${results.documentsTable ? '✅ Exists' : '❌ Missing'}`);
    console.log(`Documents Storage Bucket: ${results.documentsBucket ? '✅ Exists' : '❌ Missing'}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ Issues Found:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      
      console.log('\n📋 Setup Instructions:');
      if (!results.documentsTable) {
        console.log(`
1. Create the 'documents' table in Supabase:
   - Go to your Supabase dashboard
   - Navigate to the "Table Editor" section
   - Click "Create a new table"
   - Name the table "documents"
   - Add the following columns:
     * id (type: uuid, primary key, default: gen_random_uuid())
     * user_id (type: uuid, not null)
     * title (type: text, not null)
     * file_path (type: text, not null)
     * document_type (type: text, not null)
     * status (type: text, not null)
     * created_at (type: timestamp with time zone, default: now())
     * updated_at (type: timestamp with time zone, default: now())
   - Enable Row Level Security (RLS)
   - Create a policy named "Users can only access their own documents"
   - Set the policy to: auth.uid() = user_id
   - Apply this to all operations (SELECT, INSERT, UPDATE, DELETE)
        `);
      }
      
      if (!results.documentsBucket) {
        console.log(`
2. Create the 'documents' storage bucket:
   - In your Supabase dashboard, navigate to the "Storage" section
   - Click "Create a new bucket"
   - Name the bucket "documents"
   - Set the privacy to "Private" (authenticated access only)
   - Create a policy to allow users to upload files to their own folder:
     * Policy name: "Users can upload to their own folder"
     * Policy definition: storage.foldername(object) = auth.uid()::text
     * Apply to: INSERT, UPDATE
   - Create another policy to allow users to read their own files:
     * Policy name: "Users can read their own files"
     * Policy definition: storage.foldername(object) = auth.uid()::text
     * Apply to: SELECT
        `);
      }
    } else {
      console.log('\n✅ All required Supabase resources are set up correctly!');
    }
    
    return results;
  } catch (error) {
    console.error('Failed to run Supabase setup check:', error);
    return { error: error.message };
  }
};

// Export default for direct imports
export default { checkSupabaseSetup, runSupabaseSetupCheck };
