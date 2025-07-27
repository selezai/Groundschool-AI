-- Function to calculate total storage usage for a user
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id_param UUID)
RETURNS BIGINT AS $$
DECLARE
  total_size BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)
  INTO total_size
  FROM documents
  WHERE user_id = user_id_param;
  
  RETURN total_size;
END;
$$ LANGUAGE plpgsql;
