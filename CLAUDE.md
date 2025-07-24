# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Groundschool AI is a React Native application built with Expo for aviation exam preparation. It features AI-powered quiz generation, document upload and processing, payment integration with Payfast, and subscription management.

**Key Technologies:**
- React Native with Expo (~51.0.0)
- Expo Router for navigation
- Supabase for backend services (database, auth, storage, edge functions)
- Google Gemini AI for quiz generation
- Payfast for payment processing
- Platform support: iOS, Android, Web (PWA)

## Common Commands

### Development
```bash
# Start development server
npm start

# Platform-specific development
npm run android    # Start Android development
npm run ios        # Start iOS development
npm run web        # Start web development

# Testing
npm test          # Run Jest tests

# Linting
npx eslint src/   # Lint source code
```

### Build Commands
The project uses Expo's managed workflow. For production builds, use Expo Application Services (EAS).

## Code Architecture

### Core Structure
- `src/app/` - Expo Router pages and layouts
  - `(drawer)/` - Main app screens with drawer navigation
  - `_layout.js` - Root layout with auth routing logic
- `src/contexts/` - React contexts for global state
  - `AuthContext.js` - Authentication and user profile management
  - `NetworkContext.js` - Network connectivity state
- `src/services/` - Service layer for external integrations
  - `supabaseClient.js` - Supabase client configuration with platform-specific storage
  - `authService.js` - Authentication operations
  - `quizService.js` - Quiz generation and management
  - `documentService.js` - Document upload and processing
  - `geminiService.js` - Google Gemini AI integration
  - `loggerService.js` - Centralized logging
- `src/theme/` - Theming system with dark mode support
- `src/components/` - Reusable UI components
- `src/utils/` - Utility functions and helpers

### Key Architectural Patterns

**Authentication Flow:**
- `AuthContext` manages authentication state globally
- Route protection in `_layout.js` redirects based on auth state
- Supabase handles sessions with platform-specific storage adapters

**Platform-Specific Handling:**
- Storage: AsyncStorage (mobile) vs localStorage (web) with SSR safety
- Navigation: Drawer navigation with web PWA support
- Payment flow: Form submission (web) vs WebView (mobile)

**State Management:**
- React Context for global state (auth, network, theme)
- Local component state for UI-specific data
- Supabase real-time subscriptions for data synchronization

**Service Layer Pattern:**
- Services handle external API calls and business logic
- Contexts consume services and provide state to components
- Centralized error handling and logging

### Environment Configuration
- Environment variables configured in `app.config.js`
- Supabase credentials: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Google AI: `GOOGLE_API_KEY`
- Platform-specific configurations for iOS/Android bundle IDs

### Database Integration
- Supabase PostgreSQL with Row Level Security (RLS)
- Key tables: `profiles`, `documents`, `quizzes`
- Edge functions for payment processing and AI integration
- Storage buckets for document management

### Payment Integration
- Payfast integration for South African payments
- Subscription management with polling for status updates
- Edge functions: `generate-payfast-payment-data`, `handle-payfast-itn`

## Development Guidelines

### Testing
- Jest configured for React Native
- Test files in `src/tests/`
- Test service layer functions in isolation

### Logging
- Use `loggerService` for all logging
- Platform-aware logging (console in development, structured in production)
- Avoid console.log in production code

### Error Handling
- Implement error boundaries for React components
- Graceful degradation for network failures
- User-friendly error messages through centralized error handling

### Code Style
- ESLint configuration in `eslint.config.js`
- React Native specific rules enabled
- Single quotes, semicolons, 2-space indentation
- TypeScript-style linting for better code quality

### Platform Considerations
- SSR-safe code for web builds
- Platform-specific imports using `Platform.OS`
- Responsive design for different screen sizes
- PWA manifest configuration for web deployment

## Supabase Edge Functions
Located in `supabase/functions/`:
- `generate-payfast-payment-data/` - Creates payment forms
- `handle-payfast-itn/` - Processes payment notifications
- `handle-subscription-cancellation/` - Manages subscription cancellations

Deploy with: `supabase functions deploy [function-name]`

## Important Notes
- The app forces dark theme across all platforms
- Authentication is required for most app functionality
- Quiz generation is limited by monthly quotas for free users
- Document processing uses Google Gemini AI with content safety checks
- Payment processing is South Africa-specific (Payfast)