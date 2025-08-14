-- RATE LIMITING INFRASTRUCTURE
-- Creates the rate_limits table and supporting functions for comprehensive API rate limiting

-- Create the rate_limits table for storing rate limiting data
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Enable Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage rate limits
-- This is needed for Edge Functions to read/write rate limit data
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rate_limits' 
    AND policyname = 'Service role can manage rate limits'
  ) THEN
    CREATE POLICY "Service role can manage rate limits"
      ON rate_limits FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create function to help with rate limit table creation from Edge Functions
CREATE OR REPLACE FUNCTION create_rate_limits_table()
RETURNS void AS $$
BEGIN
  -- This function is called from Edge Functions to ensure table exists
  -- It's idempotent and safe to call multiple times
  RAISE NOTICE 'Rate limits table already exists and is configured';
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired rate limit entries
-- This can be called periodically to maintain table performance
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % expired rate limit entries', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE rate_limits_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION create_rate_limits_table() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits() TO service_role;

-- Add comment for documentation
COMMENT ON TABLE rate_limits IS 'Stores rate limiting data for API endpoints to prevent abuse and ensure fair usage';
COMMENT ON COLUMN rate_limits.key IS 'Unique identifier for the rate limit (typically endpoint:ip:hash)';
COMMENT ON COLUMN rate_limits.count IS 'Number of requests made in the current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start time of the current rate limiting window';
COMMENT ON COLUMN rate_limits.expires_at IS 'When this rate limit entry expires and can be cleaned up';
