-- Migration to rename Paystack-related columns in public.profiles to Payfast-related names

-- Rename paystack_customer_code to pf_payment_id
ALTER TABLE public.profiles
RENAME COLUMN paystack_customer_code TO pf_payment_id;

-- Rename paystack_subscription_code to payfast_token
ALTER TABLE public.profiles
RENAME COLUMN paystack_subscription_code TO payfast_token;

-- Add comments to the new columns for clarity
COMMENT ON COLUMN public.profiles.pf_payment_id IS 'Payfast payment ID for a specific transaction. Can be used to query transaction status.';
COMMENT ON COLUMN public.profiles.payfast_token IS 'Payfast token for managing recurring subscriptions or tokenized payments, if applicable.';
