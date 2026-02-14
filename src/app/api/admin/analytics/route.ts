import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin";

// Fetch all rows from a table, bypassing the default 1000-row limit
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(supabase: any, table: string, select: string) {
  const PAGE_SIZE = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
}

export async function GET() {
  try {
    // Step 1: Authenticate the requesting user via the regular (RLS) client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminUser(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Step 2: Use service role client for all data queries (bypasses RLS)
    // Falls back to regular client if service role key is not configured
    // (stats will only show admin's own data in that case)
    const adminClient = createAdminClient();
    const db = adminClient || supabase;
    const hasServiceRole = !!adminClient;

    // Step 3: Fetch all data in parallel
    const [
      profiles,
      quizzes,
      documents,
      attempts,
      questionsCountRes,
      responsesCountRes,
    ] = await Promise.all([
      fetchAll(db, "profiles", "*"),
      fetchAll(db, "quizzes", "*"),
      fetchAll(db, "documents", "id, user_id, file_size, document_type, created_at"),
      fetchAll(db, "quiz_attempts", "*"),
      db.from("questions").select("id", { count: "exact", head: true }),
      db.from("quiz_question_responses").select("id", { count: "exact", head: true }),
    ]);

    const totalQuestions = questionsCountRes.count || 0;
    const totalResponses = responsesCountRes.count || 0;

    // Step 4: Get actual signup dates from auth.users via admin API
    // Only works with service role key — falls back to updated_at from profiles
    const authUsersMap: Record<string, string> = {}; // userId -> created_at
    if (adminClient) {
      let page = 1;
      let hasMoreUsers = true;
      while (hasMoreUsers) {
        const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (authError || !authData?.users?.length) break;
        for (const u of authData.users) {
          authUsersMap[u.id] = u.created_at;
        }
        hasMoreUsers = authData.users.length === 1000;
        page++;
      }
    } else {
      // Fallback: use profiles.updated_at as approximate signup date
      for (const p of profiles) {
        if (p.updated_at) {
          authUsersMap[p.id] = p.updated_at;
        }
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // --- USER ANALYTICS ---
    const totalUsers = profiles.length;

    // Active users = users who performed ANY action in the time window:
    // quiz attempts, quiz generation, or document uploads
    const activeUserIds7d = new Set<string>();
    const activeUserIds30d = new Set<string>();

    // From quiz attempts
    for (const a of attempts) {
      const ts = new Date(a.attempted_at);
      if (ts >= sevenDaysAgo) activeUserIds7d.add(a.user_id);
      if (ts >= thirtyDaysAgo) activeUserIds30d.add(a.user_id);
    }
    // From quiz generation
    for (const q of quizzes) {
      const ts = new Date(q.created_at);
      if (ts >= sevenDaysAgo) activeUserIds7d.add(q.user_id);
      if (ts >= thirtyDaysAgo) activeUserIds30d.add(q.user_id);
    }
    // From document uploads
    for (const d of documents) {
      const ts = new Date(d.created_at);
      if (ts >= sevenDaysAgo) activeUserIds7d.add(d.user_id);
      if (ts >= thirtyDaysAgo) activeUserIds30d.add(d.user_id);
    }

    const planBreakdown = {
      basic: profiles.filter((p) => p.plan === "basic").length,
      captains_club: profiles.filter((p) => p.plan === "captains_club").length,
    };

    // Signups over time (last 30 days) — uses auth.users created_at
    const signupsByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      signupsByDay[d.toISOString().split("T")[0]] = 0;
    }
    for (const userId of Object.keys(authUsersMap)) {
      const createdAt = authUsersMap[userId];
      if (createdAt) {
        const day = new Date(createdAt).toISOString().split("T")[0];
        if (signupsByDay[day] !== undefined) {
          signupsByDay[day]++;
        }
      }
    }

    // --- QUIZ ANALYTICS ---
    const totalQuizzes = quizzes.length;
    const activeQuizzes = quizzes.filter((q) => q.status === "active").length;
    const failedQuizzes = quizzes.filter(
      (q) => q.status === "generating" || q.status === "failed"
    ).length;
    const totalAttempts = attempts.length;
    const avgScore =
      attempts.length > 0
        ? Math.round(
            attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length
          )
        : 0;
    const passRate =
      attempts.length > 0
        ? Math.round(
            (attempts.filter((a) => (a.score || 0) >= 75).length / attempts.length) * 100
          )
        : 0;

    // Quizzes generated per day (last 30 days)
    const quizzesByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      quizzesByDay[d.toISOString().split("T")[0]] = 0;
    }
    for (const q of quizzes) {
      const day = new Date(q.created_at).toISOString().split("T")[0];
      if (quizzesByDay[day] !== undefined) {
        quizzesByDay[day]++;
      }
    }

    // --- DOCUMENT ANALYTICS ---
    const totalDocuments = documents.length;
    const totalStorageMB = profiles.reduce(
      (sum, p) => sum + (p.storage_used_mb || 0),
      0
    );
    const docTypeBreakdown: Record<string, number> = {};
    for (const d of documents) {
      const type = d.document_type || "unknown";
      docTypeBreakdown[type] = (docTypeBreakdown[type] || 0) + 1;
    }

    // Uploads per day (last 30 days)
    const uploadsByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      uploadsByDay[d.toISOString().split("T")[0]] = 0;
    }
    for (const d of documents) {
      const day = new Date(d.created_at).toISOString().split("T")[0];
      if (uploadsByDay[day] !== undefined) {
        uploadsByDay[day]++;
      }
    }

    // --- REVENUE ANALYTICS ---
    // Paying users: have a PayFast payment ID
    const payingUsers = profiles.filter((p) => p.pf_payment_id !== null);
    // Active subscriptions: on captain's club plan AND have a payment ID AND plan_status is active
    const activeSubscriptions = profiles.filter(
      (p) =>
        p.plan === "captains_club" &&
        p.pf_payment_id !== null &&
        (p.plan_status === "active" || p.plan_status === "trialing")
    ).length;
    // Cancelled but still have access (period not ended)
    const cancelledButActive = profiles.filter(
      (p) =>
        p.plan === "captains_club" &&
        p.pf_payment_id !== null &&
        p.plan_status === "cancelled" &&
        p.plan_period_end &&
        new Date(p.plan_period_end) > now
    ).length;
    // R99/month per active paying subscriber
    const estimatedMRR = activeSubscriptions * 99;
    // Detailed paying user info for admin inspection
    const payingUserDetails = payingUsers.map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      plan: p.plan,
      plan_status: p.plan_status,
      pf_payment_id: p.pf_payment_id,
      plan_period_end: p.plan_period_end,
    }));

    // --- SYSTEM HEALTH ---
    const groqConfigured = !!process.env.GROQ_API_KEY;
    const geminiConfigured = !!process.env.GOOGLE_API_KEY;
    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleConfigured = hasServiceRole;

    // Stuck quizzes: generating status for more than 10 minutes
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const stuckQuizzes = quizzes.filter(
      (q) => q.status === "generating" && new Date(q.created_at) < tenMinutesAgo
    );

    // --- TOP USERS ---
    const userQuizCounts: Record<string, number> = {};
    for (const q of quizzes) {
      userQuizCounts[q.user_id] = (userQuizCounts[q.user_id] || 0) + 1;
    }
    const userAttemptCounts: Record<string, number> = {};
    for (const a of attempts) {
      userAttemptCounts[a.user_id] = (userAttemptCounts[a.user_id] || 0) + 1;
    }
    const topUsers = profiles
      .map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        plan: p.plan,
        plan_status: p.plan_status,
        quizzes_created: userQuizCounts[p.id] || 0,
        attempts: userAttemptCounts[p.id] || 0,
        storage_used_mb: p.storage_used_mb || 0,
        created_at: authUsersMap[p.id] || null,
      }))
      .sort((a, b) => b.quizzes_created - a.quizzes_created)
      .slice(0, 10);

    // --- RECENT ACTIVITY ---
    const recentQuizzes = [...quizzes]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 10)
      .map((q) => {
        const owner = profiles.find((p) => p.id === q.user_id);
        return {
          id: q.id,
          title: q.title,
          status: q.status,
          question_count: q.question_count,
          created_at: q.created_at,
          user_email: owner?.email || "Unknown",
        };
      });

    const recentAttempts = [...attempts]
      .sort(
        (a, b) =>
          new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime()
      )
      .slice(0, 10)
      .map((a) => {
        const owner = profiles.find((p) => p.id === a.user_id);
        const quiz = quizzes.find((q) => q.id === a.quiz_id);
        return {
          id: a.id,
          score: a.score,
          attempted_at: a.attempted_at,
          user_email: owner?.email || "Unknown",
          quiz_title: quiz?.title || "Unknown",
        };
      });

    return NextResponse.json({
      users: {
        total: totalUsers,
        active_7d: activeUserIds7d.size,
        active_30d: activeUserIds30d.size,
        plan_breakdown: planBreakdown,
        signups_by_day: signupsByDay,
        top_users: topUsers,
      },
      quizzes: {
        total: totalQuizzes,
        active: activeQuizzes,
        failed: failedQuizzes,
        stuck: stuckQuizzes.length,
        total_questions: totalQuestions,
        total_attempts: totalAttempts,
        total_responses: totalResponses,
        avg_score: avgScore,
        pass_rate: passRate,
        by_day: quizzesByDay,
        recent: recentQuizzes,
        recent_attempts: recentAttempts,
      },
      documents: {
        total: totalDocuments,
        total_storage_mb: Math.round(totalStorageMB * 100) / 100,
        type_breakdown: docTypeBreakdown,
        uploads_by_day: uploadsByDay,
      },
      revenue: {
        paying_users: payingUsers.length,
        active_subscriptions: activeSubscriptions,
        cancelled_but_active: cancelledButActive,
        estimated_mrr: estimatedMRR,
        paying_user_details: payingUserDetails,
      },
      system: {
        groq_configured: groqConfigured,
        gemini_configured: geminiConfigured,
        supabase_configured: supabaseConfigured,
        service_role_configured: serviceRoleConfigured,
        stuck_quizzes: stuckQuizzes.map((q) => ({
          id: q.id,
          title: q.title,
          created_at: q.created_at,
          user_id: q.user_id,
        })),
      },
      fetched_at: now.toISOString(),
    });
  } catch (err) {
    console.error("[admin-analytics] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
