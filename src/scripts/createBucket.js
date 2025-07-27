import { supabase } from '../services/supabaseClient';
import logger from '../services/loggerService';

async function createDocumentsBucket() {
  try {
    // First check if the bucket exists
    console.log('Checking if documents bucket exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === 'documents');
    
    if (bucketExists) {
      console.log('The documents bucket already exists.');
      return;
    }
    
    // Create the bucket
    console.log('Creating documents bucket...');
    const { data, error } = await supabase.storage.createBucket('documents', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
    
    if (error) {
      console.error('Error creating bucket:', error);
      return;
    }
    
    console.log('Documents bucket created successfully:', data);
    
    // Create policies
    console.log('Creating storage policies...');
    
    // We'll use the REST API directly for this part
    const token = supabase.auth.session()?.access_token;
    if (!token) {
      console.error('No access token available. Please log in first.');
      return;
    }
    
    // Manually execute the SQL for policies via the REST API
    // This is a workaround since we can't directly create policies via the JavaScript SDK
    
    console.log('Bucket created successfully. Please add the following policies manually in the Supabase dashboard:');
    console.log(`
1. Policy Name: "Users can upload to their own folder"
   - Operation: INSERT
   - Policy Definition: storage.foldername(name)[1] = auth.uid()::text

2. Policy Name: "Users can update their own files"
   - Operation: UPDATE
   - Policy Definition: storage.foldername(name)[1] = auth.uid()::text

3. Policy Name: "Users can read their own files"
   - Operation: SELECT
   - Policy Definition: storage.foldername(name)[1] = auth.uid()::text

4. Policy Name: "Users can delete their own files"
   - Operation: DELETE
   - Policy Definition: storage.foldername(name)[1] = auth.uid()::text
    `);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the function
createDocumentsBucket().then(() => {
  console.log('Script completed.');
});

export default createDocumentsBucket;
