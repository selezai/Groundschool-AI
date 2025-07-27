-- CRITICAL SECURITY FIX: Fix overly permissive profile RLS policy
-- This migration fixes the security vulnerability where any authenticated user
-- could read ALL profiles. Now users can only read their own profile.

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;

-- Create a secure policy that only allows users to read their own profile
CREATE POLICY "Allow users to read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Ensure the other policies are also secure (they should already be correct)
-- But let's verify and recreate them for consistency

-- Drop and recreate insert policy (should already be secure)
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Drop and recreate update policy (should already be secure)
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add delete policy for completeness (currently commented out in original)
CREATE POLICY "Allow users to delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Force RLS for table owners (recommended security practice)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
