-- Enable Row Level Security on the documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own documents
CREATE POLICY "Allow users to view their own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Allow users to insert their own documents
CREATE POLICY "Allow users to insert their own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to update their own documents
CREATE POLICY "Allow users to update their own documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to delete their own documents
CREATE POLICY "Allow users to delete their own documents"
ON public.documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Force RLS for table owners (recommended)
-- This ensures even the table owner must abide by RLS policies
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;