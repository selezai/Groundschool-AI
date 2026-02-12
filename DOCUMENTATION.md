# Groundschool AI — Documentation

## Overview
AI-powered aviation exam preparation web app. Upload study materials, generate practice quizzes with AI, and track your progress.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth & DB**: Supabase (SSR via @supabase/ssr)
- **AI**: Groq (primary, Llama 4 Scout 17B multimodal) + Google Gemini 2.0 Flash (fallback)
- **Payments**: PayFast (via Supabase Edge Functions)
- **Deployment**: Vercel
- **Domain**: groundschoolai.site

## Architecture

### Directory Structure
```
src/
├── app/
│   ├── (app)/              # Authenticated routes (sidebar layout)
│   │   ├── dashboard/      # Document upload, storage, quiz generation
│   │   ├── quizzes/        # Quiz history list
│   │   ├── quiz/[id]/      # Take/review a quiz
│   │   ├── profile/        # User profile, account management
│   │   ├── captains-club/  # Subscription upgrade page
│   │   └── settings/       # App settings
│   ├── api/
│   │   └── generate-quiz/  # Server-side AI quiz generation
│   ├── auth/callback/      # Supabase auth callback
│   ├── login/              # Login/register page
│   └── layout.tsx          # Root layout (dark mode, AuthProvider, Toaster)
├── components/
│   ├── layout/sidebar.tsx  # Navigation sidebar
│   ├── providers/auth-provider.tsx  # Auth context
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── supabase/           # Supabase client (browser, server, middleware)
│   ├── constants.ts        # Plan limits, formatBytes
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # cn() utility
middleware.ts               # Auth route protection
supabase/                   # Edge Functions (PayFast, account deletion)
```

### Auth Flow
1. Middleware checks auth on every request
2. Unauthenticated users → `/login`
3. Authenticated users on auth pages → `/dashboard`
4. Root `/` → redirects based on auth state
5. Supabase SSR handles cookies for session persistence

### AI Quiz Generation
- **API Route**: `/api/generate-quiz` (server-side, API keys never exposed)
- **Primary**: Groq REST API (Llama 4 Scout 17B, multimodal — text + images)
- **Fallback**: Google Gemini 2.0 Flash (multimodal)
- Documents downloaded from Supabase Storage **in parallel** via `Promise.all`
- PDFs → text extraction via `unpdf`; images → base64 for multimodal AI (capped at 4MB per image)
- Text truncated to 30,000 chars per document
- Questions normalized to `{question_text, options[], correct_answer_id, explanation}`
- **Rate limited**: 1 request per 30 seconds per user (in-memory)
- **Timeouts**: 50-second AbortController on both AI providers
- **Quota enforced server-side**: basic plan = 5 quizzes/month, auto-resets monthly

### PayFast Integration
- Edge Functions in `supabase/functions/` handle payment data generation and ITN webhooks
- Captain's Club subscription: R99/month
- Web: form POST redirect to PayFast
- Webhook updates `profiles.plan` in Supabase

## Supabase Tables
| Table | Purpose |
|-------|---------|
| profiles | User profile, plan, storage, quotas |
| documents | Uploaded study materials metadata |
| quizzes | Generated quiz records |
| quiz_questions | Individual questions per quiz |
| quiz_attempts | User quiz attempt scores |

## Environment Variables
| Variable | Where | Purpose |
|----------|-------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Client + Server | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Client + Server | Supabase anon key |
| GROQ_API_KEY | Server only | Groq AI API key |
| GOOGLE_API_KEY | Server only | Gemini AI API key |
| NEXT_PUBLIC_AUTO_UPGRADE_NEW_USERS | Client | Auto-upgrade new users to Captain's Club |

## Plans
| Plan | Storage | Quizzes/month | Past Exams |
|------|---------|---------------|------------|
| Basic | 100MB | 5 | No |
| Captain's Club | 500MB | Unlimited | Yes |

## Decisions Log
- **2025-02-13**: Security & reliability audit — **all 20 items (P0–P3) resolved**
  - **Upload hardening**: 25MB per-file limit, .doc/.docx rejected, orphaned storage files cleaned up on DB failure
  - **Upload progress**: Real byte-level progress via XHR to Supabase Storage REST API
  - **Server-side upload validation**: New `/api/validate-upload` route checks quota, file size, and extension before upload
  - **Delete safety**: DB record deleted first, then storage (prevents ghost records)
  - **Quiz quota enforcement**: Server-side check of `monthly_quizzes_remaining` in `/api/generate-quiz`, auto-resets monthly
  - **Rate limiting**: In-memory 30s cooldown per user on quiz generation
  - **Auth hardening**: `userId` derived from session, never from request body
  - **AI timeouts**: 50s AbortController on Groq and Gemini calls
  - **Image processing**: Images resized to 1024px max via `sharp`, converted to JPEG 80% quality before AI
  - **Parallel fetching**: Documents fetched concurrently via `Promise.all` instead of sequential loop
  - **N+1 elimination**: Quiz title built from already-fetched content, no extra DB queries
  - **Safe quiz insert**: Quiz created with `generating` status, set to `active` only after questions succeed
  - **Error handling**: Quiz attempt save warns user on failure; profile creation failure returns error
  - **Structured logging**: `[quiz-gen]` prefixed logs at every decision point for Vercel Logs
  - **Pagination**: Documents and quizzes lists show 20 at a time with "Show More"
  - **Quizzes filter**: Only `active` quizzes shown in list (hides failed `generating` records)
  - **See**: `AUDIT.md` for full audit findings

- **2025-02-09**: Complete rebuild from React Native/Expo to pure Next.js web app
  - **Reason**: iOS Safari white screen caused by incompatible React Native web libraries (navigator.locks, react-native-reanimated, react-native-svg). Multiple fix attempts failed. Clean Next.js build eliminates all RN-web compatibility issues.
  - **Preserved**: Same Supabase project, same Edge Functions, same PayFast integration, same domain
  - **Removed**: PostHog analytics (per user request), React Native, Expo, Metro bundler
  - **Added**: Next.js 16, Tailwind CSS, shadcn/ui, @supabase/ssr, middleware auth
