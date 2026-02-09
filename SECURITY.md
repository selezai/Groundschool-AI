# Security Documentation

## Overview

This document describes the security measures implemented in the Groundschool AI application.

## Security Layers

### 1. Row Level Security (RLS)

All database tables have RLS enabled with policies that ensure users can only access their own data:

| Table | Policy |
|-------|--------|
| `profiles` | `auth.uid() = id` |
| `documents` | `auth.uid() = user_id` |
| `quizzes` | `auth.uid() = user_id` |
| `quiz_questions` | Via parent quiz ownership |
| `quiz_attempts` | `auth.uid() = user_id` |
| `quiz_question_responses` | Via parent attempt ownership |

### 2. PayFast IP Allowlisting

The PayFast ITN (Instant Transaction Notification) webhook only accepts requests from PayFast's known IP ranges:

```
197.97.145.144/28  (197.97.145.144 - 197.97.145.159)
41.74.179.192/27   (41.74.179.192 - 41.74.179.223)
```

**Configuration:**
- Set `PAYFAST_SKIP_IP_VALIDATION=true` in development/sandbox mode to bypass IP validation
- In production, IP validation is always enforced

**Location:** `supabase/functions/handle-payfast-itn/index.ts`

### 3. Rate Limiting

All Edge Functions implement rate limiting to prevent abuse:

| Endpoint | Rate Limit |
|----------|------------|
| Payment Generation | Strict (PAYMENT config) |
| PayFast ITN Webhook | Webhook config |
| Subscription Cancellation | API config |

**Location:** `supabase/functions/_shared/rateLimiter.ts`

### 4. Structured Security Logging

All Edge Functions emit structured JSON security logs for monitoring and alerting:

```json
{
  "type": "SECURITY_EVENT",
  "timestamp": "2025-02-09T17:30:00.000Z",
  "event": "ITN_PAYMENT_SUCCESS",
  "ip": "197.97.145.150",
  "userAgent": "PayFast/1.0",
  "userId": "uuid-here",
  "status": "success",
  "details": { ... }
}
```

**Event Types:**
- `ITN_IP_BLOCKED` - Request from non-PayFast IP blocked
- `ITN_RATE_LIMITED` - Rate limit exceeded
- `ITN_SIGNATURE_INVALID` - PayFast signature validation failed
- `ITN_PAYMENT_SUCCESS` - Payment processed successfully
- `ITN_PROCESSING_ERROR` - Error during ITN processing
- `PAYMENT_GENERATION_RATE_LIMITED` - Payment generation rate limited
- `ACCOUNT_DELETED` - User account deleted successfully
- `ACCOUNT_DELETION_ERROR` - Error during account deletion

### 5. Signature Validation

PayFast ITN requests are validated using:
1. **MD5 Signature** - Validates the request came from PayFast
2. **Server-to-Server Validation** - Optional secondary validation with PayFast servers
3. **Merchant ID Validation** - Ensures the payment is for our merchant account

### 6. Service Role Key Usage

Service role keys (which bypass RLS) are used only in Edge Functions for:
- User account deletion (requires admin access to `auth.users`)
- Payment webhook processing (requires updating any user's subscription)

**Service role keys are never exposed to the client.**

## Security Audit Results

| Category | Status |
|----------|--------|
| SQL Injection | ✅ Protected (parameterized queries) |
| IDOR | ✅ Protected (RLS + client-side checks) |
| Admin Routes | ✅ N/A (no admin routes exist) |
| Edge Functions | ✅ Secured (JWT + rate limiting + IP allowlist) |

## Environment Variables

Sensitive configuration is stored in environment variables:

- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only
- `PAYFAST_SANDBOX_PASSPHRASE` - Server-side only
- `PAYFAST_SANDBOX_MERCHANT_ID` - Server-side only
- `PAYFAST_SKIP_IP_VALIDATION` - Development only

## Recommendations

1. **Monitor Security Logs** - Set up alerts for `status: 'blocked'` or `status: 'failure'` events
2. **Review Rate Limits** - Adjust rate limits based on traffic patterns
3. **Rotate Keys** - Regularly rotate API keys and passphrases
4. **Update Dependencies** - Keep all dependencies up to date for security patches

## Last Updated

February 9, 2026
