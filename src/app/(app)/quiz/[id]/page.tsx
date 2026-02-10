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
  Star,
  Target,
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
    if (!id || !user) return;
    setIsLoading(true);

    try {
      // Fetch quiz with user ownership check
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (quizError || !quizData) {
        toast.error("Exam not found or access denied");
        router.push("/quizzes");
        return;
      }

      // Fetch questions for this quiz
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", id)
        .order("order_index", { ascending: true });

      if (questionsError) {
        toast.error("Failed to load questions. Please try again.");
        return;
      }

      if (!questionsData || questionsData.length === 0) {
        toast.error("No questions found for this exam");
        router.push("/quizzes");
        return;
      }

      // Map database columns to expected interface
      const mappedQuestions = questionsData.map((q: { id: string; quiz_id: string; text: string; options: { id: string; text: string }[]; correct_answer: string; explanation: string | null }) => ({
        id: q.id,
        quiz_id: q.quiz_id,
        question_text: q.text,
        options: q.options,
        correct_answer_id: q.correct_answer,
        explanation: q.explanation,
      }));

      setQuiz(quizData);
      setQuestions(mappedQuestions);
      setIsLoading(false);
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }, [id, user, supabase, router]);

  useEffect(() => {
    if (user) {
      fetchQuiz();
    }
  }, [fetchQuiz, user]);

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

    // Save attempt with columns matching existing Supabase schema
    if (user) {
      const completionTime = Math.round((Date.now() - startTime) / 1000);
      await supabase.from("quiz_attempts").insert({
        quiz_id: id,
        user_id: user.id,
        score: finalScore,
        completion_time: completionTime,
        attempted_at: new Date().toISOString(),
        metadata: {
          total_questions: questions.length,
          answers,
        },
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
        <Card className={cn(
          "overflow-hidden",
          passed ? "border-green-500/30" : "border-yellow-500/30"
        )}>
          <div className={cn(
            "h-2",
            passed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-yellow-500 to-orange-400"
          )} />
          <CardContent className="py-10 text-center">
            <div className={cn(
              "mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4",
              passed ? "bg-green-500/10" : "bg-yellow-500/10"
            )}>
              {passed ? (
                <Trophy className="h-10 w-10 text-green-500" />
              ) : (
                <Target className="h-10 w-10 text-yellow-500" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {passed ? "Excellent Work!" : "Keep Practicing!"}
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              {passed ? "You're on track for success" : "Review the material and try again"}
            </p>
            <div className={cn(
              "inline-flex items-center gap-2 px-6 py-3 rounded-full mb-4",
              passed ? "bg-green-500/10" : "bg-yellow-500/10"
            )}>
              <span className={cn(
                "text-5xl font-bold",
                passed ? "text-green-500" : "text-yellow-500"
              )}>{score}%</span>
            </div>
            <p className="text-muted-foreground">
              {correct} of {questions.length} questions correct
            </p>
            {passed && score >= 90 && (
              <div className="flex items-center justify-center gap-1 mt-3 text-yellow-500">
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
              </div>
            )}
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
                    "w-full text-left px-4 py-4 sm:py-3 rounded-xl border transition-colors text-sm min-h-[52px] active:scale-[0.98]",
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
