"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import type { Quiz, QuizQuestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Trophy,
  RotateCcw,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());
  const [showExplanation, setShowExplanation] = useState(false);

  const fetchQuiz = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .single();

    if (quizError || !quizData) {
      toast.error("Quiz not found");
      router.push("/quizzes");
      return;
    }

    const { data: questionsData, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", id)
      .order("id");

    if (questionsError) {
      toast.error("Failed to load questions");
      return;
    }

    setQuiz(quizData);
    setQuestions(questionsData ?? []);
    setIsLoading(false);
  }, [id, supabase, router]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  const selectAnswer = (optionId: string) => {
    if (isCompleted) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
    setShowExplanation(false);
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowExplanation(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowExplanation(false);
    }
  };

  const handleSubmit = async () => {
    if (answeredCount < questions.length) {
      const unanswered = questions.length - answeredCount;
      if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) {
        return;
      }
    }

    setIsSubmitting(true);

    // Calculate score
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_answer_id) {
        correct++;
      }
    });

    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);

    // Save attempt
    if (user) {
      const completionTime = Math.round((Date.now() - startTime) / 1000);
      await supabase.from("quiz_attempts").insert({
        quiz_id: id,
        user_id: user.id,
        score: finalScore,
        total_questions: questions.length,
        completion_time: completionTime,
        answers,
      });
    }

    setIsCompleted(true);
    setCurrentIndex(0);
    setIsSubmitting(false);
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setIsCompleted(false);
    setScore(0);
    setShowExplanation(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Results screen
  if (isCompleted) {
    const correct = questions.filter((q) => answers[q.id] === q.correct_answer_id).length;
    const passed = score >= 70;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy
              className={cn(
                "h-16 w-16 mx-auto mb-4",
                passed ? "text-green-500" : "text-yellow-500"
              )}
            />
            <h2 className="text-2xl font-bold mb-2">
              {passed ? "Well Done!" : "Keep Studying!"}
            </h2>
            <p className="text-4xl font-bold text-primary mb-2">{score}%</p>
            <p className="text-muted-foreground">
              {correct} of {questions.length} correct
            </p>
          </CardContent>
        </Card>

        {/* Review answers */}
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const userAnswer = answers[q.id];
            const isCorrect = userAnswer === q.correct_answer_id;
            return (
              <Card key={q.id} className={isCorrect ? "border-green-500/30" : "border-destructive/30"}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-2 mb-3">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium">
                      {idx + 1}. {q.question_text}
                    </p>
                  </div>
                  <div className="ml-7 space-y-1">
                    {q.options.map((opt) => {
                      const isUserChoice = userAnswer === opt.id;
                      const isCorrectOption = q.correct_answer_id === opt.id;
                      return (
                        <p
                          key={opt.id}
                          className={cn(
                            "text-sm px-2 py-1 rounded",
                            isCorrectOption && "bg-green-500/10 text-green-400",
                            isUserChoice && !isCorrectOption && "bg-destructive/10 text-destructive"
                          )}
                        >
                          {opt.id.toUpperCase()}. {opt.text}
                          {isCorrectOption && " ✓"}
                          {isUserChoice && !isCorrectOption && " ✗"}
                        </p>
                      );
                    })}
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetake} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake
          </Button>
          <Button onClick={() => router.push("/dashboard")} className="flex-1">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Quiz taking screen
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold truncate">{quiz?.title}</h1>
          <span className="text-sm text-muted-foreground whitespace-nowrap ml-2">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {currentQuestion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base leading-relaxed">
              {currentQuestion.question_text}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentQuestion.options.map((opt) => {
              const isSelected = answers[currentQuestion.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(opt.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50 text-foreground"
                  )}
                >
                  <span className="font-medium mr-2">
                    {opt.id.toUpperCase()}.
                  </span>
                  {opt.text}
                </button>
              );
            })}

            {showExplanation && currentQuestion.explanation && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {currentQuestion.explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          {answeredCount} / {questions.length} answered
        </span>

        {currentIndex === questions.length - 1 ? (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Submit
          </Button>
        ) : (
          <Button variant="outline" onClick={goNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
