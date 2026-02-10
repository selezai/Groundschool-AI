"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: February 2025</p>
      </div>

      <Card>
        <CardContent className="pt-6 prose prose-sm prose-invert max-w-none">
          <h2 className="text-lg font-semibold mb-3">1. Information We Collect</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We collect information you provide directly: email address, name, and documents you upload for study purposes. We also collect usage data to improve our service.
          </p>

          <h2 className="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your information is used to provide the Groundschool AI service, generate exams from your documents, manage your account, and communicate with you about the service.
          </p>

          <h2 className="text-lg font-semibold mb-3">3. Document Storage</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Documents you upload are stored securely and are only accessible to you. We process documents to generate exam questions but do not share them with third parties.
          </p>

          <h2 className="text-lg font-semibold mb-3">4. Data Security</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We implement industry-standard security measures to protect your data. Your documents and personal information are encrypted in transit and at rest.
          </p>

          <h2 className="text-lg font-semibold mb-3">5. Data Retention</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We retain your data for as long as your account is active. When you delete your account, all associated data including documents and exam history is permanently deleted.
          </p>

          <h2 className="text-lg font-semibold mb-3">6. Third-Party Services</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We use Supabase for authentication and storage, and PayFast for payment processing. These services have their own privacy policies governing their use of data.
          </p>

          <h2 className="text-lg font-semibold mb-3">7. Your Rights</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You have the right to access, correct, or delete your personal data. You can manage your data through your profile settings or by contacting us directly.
          </p>

          <h2 className="text-lg font-semibold mb-3">8. Contact</h2>
          <p className="text-sm text-muted-foreground">
            For privacy-related questions, contact us at groundschoolai@gmail.com.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
