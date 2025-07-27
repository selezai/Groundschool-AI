/**
 * This script sets default file sizes for existing documents in the database.
 * Since we can't reliably fetch the actual file sizes, we'll assign reasonable default sizes based on document type.
 */

// Use CommonJS require instead of ES modules for compatibility
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client directly in this script
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ixcnmcxgpnfxrjwfmqgn.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4Y25tY3hncG5meHJqd2ZtcWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU1OTQ5MzEsImV4cCI6MjAzMTE3MDkzMX0.9-pBVlNlIZQpVMFdjQi-QgJmj-9_XLKpZZz9-dIq_Zs';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Updates all documents in the database with default file sizes based on document type
 */
async function updateDocumentSizes() {
  try {
    console.log('Starting document size update process...');
    
    // Fetch all documents that don't have a file size or have file_size = 0
    const { data: documents, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .or('file_size.is.null,file_size.eq.0');
    
    if (fetchError) {
      console.error('Error fetching documents:', fetchError);
      return;
    }
    
    console.log(`Found ${documents?.length || 0} documents that need size updates.`);
    
    if (!documents || documents.length === 0) {
      console.log('No documents to update.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each document with default sizes based on type
    for (const doc of documents) {
      try {
        // Determine a reasonable default size based on document type
        let defaultSize = 2 * 1024 * 1024; // Default: 2MB
        
        if (doc.document_type) {
          const type = doc.document_type.toLowerCase();
          
          if (type.includes('pdf')) {
            defaultSize = 3 * 1024 * 1024; // PDFs: 3MB
          } else if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') || type.includes('png')) {
            defaultSize = 1.5 * 1024 * 1024; // Images: 1.5MB
          } else if (type.includes('doc') || type.includes('word')) {
            defaultSize = 2.5 * 1024 * 1024; // Word docs: 2.5MB
          } else if (type.includes('text') || type.includes('txt')) {
            defaultSize = 0.5 * 1024 * 1024; // Text files: 0.5MB
          }
        }
        
        // Update the document with the default file size
        const { error: updateError } = await supabase
          .from('documents')
          .update({ file_size: defaultSize })
          .eq('id', doc.id);
          
        if (updateError) {
          console.error(`Error updating file size for document ${doc.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated document ${doc.id} with default file size: ${defaultSize} bytes (${(defaultSize / (1024 * 1024)).toFixed(2)} MB)`);
          successCount++;
        }
      } catch (docError) {
        console.error(`Error processing document ${doc.id}:`, docError);
        errorCount++;
      }
    }
    
    console.log('Document size update completed.');
    console.log(`Success: ${successCount} documents updated.`);
    console.log(`Errors: ${errorCount} documents failed.`);
    
  } catch (error) {
    console.error('Error in updateDocumentSizes:', error);
  }
}

// Run the function
updateDocumentSizes().then(() => {
  console.log('Script execution completed.');
  process.exit(0);
}).catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});
