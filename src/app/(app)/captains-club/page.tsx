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
  User,
} from "lucide-react";
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Crown className="h-12 w-12 mx-auto text-primary mb-3" />
        <h1 className="text-2xl font-bold">Upgrade to Captain&apos;s Club</h1>
        <p className="text-muted-foreground mt-1">
          Unlock exclusive features and elevate your study experience.
        </p>
      </div>

      <div className="space-y-4">
        {benefits.map((benefit) => (
          <Card key={benefit.title}>
            <CardContent className="py-4 flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5 flex-shrink-0">
                <benefit.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {benefit.description}
                </p>
              </div>
            </CardContent>
          </Card>
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
        Upgrade Now — R99/month
      </Button>
    </div>
  );
}
