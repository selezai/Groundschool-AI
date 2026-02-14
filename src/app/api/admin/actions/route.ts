import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin";

export async function POST(request: Request) {
  try {
    // Authenticate the requesting user via the regular (RLS) client
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminUser(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client for all mutations (bypasses RLS)
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured. Admin actions require the service role key." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, targetUserId, quizId } = body;

    switch (action) {
      case "reset_quota": {
        if (!targetUserId) {
          return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
        }
        const { error } = await admin
          .from("profiles")
          .update({
            monthly_quizzes_remaining: 10,
            last_quota_reset_date: new Date().toISOString(),
          })
          .eq("id", targetUserId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Quota reset to 10" });
      }

      case "upgrade_user": {
        if (!targetUserId) {
          return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
        }
        const { error } = await admin
          .from("profiles")
          .update({
            plan: "captains_club",
            plan_status: "active",
            monthly_quizzes_remaining: -1,
            can_access_past_exams: true,
          })
          .eq("id", targetUserId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "User upgraded to Captain's Club" });
      }

      case "downgrade_user": {
        if (!targetUserId) {
          return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
        }
        const { error } = await admin
          .from("profiles")
          .update({
            plan: "basic",
            plan_status: "basic",
            monthly_quizzes_remaining: 10,
            can_access_past_exams: false,
          })
          .eq("id", targetUserId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "User downgraded to Basic" });
      }

      case "fix_stuck_quiz": {
        if (!quizId) {
          return NextResponse.json({ error: "Missing quizId" }, { status: 400 });
        }
        // Check if quiz has questions — if yes, mark active; if no, delete it
        const { count } = await admin
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("quiz_id", quizId);

        if (count && count > 0) {
          await admin
            .from("quizzes")
            .update({ status: "active", question_count: count })
            .eq("id", quizId);
          return NextResponse.json({ success: true, message: `Quiz fixed — marked active with ${count} questions` });
        } else {
          await admin.from("questions").delete().eq("quiz_id", quizId);
          await admin.from("quizzes").delete().eq("id", quizId);
          return NextResponse.json({ success: true, message: "Stuck quiz deleted (had no questions)" });
        }
      }

      case "delete_quiz": {
        if (!quizId) {
          return NextResponse.json({ error: "Missing quizId" }, { status: 400 });
        }
        // Delete in correct order respecting foreign keys:
        // 1. Get all attempt IDs for this quiz
        const { data: attemptRows } = await admin
          .from("quiz_attempts")
          .select("id")
          .eq("quiz_id", quizId);
        // 2. Delete quiz_question_responses via attempt_id (not question_id)
        if (attemptRows && attemptRows.length > 0) {
          const attemptIds = attemptRows.map((a: { id: string }) => a.id);
          await admin.from("quiz_question_responses").delete().in("attempt_id", attemptIds);
        }
        // 3. Delete attempts, questions, then the quiz
        await admin.from("quiz_attempts").delete().eq("quiz_id", quizId);
        await admin.from("questions").delete().eq("quiz_id", quizId);
        const { error } = await admin.from("quizzes").delete().eq("id", quizId);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Quiz and related data deleted" });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin-action] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
