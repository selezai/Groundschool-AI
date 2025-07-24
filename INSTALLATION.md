# Installation Guide - Groundschool AI 🛠️

This guide provides comprehensive setup instructions for the Groundschool AI application.

## 📋 Prerequisites

### Required Software
- **Node.js**: Version 18 or higher ([Download](https://nodejs.org/))
- **npm**: Comes with Node.js (or use yarn as alternative)
- **Git**: For cloning the repository ([Download](https://git-scm.com/))
- **Expo CLI**: Install globally with `npm install -g @expo/cli`

### Required Accounts & API Keys
- **Supabase Account**: [supabase.com](https://supabase.com)
- **Google AI API Key**: [Google AI Studio](https://makersuite.google.com/app/apikey)
- **PayFast Merchant Account**: [payfast.co.za](https://www.payfast.co.za) (for payment features)

### Development Tools (Optional)
- **VS Code**: Recommended IDE with React Native extensions
- **Android Studio**: For Android development and emulator
- **Xcode**: For iOS development (macOS only)

## 🚀 Quick Start Installation

### 1. Clone the Repository
```bash
git clone https://github.com/selezai/Groundschool-AI.git
cd Groundschool-AI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your credentials
nano .env  # or use your preferred editor
```

### 4. Start Development Server
```bash
npm start
```

Choose your platform:
- Press `w` for web
- Press `i` for iOS simulator
- Press `a` for Android emulator

## 🔧 Detailed Configuration

### Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI Configuration
EXPO_PUBLIC_GEMINI_API_KEY=your_google_ai_api_key

# PayFast Configuration (Optional - for payment features)
PAYFAST_MERCHANT_ID=your_payfast_merchant_id
PAYFAST_MERCHANT_KEY=your_payfast_merchant_key
PAYFAST_PASSPHRASE=your_payfast_passphrase
PAYFAST_SANDBOX=true  # Set to false for production

# Application Configuration
EXPO_PUBLIC_APP_ENV=development
```

### Supabase Setup

#### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and enter project details
4. Wait for project to be created

#### 2. Get Project Credentials
1. Go to Project Settings → API
2. Copy your project URL and anon key
3. Add them to your `.env` file

#### 3. Database Setup
Run the migration files to set up the database schema:

```bash
# Navigate to supabase directory
cd supabase

# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### 4. Storage Configuration
1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `documents`
3. Set the bucket to public if you want direct file access
4. Configure RLS policies for security

#### 5. Edge Functions Deployment
```bash
# Deploy all edge functions
supabase functions deploy

# Or deploy individual functions
supabase functions deploy generate-payfast-payment-data
supabase functions deploy handle-payfast-itn
supabase functions deploy handle-subscription-cancellation
```

### Google AI API Setup

#### 1. Get API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env` file

#### 2. API Restrictions (Production)
For production deployment, restrict your API key:
1. Go to Google Cloud Console
2. Navigate to APIs & Services → Credentials
3. Edit your API key
4. Add application restrictions:
   - **HTTP referrers**: Add your domain(s)
   - **Android apps**: Add package name and SHA-1 fingerprint
   - **iOS apps**: Add bundle identifier

### PayFast Integration (Optional)

#### 1. Merchant Account Setup
1. Register at [payfast.co.za](https://www.payfast.co.za)
2. Complete merchant verification
3. Get sandbox credentials for testing

#### 2. Sandbox Configuration
```env
PAYFAST_MERCHANT_ID=10039481  # Sandbox merchant ID
PAYFAST_MERCHANT_KEY=sandbox_merchant_key
PAYFAST_PASSPHRASE=your_sandbox_passphrase
PAYFAST_SANDBOX=true
```

#### 3. Production Configuration
```env
PAYFAST_MERCHANT_ID=your_production_merchant_id
PAYFAST_MERCHANT_KEY=your_production_merchant_key
PAYFAST_PASSPHRASE=your_production_passphrase
PAYFAST_SANDBOX=false
```

## 📱 Platform-Specific Setup

### Web Development
```bash
npm run web
```
The web version will open at `http://localhost:8081`

### iOS Development (macOS only)

#### Prerequisites
- Xcode 14+ installed
- iOS Simulator or physical device

#### Setup
```bash
# Install iOS dependencies
npx pod-install ios

# Start iOS simulator
npm run ios
```

### Android Development

#### Prerequisites
- Android Studio installed
- Android SDK configured
- Android emulator or physical device

#### Setup
```bash
# Start Android emulator
npm run android
```

## 🗄️ Database Schema

The application uses the following main tables:

### Core Tables
- **profiles**: User profiles and subscription information
- **documents**: Uploaded document metadata
- **quizzes**: Generated quiz information
- **questions**: Individual quiz questions
- **quiz_attempts**: User quiz attempt history
- **quiz_question_responses**: Individual question responses

### Security Tables
- **rate_limits**: Rate limiting data for API protection

### Migration Files
All database migrations are located in `/supabase/migrations/`:
- `20250724_create_rate_limits_table.sql`: Rate limiting infrastructure
- Additional migrations for core functionality

## 🔒 Security Configuration

### Row Level Security (RLS)
The application uses RLS policies to ensure data security:

```sql
-- Example: Users can only access their own profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Example: Users can only access their own documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);
```

### API Key Security
- Never commit API keys to version control
- Use environment variables for all sensitive data
- Restrict API keys in production environments
- Rotate keys regularly

## 🧪 Testing Setup

### Unit Tests
```bash
npm test
```

### End-to-End Testing
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react-native jest-expo

# Run E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Web Deployment (Vercel)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard
```

### Mobile App Deployment

#### Using EAS Build
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## 🔧 Troubleshooting

### Common Issues

#### Metro Bundler Issues
```bash
# Clear Metro cache
npx expo start --clear

# Reset npm cache
npm start -- --reset-cache
```

#### iOS Simulator Issues
```bash
# Reset iOS simulator
xcrun simctl erase all

# Rebuild iOS
rm -rf ios/build
npm run ios
```

#### Android Build Issues
```bash
# Clean Android build
cd android
./gradlew clean
cd ..
npm run android
```

#### Supabase Connection Issues
1. Check your project URL and API key
2. Verify network connectivity
3. Check Supabase project status
4. Review RLS policies

### Environment Issues
- Ensure all required environment variables are set
- Check for typos in variable names
- Verify API keys are valid and not expired
- Confirm Supabase project is active

### Performance Issues
- Clear Metro cache: `npx expo start --clear`
- Restart development server
- Check for memory leaks in components
- Optimize large document processing

## 📞 Support

### Getting Help
- **Documentation**: Check existing docs in `/docs` folder
- **Issues**: Report bugs via GitHub Issues
- **Email**: Contact selezmj@gmail.com for urgent issues

### Development Resources
- **Expo Documentation**: [docs.expo.dev](https://docs.expo.dev)
- **React Native Guide**: [reactnative.dev](https://reactnative.dev)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Google AI Docs**: [ai.google.dev](https://ai.google.dev)

---

*Ready to transform aviation education with AI? Let's get started!* ✈️🚀
