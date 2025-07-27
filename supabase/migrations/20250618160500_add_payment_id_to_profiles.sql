-- Add the m_payment_id_last_attempt column to the profiles table
ALTER TABLE public.profiles
ADD COLUMN m_payment_id_last_attempt TEXT;
