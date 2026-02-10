# Groundschool AI - Changelog

## Version 2.0.0 (February 2025) - Next.js Rebuild

### Major Changes
- Complete rebuild from React Native/Expo to Next.js 14+ with App Router
- Modern dark theme UI with glassmorphism, gradients, and hover effects
- Deployed to Vercel at groundschoolai.site

---

## Session Fixes - February 10, 2025

### UI/UX Improvements
- **Dark Theme Fix**: Fixed CSS variables to use proper `hsl()` function syntax
- **Question Selector**: Expanded options to 100 (5, 10, 15, 20, 25, 30, 40, 50, 75, 100) with content-dependent hint
- **Terminology Update**: Changed all front-facing "quiz/quizzes" to "exam/exams"

### Profile Page Enhancements
- Added **Captain's Club Membership Card** with plan status and benefits
- Added **My Activity** section showing exams taken, documents, and average score
- Added **Usage & Quotas** card with storage progress and monthly exam limits
- Added navigation links to Settings, Help & Support, and About pages

### New Pages Created
- `/settings` - Profile editing and password change functionality
- `/help` - Contact info and expandable FAQs
- `/about` - App info, version, and legal links
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy
- `/refund` - Refund Policy

### Supabase Schema Fixes
Fixed table and column names to match existing database schema:

#### Table: `questions` (was incorrectly `quiz_questions`)
| Column | Old (Wrong) | New (Correct) |
|--------|-------------|---------------|
| Table name | quiz_questions | questions |
| Question text | question_text | text |
| Correct answer | correct_answer_id | correct_answer |
| Added | - | correct_answer_index |
| Added | - | order_index |

#### Table: `quizzes`
| Column | Old (Wrong) | New (Correct) |
|--------|-------------|---------------|
| Document reference | document_id | document_ids (array) |
| Added | - | status |
| Added | - | created_at (explicit) |

#### Table: `quiz_attempts`
| Column | Old (Wrong) | New (Correct) |
|--------|-------------|---------------|
| total_questions | direct column | moved to metadata |
| answers | direct column | moved to metadata |
| Added | - | attempted_at (explicit) |

### Production Error Handling
- Removed all `console.log` and `console.error` statements
- User-facing error messages are now friendly and non-technical
- Technical details no longer exposed to users

### Files Modified
- `src/app/(app)/quiz/[id]/page.tsx` - Exam taking page
- `src/app/(app)/quizzes/page.tsx` - Exam list page
- `src/app/(app)/dashboard/page.tsx` - Dashboard
- `src/app/(app)/profile/page.tsx` - Profile page
- `src/app/api/generate-quiz/route.ts` - Quiz generation API
- `src/components/layout/sidebar.tsx` - Navigation sidebar
- `src/components/providers/auth-provider.tsx` - Auth context
- `src/lib/types.ts` - TypeScript interfaces
- `src/app/globals.css` - Dark theme CSS variables

---

## Known Issues
- None currently reported

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
GOOGLE_API_KEY=
```
