"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText, Shield, ChevronRight, CreditCard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  const appVersion = "2.0.0";
  const companyName = "Groundschool AI";
  const currentYear = new Date().getFullYear();
  const appDescription =
    "Groundschool AI is your intelligent partner for aviation ground school studies. Create quizzes from your documents, test your knowledge, and prepare effectively for your exams.";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">About</h1>
        <p className="text-muted-foreground">Learn more about Groundschool AI</p>
      </div>

      {/* App Info Card */}
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
              <Image
                src="/assets/logo.png"
                alt="Groundschool AI"
                width={48}
                height={48}
                className="rounded-lg"
              />
            </div>
            <h2 className="text-xl font-bold">{companyName}</h2>
            <p className="text-sm text-muted-foreground">Version {appVersion}</p>
          </div>

          <div className="p-4 rounded-xl bg-muted/50 mb-4">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {appDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Legal Card */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Legal Information</h3>
          <div className="space-y-1">
            <Link
              href="/terms"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10">
                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="flex-1 font-medium">Terms of Service</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/privacy"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10">
                <Shield className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="flex-1 font-medium">Privacy Policy</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/refund"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10">
                <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="flex-1 font-medium">Refund Policy</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-sm font-medium">{companyName}</p>
        <p className="text-xs text-muted-foreground">
          © {currentYear} {companyName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
