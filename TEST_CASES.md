# Groundschool AI Test Cases Checklist

This document outlines the test cases for the Groundschool AI application in a checklist format to track testing progress.

## 1. Authentication Tests

### 1.1 User Registration
- [ ] **TC-1.1.1**: Verify new user registration with valid email and password
- [x] **TC-1.1.2**: Verify error handling for invalid email format
- [ ] **TC-1.1.3**: Verify error handling for weak passwords
- [ ] **TC-1.1.4**: Verify automatic profile creation in `public.profiles` table after registration
- [ ] **TC-1.1.5**: Verify error handling for duplicate email registration

### 1.2 User Login
- [x] **TC-1.2.1**: Verify login with valid credentials - PASSED (2025-05-29)
- [ ] **TC-1.2.2**: Verify error handling for invalid credentials
- [ ] **TC-1.2.3**: Verify persistence of login session
- [ ] **TC-1.2.4**: Verify error display on web vs. native platforms
- [ ] **TC-1.2.5**: Verify login state management in `AuthContext`

### 1.3 User Logout
- [x] **TC-1.3.1**: Verify successful logout functionality - PASSED (2025-05-29)
- [x] **TC-1.3.2**: Verify session cleanup after logout - PASSED (2025-05-29)
- [x] **TC-1.3.3**: Verify redirection to login screen after logout - PASSED (2025-05-29)

## 2. Document Management Tests

### 2.1 Document Upload
- [x] **TC-2.1.1**: Verify PDF document upload - PASSED (2025-05-29)
- [x] **TC-2.1.2**: Verify image document upload (JPG, PNG, HEIC) - PASSED (2025-05-29)
- [N/A] **TC-2.1.3**: Verify text document upload (TXT, DOCX) - N/A (2025-05-29, formats not supported/used)
- [N/A] **TC-2.1.4**: Verify document limit enforcement (max 20 documents) - N/A (2025-05-29, requirement changed to size limit per TC-2.1.5)
- [x] **TC-2.1.5**: Verify storage size limit enforcement (25MB per user) - PASSED (2025-05-29)
- [x] **TC-2.1.6**: Verify error handling for unsupported file types - PASSED (2025-05-29, file selector prevents selection by design)
- [x] **TC-2.1.7**: Verify file name extraction and display - PASSED (2025-05-29)

### 2.2 Document Listing
- [x] **TC-2.2.1**: Verify all user documents are displayed - PASSED (2025-05-29)
- [N/A] **TC-2.2.2**: Verify document type icons display correctly - N/A (2025-05-29, icons not displayed, acceptable)
- [x] **TC-2.2.3**: Verify document titles display correctly - PASSED (2025-05-29)
- [x] **TC-2.2.4**: Verify document list refresh functionality - PASSED (2025-05-29, auto-refreshes)

### 2.3 Document Deletion
- [x] **TC-2.3.1**: Verify document deletion with confirmation - PASSED (2025-05-29)
- [x] **TC-2.3.2**: Verify UI updates after document deletion - PASSED (2025-05-29)
- [x] **TC-2.3.3**: Verify storage cleanup after document deletion - PASSED (2025-05-29)
- [x] **TC-2.3.4**: Verify platform-specific confirmation dialogs (web vs. native) - PASSED (2025-05-29)

### 2.4 Document Download
- [ ] **TC-2.4.1**: Verify document download functionality
- [ ] **TC-2.4.2**: Verify file sharing after download
- [ ] **TC-2.4.3**: Verify error handling for failed downloads

## 3. Quiz Generation Tests

### 3.1 Quiz Creation
- [ ] **TC-3.1.1**: Verify quiz generation from PDF document
- [ ] **TC-3.1.2**: Verify quiz generation from image document
- [ ] **TC-3.1.3**: Verify quiz generation from text document
- [ ] **TC-3.1.4**: Verify AI-generated quiz title
- [ ] **TC-3.1.5**: Verify AI-determined question count
- [ ] **TC-3.1.6**: Verify user-specified question count override
- [ ] **TC-3.1.7**: Verify difficulty level selection
- [ ] **TC-3.1.8**: Verify quiz limit enforcement (max 20 quizzes, oldest deleted)

### 3.2 Quiz JSON Parsing
- [ ] **TC-3.2.1**: Verify handling of well-formed JSON responses
- [ ] **TC-3.2.2**: Verify correction of malformed option structures
- [ ] **TC-3.2.3**: Verify handling of markdown code blocks in AI responses
- [ ] **TC-3.2.4**: Verify retry logic for invalid AI responses
- [ ] **TC-3.2.5**: Verify fallback mechanisms for unrecoverable parsing errors

## 4. Quiz Interaction Tests

### 4.1 Quiz Listing
- [ ] **TC-4.1.1**: Verify pagination of quiz list (10 per page)
- [ ] **TC-4.1.2**: Verify "load more" functionality
- [ ] **TC-4.1.3**: Verify quiz list refresh functionality
- [ ] **TC-4.1.4**: Verify quiz deletion from list

