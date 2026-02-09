"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, getMaxStorageForPlan } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const maxStorage = getMaxStorageForPlan(profile?.plan ?? null);
  const storagePercent = maxStorage > 0 ? Math.min(100, Math.round((storageUsed / maxStorage) * 100)) : 0;

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setIsLoadingStats(true);

    // Fetch storage usage
    const { data: docs } = await supabase
      .from("documents")
      .select("file_size")
      .eq("user_id", user.id);

    const totalBytes = (docs ?? []).reduce((sum: number, d: { file_size: number }) => sum + (d.file_size || 0), 0);
    setStorageUsed(totalBytes);

    // Fetch quiz count
    const { count } = await supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setQuizCount(count ?? 0);
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
      console.error("Delete account error:", err);
      toast.error("Failed to delete account. Please try again.");
    }
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
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

          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Plan:</span>
            <Badge variant={profile?.plan === "captains_club" ? "default" : "secondary"}>
              {profile?.plan === "captains_club" ? "Captain's Club" : "Basic"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingStats ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5" />
                    Storage
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(storageUsed)} / {formatBytes(maxStorage)}
                  </span>
                </div>
                <Progress value={storagePercent} className="h-2" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Total Quizzes
                </span>
                <span className="text-sm font-medium">{quizCount}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              className="text-destructive hover:text-destructive"
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
