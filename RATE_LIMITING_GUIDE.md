# 🚦 Rate Limiting Implementation Guide

## Overview

Your Groundschool AI project now has comprehensive rate limiting implemented across all critical Edge Functions to prevent API abuse, protect against DDoS attacks, and ensure fair usage of resources.

## 🛡️ Security Benefits

- **Prevents Payment Fraud**: Strict limits on payment endpoint usage
- **Blocks DDoS Attacks**: Rate limiting prevents overwhelming your servers
- **Protects Resources**: Prevents excessive API calls that could impact performance
- **Fair Usage**: Ensures all users get equitable access to services
- **Webhook Security**: Protects PayFast ITN handler from abuse

## 📊 Rate Limiting Configuration

### Payment Endpoints (Most Restrictive)
- **Endpoint**: `generate-payfast-payment-data`
- **Limit**: 3 requests per minute
- **Window**: 60 seconds
- **Purpose**: Prevent payment fraud and abuse

### Webhook Endpoints
- **Endpoint**: `handle-payfast-itn`
- **Limit**: 10 requests per minute
- **Window**: 60 seconds
- **Purpose**: Allow legitimate PayFast traffic while blocking abuse

### API Endpoints
- **Endpoint**: `handle-subscription-cancellation`
- **Limit**: 60 requests per minute
- **Window**: 60 seconds
- **Purpose**: General API protection with reasonable limits

## 🏗️ Technical Implementation

### Rate Limiting Infrastructure

1. **Shared Utility**: `/supabase/functions/_shared/rateLimiter.ts`
   - Comprehensive rate limiting logic
   - Multiple rate limiting strategies
   - IP-based and user-based limiting
   - Automatic cleanup of expired entries

2. **Database Table**: `rate_limits`
   - Stores rate limiting data
   - Automatic expiration and cleanup
   - Efficient indexing for performance

3. **Migration**: `20250724_create_rate_limits_table.sql`
   - Creates the rate limiting infrastructure
   - Sets up proper permissions and policies

### Rate Limiting Logic

```typescript
// Example usage in Edge Functions
const rateLimitResponse = await applyRateLimit(
  req,
  RATE_LIMIT_CONFIGS.PAYMENT,
  'payment-generation',
  supabaseUrl,
  supabaseServiceKey
);

if (rateLimitResponse) {
  return rateLimitResponse; // Returns 429 Too Many Requests
}
```

## 🔧 Configuration Options

### Predefined Configurations

```typescript
RATE_LIMIT_CONFIGS = {
  PAYMENT: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 3,          // 3 requests max
    message: 'Too many payment requests...'
  },
  
  WEBHOOK: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 10,         // 10 requests max
    message: 'Webhook rate limit exceeded.'
  },
  
  API: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 60,         // 60 requests max
    message: 'Rate limit exceeded...'
  }
}
```

### Custom Configuration

You can create custom rate limiting configurations:

```typescript
const customConfig = {
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 100,         // 100 requests
  message: 'Custom rate limit message',
  statusCode: 429
};
```

## 📈 Monitoring and Logging

### Rate Limit Headers

When rate limiting is active, responses include helpful headers:

```
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642694400
X-RateLimit-Window: 60000
Retry-After: 60
```

### Logging

Rate limiting events are logged with details:

```
🚦 Rate limit exceeded for payment-generation: {
  key: "payment-generation:192.168.1.1:abc123",
  currentCount: 4,
  maxRequests: 3,
  windowMs: 60000,
  resetTime: "2024-01-20T10:30:00.000Z"
}
```

## 🚀 Deployment Instructions

### 1. Apply Database Migration

Run the rate limiting migration in your Supabase Dashboard:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/20250724_create_rate_limits_table.sql
```

### 2. Deploy Edge Functions

The rate limiting is automatically applied when you deploy your Edge Functions:

```bash
supabase functions deploy generate-payfast-payment-data
supabase functions deploy handle-payfast-itn
supabase functions deploy handle-subscription-cancellation
```

### 3. Monitor Performance

Check your Supabase logs to monitor rate limiting effectiveness:

- Look for `🚦 Rate limit exceeded` messages
- Monitor the `rate_limits` table size
- Check for any performance impacts

## 🔧 Maintenance

### Cleanup Expired Entries

The system automatically cleans up expired rate limit entries, but you can manually run:

```sql
SELECT cleanup_expired_rate_limits();
```

### Adjust Limits

To modify rate limits, update the configurations in `rateLimiter.ts` and redeploy:

```typescript
// Example: Increase payment limit to 5 requests per minute
PAYMENT: {
  windowMs: 60 * 1000,
  maxRequests: 5,  // Changed from 3 to 5
  message: 'Too many payment requests...'
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **Rate Limiter Not Working**
   - Check if the `rate_limits` table exists
   - Verify environment variables are set
   - Check Supabase service role permissions

2. **Too Restrictive Limits**
   - Monitor logs for legitimate users being blocked
   - Adjust limits in the configuration
   - Consider implementing user-based rate limiting

3. **Performance Issues**
   - Monitor the `rate_limits` table size
   - Run cleanup function regularly
   - Consider implementing Redis for high-traffic scenarios

### Debug Mode

Enable debug logging by adding console.log statements:

```typescript
console.log('Rate limit check:', {
  endpoint: 'payment-generation',
  ip: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent')
});
```

## 📊 Rate Limiting Effectiveness

### Expected Outcomes

- **Reduced API Abuse**: Malicious actors blocked after exceeding limits
- **Improved Stability**: Server resources protected from overload
- **Better User Experience**: Legitimate users get consistent performance
- **Enhanced Security**: Payment fraud attempts are limited

### Monitoring Metrics

Track these metrics to measure effectiveness:

1. **Rate Limit Triggers**: How often limits are exceeded
2. **Blocked Requests**: Number of requests blocked per day
3. **Response Times**: Improvement in API response times
4. **Error Rates**: Reduction in server errors due to overload

## 🔒 Security Considerations

### IP-Based Limiting

- Uses `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip` headers
- Includes user agent hash for additional uniqueness
- Handles proxy and CDN scenarios

### Fail-Safe Design

- If rate limiter fails, requests are allowed (fail-open)
- Prevents rate limiter issues from breaking your app
- Comprehensive error handling and logging

### Data Privacy

- Rate limiting keys are hashed and anonymized
- No personal data stored in rate limit entries
- Automatic cleanup prevents data accumulation

## 🎯 Next Steps

1. **Monitor Performance**: Watch logs for rate limiting effectiveness
2. **Adjust Limits**: Fine-tune based on actual usage patterns
3. **Add More Endpoints**: Apply rate limiting to other sensitive endpoints
4. **Implement User-Based Limiting**: Consider per-user rate limits for authenticated endpoints
5. **Set Up Alerts**: Monitor for unusual rate limiting patterns

Your rate limiting system is now active and protecting your Groundschool AI application from abuse while ensuring legitimate users have smooth access to all features.
