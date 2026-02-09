"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, getMaxStorageForPlan } from "@/lib/constants";
import type { Document } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  Trash2,
  FileText,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);

  const maxStorage = getMaxStorageForPlan(profile?.plan ?? null);
  const storagePercent = maxStorage > 0 ? Math.min(100, Math.round((storageUsed / maxStorage) * 100)) : 0;

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setIsLoadingDocs(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load documents");
    } else {
      setDocuments(data ?? []);
      const totalBytes = (data ?? []).reduce((sum: number, d: Document) => sum + (d.file_size || 0), 0);
      setStorageUsed(totalBytes);
    }
    setIsLoadingDocs(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (storageUsed + file.size > maxStorage) {
      toast.error("Storage limit exceeded. Upgrade to Captain's Club for more storage.");
      return;
    }

    setIsUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setIsUploading(false);
      return;
    }

    const title = file.name.replace(/\.[^/.]+$/, "") || "Untitled Document";

    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      title,
      file_path: filePath,
      file_size: file.size,
      content_type: file.type,
    });

    if (dbError) {
      toast.error("Failed to save document record");
    } else {
      toast.success("Document uploaded successfully");
      fetchDocuments();
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([doc.file_path]);

    if (storageError) {
      toast.error("Failed to delete file from storage");
      return;
    }

    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("id", docId);

    if (dbError) {
      toast.error("Failed to delete document record");
    } else {
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      setStorageUsed((prev) => prev - (doc.file_size || 0));
    }
  };

  const toggleSelect = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleGenerateQuiz = async () => {
    if (selectedDocIds.length === 0) {
      toast.error("Select at least one document to generate a quiz");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedDocIds,
          numberOfQuestions,
          userId: user?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate quiz");
      }

      toast.success("Quiz generated successfully!");
      router.push(`/quiz/${data.quizId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate quiz";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Upload study materials and generate practice exams
        </p>
      </div>

      {/* Storage Usage */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Storage</span>
            <span className="text-sm text-muted-foreground">
              {formatBytes(storageUsed)} / {formatBytes(maxStorage)}
            </span>
          </div>
          <Progress value={storagePercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Upload + Generate */}
      <div className="flex flex-wrap gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.heic"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload Document
        </Button>

        <Button
          variant="secondary"
          onClick={handleGenerateQuiz}
          disabled={isGenerating || selectedDocIds.length === 0}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Generate Quiz ({selectedDocIds.length} selected)
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="numQuestions" className="text-sm text-muted-foreground whitespace-nowrap">
            Questions:
          </label>
          <select
            id="numQuestions"
            value={numberOfQuestions}
            onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
            className="bg-muted text-foreground text-sm rounded-md px-2 py-1.5 border border-border"
          >
            {[5, 10, 15, 20, 25, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents List */}
      {isLoadingDocs ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No documents yet</h3>
            <p className="text-muted-foreground text-sm">
              Upload your study materials to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            return (
              <Card
                key={doc.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => toggleSelect(doc.id)}
              >
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(doc.id);
                    }}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>

                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(doc.file_size)} •{" "}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