### 4.2 Quiz Taking
- [ ] **TC-4.2.1**: Verify question display
- [ ] **TC-4.2.2**: Verify option selection
- [ ] **TC-4.2.3**: Verify navigation between questions
- [ ] **TC-4.2.4**: Verify quiz completion
- [ ] **TC-4.2.5**: Verify score calculation
- [ ] **TC-4.2.6**: Verify handling of different option formats (string arrays vs. object arrays)
- [ ] **TC-4.2.7**: Verify exit confirmation dialog

### 4.3 Quiz Results
- [ ] **TC-4.3.1**: Verify results display
- [ ] **TC-4.3.2**: Verify correct/incorrect answer highlighting
- [ ] **TC-4.3.3**: Verify explanation display
- [ ] **TC-4.3.4**: Verify return to quiz list functionality

## 5. Offline Functionality Tests

### 5.1 Quiz Attempt Offline Storage
- [x] **TC-5.1.1**: Verify quiz attempt storage when offline - PASSED (2025-05-29)
- [x] **TC-5.1.2**: Verify unique ID generation for offline attempts - PASSED (2025-05-29)
- [x] **TC-5.1.3**: Verify synchronization of offline attempts when online - PASSED (2025-05-29)
- [x] **TC-5.1.4**: Verify proper mapping of fields during synchronization (camelCase to snake_case) - PASSED (2025-05-29)

### 5.2 Network Error Handling
- [x] **TC-5.2.1**: Verify graceful handling of network disconnection - PASSED (2025-05-29)
- [ ] **TC-5.2.2**: Verify appropriate error messages for network issues
- [x] **TC-5.2.3**: Verify retry logic for transient network errors - PASSED (2025-05-29)

## 6. Profile Management Tests

### 6.1 Profile Settings
- [ ] **TC-6.1.1**: Verify profile information display
- [ ] **TC-6.1.2**: Verify full name update
- [ ] **TC-6.1.3**: Verify avatar URL update
- [ ] **TC-6.1.4**: Verify password change functionality

### 6.2 Navigation
- [ ] **TC-6.2.1**: Verify navigation to Help & Support screen
- [ ] **TC-6.2.2**: Verify navigation to About screen
- [ ] **TC-6.2.3**: Verify navigation to Privacy Policy screen
- [ ] **TC-6.2.4**: Verify navigation to Terms of Service screen

## 7. UI/UX Tests

### 7.1 Theme
- [ ] **TC-7.1.1**: Verify dark theme application across all screens
- [ ] **TC-7.1.2**: Verify consistent styling of UI elements
- [ ] **TC-7.1.3**: Verify proper contrast for text elements
- [ ] **TC-7.1.4**: Verify icon visibility against backgrounds

### 7.2 Responsiveness
- [ ] **TC-7.2.1**: Verify layout on small mobile screens
- [ ] **TC-7.2.2**: Verify layout on tablet screens
- [ ] **TC-7.2.3**: Verify layout on web browsers
- [ ] **TC-7.2.4**: Verify orientation changes (portrait/landscape)

### 7.3 Accessibility
- [ ] **TC-7.3.1**: Verify screen reader compatibility
- [ ] **TC-7.3.2**: Verify keyboard navigation on web
- [ ] **TC-7.3.3**: Verify touch target sizes on mobile

## 8. Performance Tests

### 8.1 Load Testing
- [ ] **TC-8.1.1**: Verify application performance with maximum document count
- [ ] **TC-8.1.2**: Verify application performance with maximum quiz count
- [ ] **TC-8.1.3**: Verify quiz generation performance with large documents

### 8.2 Memory Usage
- [ ] **TC-8.2.1**: Verify memory usage during document upload
- [ ] **TC-8.2.2**: Verify memory usage during quiz generation
- [ ] **TC-8.2.3**: Verify memory usage during quiz taking

## 9. Integration Tests

### 9.1 Supabase Integration
- [ ] **TC-9.1.1**: Verify data consistency between client and Supabase
- [ ] **TC-9.1.2**: Verify RLS policies for user data isolation
- [ ] **TC-9.1.3**: Verify database triggers for profile creation

### 9.2 Gemini AI Integration
- [ ] **TC-9.2.1**: Verify API communication with Gemini
- [ ] **TC-9.2.2**: Verify prompt effectiveness for quiz generation
- [ ] **TC-9.2.3**: Verify handling of API rate limits
- [ ] **TC-9.2.4**: Verify multimodal input processing (text + images)

## 10. Cross-Platform Tests

### 10.1 Platform-Specific Features
- [ ] **TC-10.1.1**: Verify alert dialogs on native platforms
- [ ] **TC-10.1.2**: Verify custom alert implementation on web
- [ ] **TC-10.1.3**: Verify document picker on different platforms
- [ ] **TC-10.1.4**: Verify file sharing on different platforms
