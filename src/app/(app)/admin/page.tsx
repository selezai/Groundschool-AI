"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Users,
  ClipboardList,
  FileText,
  DollarSign,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Shield,
  Zap,
  Crown,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_UUID = "c0023a5b-e4e9-4955-9ec7-2f9eed20db5a";
const REFRESH_INTERVAL = 60000; // 60 seconds

interface AnalyticsData {
  users: {
    total: number;
    active_7d: number;
    active_30d: number;
    plan_breakdown: { basic: number; captains_club: number };
    signups_by_day: Record<string, number>;
    top_users: {
      id: string;
      email: string;
      full_name: string | null;
      plan: string;
      plan_status: string | null;
      quizzes_created: number;
      attempts: number;
      storage_used_mb: number;
      created_at: string | null;
    }[];
  };
  quizzes: {
    total: number;
    active: number;
    failed: number;
    stuck: number;
    total_questions: number;
    total_attempts: number;
    total_responses: number;
    avg_score: number;
    pass_rate: number;
    by_day: Record<string, number>;
    recent: {
      id: string;
      title: string;
      status: string;
      question_count: number;
      created_at: string;
      user_email: string;
    }[];
    recent_attempts: {
      id: string;
      score: number;
      attempted_at: string;
      user_email: string;
      quiz_title: string;
    }[];
  };
  documents: {
    total: number;
    total_storage_mb: number;
    type_breakdown: Record<string, number>;
    uploads_by_day: Record<string, number>;
  };
  revenue: {
    paying_users: number;
    active_subscriptions: number;
    cancelled_but_active: number;
    estimated_mrr: number;
    paying_user_details: {
      id: string;
      email: string;
      full_name: string | null;
      plan: string;
      plan_status: string | null;
      pf_payment_id: string | null;
      plan_period_end: string | null;
    }[];
  };
  system: {
    groq_configured: boolean;
    gemini_configured: boolean;
    supabase_configured: boolean;
    service_role_configured: boolean;
    stuck_quizzes: {
      id: string;
      title: string;
      created_at: string;
      user_id: string;
    }[];
  };
  fetched_at: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "emerald" | "amber" | "rose" | "blue" | "purple";
}) {
  const colorMap = {
    primary: "from-primary/10 to-primary/5 border-primary/20 text-primary",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-500",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-500",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-500",
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-500",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-500",
  };

  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-4", colorMap[color])}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-background/50">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function MiniBarChart({ data, height = 60 }: { data: Record<string, number>; height?: number }) {
  const values = Object.values(data);
  const max = Math.max(...values, 1);
  const entries = Object.entries(data);

  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {entries.map(([key, val]) => (
        <div
          key={key}
          className="flex-1 bg-primary/60 rounded-t-sm hover:bg-primary transition-colors cursor-default group relative"
          style={{ height: `${Math.max((val / max) * 100, 2)}%` }}
          title={`${key}: ${val}`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
        ok
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
          : "bg-rose-500/10 border-rose-500/20 text-rose-600"
      )}
    >
      {ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      {label}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        if (res.status === 403) {
          router.push("/dashboard");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.id !== ADMIN_UUID) {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, authLoading, router, fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const runAction = async (action: string, params: Record<string, string> = {}) => {
    const key = `${action}-${params.targetUserId || params.quizId || ""}`;
    setActionLoading(key);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Action failed: ${json.error}`);
      } else {
        alert(json.message);
        fetchData();
      }
    } catch {
      alert("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-rose-500" />
        <p className="text-lg font-medium text-rose-500">Error loading analytics</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              System overview & analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(autoRefresh && "border-emerald-500/50 text-emerald-600")}
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* System Health Alerts */}
      {(data.system.stuck_quizzes.length > 0 ||
        !data.system.groq_configured ||
        !data.system.gemini_configured ||
        !data.system.service_role_configured) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-amber-600">Attention Required</h3>
          </div>
          <div className="space-y-2">
            {!data.system.service_role_configured && (
              <p className="text-sm text-rose-600 font-medium">SUPABASE_SERVICE_ROLE_KEY is not set — admin dashboard stats will be inaccurate (only showing your own data due to RLS).</p>
            )}
            {!data.system.groq_configured && (
              <p className="text-sm text-amber-700">Groq API key is not configured — primary AI provider is down.</p>
            )}
            {!data.system.gemini_configured && (
              <p className="text-sm text-amber-700">Gemini API key is not configured — fallback AI provider is down.</p>
            )}
            {data.system.stuck_quizzes.length > 0 && (
              <p className="text-sm text-amber-700">
                {data.system.stuck_quizzes.length} stuck quiz(es) detected (generating for &gt;10 min).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top-level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Total Users" value={data.users.total} color="blue" />
        <StatCard
          icon={Activity}
          label="Active (7d)"
          value={data.users.active_7d}
          sub={`${data.users.active_30d} in 30d`}
          color="emerald"
        />
        <StatCard icon={ClipboardList} label="Total Exams" value={data.quizzes.total} color="primary" />
        <StatCard icon={FileText} label="Documents" value={data.documents.total} color="purple" />
        <StatCard
          icon={DollarSign}
          label="MRR"
          value={`R${data.revenue.estimated_mrr}`}
          sub={`${data.revenue.active_subscriptions} subs`}
          color="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Pass Rate"
          value={`${data.quizzes.pass_rate}%`}
          sub={`Avg: ${data.quizzes.avg_score}%`}
          color="amber"
        />
      </div>

      {/* System Health */}
      <CollapsibleSection title="System Health" icon={Activity}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatusBadge ok={data.system.supabase_configured} label="Supabase" />
          <StatusBadge ok={data.system.service_role_configured} label="Service Role Key" />
          <StatusBadge ok={data.system.groq_configured} label="Groq AI (Primary)" />
          <StatusBadge ok={data.system.gemini_configured} label="Gemini AI (Fallback)" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Total Questions</p>
            <p className="text-lg font-bold">{data.quizzes.total_questions.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Total Attempts</p>
            <p className="text-lg font-bold">{data.quizzes.total_attempts.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Failed Generations</p>
            <p className={cn("text-lg font-bold", data.quizzes.failed > 0 ? "text-rose-500" : "text-foreground")}>
              {data.quizzes.failed}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Stuck Quizzes</p>
            <p className={cn("text-lg font-bold", data.quizzes.stuck > 0 ? "text-amber-500" : "text-foreground")}>
              {data.quizzes.stuck}
            </p>
          </div>
        </div>

        {data.system.stuck_quizzes.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Stuck Quizzes</h4>
            <div className="space-y-2">
              {data.system.stuck_quizzes.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div>
                    <p className="text-sm font-medium truncate max-w-[300px]">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(q.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAction("fix_stuck_quiz", { quizId: q.id })}
                    disabled={actionLoading === `fix_stuck_quiz-${q.id}`}
                  >
                    {actionLoading === `fix_stuck_quiz-${q.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Fix"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* User Analytics */}
      <CollapsibleSection title="Users" icon={Users}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Basic Plan</p>
            <p className="text-lg font-bold">{data.users.plan_breakdown.basic}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Captain&apos;s Club</p>
            <p className="text-lg font-bold">{data.users.plan_breakdown.captains_club}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Active (7 days)</p>
            <p className="text-lg font-bold">{data.users.active_7d}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Active (30 days)</p>
            <p className="text-lg font-bold">{data.users.active_30d}</p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Signups (Last 30 Days)</h4>
          <MiniBarChart data={data.users.signups_by_day} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{Object.keys(data.users.signups_by_day)[0]}</span>
            <span>{Object.keys(data.users.signups_by_day).slice(-1)[0]}</span>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Top Users</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">User</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Plan</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Exams</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Attempts</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Storage</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Joined</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.top_users.map((u) => (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-2 px-2">
                      <p className="font-medium truncate max-w-[200px]">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{u.email}</p>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          u.plan === "captains_club"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {u.plan === "captains_club" ? "CC" : "Basic"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{u.quizzes_created}</td>
                    <td className="py-2 px-2 text-right">{u.attempts}</td>
                    <td className="py-2 px-2 text-right">{u.storage_used_mb.toFixed(1)} MB</td>
                    <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.plan === "basic" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => runAction("upgrade_user", { targetUserId: u.id })}
                            disabled={actionLoading === `upgrade_user-${u.id}`}
                          >
                            {actionLoading === `upgrade_user-${u.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Crown className="h-3 w-3 mr-1" />
                                Upgrade
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => runAction("downgrade_user", { targetUserId: u.id })}
                            disabled={actionLoading === `downgrade_user-${u.id}`}
                          >
                            {actionLoading === `downgrade_user-${u.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Downgrade"
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => runAction("reset_quota", { targetUserId: u.id })}
                          disabled={actionLoading === `reset_quota-${u.id}`}
                        >
                          {actionLoading === `reset_quota-${u.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Reset Quota"
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>

      {/* Quiz Analytics */}
      <CollapsibleSection title="Exams" icon={ClipboardList}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Active Exams</p>
            <p className="text-lg font-bold">{data.quizzes.active}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Total Attempts</p>
            <p className="text-lg font-bold">{data.quizzes.total_attempts}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Avg Score</p>
            <p className="text-lg font-bold">{data.quizzes.avg_score}%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Pass Rate (≥75%)</p>
            <p className="text-lg font-bold">{data.quizzes.pass_rate}%</p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Exams Generated (Last 30 Days)</h4>
          <MiniBarChart data={data.quizzes.by_day} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{Object.keys(data.quizzes.by_day)[0]}</span>
            <span>{Object.keys(data.quizzes.by_day).slice(-1)[0]}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Exams</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.quizzes.recent.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.user_email} · {q.question_count} Q · {new Date(q.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0",
                      q.status === "active"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : q.status === "generating"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-rose-500/10 text-rose-500"
                    )}
                  >
                    {q.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Recent Attempts</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.quizzes.recent_attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.quiz_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.user_email} · {new Date(a.attempted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold ml-2 shrink-0",
                      a.score >= 75 ? "text-emerald-500" : "text-rose-500"
                    )}
                  >
                    {a.score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Document Analytics */}
      <CollapsibleSection title="Documents" icon={FileText}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Total Documents</p>
            <p className="text-lg font-bold">{data.documents.total}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Total Storage</p>
            <p className="text-lg font-bold">{data.documents.total_storage_mb} MB</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">File Types</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(data.documents.type_breakdown).map(([type, count]) => (
                <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Uploads (Last 30 Days)</h4>
          <MiniBarChart data={data.documents.uploads_by_day} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{Object.keys(data.documents.uploads_by_day)[0]}</span>
            <span>{Object.keys(data.documents.uploads_by_day).slice(-1)[0]}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Revenue */}
      <CollapsibleSection title="Revenue" icon={DollarSign}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">R{data.revenue.estimated_mrr}</p>
            <p className="text-xs text-muted-foreground mt-1">R99/month × {data.revenue.active_subscriptions} subscribers</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Paying Users</p>
            <p className="text-2xl font-bold">{data.revenue.paying_users}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
            <p className="text-2xl font-bold">
              {data.users.total > 0
                ? ((data.revenue.paying_users / data.users.total) * 100).toFixed(1)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.revenue.paying_users} of {data.users.total} users
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground">Cancelled (Still Active)</p>
            <p className={cn("text-2xl font-bold", data.revenue.cancelled_but_active > 0 ? "text-amber-500" : "text-foreground")}>
              {data.revenue.cancelled_but_active}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Access until period ends
            </p>
          </div>
        </div>

        {data.revenue.paying_user_details.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Paying User Details</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">User</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Plan</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Payment ID</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Period End</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenue.paying_user_details.map((u) => (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <p className="font-medium truncate max-w-[180px]">{u.full_name || "\u2014"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                      </td>
                      <td className="py-2 px-2">
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          u.plan === "captains_club" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                        )}>
                          {u.plan === "captains_club" ? "CC" : "Basic"}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          u.plan_status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                          u.plan_status === "cancelled" ? "bg-rose-500/10 text-rose-500" :
                          "bg-amber-500/10 text-amber-500"
                        )}>
                          {u.plan_status || "unknown"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                        {u.pf_payment_id || "\u2014"}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {u.plan_period_end ? new Date(u.plan_period_end).toLocaleDateString() : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" />
        <span>Data fetched at {new Date(data.fetched_at).toLocaleString()}</span>
        {autoRefresh && <span>· Auto-refreshing every 60s</span>}
      </div>
    </div>
  );
}
