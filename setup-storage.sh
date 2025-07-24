#!/bin/bash

# Get Supabase project reference ID
PROJECT_REF=$(supabase projects list --output json | grep -o '"reference_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$PROJECT_REF" ]; then
  echo "Error: Could not get project reference ID. Make sure you're logged in and linked to a project."
  exit 1
fi

echo "Using Supabase project: $PROJECT_REF"

# Get API URL and service role key
API_URL="https://$PROJECT_REF.supabase.co"
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env 2>/dev/null | cut -d'=' -f2)

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: Could not find SUPABASE_SERVICE_ROLE_KEY in .env file."
  echo "Please create a .env file with your service role key:"
  echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
  exit 1
fi

echo "Creating 'documents' storage bucket..."

# Create the documents bucket
RESPONSE=$(curl -s -X POST \
  "$API_URL/storage/v1/bucket" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"documents","name":"documents","public":false,"file_size_limit":52428800}')

if echo "$RESPONSE" | grep -q "error"; then
  ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  if echo "$ERROR" | grep -q "already exists"; then
    echo "Bucket 'documents' already exists."
  else
    echo "Error creating bucket: $ERROR"
    exit 1
  fi
else
  echo "Bucket 'documents' created successfully!"
fi

echo "Setting up RLS policies for the 'documents' bucket..."

# Create SQL file with policies
cat > storage_policies.sql << EOF
-- Create policy to allow users to upload to their own folder
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
);
EOF

# Execute the SQL using the REST API
RESPONSE=$(curl -s -X POST \
  "$API_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat storage_policies.sql | tr '\n' ' ')\"}")

if echo "$RESPONSE" | grep -q "error"; then
  ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  echo "Error setting up policies: $ERROR"
  exit 1
else
  echo "RLS policies set up successfully!"
fi

# Clean up
rm storage_policies.sql

echo "Storage setup complete. You should now be able to upload documents."
