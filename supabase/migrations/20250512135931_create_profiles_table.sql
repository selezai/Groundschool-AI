CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Setup RLS (as a comment, actual RLS is in the next migration)
-- We will enable RLS and add policies in a subsequent migration file.
-- This ensures the table exists before we try to modify its RLS settings.

-- Optional: Add a comment explaining the purpose of the table
COMMENT ON TABLE public.profiles IS 'Stores public user profile information, linked to auth.users.';