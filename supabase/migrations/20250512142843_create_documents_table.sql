-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Use default UUID generation
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE, -- Path in Supabase Storage, should be unique
  content_url TEXT, -- Public URL from Storage if available/needed
  document_type TEXT NOT NULL, -- e.g., 'pdf', 'png', 'jpg'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')), -- Upload/processing status
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for frequently queried columns
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_status ON public.documents(status);

-- Add comment on the table
COMMENT ON TABLE public.documents IS 'Stores metadata about user-uploaded documents.';
COMMENT ON COLUMN public.documents.file_path IS 'Path to the document file in Supabase Storage.';
COMMENT ON COLUMN public.documents.status IS 'Tracks the upload and processing status of the document.';

-- Note: The 'content' column mentioned in the guide is omitted here.
-- Text extraction for AI is handled server-side during quiz generation (Step 4).
-- If basic text preview is needed later, a separate mechanism or table might be better.