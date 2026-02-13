"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Crown,
  Infinity,
  History,
  HardDrive,
  Loader2,
  ShieldCheck,
  Check,
  User,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const benefits = [
  {
    icon: Infinity,
    title: "Unlimited Exam Generation",
    description: "Create as many practice exams as you need, whenever you need them.",
  },
  {
    icon: History,
    title: "Full Exam History",
    description: "Access and review all your past exams to track your progress.",
  },
  {
    icon: HardDrive,
    title: "Increased Storage (500MB)",
    description: "Store more documents and study materials without worry.",
  },
];

export default function CaptainsClubPage() {
  const { profile, user, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const isSubscribed = profile?.plan === "captains_club";

  const handleSubscribe = async () => {
    if (!user || !profile) {
      toast.error("Please sign in first");
      return;
    }

    if (!profile.full_name) {
      toast.error("Please set your full name in your profile first");
      router.push("/profile");
      return;
    }

    setIsSubscribing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-payfast-payment-data",
        {
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            fullName: profile.full_name,
            itemName: "Captain's Club",
            amount: "99.00",
            itemDescription: "Monthly subscription to Captain's Club",
            isInitialSetup: false,
          }),
        }
      );

      if (error) {
        throw new Error(error.message || "Payment setup failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.paymentUrl && data?.formData) {
        // Redirect to PayFast via form POST
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.paymentUrl;
        Object.keys(data.formData).forEach((key) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = data.formData[key];
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      } else {
        throw new Error("Unexpected response from payment service");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment setup failed";
      toast.error(message);
    } finally {
      setIsSubscribing(false);
    }
  };

  if (isSubscribed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              You&apos;re a Captain&apos;s Club Member!
            </h2>
            <p className="text-muted-foreground mb-6">
              You have full access to all premium features. Thank you for your support!
            </p>
            <Button variant="outline" onClick={() => router.push("/profile")}>
              <User className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/assets/logo.png"
            alt="Groundschool AI"
            width={64}
            height={64}
            className="rounded-xl"
          />
        </div>
        <h1 className="text-3xl font-bold">Captain&apos;s Club</h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Unlock your full potential with unlimited access to all premium features.
        </p>
      </div>

      {/* Pricing Card */}
      <Card className="border-primary/50 bg-gradient-to-b from-primary/5 to-transparent">
        <CardContent className="pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Crown className="h-3 w-3" />
            MOST POPULAR
          </div>
          <div className="flex items-baseline justify-center gap-1 mb-2">
            <span className="text-4xl font-bold">R99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Cancel anytime</p>
          
          <div className="space-y-3 text-left max-w-xs mx-auto mb-6">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{benefit.title}</p>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            className="w-full py-6 text-lg"
            onClick={handleSubscribe}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Crown className="h-5 w-5 mr-2" />
            )}
            Upgrade Now
          </Button>
        </CardContent>
      </Card>

      {/* Comparison */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Currently on <span className="font-medium text-foreground">Basic Plan</span></p>
        <p className="mt-1">10 exams/month • 50MB storage • Limited history</p>
      </div>
    </div>
  );
}
