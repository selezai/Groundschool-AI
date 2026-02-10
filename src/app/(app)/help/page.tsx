"use client";

import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "How do I create a new exam?",
    answer:
      "You can create a new exam from your dashboard. Upload study documents, select the ones you want to use, choose the number of questions, and click 'Generate Exam'. The AI will create relevant questions from your materials.",
  },
  {
    question: "How are my exam scores calculated?",
    answer:
      "Exam scores are calculated based on the number of correct answers out of the total number of questions. Your score is shown as a percentage after completing each exam.",
  },
  {
    question: "Can I upload my own documents for studying?",
    answer:
      "Yes! Groundschool AI allows you to upload PDF documents, images, and text files. Navigate to your dashboard and use the 'Upload Document' button to add your study materials.",
  },
  {
    question: "How does the AI assist in my learning?",
    answer:
      "The AI analyzes your uploaded documents and generates relevant multiple-choice questions to test your knowledge. It creates questions that cover key concepts from your study materials.",
  },
  {
    question: "What if I forget my password?",
    answer:
      "If you forget your password, click the 'Forgot Password?' link on the login screen. You'll receive an email with instructions to reset your password.",
  },
  {
    question: "How do I update my profile information?",
    answer:
      "You can update your full name from the Profile page. Navigate to Profile and edit your name in the Account Information section.",
  },
  {
    question: "What's included in Captain's Club?",
    answer:
      "Captain's Club members get unlimited exam generation, full exam history access, and 500MB of document storage. It's R99/month and you can cancel anytime.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-3 py-4 text-left hover:bg-muted/30 transition-colors rounded-lg px-2 -mx-2"
      >
        <HelpCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <span className="flex-1 font-medium">{question}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pl-8 pr-2 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const supportEmail = "groundschoolai@gmail.com";

  const handleEmailPress = () => {
    window.location.href = `mailto:${supportEmail}`;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Help & Support</h1>
        <p className="text-muted-foreground">Get help with Groundschool AI</p>
      </div>

      {/* Contact Card */}
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Contact Us</h3>
          <p className="text-sm text-muted-foreground mb-4">
            For any assistance or queries, please email us at:
          </p>
          <button
            onClick={handleEmailPress}
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            <Mail className="h-4 w-4" />
            {supportEmail}
          </button>
        </CardContent>
      </Card>

      {/* FAQs Card */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Frequently Asked Questions</h3>
          <div className="space-y-1">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
