import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMaxStorageForPlan } from "@/lib/constants";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const UNSUPPORTED_EXTENSIONS = [".doc", ".docx"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileSize, fileName } = body;

    if (!fileSize || !fileName) {
      return NextResponse.json(
        { error: "Missing fileSize or fileName" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check file extension
    const ext = "." + (fileName.split(".").pop()?.toLowerCase() || "");
    if (UNSUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Word documents (.doc/.docx) are not supported. Please convert to PDF first." },
        { status: 400 }
      );
    }

    // Check per-file size limit
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 25MB per file." },
        { status: 400 }
      );
    }

    // Check storage quota from DB
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const maxStorage = getMaxStorageForPlan(profile?.plan ?? null);

    const { data: docs } = await supabase
      .from("documents")
      .select("file_size")
      .eq("user_id", user.id);

    const currentUsage = (docs ?? []).reduce(
      (sum: number, d: { file_size: number }) => sum + (d.file_size || 0),
      0
    );

    if (currentUsage + fileSize > maxStorage) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Upgrade to Captain's Club for more storage." },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}
