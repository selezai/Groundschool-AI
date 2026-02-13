"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, getMaxStorageForPlan } from "@/lib/constants";
import type { Document } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  BookOpen,
  FileUp,
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [visibleCount, setVisibleCount] = useState(20);

  const maxStorage = getMaxStorageForPlan(profile?.plan ?? null);
  const storagePercent = maxStorage > 0 ? Math.min(100, Math.round((storageUsed / maxStorage) * 100)) : 0;

  const computeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const [greeting, setGreeting] = useState(computeGreeting);

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(computeGreeting());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "Pilot";

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

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
  const UNSUPPORTED_EXTENSIONS = [".doc", ".docx"];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    if (UNSUPPORTED_EXTENSIONS.includes(fileExt)) {
      toast.error("Word documents (.doc/.docx) are not supported. Please convert to PDF first.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 25MB per file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (storageUsed + file.size > maxStorage) {
      toast.error("Storage limit exceeded. Upgrade to Captain's Club for more storage.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Server-side validation before upload
    try {
      const validateRes = await fetch("/api/validate-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: file.size, fileName: file.name }),
      });
      if (!validateRes.ok) {
        const validateData = await validateRes.json();
        toast.error(validateData.error || "Upload validation failed");
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    } catch {
      toast.error("Could not validate upload. Please try again.");
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filePath = `${user.id}/${Date.now()}${fileExt}`;

    // Upload with progress tracking via XMLHttpRequest
    const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/documents/${filePath}`;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const uploadResult = await new Promise<{ error: string | null }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ error: null });
        } else {
          resolve({ error: `Upload failed (${xhr.status})` });
        }
      };
      xhr.onerror = () => resolve({ error: "Upload failed. Check your connection." });
      xhr.open("POST", uploadUrl);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.send(file);
    });

    if (uploadResult.error) {
      toast.error(uploadResult.error);
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const title = file.name.replace(/\.[^/.]+$/, "") || "Untitled Document";

    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      title,
      file_path: filePath,
      file_size: file.size,
      document_type: file.type || "application/octet-stream",
    });

    if (dbError) {
      // Rollback: remove orphaned file from storage
      await supabase.storage.from("documents").remove([filePath]);
      toast.error("Failed to save document record. Please try again.");
    } else {
      toast.success("Document uploaded successfully");
      fetchDocuments();
    }

    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    // Delete DB record first to avoid ghost records pointing to deleted files
    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("id", docId);

    if (dbError) {
      toast.error("Failed to delete document record");
      return;
    }

    // Then remove from storage (best-effort; orphaned file is less harmful than ghost record)
    await supabase.storage.from("documents").remove([doc.file_path]);

    toast.success("Document deleted");
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
    setStorageUsed((prev) => prev - (doc.file_size || 0));
  };

  const toggleSelect = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleGenerateQuiz = async () => {
    if (selectedDocIds.length === 0) {
      toast.error("Select at least one document to generate an exam");
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
        throw new Error(data.error || "Failed to generate exam");
      }

      const generated = data.questionCount || 0;
      if (generated < numberOfQuestions) {
        toast.success(`Exam generated with ${generated} questions (document content supported ${generated} of ${numberOfQuestions} requested)`);
      } else {
        toast.success("Exam generated successfully!");
      }
      router.push(`/quiz/${data.quizId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate exam";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 overflow-x-hidden">
      {/* Hero Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {greeting}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Upload study materials and generate AI-powered practice exams
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Storage Card */}
        <div className="stat-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 w-fit">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Storage Used</p>
              <p className="text-lg sm:text-xl font-semibold">{formatBytes(storageUsed)}</p>
            </div>
          </div>
          <Progress value={storagePercent} className="h-1.5 sm:h-2" />
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2">{formatBytes(maxStorage - storageUsed)} remaining</p>
        </div>

        {/* Documents Card */}
        <div className="stat-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 w-fit">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Documents</p>
              <p className="text-lg sm:text-xl font-semibold">{documents.length}</p>
            </div>
          </div>
        </div>

        {/* Selected Card */}
        <div className="stat-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-amber-500/10 w-fit">
              <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Selected for Exam</p>
              <p className="text-lg sm:text-xl font-semibold">{selectedDocIds.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.png,.jpg,.jpeg,.heic"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isGenerating}
          className="gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? `Uploading ${uploadProgress}%` : "Upload Document"}
        </Button>

        <Button
          onClick={handleGenerateQuiz}
          disabled={isGenerating || selectedDocIds.length === 0}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Exam
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:ml-auto">
          <div className="flex items-center gap-2">
            <label htmlFor="numQuestions" className="text-sm text-muted-foreground whitespace-nowrap">
              Questions:
            </label>
            <select
              id="numQuestions"
              value={numberOfQuestions}
              onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
              className="bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            >
              {[5, 10, 15, 20, 25, 30, 40, 50, 75, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground/70 italic">
            Actual count depends on document content
          </p>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Documents</h2>
        {documents.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : 'Select documents to generate exam'}
          </span>
        )}
      </div>

      {/* Documents List */}
      {isLoadingDocs ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="relative rounded-2xl border-2 border-dashed border-border/50 bg-gradient-to-b from-card/50 to-transparent p-12 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="relative">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Ready to start studying?</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your aviation study materials (PDFs, notes, images) and let AI generate practice exams for you.
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading}
              size="lg"
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
            >
              <FileUp className="h-5 w-5" />
              Upload Your First Document
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.slice(0, visibleCount).map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => !isGenerating && toggleSelect(doc.id)}
                className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                  isGenerating
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover-lift"
                } ${
                  isSelected 
                    ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/5" 
                    : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
                }`}
              >
                <div className="flex items-center gap-4 w-full overflow-hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isGenerating) toggleSelect(doc.id);
                    }}
                    className={`flex-shrink-0 rounded-lg p-2 transition-colors ${
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <div className="p-2 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0 w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatBytes(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isGenerating) handleDelete(doc.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {documents.length > visibleCount && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisibleCount((prev) => prev + 20)}
            >
              Show More ({documents.length - visibleCount} remaining)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
