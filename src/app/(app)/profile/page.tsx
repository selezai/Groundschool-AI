"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, getMaxStorageForPlan } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Mail,
  Crown,
  HardDrive,
  ClipboardList,
  Loader2,
  Save,
  Trash2,
  AlertTriangle,
  Settings,
  HelpCircle,
  Info,
  ChevronRight,
  FileText,
  Target,
  Check,
  Infinity,
  History,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";

export default function ProfilePage() {
  const { user, profile, isLoading, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  const maxStorage = getMaxStorageForPlan(profile?.plan ?? null);
  const storagePercent = maxStorage > 0 ? Math.min(100, Math.round((storageUsed / maxStorage) * 100)) : 0;

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setIsLoadingStats(true);

    // Fetch all stats in parallel — use minimal selects
    const [docsResult, quizzesResult, attemptsResult] = await Promise.all([
      supabase.from("documents").select("file_size").eq("user_id", user.id),
      supabase.from("quizzes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("quiz_attempts").select("score").eq("user_id", user.id),
    ]);

    // Storage — sum file sizes from the minimal query
    const docs = docsResult.data ?? [];
    const totalBytes = docs.reduce((sum: number, d: { file_size: number }) => sum + (d.file_size || 0), 0);
    setStorageUsed(totalBytes);
    setDocCount(docs.length);

    // Quiz count
    setQuizCount(quizzesResult.count ?? 0);

    // Average score
    const attempts = attemptsResult.data ?? [];
    if (attempts.length > 0) {
      const totalScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
      setAvgScore(Math.round(totalScore / attempts.length));
    }

    setIsLoadingStats(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile?.full_name]);

  const handleSaveName = async () => {
    if (!user || !fullName.trim()) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update name");
    } else {
      toast.success("Name updated");
      refreshProfile();
    }
    setIsSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase.functions.invoke("delete-user-account");
      if (error) throw error;

      toast.success("Account deleted");
      await signOut();
      router.push("/login");
    } catch (err) {
      toast.error("Failed to delete account. Please try again.");
    }
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  if (!user || isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isCaptainsClub = profile?.plan === "captains_club";

  const benefits = [
    { icon: Infinity, text: "Unlimited exam generation" },
    { icon: History, text: "Full exam history access" },
    { icon: HardDrive, text: "500MB storage" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>

      {/* User Info Card */}
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
              {(profile?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{profile?.full_name || "Pilot"}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="flex gap-2">
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
              <Button onClick={handleSaveName} disabled={isSaving} size="icon">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Captain's Club Membership Card */}
      <Card className={isCaptainsClub ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isCaptainsClub ? "bg-primary/20" : "bg-muted"}`}>
                <Crown className={`h-6 w-6 ${isCaptainsClub ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-semibold">{isCaptainsClub ? "Captain's Club" : "Basic Plan"}</p>
                <p className="text-xs text-muted-foreground">
                  {isCaptainsClub ? "Premium membership active" : "Upgrade for unlimited access"}
                </p>
              </div>
            </div>
            {isCaptainsClub && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                ACTIVE
              </span>
            )}
          </div>

          {isCaptainsClub ? (
            <div className="space-y-2 mb-4">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 mb-4">
              <p className="text-sm font-medium mb-1">Unlock unlimited exams</p>
              <p className="text-xs text-muted-foreground">R99/month • Cancel anytime</p>
            </div>
          )}

          <Button
            className="w-full"
            variant={isCaptainsClub ? "outline" : "default"}
            onClick={() => router.push("/captains-club")}
          >
            {isCaptainsClub ? "Manage Subscription" : "Upgrade to Captain's Club"}
          </Button>
        </CardContent>
      </Card>

      {/* My Activity Card */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            My Activity
          </h3>
          {isLoadingStats ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div className="p-3 sm:p-4 rounded-xl bg-muted/50">
                <p className="text-xl sm:text-2xl font-bold">{quizCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Exams Taken</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-muted/50">
                <p className="text-xl sm:text-2xl font-bold">{docCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Documents</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-muted/50">
                <p className="text-xl sm:text-2xl font-bold">{avgScore}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage & Quotas Card */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Usage & Quotas
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Storage</span>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(storageUsed)} / {formatBytes(maxStorage)}
                </span>
              </div>
              <Progress value={storagePercent} className="h-2" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Monthly Exams</span>
              <span className="text-sm font-medium">
                {isCaptainsClub ? "Unlimited" : `${profile?.monthly_quizzes_remaining ?? 5} remaining`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Card */}
      <Card>
        <CardContent className="pt-6 space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10">
              <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <span className="flex-1 font-medium">App Settings</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10">
              <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <span className="flex-1 font-medium">Help & Support</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/about"
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10">
              <Info className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <span className="flex-1 font-medium">About</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </h3>
          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This will permanently delete your account, all documents, quizzes, and data. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Yes, Delete My Account
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
