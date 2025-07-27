-- Enable Row Level Security on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read profiles
-- Allows any authenticated user to read all rows from the profiles table.
CREATE POLICY "Allow authenticated users to read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow users to insert their own profile
-- Ensures a user can only insert a row into profiles where the id column matches their own auth.uid().
CREATE POLICY "Allow users to insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy: Allow users to update their own profile
-- Ensures a user can only update a row in profiles where the id column matches their own auth.uid().
CREATE POLICY "Allow users to update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Optional Policy: Allow users to delete their own profile
-- Uncomment if users should be able to delete their profiles.
-- CREATE POLICY "Allow users to delete their own profile"
-- ON public.profiles
-- FOR DELETE
-- TO authenticated
-- USING (auth.uid() = id);