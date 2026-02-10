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
} from "lucide-react";
import { toast } from "sonner";

export default function QuizzesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchQuizzes = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load quizzes");
    } else {
      setQuizzes(data ?? []);
    }
    setIsLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleDelete = async (quizId: string) => {
    setDeletingId(quizId);

    // Delete questions first, then quiz
    const { error: qError } = await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", quizId);

    if (qError) {
      toast.error("Failed to delete quiz questions");
      setDeletingId(null);
      return;
    }

    // Delete attempts
    await supabase.from("quiz_attempts").delete().eq("quiz_id", quizId);

    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);

    if (error) {
      toast.error("Failed to delete quiz");
    } else {
      toast.success("Quiz deleted");
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Quizzes</h1>
        <p className="text-muted-foreground">
          Review and retake your practice exams
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Upload study materials and generate your first AI-powered practice exam.
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              <Sparkles className="h-4 w-4 mr-2" />
              Create Your First Quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{quiz.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {quiz.question_count} questions •{" "}
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/quiz/${quiz.id}`)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deletingId === quiz.id}
                    onClick={() => handleDelete(quiz.id)}
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
        </div>
      )}
    </div>
  );
}
