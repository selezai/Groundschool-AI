# API Documentation - Groundschool AI 🔌

This directory contains comprehensive API documentation for the Groundschool AI application.

## API Overview

Groundschool AI uses a modern API architecture built on:
- **Supabase**: PostgreSQL database with auto-generated REST API
- **Supabase Edge Functions**: Serverless functions for custom logic
- **Google Gemini AI**: External AI service for document processing
- **PayFast**: Payment gateway integration

## API Structure

### Core APIs

#### Authentication API
- **Endpoint**: Supabase Auth
- **Methods**: Sign up, Sign in, Sign out, Password reset
- **Security**: JWT tokens, Row Level Security

#### Documents API
- **Endpoint**: `/rest/v1/documents`
- **Methods**: CRUD operations for user documents
- **Features**: File upload, metadata management, storage integration

#### Quizzes API
- **Endpoint**: `/rest/v1/quizzes`
- **Methods**: Create, read, update, delete quizzes
- **Features**: AI generation, multi-document processing

#### Questions API
- **Endpoint**: `/rest/v1/questions`
- **Methods**: Manage quiz questions and responses
- **Features**: Multiple choice, explanations, scoring

### Edge Functions

#### PayFast Payment Generation
- **Endpoint**: `/functions/v1/generate-payfast-payment-data`
- **Method**: POST
- **Purpose**: Generate secure payment data for PayFast

#### PayFast ITN Handler
- **Endpoint**: `/functions/v1/handle-payfast-itn`
- **Method**: POST
- **Purpose**: Process payment notifications from PayFast

#### Subscription Management
- **Endpoint**: `/functions/v1/handle-subscription-cancellation`
- **Method**: POST
- **Purpose**: Handle subscription cancellations

## Authentication

### JWT Token Authentication
```javascript
// Example: Authenticated request
const { data, error } = await supabase
  .from('quizzes')
  .select('*')
  .eq('user_id', user.id);
```

### API Key Authentication (Edge Functions)
```javascript
// Example: Edge function call
const response = await fetch('/functions/v1/generate-payfast-payment-data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(paymentData)
});
```

## Rate Limiting

### Protection Levels
- **Payment Endpoints**: 3 requests/minute
- **Webhook Endpoints**: 10 requests/minute
- **General API**: 60 requests/minute
- **File Upload**: Special handling for large files

### Rate Limit Headers
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60000
```

## Error Handling

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Document size exceeds 10MB limit",
    "details": {
      "field": "file_size",
      "limit": 10485760,
      "actual": 15728640
    }
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## API Examples

### Document Upload
```javascript
const uploadDocument = async (file, title) => {
  // Upload file to storage
  const { data: fileData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(`${user.id}/${file.name}`, file);

  if (uploadError) throw uploadError;

  // Create document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      file_path: fileData.path,
      document_type: file.type,
      user_id: user.id
    })
    .select()
    .single();

  return data;
};
```

### Quiz Generation
```javascript
const generateQuiz = async (documentId) => {
  const response = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      document_id: documentId,
      difficulty: 'medium'
    })
  });

  return response.json();
};
```

### Payment Processing
```javascript
const initiatePayment = async (planType) => {
  const response = await fetch('/functions/v1/generate-payfast-payment-data', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan: planType,
      user_id: user.id
    })
  });

  const paymentData = await response.json();
  // Redirect to PayFast with payment data
};
```

## Database Schema

### Key Tables
- **profiles**: User profiles and subscription data
- **documents**: Document metadata and file references
- **quizzes**: Generated quiz information
- **questions**: Individual quiz questions
- **quiz_attempts**: User quiz attempt history
- **rate_limits**: API rate limiting data

### Relationships
```sql
-- User has many documents
documents.user_id -> profiles.id

-- Document has many quizzes
quizzes.source_document_id -> documents.id

-- Quiz has many questions
questions.quiz_id -> quizzes.id

-- User has many quiz attempts
quiz_attempts.user_id -> profiles.id
```

## Security Considerations

### Row Level Security (RLS)
```sql
-- Example: Users can only access their own documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);
```

### Input Validation
- File type and size validation
- SQL injection prevention
- XSS protection
- Rate limiting enforcement

### API Key Security
- Environment variable storage
- Production restrictions
- Regular key rotation
- Audit logging

## Performance Optimization

### Caching Strategy
- Database query optimization
- File storage CDN
- API response caching
- Client-side caching

### Pagination
```javascript
// Example: Paginated quiz list
const getQuizzes = async (page = 0, limit = 10) => {
  const { data, error, count } = await supabase
    .from('quizzes')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  return { quizzes: data, total: count };
};
```

## Testing

### API Testing
- Unit tests for Edge Functions
- Integration tests for database operations
- End-to-end tests for complete workflows
- Load testing for performance validation

### Mock Data
- Test user accounts
- Sample documents
- Mock payment responses
- Simulated AI responses

---

*Well-designed APIs are the foundation of great applications* 🔌⚡
