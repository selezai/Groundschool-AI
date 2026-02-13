"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Sparkles,
  Target,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Shield,
  Zap,
  TrendingUp,
  Clock,
  Crown,
} from "lucide-react";
import Image from "next/image";

const ONBOARDING_PREFIX = "groundschool_onboarding_completed_";

interface OnboardingModalProps {
  onComplete: () => void;
  firstName?: string;
  userId: string;
}

export function OnboardingModal({ onComplete, firstName, userId }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_PREFIX + userId, "true");
    onComplete();
  };

  const totalSteps = 4;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-card border border-border/50 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Step 0: Welcome — Aspirational */}
        {currentStep === 0 && (
          <>
            <div className="relative bg-gradient-to-b from-primary/15 via-primary/5 to-transparent px-8 pt-10 pb-6 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
              <div className="relative">
                <div className="relative mx-auto w-24 h-24 mb-5">
                  <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-2xl animate-pulse" />
                  <Image
                    src="/assets/logo.png"
                    alt="Groundschool AI"
                    width={96}
                    height={96}
                    className="relative rounded-2xl shadow-xl"
                  />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Welcome{firstName ? `, ${firstName}` : ""} ✈️
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  You just joined the smartest way to prepare for your aviation exams. Let&apos;s get you exam-ready.
                </p>
              </div>
            </div>
            <div className="px-8 pt-4 pb-2">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-lg font-bold text-primary">AI</p>
                  <p className="text-[10px] text-muted-foreground">Powered</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-lg font-bold text-primary">75%</p>
                  <p className="text-[10px] text-muted-foreground">Pass Standard</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-lg font-bold text-primary">∞</p>
                  <p className="text-[10px] text-muted-foreground">Practice Exams</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 1: How it works — Simple 3-step */}
        {currentStep === 1 && (
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-5">
              <Zap className="h-3 w-3" />
              SIMPLE AS 1-2-3
            </div>
            <h2 className="text-xl font-bold mb-6">How It Works</h2>
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Upload Your Notes</p>
                  <p className="text-xs text-muted-foreground">PDFs, images, text files — drop in your study material</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Generates Your Exam</p>
                  <p className="text-xs text-muted-foreground">Realistic questions tailored to your material in seconds</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Pass With Confidence</p>
                  <p className="text-xs text-muted-foreground">Practice until you consistently hit the 75% aviation standard</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Why it works — Trust & value */}
        {currentStep === 2 && (
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              <Shield className="h-3 w-3" />
              BUILT FOR PILOTS
            </div>
            <h2 className="text-xl font-bold mb-2">Why Students Love It</h2>
            <p className="text-muted-foreground text-xs mb-6">Purpose-built for aviation exam success</p>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Study smarter, not harder</p>
                  <p className="text-[11px] text-muted-foreground">AI extracts the key concepts from your material</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                <TrendingUp className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Track your improvement</p>
                  <p className="text-[11px] text-muted-foreground">See your scores climb with every practice session</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
                <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Questions that actually matter</p>
                  <p className="text-[11px] text-muted-foreground">AI focuses on exam-relevant content, not filler</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: You're in — Exclusivity & urgency */}
        {currentStep === 3 && (
          <div className="px-8 pt-8 pb-2 text-center">
            <div className="relative mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-5 shadow-lg shadow-primary/30">
              <Crown className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">You&apos;re In! 🎉</h2>
            <p className="text-muted-foreground text-sm mb-5 max-w-xs mx-auto">
              You have <span className="text-primary font-semibold">full premium access</span> to Groundschool AI — no limits, no restrictions.
            </p>
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mb-4">
              <p className="text-sm font-semibold mb-2">Your Captain&apos;s Club includes:</p>
              <div className="space-y-1.5 text-left">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Unlimited exam generation
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Full exam history & retakes
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> 500MB document storage
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> AI-powered question explanations
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 italic">
              Upload your first document and generate an exam — it takes 30 seconds.
            </p>
          </div>
        )}

        {/* Progress + Actions */}
        <div className="px-8 pt-4 pb-6">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-8 bg-primary"
                    : i < currentStep
                    ? "w-4 bg-primary/40"
                    : "w-4 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            {currentStep > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleComplete}
                className="text-muted-foreground/50 text-xs"
              >
                Skip
              </Button>
            )}

            {isLastStep ? (
              <Button
                onClick={handleComplete}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 px-6"
              >
                <Rocket className="h-4 w-4" />
                Start Studying
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="gap-1 px-5"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_PREFIX + userId) === "true";
}

export function markOnboardingComplete(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_PREFIX + userId, "true");
}
