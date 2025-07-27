/**
 * Test script for Gemini AI integration
 * 
 * This script tests the Gemini service's ability to generate questions from a document.
 * Run this script with: npx expo run:web -- --no-dev
 */

import { supabase } from '../services/supabaseClient';
import { generateQuestionsFromDocument } from '../services/geminiService';
import logger from '../services/loggerService';

// Test configuration
const TEST_DOCUMENT_ID = null; // Set this to a valid document ID or leave null to use the first available document

/**
 * Main test function
 */
async function testGeminiIntegration() {
  console.log('🧪 Starting Gemini AI integration test...');
  
  try {
    // 1. Authenticate (if needed)
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      console.error('❌ Authentication required:', authError?.message || 'No active session');
      return;
    }
    
    console.log('✅ Authentication successful');
    
    // 2. Fetch a document to test with
    let document;
    
    if (TEST_DOCUMENT_ID) {
      // Fetch specific document if ID is provided
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', TEST_DOCUMENT_ID)
        .single();
        
      if (error || !data) {
        console.error(`❌ Failed to fetch document with ID ${TEST_DOCUMENT_ID}:`, error?.message || 'Document not found');
        return;
      }
      
      document = data;
    } else {
      // Fetch the first available document
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .limit(1)
        .single();
        
      if (error || !data) {
        console.error('❌ Failed to fetch any documents:', error?.message || 'No documents found');
        return;
      }
      
      document = data;
    }
    
    console.log('✅ Using document:', {
      id: document.id,
      title: document.title,
      type: document.document_type,
      path: document.file_path
    });
    
    // 3. Generate questions using the Gemini service
    console.log('🔄 Generating questions from document...');
    console.log('⏳ This may take a minute depending on document size and complexity...');
    
    const questions = await generateQuestionsFromDocument(document, 3, 'medium');
    
    // 4. Display results
    console.log(`✅ Successfully generated ${questions.length} questions:`);
    
    questions.forEach((question, index) => {
      console.log(`\n--- Question ${index + 1} ---`);
      console.log(`Q: ${question.text}`);
      console.log('Options:');
      question.options.forEach(option => console.log(`  ${option}`));
      console.log(`Correct Answer: ${question.correct_answer}`);
      console.log(`Explanation: ${question.explanation}`);
      console.log(`Difficulty: ${question.difficulty}`);
      console.log(`Topic: ${question.topic}`);
    });
    
    console.log('\n🎉 Gemini AI integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Export the test function
export default testGeminiIntegration;

// Auto-run the test if this file is executed directly
if (typeof window !== 'undefined') {
  // Only run in browser environment
  window.runGeminiTest = testGeminiIntegration;
  console.log('📝 To run the test, call window.runGeminiTest() in the browser console');
}
