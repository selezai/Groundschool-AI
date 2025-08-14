-- Migration to add Payfast-related columns to public.profiles table
-- This migration safely adds columns if they don't exist and renames existing ones if needed

-- Add pf_payment_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'pf_payment_id') THEN
        -- Check if paystack_customer_code exists and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'paystack_customer_code') THEN
            ALTER TABLE public.profiles RENAME COLUMN paystack_customer_code TO pf_payment_id;
        ELSE
            -- Add the column if neither exists
            ALTER TABLE public.profiles ADD COLUMN pf_payment_id TEXT;
        END IF;
    END IF;
END $$;

-- Add payfast_token column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'payfast_token') THEN
        -- Check if paystack_subscription_code exists and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'paystack_subscription_code') THEN
            ALTER TABLE public.profiles RENAME COLUMN paystack_subscription_code TO payfast_token;
        ELSE
            -- Add the column if neither exists
            ALTER TABLE public.profiles ADD COLUMN payfast_token TEXT;
        END IF;
    END IF;
END $$;

-- Add other PayFast-related columns if they don't exist
DO $$ 
BEGIN
    -- Add plan column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'plan') THEN
        ALTER TABLE public.profiles ADD COLUMN plan TEXT DEFAULT 'basic';
    END IF;
    
    -- Add plan_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'plan_status') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_status TEXT DEFAULT 'inactive';
    END IF;
    
    -- Add email column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    
    -- Add plan_activated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'plan_activated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_activated_at TIMESTAMPTZ;
    END IF;
    
    -- Add plan_period_end column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'plan_period_end') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_period_end TIMESTAMPTZ;
    END IF;
    
    -- Add can_access_past_exams column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'can_access_past_exams') THEN
        ALTER TABLE public.profiles ADD COLUMN can_access_past_exams BOOLEAN DEFAULT false;
    END IF;
    
    -- Add monthly_quizzes_remaining column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'monthly_quizzes_remaining') THEN
        ALTER TABLE public.profiles ADD COLUMN monthly_quizzes_remaining INTEGER DEFAULT 10;
    END IF;
    
    -- Add last_quota_reset_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'last_quota_reset_date') THEN
        ALTER TABLE public.profiles ADD COLUMN last_quota_reset_date DATE;
    END IF;
    
    -- Add m_payment_id_last_attempt column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'm_payment_id_last_attempt') THEN
        ALTER TABLE public.profiles ADD COLUMN m_payment_id_last_attempt TEXT;
    END IF;
END $$;

-- Add comments to the columns for clarity
COMMENT ON COLUMN public.profiles.pf_payment_id IS 'Payfast payment ID for a specific transaction. Can be used to query transaction status.';
COMMENT ON COLUMN public.profiles.payfast_token IS 'Payfast token for managing recurring subscriptions or tokenized payments, if applicable.';
COMMENT ON COLUMN public.profiles.plan IS 'User subscription plan: basic or captains_club';
COMMENT ON COLUMN public.profiles.plan_status IS 'Status of the subscription plan: active, inactive, cancelled';
COMMENT ON COLUMN public.profiles.email IS 'User email address for identification and communication';
COMMENT ON COLUMN public.profiles.can_access_past_exams IS 'Whether user can access past exam history (Captain''s Club feature)';
COMMENT ON COLUMN public.profiles.monthly_quizzes_remaining IS 'Number of quizzes remaining this month (-1 for unlimited)';
COMMENT ON COLUMN public.profiles.m_payment_id_last_attempt IS 'Last payment attempt ID for tracking payment status';
