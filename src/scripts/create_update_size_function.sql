-- Function to update document size
CREATE OR REPLACE FUNCTION update_document_size(document_id UUID, size_in_bytes BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE documents
  SET file_size = size_in_bytes
  WHERE id = document_id;
END;
$$ LANGUAGE plpgsql;
