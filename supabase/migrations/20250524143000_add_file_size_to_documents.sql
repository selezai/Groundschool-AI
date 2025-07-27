-- Add file_size column to documents table
ALTER TABLE public.documents ADD COLUMN file_size BIGINT;

-- Add comment on the column
COMMENT ON COLUMN public.documents.file_size IS 'Size of the document file in bytes.';

-- Update existing documents to set file_size to 0 (since we don't know their actual size)
UPDATE public.documents SET file_size = 0 WHERE file_size IS NULL;

-- Make file_size NOT NULL after updating existing records
ALTER TABLE public.documents ALTER COLUMN file_size SET NOT NULL;

-- Add index for file_size to optimize queries that filter or aggregate by size
CREATE INDEX idx_documents_file_size ON public.documents(file_size);
