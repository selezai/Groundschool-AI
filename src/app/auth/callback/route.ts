import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password recovery — redirect to reset-password page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      // Ensure profile exists for OAuth users (Google, etc.)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingProfile) {
          const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Pilot";

          const autoUpgrade =
            process.env.NEXT_PUBLIC_AUTO_UPGRADE_NEW_USERS === "true";
          const trialDays = process.env.NEXT_PUBLIC_CAPTAINS_CLUB_TRIAL_DAYS;

          const plan = autoUpgrade ? "captains_club" : "basic";
          const planStatus = autoUpgrade ? "active" : "basic";

          let planPeriodEnd: string | null = null;
          if (autoUpgrade && trialDays && trialDays !== "null") {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + parseInt(trialDays));
            planPeriodEnd = endDate.toISOString();
          }

          await supabase.from("profiles").upsert({
            id: user.id,
            full_name: fullName,
            email: user.email,
            plan,
            plan_status: planStatus,
            plan_period_end: planPeriodEnd,
            monthly_quizzes_remaining: autoUpgrade ? -1 : 5,
            can_access_past_exams: autoUpgrade,
            storage_used_mb: 0,
            updated_at: new Date().toISOString(),
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
