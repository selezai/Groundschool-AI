"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function RefundPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Refund Policy</h1>
        <p className="text-muted-foreground">Last updated: February 2025</p>
      </div>

      <Card>
        <CardContent className="pt-6 prose prose-sm prose-invert max-w-none">
          <h2 className="text-lg font-semibold mb-3">1. Subscription Cancellation</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You may cancel your Captain&apos;s Club subscription at any time. Upon cancellation, you will retain access to premium features until the end of your current billing period. No partial refunds are provided for unused portions of a billing period.
          </p>

          <h2 className="text-lg font-semibold mb-3">2. Refund Eligibility</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Refunds may be considered in the following circumstances:
          </p>
          <ul className="text-sm text-muted-foreground mb-4 list-disc pl-5 space-y-1">
            <li>Technical issues that prevented you from using the service</li>
            <li>Duplicate or erroneous charges</li>
            <li>Subscription charged after a cancellation request was submitted</li>
          </ul>

          <h2 className="text-lg font-semibold mb-3">3. Refund Request Process</h2>
          <p className="text-sm text-muted-foreground mb-4">
            To request a refund, please email us at <span className="text-primary">groundschoolai@gmail.com</span> with:
          </p>
          <ul className="text-sm text-muted-foreground mb-4 list-disc pl-5 space-y-1">
            <li>Your account email address</li>
            <li>Date of the charge</li>
            <li>Reason for the refund request</li>
            <li>Any relevant screenshots or documentation</li>
          </ul>

          <h2 className="text-lg font-semibold mb-3">4. Processing Time</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Refund requests are reviewed within 5-7 business days. If approved, refunds are processed through PayFast and may take an additional 5-10 business days to appear in your account, depending on your bank or payment provider.
          </p>

          <h2 className="text-lg font-semibold mb-3">5. Non-Refundable Items</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The following are not eligible for refunds:
          </p>
          <ul className="text-sm text-muted-foreground mb-4 list-disc pl-5 space-y-1">
            <li>Subscription fees for periods where the service was used</li>
            <li>Requests made more than 30 days after the charge</li>
            <li>Accounts terminated for violation of Terms of Service</li>
          </ul>

          <h2 className="text-lg font-semibold mb-3">6. Free Trial</h2>
          <p className="text-sm text-muted-foreground mb-4">
            If you signed up during a promotional period with free access, no charges were made and therefore no refund is applicable.
          </p>

          <h2 className="text-lg font-semibold mb-3">7. Contact</h2>
          <p className="text-sm text-muted-foreground">
            For refund inquiries or billing questions, contact us at <span className="text-primary">groundschoolai@gmail.com</span>. We aim to respond within 48 hours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
