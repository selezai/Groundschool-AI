# Deployment Guide - Groundschool AI 🚀

This directory contains deployment configurations and guides for various platforms.

## Deployment Targets

### 🌐 Web (PWA) - Vercel
- **Status**: ✅ Production Ready
- **URL**: [groundschool-ai.vercel.app](https://groundschool-ai.vercel.app)
- **Config**: `vercel.json`

### 📱 Mobile Apps
- **iOS**: App Store deployment ready
- **Android**: Google Play Store deployment ready
- **Config**: `eas.json` (Expo Application Services)

### ☁️ Backend - Supabase
- **Database**: PostgreSQL with RLS
- **Storage**: Document file storage
- **Edge Functions**: Serverless API endpoints
- **Config**: `supabase/config.toml`

## Quick Deployment

### Web Deployment
```bash
# Using Vercel CLI
npm install -g vercel
vercel

# Or connect GitHub repo to Vercel dashboard
```

### Mobile Deployment
```bash
# Using EAS Build
npm install -g @expo/eas-cli
eas build --platform all
eas submit --platform all
```

## Environment Configuration

### Production Environment Variables
```env
# Supabase (Production)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key

# Google AI (Production with restrictions)
EXPO_PUBLIC_GEMINI_API_KEY=your_restricted_api_key

# PayFast (Production)
PAYFAST_MERCHANT_ID=your_production_merchant_id
PAYFAST_MERCHANT_KEY=your_production_merchant_key
PAYFAST_PASSPHRASE=your_production_passphrase
PAYFAST_SANDBOX=false

# App Configuration
EXPO_PUBLIC_APP_ENV=production
```

### Security Checklist
- [ ] API keys restricted to production domains
- [ ] Environment variables secured
- [ ] Database RLS policies active
- [ ] SSL certificates configured
- [ ] Rate limiting enabled
- [ ] Error logging configured

## Platform-Specific Guides

### Vercel Web Deployment
See: [vercel-deployment.md](vercel-deployment.md)

### iOS App Store
See: [ios-deployment.md](ios-deployment.md)

### Android Play Store
See: [android-deployment.md](android-deployment.md)

### Supabase Backend
See: [supabase-deployment.md](supabase-deployment.md)

## Monitoring & Analytics

### Performance Monitoring
- **Web**: Vercel Analytics
- **Mobile**: Expo Analytics
- **Backend**: Supabase Dashboard

### Error Tracking
- **Frontend**: Sentry (optional)
- **Backend**: Supabase Logs
- **Edge Functions**: Deno Deploy logs

### User Analytics
- **Privacy-focused**: No personal data tracking
- **Usage metrics**: Anonymous usage patterns
- **Performance**: Load times and error rates

## Rollback Procedures

### Web Rollback
```bash
# Vercel rollback to previous deployment
vercel rollback
```

### Mobile Rollback
- iOS: App Store Connect rollback
- Android: Google Play Console rollback

### Database Rollback
```bash
# Supabase migration rollback
supabase db reset --db-url your_db_url
```

## CI/CD Pipeline

### GitHub Actions (Optional)
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: vercel --prod
```

## Performance Optimization

### Web Optimization
- Bundle size optimization
- Image compression
- CDN configuration
- Caching strategies

### Mobile Optimization
- App size reduction
- Startup time optimization
- Memory usage optimization
- Battery usage optimization

## Security Considerations

### Production Security
- API key restrictions
- HTTPS enforcement
- Content Security Policy
- Rate limiting active
- Input validation
- SQL injection prevention

### Data Protection
- GDPR compliance
- Data encryption
- Secure file storage
- User privacy protection

## Support & Maintenance

### Monitoring
- Uptime monitoring
- Performance alerts
- Error notifications
- Usage analytics

### Updates
- Security patches
- Feature updates
- Bug fixes
- Performance improvements

---

*Deploy with confidence - your aviation education platform awaits!* ✈️🚀
