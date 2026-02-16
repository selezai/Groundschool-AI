"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Plane,
  Loader2,
  ChevronDown,
  ChevronUp,
  Gauge,
  Cloud,
  Scale,
  Compass,
  Brain,
  Map,
  Radio,
  RotateCw,
  Helicopter,
} from "lucide-react";
import { toast } from "sonner";

interface Subject {
  code: string;
  name: string;
  shortName: string;
  icon: React.ElementType;
  questionCount: number;
  licence: "PPL(A)" | "PPL(H)";
  color: string;
}

const AEROPLANE_SUBJECTS: Subject[] = [
  { code: "pof", name: "Principles of Flight", shortName: "POF", icon: Gauge, questionCount: 200, licence: "PPL(A)", color: "text-blue-500" },
  { code: "atg", name: "Aircraft Technical & General", shortName: "ATG", icon: Plane, questionCount: 200, licence: "PPL(A)", color: "text-slate-500" },
  { code: "met", name: "Meteorology", shortName: "MET", icon: Cloud, questionCount: 217, licence: "PPL(A)", color: "text-cyan-500" },
  { code: "law", name: "Air Law", shortName: "LAW", icon: Scale, questionCount: 200, licence: "PPL(A)", color: "text-amber-500" },
  { code: "nav", name: "Navigation", shortName: "NAV", icon: Compass, questionCount: 200, licence: "PPL(A)", color: "text-green-500" },
  { code: "hp", name: "Human Performance", shortName: "HP", icon: Brain, questionCount: 200, licence: "PPL(A)", color: "text-purple-500" },
  { code: "fp", name: "Flight Planning", shortName: "FP", icon: Map, questionCount: 175, licence: "PPL(A)", color: "text-orange-500" },
  { code: "radio", name: "Restricted Radio", shortName: "Radio", icon: Radio, questionCount: 150, licence: "PPL(A)", color: "text-red-500" },
];

const HELICOPTER_SUBJECTS: Subject[] = [
  { code: "hpof", name: "Helicopter Principles of Flight", shortName: "HPOF", icon: RotateCw, questionCount: 100, licence: "PPL(H)", color: "text-indigo-500" },
  { code: "hfp", name: "Helicopter Flight Planning", shortName: "HFP", icon: Helicopter, questionCount: 100, licence: "PPL(H)", color: "text-teal-500" },
];

const QUESTION_COUNT_OPTIONS = [20, 30, 40, 60, 80];

export default function QuestionBankPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [questionCount, setQuestionCount] = useState(40);
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (!selectedSubject) return;

    setIsStarting(true);
    try {
      const res = await fetch("/api/question-bank/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectCode: selectedSubject.code,
          questionCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start exam");
      }

      toast.success(`${selectedSubject.shortName} exam started with ${data.questionCount} questions`);
      router.push(`/quiz/${data.quizId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start exam";
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubjectClick = (subject: Subject) => {
    if (selectedSubject?.code === subject.code) {
      setSelectedSubject(null);
    } else {
      setSelectedSubject(subject);
      setQuestionCount(Math.min(40, subject.questionCount));
    }
  };

  const renderSubjectCard = (subject: Subject) => {
    const Icon = subject.icon;
    const isSelected = selectedSubject?.code === subject.code;
    const availableOptions = QUESTION_COUNT_OPTIONS.filter((c) => c <= subject.questionCount);

    return (
      <Card
        key={subject.code}
        className={`cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
          isSelected
            ? "ring-2 ring-primary border-primary shadow-lg col-span-2 lg:col-span-1"
            : "hover:border-muted-foreground/30"
        }`}
        onClick={() => handleSubjectClick(subject)}
      >
        <CardContent className="py-4 px-4">
          <div className="flex items-center gap-3 min-h-[44px]">
            <div className={`p-2.5 sm:p-2 rounded-lg bg-muted/50 ${subject.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{subject.name}</p>
              <p className="text-xs text-muted-foreground">{subject.questionCount} questions</p>
            </div>
            {isSelected ? (
              <ChevronUp className="h-5 w-5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            ) : (
              <ChevronDown className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>

          {isSelected && (
            <div
              className="mt-4 pt-3 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="h-11 sm:h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
              >
                {availableOptions.map((count) => (
                  <option key={count} value={count}>
                    {count} questions
                  </option>
                ))}
              </select>

              <Button
                onClick={handleStart}
                disabled={isStarting}
                className="h-11 sm:h-9 gap-2 whitespace-nowrap"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4" />
                )}
                Start Exam
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
          Question Bank
        </h1>
        <p className="text-muted-foreground mt-1">
          Practice with SACAA PPL exam questions across all subjects
        </p>
      </div>

      {/* Aeroplane Subjects */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Plane className="h-5 w-5 text-muted-foreground" />
          Aeroplane — PPL(A)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {AEROPLANE_SUBJECTS.map(renderSubjectCard)}
        </div>
      </div>

      {/* Helicopter Subjects */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Helicopter className="h-5 w-5 text-muted-foreground" />
          Helicopter — PPL(H)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {HELICOPTER_SUBJECTS.map(renderSubjectCard)}
        </div>
      </div>
    </div>
  );
}
