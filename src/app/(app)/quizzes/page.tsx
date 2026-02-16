"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import type { Quiz } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  Trash2,
  Play,
  Loader2,
  Sparkles,
  Lock,
  Crown,
  Clock,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "in_progress" | "completed";

export default function QuizzesPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>("in_progress");
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  const fetchQuizzes = useCallback(async () => {
    if (!user) return;
    setIsLoadingQuizzes(true);
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load exams");
    } else {
      setAllQuizzes(data ?? []);
    }
    setIsLoadingQuizzes(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const inProgressQuizzes = allQuizzes.filter((q) => q.status === "active");
  const completedQuizzes = allQuizzes.filter((q) => q.status === "completed");
  const displayedQuizzes = activeTab === "in_progress" ? inProgressQuizzes : completedQuizzes;

  const handleDelete = async (quizId: string) => {
    setDeletingId(quizId);

    // Delete questions first, then quiz
    const { error: qError } = await supabase
      .from("questions")
      .delete()
      .eq("quiz_id", quizId);

    if (qError) {
      toast.error("Failed to delete exam questions");
      setDeletingId(null);
      return;
    }

    // Delete attempt responses first (foreign key to quiz_attempts)
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("quiz_id", quizId);

    if (attempts && attempts.length > 0) {
      const attemptIds = attempts.map((a: { id: string }) => a.id);
      await supabase.from("quiz_question_responses").delete().in("attempt_id", attemptIds);
    }

    // Delete attempts
    await supabase.from("quiz_attempts").delete().eq("quiz_id", quizId);

    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);

    if (error) {
      toast.error("Failed to delete exam");
    } else {
      toast.success("Exam deleted");
      setAllQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    }
    setDeletingId(null);
  };

  if (!user || isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile.plan !== "captains_club") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Exams</h1>
          <p className="text-muted-foreground">Review and retake your practice exams</p>
        </div>
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Captain&apos;s Club Feature</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Upgrade to Captain&apos;s Club to access your full exam history. Review past exams, track your progress, and retake exams anytime.
            </p>
            <Button onClick={() => router.push("/captains-club")} className="gap-2">
              <Crown className="h-4 w-4" />
              Upgrade to Captain&apos;s Club
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Exams</h1>
        <p className="text-muted-foreground">
          Review and retake your practice exams
        </p>
      </div>

      {/* Pill-style Tabs */}
      <div className="inline-flex rounded-xl bg-muted p-1 gap-1">
        <button
          onClick={() => { setActiveTab("in_progress"); setVisibleCount(20); }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "in_progress"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
          In Progress
          {inProgressQuizzes.length > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {inProgressQuizzes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab("completed"); setVisibleCount(20); }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "completed"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Completed
          {completedQuizzes.length > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {completedQuizzes.length}
            </span>
          )}
        </button>
      </div>

      {isLoadingQuizzes ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : displayedQuizzes.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {activeTab === "in_progress" ? (
                <Clock className="h-8 w-8 text-primary" />
              ) : (
                <ClipboardList className="h-8 w-8 text-primary" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {activeTab === "in_progress" ? "No exams in progress" : "No completed exams"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              {activeTab === "in_progress"
                ? "Start a new exam from the Question Bank or upload study materials to generate one."
                : "Complete an exam to see your results here."}
            </p>
            <Button onClick={() => router.push(activeTab === "in_progress" ? "/question-bank" : "/dashboard")}>
              <Sparkles className="h-4 w-4 mr-2" />
              {activeTab === "in_progress" ? "Go to Question Bank" : "Create an Exam"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayedQuizzes.slice(0, visibleCount).map((quiz) => (
            <Card key={quiz.id} className="hover:bg-muted/50 transition-colors active:scale-[0.99]">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <button
                  onClick={() => router.push(`/quiz/${quiz.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  {activeTab === "in_progress" ? (
                    <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 w-0">
                    <p className="text-sm font-medium truncate">{quiz.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {quiz.question_count} questions •{" "}
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-primary"
                    onClick={() => router.push(`/quiz/${quiz.id}`)}
                  >
                    {activeTab === "in_progress" ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === quiz.id}
                    onClick={() => setDeleteConfirmId(quiz.id)}
                  >
                    {deletingId === quiz.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {displayedQuizzes.length > visibleCount && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisibleCount((prev) => prev + 20)}
            >
              Show More ({displayedQuizzes.length - visibleCount} remaining)
            </Button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="text-lg font-semibold">Delete Exam</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete this exam, all questions, and attempt history. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
