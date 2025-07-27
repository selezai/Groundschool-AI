-- Create the documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on the objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to upload to their own folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can upload to their own folder'
    ) THEN
        CREATE POLICY "Users can upload to their own folder" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END
$$;

-- Create policy to allow users to update their own files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can update their own files'
    ) THEN
        CREATE POLICY "Users can update their own files" ON storage.objects
        FOR UPDATE TO authenticated
        USING (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END
$$;

-- Create policy to allow users to read their own files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can read their own files'
    ) THEN
        CREATE POLICY "Users can read their own files" ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END
$$;

-- Create policy to allow users to delete their own files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can delete their own files'
    ) THEN
        CREATE POLICY "Users can delete their own files" ON storage.objects
        FOR DELETE TO authenticated
        USING (
            bucket_id = 'documents' AND
            (storage.foldername(name))[1] = auth.uid()::text
        );
    END IF;
END
$$;
