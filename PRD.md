# Product Requirements Document (PRD)

## GroundSchool AI

**Version:** 1.1.1  
**Last Updated:** May 23, 2024  
**Status:** Revised Draft  
**Logo Location:** The app's logo is located on the Desktop at `logo.png`.

## Table of Contents

1. [Introduction](#introduction)
2. [Product Overview](#product-overview)
3. [Market Analysis](#market-analysis)
4. [Target Users](#target-users)
5. [User Stories](#user-stories)
6. [Functional Requirements](#functional-requirements)
7. [Non-Functional Requirements](#non-functional-requirements)
8. [User Interface](#user-interface)
9. [Technical Architecture](#technical-architecture)
10. [Data Management](#data-management)
11. [Integration Requirements](#integration-requirements)
12. [Risk Assessment](#risk-assessment)
13. [Deployment Strategy](#deployment-strategy)
14. [Success Metrics](#success-metrics)
15. [Monetization Strategy](#monetization-strategy)
16. [Future Enhancements](#future-enhancements)
17. [Appendix](#appendix)

## Introduction

GroundSchool AI is a mobile and web application designed to help aviation students prepare for exams by generating SACAA-style multiple-choice questions based on their study materials. The app uses AI to create relevant, context-specific questions that help students test their knowledge and identify areas for improvement.

### Problem Statement

Aviation students face challenges in effectively preparing for exams:
- Expensive commercial study apps that charge per exam or subject
- Limited access to practice questions specific to their study materials
- Generic practice tests that don't target their specific learning needs
- Difficulty in identifying knowledge gaps in complex aviation subjects
- Time-consuming process of creating self-test questions

### Solution

GroundSchool AI addresses these challenges by providing a cost-effective alternative that:
- Allows students to upload their own study materials (PDF or Images) for free
- Uses AI to generate relevant, SACAA-style multiple-choice questions
- Provides immediate feedback on answers
- Tracks progress over time to identify areas for improvement
- Offers offline access to previously generated quizzes

## Product Overview

### Core Features

1. **Cost-Effective Learning**: Generate unlimited practice questions from your own materials for a fraction of the cost of commercial apps
2. **Document Upload**: Upload PDF or Image study materials for analysis. 
3. **AI-Generated Questions**: Create SACAA-style multiple-choice questions based on uploaded content.
4. **Quiz Taking**: Answer questions with immediate feedback
5. **Progress Tracking**: View quiz history and performance analytics
6. **Offline Support**: Access previously generated quizzes without internet connection
7. **Progressive Web App (PWA)**: 
   - Available on iOS, Android, and Web
   - Enables easy user testing via a single web link
   - Free access during user testing phase
   - Seamless transition to native apps when ready

### Value Proposition

GroundSchool AI transforms passive reading into active learning by generating targeted questions from students' own study materials, helping them identify knowledge gaps and improve retention through active recall - all at a fraction of the cost of traditional study apps. The PWA approach allows for easy user testing and feedback collection before full native app release.

## Market Analysis

### Competitive Landscape

| Competitor | Pricing Model | Key Features | Limitations |
|------------|---------------|--------------|------------|
| PrepWare | ZAR 1420 per exam | Pre-made question bank, Performance tracking | Cannot use own materials, High per-exam cost |
| ASA Test Prep | ZAR 950-ZAR 1890 per subject | Comprehensive study guides, Professional content | Limited customization, No AI-powered content |
| Dauntless Aviation | ZAR 570-ZAR 3780 per package | Extensive question banks, Cross-platform | Cannot generate questions from custom material |
| Sporty's Study Buddy | ZAR 280-ZAR 950 per test | Official FAA questions, Good interface | Limited to FAA content only |

### Market Size & Opportunity

- **Total Addressable Market**: 250,000 aviation students globally
- **Target Market**: 75,000 SACAA and similar certification students
- **Initial Target**: 5,000 South African aviation students

### Competitive Advantages

1. **AI-Powered Content Generation**: Unique ability to create custom questions from user materials
2. **Cost Efficiency**: Significantly lower cost than competitors with subscription model
3. **Personalization**: Questions tailored to individual study materials
4. **Offline Functionality**: Complete access to generated quizzes without internet
5. **Cross-Platform Availability**: Seamless experience across web and mobile

## User Testing Phase

### Testing Strategy

1. **Initial Testing Phase**
   - Duration: 3 months
   - Access: Free via PWA link
   - Purpose: Gather user feedback and identify areas for improvement
   - Features: Full access to all core features

2. **Testing Objectives**
   - Validate AI-generated question quality
   - Test document upload and processing
   - Evaluate quiz generation accuracy
   - Gather user feedback on interface and usability
   - Test offline functionality

3. **User Recruitment**
   - Target: 100 active aviation students
   - Access: Single PWA link shared with testers
   - Support: Dedicated support channel for feedback

### Post-Testing

1. **Data Collection**
   - User feedback and suggestions
   - Performance metrics
   - Bug reports
   - Feature requests

2. **Improvement Cycle**
   - Analyze testing data
   - Implement improvements
   - Prepare for native app release

## Target Users

### Primary Users

- **Aviation Students**: Individuals studying for SACAA exams or other aviation certifications
- **Flight Instructors**: Professionals who want to create custom quizzes for their students
- **Aviation Enthusiasts**: Hobbyists looking to test their aviation knowledge

### User Personas

#### Student Pilot - Thabo

- **Demographics**: 24-year-old student pilot, works part-time, studies for PPL
- **Technology**: Moderately tech-savvy, uses Android smartphone and Windows laptop
- **Study Habits**: Studies between flights and after work, 10-15 hours weekly
- **Pain Points**: Limited budget for study materials, difficulty identifying knowledge gaps
- **Goals**: Pass PPL exams on first attempt, efficient use of study time
- **Needs**: Quick access to relevant practice questions, ability to focus on weak areas, affordable solution

#### Flight Instructor - Sarah

- **Demographics**: 35-year-old flight instructor with 10 years of experience, teaches at flight school
- **Technology**: Tech-savvy, uses iPad Pro and MacBook, creates digital teaching materials
- **Work Pattern**: Creates lesson plans weekly, provides supplementary materials to students
- **Pain Points**: Time-consuming to create practice tests, difficulty tracking student progress
- **Goals**: Improve student pass rates, reduce preparation time
- **Needs**: Tool to generate questions from her teaching materials, track student progress, customizable quizzes

#### Aviation Enthusiast - Michael

- **Demographics**: 45-year-old business professional, aviation enthusiast for 15 years
- **Technology**: Average tech user, primarily uses iPhone and occasionally laptop
- **Study Habits**: Studies aviation topics during commutes and weekends, often while traveling
- **Pain Points**: Limited connectivity while traveling, casual learning without structure
- **Goals**: Expand aviation knowledge, possible recreational pilot license in future
- **Needs**: Casual learning tool that works offline during flights, no pressure learning environment

## User Stories

### Document Management

1. **[MUST]** As a student, I want to upload my study materials (PDFs or images) so that I can generate relevant practice questions.
   - **Acceptance Criteria**:
     - System accepts PDF files up to 10MB 
     - System accepts JPG, PNG images up to 5MB each 
     - Upload progress is displayed.
     - Confirmation message appears when upload completes.
     - Uploaded documents appear in document library.

2. **[DEFERRED]** As an instructor, I want to generate quizzes from multiple documents at once so that I can create comprehensive practice tests.
   - **Acceptance Criteria (Future)**:
     - Multiple document selection is available in the UI.
     - Selected documents are visibly highlighted.
     - System attempts to combine content from selected documents for AI processing.
     - Generated quiz questions aim to cover material from all selected documents.

3. **[MUST]** As a user, I want to see the status of my quiz generation process so that I can track progress.
   - **Acceptance Criteria**:
     - Progress bar shows percentage complete.
     - Estimated time remaining is displayed.
     - User can cancel process at any time.
     - Notification when process completes.

4. **[MUST]** As a student, I want to specify the number of questions for my quiz, and have the AI generate them at appropriate difficulty levels based on my study material, so that I can focus on targeted learning.
   - **Acceptance Criteria**:
     - User interface allows input for the desired number of questions (e.g., 5-50, configurable by user within reasonable system limits).
     - System analyzes document content 
     - AI attempts to generate the user-specified number of questions.
     - AI attempts to balance difficulty distribution (e.g., easy, medium, hard) for the generated questions.

5. **[MUST]** As a student, I want to receive immediate feedback on my answers so that I can learn from my mistakes.
   - **Acceptance Criteria**:
     - Correct/incorrect status shown immediately after answering.
     - Correct answer highlighted if user answer was incorrect.
     - Explanation provided for correct answer.
     - Option to continue to next question.

6. **[DEFERRED]** As a user, I want to generate quizzes that combine content from multiple documents so that I can test comprehensive knowledge. (Duplicate of Story 2, also DEFERRED)
   - **Acceptance Criteria (Future)**:
     - Interface allows selection of multiple documents for quiz generation.
     - Generated questions aim to reference content from all selected documents.
     - System attempts to maintain context across document boundaries during AI processing.

### Quiz Taking

7. **[MUST]** As a student, I want to receive immediate feedback on my answers so that I can learn from mistakes.
   - **Acceptance Criteria**:
     - Correct/incorrect status shown immediately after answering.
     - Correct answer highlighted if user answer was incorrect.
     - Explanation provided for correct answer.
     - Option to continue to next question.

8. **[MUST]** As a user, I want to see explanations for correct answers so that I can understand concepts better.
   - **Acceptance Criteria**:
     - Explanation text is clear and concise.
     - Explanation references relevant sections from source material.
     - Option to view more detailed explanation if available.
     - Reference to page/section in original document when applicable.

9. **[SHOULD]** As a student, I want to flag difficult questions for later review so that I can focus on challenging areas.
   - **Acceptance Criteria**:
     - Flag/bookmark icon is easily accessible.
     - Flagged questions are saved to user account.
     - Separate view to access all flagged questions.
     - Option to unflag questions.

### Progress Tracking

10. **[MUST]** As a student, I want to view my quiz history so that I can track my progress over time.
    - **Acceptance Criteria**:
      - List of completed quizzes with dates.
      - Score for each quiz displayed.
      - Filter options (date, score, subject).
      - Option to retake any previous quiz.

11. **[SHOULD]** As an instructor, I want to see analytics on common mistakes so that I can address knowledge gaps.
    - **Acceptance Criteria**:
      - Heatmap of question difficulty.
      - Most frequently missed questions highlighted.
      - Topics with lowest performance identified.
      - Data exportable in CSV format.

12. **[SHOULD]** As a user, I want to see performance trends by topic so that I can focus my study efforts.
    - **Acceptance Criteria**:
      - Graph showing performance over time.
      - Performance breakdown by topic area.
      - Recommendations for areas to study.
      - Comparison to previous performance periods.

### Account Management

13. **[MUST]** As a user, I want to create an account so that I can save my progress across devices.
    - **Acceptance Criteria**:
      - Email verification process works.
      - Password requirements are clear.
      - Account creation takes less than 1 minute.
      - Success confirmation is displayed.

14. **[MUST]** As a user, I want to reset my password so that I can regain access if forgotten.
    - **Acceptance Criteria**:
      - Password reset email sends within 1 minute.
      - Reset link is valid for 24 hours.
      - New password meets security requirements.
      - Confirmation of password change is sent.

15. **[SHOULD]** As a user, I want to update my profile information so that my account reflects current details.
    - **Acceptance Criteria**:
      - All profile fields are editable.
      - Changes save successfully.
      - Email change requires verification.
      - Confirmation of updates is displayed.

## Functional Requirements

### Priority Levels
- **P0**: Must have for MVP launch
- **P1**: Should have for MVP launch
- **P2**: Nice to have, can be added post-launch
- **P3**: Future enhancement

### User Authentication

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR1.1 | Users shall be able to register using email/password | P0 | Email verification process works; Password requirements are enforced; Registration completes in <30 seconds |
| FR1.2 | Users shall be able to log in using email/password | P0 | Login process takes <5 seconds; Failed login provides appropriate error message; Session persists according to user preference |
| FR1.3 | Users shall be able to reset their password via email | P0 | Reset email arrives within 1 minute; Link expires after 24 hours; New password must meet security requirements |
| FR1.4 | Users shall be able to log out from any screen | P0 | Logout button is accessible from main menu; Confirmation dialog prevents accidental logout; Session terminates immediately |
| FR1.5 | Users shall be able to use the app in guest mode with limited features | P1 | Guest can take sample quizzes; Access to core features without registration; Clear upgrade path to full account |

### Document Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR2.1 | Users shall be able to upload PDF documents or images up to 10MB in size for quiz generation | P0 | System accepts files within size limits; Progress indicator shows upload status; Error messages for failed uploads are clear |
| FR2.2 | Users shall be able to view the status of their quiz generation process | P0 | Progress percentage displayed; Estimated completion time shown; Status updates in real-time |
| FR2.3 | Users shall be able to cancel ongoing quiz generation processes | P1 | Cancel button is easily accessible; System confirms cancellation; Resources are properly released |
| FR2.4 | Users shall be able to combine multiple documents for quiz generation | P2 | (Future) Interface allows multiple selection; (Future) Preview shows all selected documents; (Future) Clear indication of combined content for AI processing |
| FR2.5 | Users shall be able to see estimated time for quiz generation based on document size | P1 | Estimate appears before confirmation; Estimate is accurate within 25%; Updates as process proceeds |

### Quiz Generation

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR3.1 | Users shall be able to generate quizzes from one or more documents | P0 | Interface guides document selection; Generation starts with single click; Success/failure notification provided |
| FR3.2 | The AI shall automatically determine the appropriate number of questions (5-100) based on the amount and complexity of study materials | P0 | Question count scales with content; User can override suggested count; Minimum of 5 questions per quiz |
| FR3.3 | The AI shall automatically balance the difficulty levels (Easy, Medium, Hard) within each quiz based on content complexity | P1 | Difficulty distribution is approximately 30/40/30; Difficulty indicated for each question; Overall difficulty matches content complexity |
| FR3.4 | The system shall generate SACAA-style multiple-choice questions with 4 options | P0 | All questions follow SACAA format; Each question has exactly 4 options; Only one option is correct |
| FR3.5 | The system shall provide explanations for correct answers | P0 | Every question includes explanation; Explanations reference source material; Explanations are concise and clear |

### Quiz Taking

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR4.1 | Users shall be able to select one answer per question | P0 | Selection is clearly highlighted; Change is possible before submission; Only one option can be selected |
| FR4.2 | Users shall receive immediate feedback on their answer | P0 | Feedback appears within 1 second; Correct/incorrect status clearly shown; Visual indication of correct answer |
| FR4.3 | Users shall be able to see the explanation for the correct answer | P0 | Explanation visible after answering; Text is readable on all devices; Reference to source material included |
| FR4.4 | Users shall be able to navigate between questions | P0 | Next/previous buttons work; Question number indicator shows progress; Can jump to specific questions |
| FR4.5 | Users shall be able to flag difficult questions for later review so that I can focus on challenging areas | P1 | Flag icon is easily accessible; Flagged questions are saved to user account; Separate view to access all flagged questions |
| FR4.6 | Users shall be able to see their score upon completion | P0 | Final percentage shown; Breakdown by topic provided; Option to review incorrect answers; Option to retake quiz |

### Progress Tracking

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR5.1 | Users shall be able to view their quiz history | P0 | Complete list of taken quizzes with dates; Score for each quiz displayed; Filter options (date, score, subject); Option to retake quizzes |
| FR5.2 | Users shall be able to see performance analytics by subject | P1 | Visual graphs of performance; Topic-by-topic breakdown; Trend analysis over time; Data exportable in CSV format |
| FR5.3 | Users shall be able to identify their weakest topics | P1 | Topics ranked by performance; Visual indicators of weak areas; Recommendations for areas to study; Links to relevant quizzes |
| FR5.4 | Users shall be able to track improvement over time | P1 | Historical performance graph; Weekly/monthly trend analysis; Comparison to previous periods; Goal setting and tracking |
| FR5.5 | Users shall be able to review previously answered questions | P0 | Access to all past questions; Filter by correct/incorrect; Sort by difficulty or date; Notes can be added to questions |

### Offline Support

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR6.1 | Users shall be able to access generated quizzes offline | P0 | Previously loaded quizzes available offline; Clear indication of offline status; No functionality loss for cached content |
| FR6.2 | Users shall be able to take quizzes offline | P0 | All quiz features work offline; Answers and progress saved locally; No internet connectivity required |
| FR6.3 | The system shall sync results when connection is restored | P1 | Automatic sync when online; Sync status indicator; Conflict resolution for concurrent changes; Manual sync option |

## Non-Functional Requirements

### Performance

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR1.1 | The app shall load within 3 seconds on standard mobile connections | P0 | Initial load ≤3s on 4G; Subsequent loads ≤1.5s; Loading indicator for operations >1s |
| NFR1.2 | Quiz generation shall complete within 10 seconds | P1 | Average generation time ≤10s; Progress indicator for longer operations; Background processing option for large documents |
| NFR1.3 | The system shall support up to 10,000 concurrent users | P1 | Response time remains <3s at peak load; No service degradation at 10,000 users; Auto-scaling triggers at 7,500 users |
| NFR1.4 | Document upload shall process at least 1MB per second | P0 | Upload speed ≥1MB/s on 4G connection; Progress indicator shows real-time status; Timeout recovery mechanism in place |

### Reliability

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR2.1 | The system shall have 99.9% uptime | P0 | Monthly downtime <45 minutes; Planned maintenance during low usage hours; Status page for outage communication |
| NFR2.2 | The system shall recover from crashes without data loss | P0 | Auto-save quiz progress every 30 seconds; Session recovery after app restart; All user data persisted to storage immediately |
| NFR2.3 | All user data shall be backed up daily | P0 | Daily backups of all databases; Backup retention of 30 days; Recovery testing performed monthly; Recovery time <4 hours |

### Security

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR3.1 | All user data shall be encrypted in transit and at rest | P0 | TLS 1.3 for all connections; AES-256 encryption for stored data; Key rotation every 90 days; Security audit passed |
| NFR3.2 | User passwords shall be hashed using bcrypt | P0 | BCrypt with work factor ≥12; No plaintext passwords in logs; Password policy enforced (8+ chars, 1 uppercase, 1 number) |
| NFR3.3 | The system shall implement rate limiting for authentication attempts | P0 | Max 5 failed attempts in 15 minutes; Account lockout after excessive attempts; Email notification of suspicious activity |
| NFR3.4 | The system shall comply with GDPR requirements | P0 | Data export functionality; Right to be forgotten implemented; Privacy policy clearly displayed; Data processing agreement available |

### Usability

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR4.1 | The app shall be usable by people with no technical background | P0 | 90% of usability test tasks completed successfully; Average task completion time <30 seconds; SUS score >80 |
| NFR4.2 | The app shall be accessible according to WCAG 2.1 AA standards | P1 | All images have alt text; Color contrast ratio ≥4.5:1; Keyboard navigation works for all features; Screen reader compatibility verified |
| NFR4.3 | The app shall support both light and dark modes | P1 | Mode toggle easily accessible; System preference detection; Consistent color scheme in both modes; No readability issues in either mode |
| NFR4.4 | The app shall be fully responsive on devices from 320px to 1920px width | P0 | All features functional at all sizes; No horizontal scrolling; Touch targets ≥44px; Font sizes readable without zooming |

### Compatibility

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR5.1 | The mobile app shall support iOS 14+ and Android 10+ | P0 | All features work on minimum supported versions; Performance testing on entry-level devices passed; Battery usage <3% per hour of active use |
| NFR5.2 | The web app shall support Chrome, Firefox, Safari, and Edge (latest 2 versions) | P0 | All features work in supported browsers; Visual consistency across browsers; Performance within 10% across browsers |
| NFR5.3 | The PWA shall work offline on supported browsers | P0 | Service worker caches essential resources; Offline mode clearly indicated; Data syncs when connection restored; Clear offline status indicator |

## User Interface

### Design Principles

- Clean, minimalist interface with focus on content
- Consistent color scheme and typography
- Intuitive navigation with minimal learning curve
- Responsive design that works across all device sizes
- Accessibility built into core experience

### Key Screens

#### 1. Login/Registration
![Login Screen Wireframe](/api/placeholder/400/240)
- Simple form with email/password fields
- Social login options
- Guest mode access
- Password reset option
- Registration form with minimal required fields

#### 2. Home Dashboard
![Dashboard Wireframe](/api/placeholder/400/240)
- Recent activity summary
- Quick access to document upload
- Recently generated quizzes
- Performance summary
- Quick start quiz button

#### 3. Document Upload
![Upload Screen Wireframe](/api/placeholder/400/240)
- Drag-and-drop interface
- File browser button
- Upload progress indicator
- File size limitations clearly displayed
- Support for multiple file selection

#### 4. Document Library
![Library Wireframe](/api/placeholder/400/240)
- Grid/list view toggle
- Search and filter options
- Document preview thumbnails
- Selection mode for multiple documents
- Quick actions (delete, generate quiz, share)

#### 5. Quiz Generation
![Quiz Generation Wireframe](/api/placeholder/400/240)
- Document selection interface
- Quiz parameters configuration
- Estimated generation time
- Progress indicator during generation
- Cancel option

#### 6. Quiz Taking
![Quiz Screen Wireframe](/api/placeholder/400/240)
- Clean question display
- Answer options clearly distinguished
- Navigation controls
- Progress indicator
- Flag/bookmark option
- Time remaining (if timed quiz)

#### 7. Results Screen
![Results Wireframe](/api/placeholder/400/240)
- Overall score prominently displayed
- Performance breakdown by topic
- Comparison to previous attempts
- Options to review questions or retake quiz
- Share results option

#### 8. Progress Analytics
![Analytics Wireframe](/api/placeholder/400/240)
- Performance over time graph
- Topic mastery visualization
- Weak areas highlight
- Recommended focus areas
- Export options

#### 9. Settings
![Settings Wireframe](/api/placeholder/400/240)
- Account management options
- Notification preferences
- Theme selection (dark mode enforced)
- Offline mode settings
- Privacy controls

### User Flows

#### Document Upload to Quiz Taking Flow
![User Flow - Document to Quiz](/api/placeholder/500/240)
1. User uploads document(s)
2. System processes document(s)
3. Quiz generation options presented
4. System generates quiz
5. User takes quiz
6. Results displayed

#### Account Creation Flow
![User Flow - Account Creation](/api/placeholder/500/240)
1. User selects "Create Account"
2. User enters email and password
3. User verifies email
4. User completes profile
5. Welcome screen with tutorial option

#### Quiz History to Retake Flow
![User Flow - Quiz History](/api/placeholder/500/240)
1. User navigates to History
2. User views past performance
3. User selects quiz to retake
4. System regenerates quiz
5. User takes quiz again
6. Results compare original vs. current attempt

## Technical Architecture

### Platform Requirements

- **SDK Version**: Expo SDK 52
- **React Native**: Compatible with Expo SDK 52
- **React**: Compatible with Expo SDK 52
- **Next.js**: Version 14 (compatible with Expo SDK 52)

### Key Dependencies

1. **Expo SDK 52**
   - All dependencies are compatible with SDK 52
   - No deprecated APIs are used
   - All native modules are up to date

2. **React Native**
   - All components are compatible with SDK 52
   - No conflicting native modules
   - All third-party libraries are SDK 52 compatible

3. **Supabase**
   - Latest version compatible with SDK 52
   - All storage and authentication features tested
   - Offline support verified

4. **Google Gemini 2.5 Pro Preview**
   - Integration tested with SDK 52
   - No deprecated API usage
   - All features compatible with SDK 52

### Technical Stack

1. **Frontend**
   - React Native (SDK 52 compatible)
   - Expo SDK 52
   - React Navigation (SDK 52 compatible)
   - React Native Paper (SDK 52 compatible)

2. **Backend**
   - Supabase (SDK 52 compatible)
   - Google Gemini 2.5 Pro Preview API
   - Sentry for error tracking

3. **Storage**
   - Supabase Storage (SDK 52 compatible)
   - Local storage for offline support

### Architecture Diagram

![Architecture Diagram](/api/placeholder/600/300)

### Integration Points

1. **Document Upload**
   - Uses SDK 52 compatible file handling
   - Implements latest SDK 52 storage APIs
   - Handles both PDF and image uploads

2. **AI Integration**
   - Uses SDK 52 compatible networking
   - Implements latest SDK 52 API handling
   - Handles offline support

3. **Offline Support**
   - Uses SDK 52 compatible caching
   - Implements latest SDK 52 storage features
   - Handles sync operations

### Testing Requirements

- All features must be tested with Expo SDK 52
- No deprecated APIs should be used
- All native modules must be SDK 52 compatible
- Offline functionality must work with SDK 52 storage

## Data Management

### Data Entities

1. **User**:
   - ID, email, password (hashed), name, created_at, last_login
   - Relationships: One-to-many with Quiz, QuizAttempt
   - Constraints: Unique email, password requirements

2. **Quiz**:
   - ID, user_id, title, document_ids, question_count, difficulty, created_at
   - Relationships: Many-to-one with User, One-to-many with Question, One-to-many with QuizAttempt
   - Constraints: Valid user_id, question_count between 5-100

3. **Question**:
   - ID, quiz_id, text, options (JSON array), correct_answer_index, explanation, image_url (nullable), topic, difficulty
   - Relationships: Many-to-one with Quiz, One-to-many with QuestionResponse
   - Constraints: Valid quiz_id, 4 options per question, correct_answer_index between 0-3

4. **QuizAttempt**:
   - ID, user_id, quiz_id, score, completed_at, duration, is_complete
   - Relationships: Many-to-one with User, Many-to-one with Quiz, One-to-many with QuestionResponse
   - Constraints: Valid user_id and quiz_id, score between 0-100

5. **QuestionResponse**:
   - ID, quiz_attempt_id, question_id, selected_answer_index, is_correct, time_taken
   - Relationships: Many-to-one with QuizAttempt, Many-to-one with Question
   - Constraints: Valid quiz_attempt_id and question_id, selected_answer_index between 0-3

### Database Schema

```
Table Users {
  id UUID [pk]
  email VARCHAR [unique, not null]
  password_hash VARCHAR [not null]
  name VARCHAR
  created_at TIMESTAMP [default: `now()`]
  last_login TIMESTAMP
}

Table Quizzes {
  id UUID [pk]
  user_id UUID [ref: > Users.id]
  title VARCHAR [not null]
  document_ids TEXT[] [not null]
  question_count INTEGER [not null]  -- Range: 5-100
  difficulty VARCHAR [not null]
  created_at TIMESTAMP [default: `now()`]
}

Table Questions {
  id UUID [pk]
  quiz_id UUID [ref: > Quizzes.id]
  text TEXT [not null]
  options JSONB [not null]
  correct_answer_index INTEGER [not null]
  explanation TEXT [not null]
  image_url VARCHAR
  topic VARCHAR
  difficulty VARCHAR [not null]
}

Table QuizAttempts {
  id UUID [pk]
  user_id UUID [ref: > Users.id]
  quiz_id UUID [ref: > Quizzes.id]
  score DECIMAL [not null]
  completed_at TIMESTAMP
  duration INTEGER
  is_complete BOOLEAN [default: false]
}

Table QuestionResponses {
  id UUID [pk]
  quiz_attempt_id UUID [ref: > QuizAttempts.id]
  question_id UUID [ref: > Questions.id]
  selected_answer_index INTEGER
  is_correct BOOLEAN
  time_taken INTEGER
}

Table Documents {
  id UUID [pk]
  user_id UUID [ref: > Users.id]
  name VARCHAR [not null]
  file_path VARCHAR [not null]
  file_size INTEGER [not null]
  file_type VARCHAR [not null]
  uploaded_at TIMESTAMP [default: `now()`]
  processed BOOLEAN [default: false]
  processing_error VARCHAR
}
```

The application will manage user data, uploaded documents, generated quizzes, and user progress. Data will be stored securely in Supabase.

Key data entities include:

1.  **`auth.users` (Supabase Managed)**:
    *   Stores core user authentication information (ID, email, encrypted password, etc.).

2.  **`profiles`**:
    *   Stores additional public user information (username, full name, avatar URL) linked to `auth.users`.

3.  **`documents`**:
    *   Stores metadata about user-uploaded study materials (title, file path in Supabase Storage, document type, etc.).
    *   Includes extracted text `content` for AI processing. **Crucial Note:** For PDF documents, this `content` field currently holds placeholder text due to limitations in the PDF text extraction service. Image OCR provides functional text extraction.

4.  **`quizzes`**:
    *   Stores metadata for quizzes generated from documents (title, number of questions, associated user and document IDs).

5.  **`quiz_questions`** (Primary table for online quiz questions):
    *   Stores individual questions belonging to a quiz (text, options, correct answer, explanation).
    *   **Note on `correct_answer` field:** The AI may provide this as text or an index. Consistency in generation and checking logic is vital.
    *   **Note on `questions` table variant:** The `offlineService.js` might use a slightly different schema or table named `questions` for caching/syncing, potentially with `correct_answer_index`. This discrepancy needs to be resolved or carefully managed to ensure data integrity between online and offline states.

6.  **`quiz_attempts`**:
    *   Stores records of user attempts at quizzes (user ID, quiz ID, score, selected answers, completion date).

Data integrity will be maintained through proper relationships and validation. User data privacy will be ensured through Supabase's security features and RLS policies.

Refer to **Appendix A of the GroundSchool AI Implementation Guide** for a more detailed schema, including column specifics and relationships.

## Integration Requirements

### Google Gemini 2.5 Pro Preview Integration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| IR1.1 | The system shall integrate with Google Gemini 2.5 Pro Preview API for question generation | P0 | API credentials securely stored; Requests properly authenticated; Response handling includes error cases |
| IR1.2 | The system shall send document text and receive structured question data | P0 | Text extraction works for PDF and images; Structured JSON response parsed correctly; Question format validation implemented |
| IR1.3 | The system shall handle API rate limits and errors gracefully | P0 | Exponential backoff for rate limits; User-friendly error messages; Logging of API errors for troubleshooting |
| IR1.4 | The system shall implement caching to reduce API calls | P1 | Cache hit rate >50%; TTL of 24 hours for cached responses; Cache invalidation when source document changes |

### Supabase Integration (continued)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| IR2.2 | The system shall use Supabase for database storage | P0 | Database schema implemented; CRUD operations working; Indexes optimized for query performance; Row-level security implemented |
| IR2.3 | The system shall use Supabase for file storage | P0 | File upload works for all supported formats; Download speed meets performance requirements; Access controls prevent unauthorized access |

### PWA Integration

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| IR3.1 | The system shall implement PWA capabilities for web access | P0 | Passes Lighthouse PWA audit; Install prompt appears appropriately; App icon and splash screen implemented |
| IR3.2 | The system shall maintain offline functionality in PWA mode | P0 | Service worker caches critical resources; Offline mode clearly indicated; Data syncs when connection restored |
| IR3.3 | The system shall provide easy installation options for PWA | P1 | Install prompt appears at appropriate times; Installation flow is simple; PWA behaves like native app after installation |
| IR3.4 | The system shall support deep linking for user testing | P1 | Links direct to specific content; Invitation links work for testing; Analytics track deep link usage |
| IR3.5 | The system shall maintain data sync between PWA and native apps | P2 | User data consistent across platforms; Seamless transition between platforms; Sync conflicts resolved automatically |

## Risk Assessment

### Technical Risks

| Risk | Impact (1-5) | Probability (1-5) | Risk Score | Mitigation Strategy | Owner |
|------|--------------|-------------------|------------|---------------------|-------|
| R1.1 | AI model (Gemini 2.5 Pro Preview) may generate inaccurate or irrelevant questions | Medium | High | Implement quality control measures; User feedback loop for question rating; Refine prompts for accuracy and relevance to aviation; Potential fine-tuning if available/needed | AI/Engineering Team |
| R1.2 | Users may upload copyrighted material without permission | Medium | Medium | Display clear warnings about copyright; Implement a reporting mechanism for copyrighted content; User agreement clause | Legal Team |
| R1.3 | Scalability issues with increasing number of users and documents | Low | High | Use scalable cloud infrastructure (Supabase); Optimize database queries; Load testing | Engineering Team |
| R1.4 | Security vulnerabilities in user authentication or data storage | Low | High | Follow security best practices; Regular security audits; Use Supabase's built-in security features (RLS); Secure API key management for Google Cloud | Security Team |
| R1.5 | Google Gemini API or other third-party service outages (Supabase) | Medium | Medium | Implement retry mechanisms; Have fallback options or graceful degradation (e.g., notify user of temporary unavailability); Monitor third-party service status | Engineering Team |
| R1.6 | Inconsistent question quality across different document types/structures/modalities | Medium | Medium | Improve prompt engineering for handling diverse inputs (PDF layouts, image quality); Provide guidelines for optimal document upload quality; AI model evaluation on diverse examples | AI/Engineering Team |
| R1.7 | ~~**Critical: PDF Text Extraction Limitation** - Current placeholder text extraction for PDFs severely degrades quiz quality from PDF documents, undermining a core feature.~~ | ~~High~~ Low | ~~High~~ Low | **Mitigated:** Switched to Google Gemini 2.5 Pro Preview API, which directly processes PDF/image content, bypassing the need for app-side text extraction. | Engineering/Product |
| R1.8 | **Critical: Non-Functional PDF Export** - The `exportDocumentToPdf` feature currently exports extracted text, not a high-fidelity replica of original PDFs. | Medium | Medium | Implemented basic text-to-PDF export. Further enhancement requires more complex PDF generation/manipulation libraries or defining clearer requirements (export text vs. export original). Manage user expectations. | Engineering/Product |
| R1.9 | **Data Integrity for Quiz Questions** - Potential schema differences for `correct_answer` (text vs. index) between online and offline storage. | Medium | High | Standardize the `correct_answer` representation via prompt engineering with Gemini 2.5 Pro Preview for consistent output format; Implement robust validation and transformation logic during sync. | Engineering Team |
| R1.10 | **Dependency & Cost Risk (Google Gemini API)** - Reliance on Google Cloud/Gemini API introduces dependency. API costs may fluctuate or exceed projections based on usage patterns (file size, complexity, number of calls). | Medium | Medium | Monitor API usage and costs closely; Implement cost-control measures (e.g., user limits, caching if possible); Explore different Gemini model tiers (e.g., Flash vs. Pro) if cost becomes an issue; Have clear T&Cs regarding usage limits. | Product/Engineering |

### Business Risks

| Risk | Impact (1-5) | Probability (1-5) | Risk Score | Mitigation Strategy | Owner |
|------|--------------|-------------------|------------|---------------------|-------|
| R2.1 | Low user adoption | High | Medium | Implement referral program; Focus on UX excellence; Targeted marketing to aviation schools | Marketing Team |
| R2.2 | Competitor reaction | Medium | High | Monitor competitive landscape; Maintain aggressive feature roadmap; Focus on unique AI capabilities | Product Team |
| R2.3 | Regulatory changes affecting educational apps | Medium | Low | Monitor regulatory environment; Build compliance features; Maintain relationships with aviation authorities | Legal Team |
| R2.4 | AI model costs exceeding projections | Medium | Medium | Implement usage caps; Cache results; Optimize prompt efficiency; Negotiate volume pricing | Engineering Team |
| R2.5 | Copyright concerns with user materials | Medium | Low | Clear terms of service; Educational fair use focus; Content filtering for known protected materials | Legal Team |

### Contingency Plans

1. **Quality Issues**
   - Rollback to previous AI model version
   - Manual review process for reported questions
   - Emergency update deployment process

2. **Performance Problems**
   - CDN integration for faster content delivery
   - Server scaling automation
   - Background processing for resource-intensive tasks

3. **Business Continuity**
   - Data backup and recovery procedures
   - Alternative AI provider integration points
   - Disaster recovery documentation and testing

## Deployment Strategy

### Timeline

| Phase | Timeline | Key Activities | Exit Criteria |
|-------|----------|----------------|---------------|
| Pre-Alpha | Weeks 1-2 | Initial build, internal testing, core functionality | All P0 requirements pass internal testing |
| Alpha | Weeks 3-4 | Limited release to 20 test users, bug fixes | No P0 bugs, <5 P1 bugs remaining |
| Beta | Weeks 5-8 | Expanded testing with 100 users, performance optimization | All P0/P1 requirements implemented, user feedback >75% positive |
| Release Candidate | Weeks 9-10 | Final testing, documentation, marketing prep | No known P0/P1 bugs, all test cases pass |
| Public Launch | Week 11 | Production deployment, marketing activities | Successful deployment with <1% error rate |
| Post-Launch | Weeks 12+ | Monitoring, bug fixes, initial feature enhancements | Stable performance metrics, growing user base |

### Web Deployment

- Progressive Web App (PWA) deployed on Vercel
- Continuous integration and deployment via GitHub Actions
- Staging and production environments
- Automated testing in CI/CD pipeline
- Blue/green deployment strategy for zero downtime

### Mobile Deployment

- iOS app deployed to Apple App Store
- Android app deployed to Google Play Store
- Over-the-air updates via Expo EAS Update
- Phased rollout strategy (10% -> 25% -> 50% -> 100%)
- Beta testing via TestFlight and Google Play Testing Program

### Release Phases

1. **Alpha (Week 1-2)**
   - Internal testing with development team
   - Focus on core functionality and critical bugs
   - Daily builds and testing cycles
   - Success criteria: All P0 requirements implemented

2. **Beta (Week 3-8)**
   - Limited release to selected test users
   - Weekly builds with bug fixes and optimizations
   - Structured feedback collection process
   - Success criteria: >75% positive user feedback

3. **Public Release (Week 11)**
   - Full release to app stores and web
   - Marketing campaign launch
   - Customer support team fully staffed
   - Success criteria: Stable metrics, growing user acquisition

### Post-Launch Support

- Weekly bug fix releases for first month
- Bi-weekly feature updates following roadmap
- 24/7 monitoring of critical services
- User feedback collection and analysis

## Success Metrics

### User Engagement

| ID | Metric | Target | Measurement Method |
|----|--------|--------|-------------------|
| SM1.1 | Average session duration | >10 minutes | Analytics tracking of app usage |
| SM1.2 | Weekly active users | >1,000 after 3 months | User authentication logs |
| SM1.3 | Quiz completion rate | >80% | Quiz attempt vs. completion records |
| SM1.4 | Return rate | >60% weekly | User session tracking |
| SM1.5 | Document uploads per user | >3 per month | Storage metrics |

### Performance Metrics

| ID | Metric | Target | Measurement Method |
|----|--------|--------|---------------------|
| SM2.1 | Average document upload time | <5 seconds | Performance monitoring |
| SM2.2 | Average quiz generation time | <8 seconds | Backend processing logs |
| SM2.3 | App crash rate | <0.5% | Error tracking system |
| SM2.4 | API response time | <200ms (P95) | API gateway metrics |
| SM2.5 | Time to interactive | <3 seconds | Lighthouse metrics |

### Business Metrics

| ID | Metric | Target | Measurement Method |
|----|--------|--------|---------------------|
| SM3.1 | User retention rate | >60% after 30 days | Cohort analysis |
| SM3.2 | Organic user growth | >10% month-over-month | Acquisition source tracking |
| SM3.3 | App store rating | >4.5 stars | App store metrics |
| SM3.4 | Cost per acquisition | <ZAR 95 per user | Marketing analytics |
| SM3.5 | Conversion to paid plan | >15% of free users | Subscription analytics |

### Learning Efficacy Metrics

| ID | Metric | Target | Measurement Method |
|----|--------|--------|---------------------|
| SM4.1 | Knowledge improvement | >20% increase in quiz scores | Before/after quiz comparison |
| SM4.2 | Study time efficiency | >30% reduction in study time | User surveys |
| SM4.3 | Exam pass rate | >90% for users with >20 quizzes completed | User reported exam results |
| SM4.4 | Topic mastery progression | Positive trend in weak areas | Performance analytics |

## Monetization Strategy

The application will adopt a freemium model with a clear upgrade path to a premium subscription. Paystack will be used as the payment gateway for handling subscriptions.

### Subscription Plans

Two primary plans will be offered:

**1. Basic Plan (Free Tier)**
    *   **Monthly Price:** Free
    *   **Storage:** 25 MB total storage for documents and related data.
    *   **My Exams (Past Exams Access):** No access to view or retake past exams.
    *   **Quizzes per Month:** Up to 10 quizzes can be generated per calendar month.
    *   **Target Audience:** New users, users with light usage needs, or those wishing to evaluate the core functionality before committing.

**2. Captain's Club (Premium Tier)**
    *   **Monthly Price:** R99 (South African Rand)
    *   **Storage:** 500 MB total storage for documents and related data.
    *   **My Exams (Past Exams Access):** Unlimited access to view, review, and retake past exams.
    *   **Quizzes per Month:** Unlimited quiz generations.
    *   **Additional Potential Features (Future Consideration):**
        *   Advanced analytics on quiz performance.
        *   Priority support.
        *   Ad-free experience (if ads are introduced to the Basic Plan).
    *   **Target Audience:** Regular users, users with larger study material volumes, and those who value unlimited access and advanced features.

### Payment Gateway Integration

*   **Provider:** Paystack
*   **Functionality:**
    *   Secure processing of monthly subscription payments for the "Captain's Club" plan.
    *   Management of subscription lifecycle events (e.g., activation, cancellation, payment failure).
    *   Storing customer payment details securely via Paystack's infrastructure.

### User Experience for Monetization

*   **Upgrade Prompts:** Non-intrusive prompts to upgrade will be presented when users on the Basic Plan attempt to exceed their quotas (e.g., storage limit, monthly quiz limit, accessing past exams).
*   **Subscription Management:** Users will be able to view their current plan, manage their subscription (e.g., upgrade, cancel), and view billing history within the app's settings or profile section.
*   **Trial Period:** (Decision Pending) A 7-14 day free trial of the "Captain's Club" features for new users is under consideration to allow full evaluation before purchase. If implemented, this will be managed via Paystack's trial functionalities or custom logic.

### Database Schema Implications (public.profiles table)

To support this monetization strategy, the `public.profiles` table in Supabase will include fields such as:
    *   `plan`: (e.g., 'basic', 'captains_club')
    *   `plan_status`: (e.g., 'active', 'past-due', 'cancelled' - aligned with Paystack statuses)
    *   `plan_period_end`: Timestamp for current subscription period end.
    *   `paystack_customer_code`: Paystack's customer identifier.
    *   `paystack_subscription_code`: Paystack's subscription identifier.
    *   `storage_used_mb`: Tracks current storage usage.
    *   `can_access_past_exams`: Boolean flag.
    *   `monthly_quizzes_remaining`: Tracks remaining quizzes for 'basic' plan users.
    *   `last_quota_reset_date`: When quotas were last reset.

## Future Enhancements

### Phase 2 (3-6 months post-launch)

| ID | Feature | Description | Business Value |
|----|---------|-------------|---------------|
| FE1.1 | Social Features | Share quizzes with friends or classmates | Increases user acquisition through referrals |
| FE1.2 | Collaborative Study | Create study groups with shared documents | Improves user engagement and retention |
| FE1.3 | Advanced Analytics | More detailed performance insights | Increases perceived value and conversion rate |
| FE1.4 | Custom Templates | Allow users to create question templates | Appeals to instructors and power users |
| FE1.5 | Quiz Scheduling | Set recurring quizzes for spaced repetition | Improves learning efficacy and retention |

### Phase 3 (6-12 months post-launch)

| ID | Feature | Description | Business Value |
|----|---------|-------------|---------------|
| FE2.1 | AI Tutor | Personalized learning recommendations | Premium feature to drive conversions |
| FE2.2 | Audio Questions | Support for listening comprehension | Expands use cases for aviation communications |
| FE2.3 | Flashcard Mode | Alternative study method | Appeals to different learning styles |
| FE2.4 | Subscription Model | Premium features for paying users | Core monetization strategy |
| FE2.5 | API Access | Allow integration with other learning systems | Appeals to institutional customers |

### Future Vision

| Timeline | Strategic Goal | Key Initiatives |
|----------|----------------|----------------|
| Year 2 | Expand to wider aviation market | Support for FAA, EASA standards<br>Multi-language support<br>Partner with major flight schools |
| Year 3 | Extend beyond aviation | Architecture for other technical domains<br>Customizable AI learning models<br>Enterprise LMS integration |
| Year 5 | Become leading AI learning platform | Machine learning for optimized learning paths<br>VR/AR integration<br>Corporate training solutions |

## Appendix

### Glossary

- **SACAA**: South African Civil Aviation Authority
- **PPL**: Private Pilot License
- **CPL**: Commercial Pilot License
- **ATPL**: Airline Transport Pilot License
- **LMS**: Learning Management System
- **PWA**: Progressive Web Application
- **AI**: Artificial Intelligence
- **MCQ**: Multiple Choice Question

### References

1. SACAA Examination Guidelines
2. Aviation Training Standards
3. Google Gemini 2.5 Pro Preview API Documentation
4. Supabase Documentation
5. PWA Best Practices - Web.dev
6. Nielsen Norman Group - UX Guidelines for Educational Apps
7. React Native Performance Best Practices

### Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-03-15 | Initial Team | First draft |
| 0.2 | 2025-03-22 | Product Team | Added user stories |
| 1.0 | 2025-04-02 | Product Team | Finalized for development |
| 1.1 | 2025-04-11 | Senior Development Team | Enhanced with technical details, flows, risks, and acceptance criteria |
| 1.1.1 | 2024-05-23 | Senior Development Team | Updated PRD version, last updated date, status. Added caveats to 'Document Upload' and 'AI-Generated Questions' features regarding current PDF processing limitations, reflecting known issues from the Implementation Guide. |