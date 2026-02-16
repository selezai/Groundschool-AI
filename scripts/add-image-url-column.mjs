#!/usr/bin/env node
/**
 * Add image_url column to the questions table in Supabase
 * 
 * Usage: node scripts/add-image-url-column.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Adding image_url column to questions table...\n');

  // Use rpc to run raw SQL to add the column
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;'
  });

  if (error) {
    // If rpc doesn't exist, try a different approach
    console.log('RPC approach failed, trying direct query via REST...');
    console.log('Error:', error.message);
    console.log('\n--- Manual SQL Required ---');
    console.log('Please run this SQL in the Supabase SQL Editor:');
    console.log('');
    console.log('  ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;');
    console.log('');
    console.log('Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
    console.log('Paste the SQL above and click "Run"');
  } else {
    console.log('✓ image_url column added successfully!');
  }

  // Verify by trying to select with the new column
  const { data, error: selectError } = await supabase
    .from('questions')
    .select('id, image_url')
    .limit(1);

  if (selectError) {
    console.log('\n⚠ Column verification failed:', selectError.message);
    console.log('The column may not exist yet. Please run the SQL manually.');
  } else {
    console.log('\n✓ Column verified - questions table now has image_url field');
    if (data && data.length > 0) {
      console.log('  Sample row:', JSON.stringify(data[0]));
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
