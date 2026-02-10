"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: February 2025</p>
      </div>

      <Card>
        <CardContent className="pt-6 prose prose-sm prose-invert max-w-none">
          <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground mb-4">
            By accessing and using Groundschool AI, you accept and agree to be bound by the terms and provisions of this agreement.
          </p>

          <h2 className="text-lg font-semibold mb-3">2. Description of Service</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Groundschool AI provides an AI-powered study platform for aviation ground school preparation. Users can upload study documents and generate practice exams to test their knowledge.
          </p>

          <h2 className="text-lg font-semibold mb-3">3. User Accounts</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.
          </p>

          <h2 className="text-lg font-semibold mb-3">4. Subscription and Payments</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Captain&apos;s Club subscriptions are billed monthly at R99/month. You may cancel your subscription at any time. Refunds are handled on a case-by-case basis.
          </p>

          <h2 className="text-lg font-semibold mb-3">5. User Content</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You retain ownership of documents you upload. By uploading content, you grant us a license to process it for exam generation. We do not share your documents with third parties.
          </p>

          <h2 className="text-lg font-semibold mb-3">6. Acceptable Use</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You agree not to misuse the service, upload illegal content, or attempt to circumvent any security measures. We reserve the right to terminate accounts that violate these terms.
          </p>

          <h2 className="text-lg font-semibold mb-3">7. Disclaimer</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Groundschool AI is a study aid and does not guarantee exam success. The service is provided &quot;as is&quot; without warranties of any kind.
          </p>

          <h2 className="text-lg font-semibold mb-3">8. Contact</h2>
          <p className="text-sm text-muted-foreground">
            For questions about these terms, contact us at groundschoolai@gmail.com.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
