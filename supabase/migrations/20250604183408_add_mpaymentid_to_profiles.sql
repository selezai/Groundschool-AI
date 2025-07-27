-- Migration to add m_payment_id_last_attempt to public.profiles table

ALTER TABLE public.profiles
ADD COLUMN m_payment_id_last_attempt TEXT NULL;

COMMENT ON COLUMN public.profiles.m_payment_id_last_attempt IS 'Stores the m_payment_id of the most recent payment attempt initiated by the user. Used by ITN handler to verify and process the correct transaction.';
