#!/usr/bin/env node
/**
 * Upload question bank images to Supabase Storage
 * 
 * Usage: node scripts/upload-question-images.mjs
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load env vars from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'question-images';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Image directories to upload from
const IMAGE_DIRS = [
  path.resolve(process.cwd(), 'Question Bank/extracted_images'),
  path.resolve(process.cwd(), 'Question Bank/images'),
];

async function ensureBucket() {
  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!exists) {
    console.log(`Creating bucket: ${BUCKET_NAME}`);
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true, // Public so images can be displayed without auth
      fileSizeLimit: 5 * 1024 * 1024, // 5MB max
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    });
    if (error) {
      console.error('Failed to create bucket:', error.message);
      process.exit(1);
    }
    console.log(`Bucket "${BUCKET_NAME}" created successfully`);
  } else {
    console.log(`Bucket "${BUCKET_NAME}" already exists`);
  }
}

async function uploadImages() {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const dir of IMAGE_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`Skipping missing directory: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
    console.log(`\nUploading ${files.length} images from: ${path.basename(dir)}/`);

    for (const filename of files) {
      const filePath = path.join(dir, filename);
      const fileBuffer = fs.readFileSync(filePath);
      
      // Upload to bucket root with original filename
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, fileBuffer, {
          contentType: 'image/png',
          upsert: true, // Overwrite if exists
        });

      if (error) {
        console.error(`  ✗ ${filename}: ${error.message}`);
        failed++;
      } else {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filename}`;
        console.log(`  ✓ ${filename}`);
        results.push({ filename, url: publicUrl });
        uploaded++;
      }
    }
  }

  console.log(`\n=== Upload Summary ===`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${uploaded + skipped + failed}`);

  // Write URL mapping file for reference
  const mappingPath = path.resolve(process.cwd(), 'question-bank-data/image-urls.json');
  const mapping = {};
  for (const r of results) {
    mapping[r.filename] = r.url;
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\nURL mapping saved to: ${mappingPath}`);

  return mapping;
}

async function main() {
  console.log('=== Question Image Upload Tool ===\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Bucket: ${BUCKET_NAME}\n`);

  await ensureBucket();
  await uploadImages();

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
