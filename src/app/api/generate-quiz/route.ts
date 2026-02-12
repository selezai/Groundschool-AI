import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

interface QuizQuestion {
  question_text: string;
  options: { id: string; text: string }[];
  correct_answer_id: string;
  explanation: string;
}

interface DocumentContent {
  title: string;
  type: "text" | "image";
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp", ".gif", ".bmp"];

function isImageFile(contentType: string, filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return contentType.startsWith("image/") || IMAGE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

function getMimeType(contentType: string, filePath: string): string {
  if (contentType && contentType !== "application/octet-stream") return contentType;
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".png")) return "image/png";
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) return "image/jpeg";
  if (lowerPath.endsWith(".webp")) return "image/webp";
  if (lowerPath.endsWith(".gif")) return "image/gif";
  if (lowerPath.endsWith(".heic") || lowerPath.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const { extractText } = await import("unpdf");
    
    // unpdf requires Uint8Array, not Buffer
    const uint8Array = new Uint8Array(buffer);
    const result = await extractText(uint8Array);
    
    return Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text || "");
  } catch {
    return "";
  }
}

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB cap per image for AI processing
const AI_IMAGE_MAX_DIMENSION = 1024; // Max width/height for images sent to AI

async function resizeImageForAI(buffer: Buffer, mimeType: string): Promise<{ data: Buffer; mime: string }> {
  try {
    const resized = await sharp(buffer)
      .resize(AI_IMAGE_MAX_DIMENSION, AI_IMAGE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { data: resized, mime: "image/jpeg" };
  } catch {
    // If sharp fails (e.g. unsupported format like HEIC without plugin), return original if small enough
    if (buffer.length <= MAX_IMAGE_SIZE) {
      return { data: buffer, mime: mimeType };
    }
    throw new Error("Image could not be processed");
  }
}

async function fetchSingleDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docId: string,
  userId: string
): Promise<DocumentContent | null> {
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, title, document_type")
    .eq("id", docId)
    .eq("user_id", userId)
    .single();

  if (!doc) return null;

  const { data: fileData } = await supabase.storage
    .from("documents")
    .download(doc.file_path);

  if (!fileData) return null;

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const lowerPath = doc.file_path.toLowerCase();
  const contentType = doc.document_type || "";

  // Handle PDFs - extract text
  if (contentType === "application/pdf" || lowerPath.endsWith(".pdf")) {
    const text = await extractTextFromPdf(buffer);
    if (text.trim()) {
      return { title: doc.title, type: "text", text };
    }
    return null;
  }

  // Handle images - resize for AI processing, then base64 encode
  if (isImageFile(contentType, doc.file_path)) {
    try {
      const originalMime = getMimeType(contentType, doc.file_path);
      const { data: resizedBuf, mime: finalMime } = await resizeImageForAI(buffer, originalMime);
      return {
        title: doc.title,
        type: "image",
        imageBase64: resizedBuf.toString("base64"),
        mimeType: finalMime,
      };
    } catch {
      return null; // Skip images that can't be processed
    }
  }

  // Handle text files
  if (contentType.startsWith("text/") || lowerPath.endsWith(".txt") || lowerPath.endsWith(".md")) {
    const text = buffer.toString("utf-8");
    if (text.trim()) {
      return { title: doc.title, type: "text", text };
    }
    return null;
  }

  // Try as text for unknown types
  try {
    const text = buffer.toString("utf-8");
    if (text.trim()) {
      return { title: doc.title, type: "text", text };
    }
  } catch {
    // Skip if can't read
  }
  return null;
}

async function getDocumentContents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentIds: string[],
  userId: string
): Promise<DocumentContent[]> {
  const results = await Promise.all(
    documentIds.map((docId) => fetchSingleDocument(supabase, docId, userId))
  );
  return results.filter((r): r is DocumentContent => r !== null);
}

function parseQuestions(raw: string): QuizQuestion[] {
  // Try to extract JSON from the response
  let jsonStr = raw;
  const jsonMatch = raw.match(/\{[\s\S]*"questions"[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr);
  const questions: QuizQuestion[] = parsed.questions || [];

  // Normalize: ensure correct_answer_id exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return questions.map((q: any) => {
    const correctId = q.correct_answer_id || q.correct || q.answer || "";
    return {
      question_text: String(q.question_text || ""),
      options: (q.options || []) as { id: string; text: string }[],
      correct_answer_id: String(correctId),
      explanation: String(q.explanation || ""),
    };
  });
}

// Groq multimodal with Llama 4 Scout - supports text and images
async function generateWithGroqMultimodal(
  contents: DocumentContent[],
  numberOfQuestions: number
): Promise<QuizQuestion[]> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const promptText = `You are an aviation exam question generator. Based on the following study materials (text and/or images), generate exactly ${numberOfQuestions} multiple-choice questions.

RULES:
- Each question must have exactly 4 options labeled a, b, c, d
- Only one option should be correct
- Include a brief explanation for the correct answer
- Questions should test understanding, not just memorization
- Focus on key aviation concepts, regulations, and procedures
- If images contain diagrams, charts, or text, use that information to create questions

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question_text": "What is...",
      "options": [
        {"id": "a", "text": "Option A"},
        {"id": "b", "text": "Option B"},
        {"id": "c", "text": "Option C"},
        {"id": "d", "text": "Option D"}
      ],
      "correct_answer_id": "a",
      "explanation": "The correct answer is A because..."
    }
  ]
}`;

  // Build message content array with text and images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageContent: any[] = [{ type: "text", text: promptText }];

  for (const doc of contents) {
    if (doc.type === "text" && doc.text) {
      messageContent.push({
        type: "text",
        text: `\n--- Document: ${doc.title} ---\n${doc.text.substring(0, 100000)}`,
      });
    } else if (doc.type === "image" && doc.imageBase64) {
      messageContent.push({ type: "text", text: `\n--- Image: ${doc.title} ---` });
      messageContent.push({
        type: "image_url",
        image_url: {
          url: `data:${doc.mimeType || "image/jpeg"};base64,${doc.imageBase64}`,
        },
      });
    }
  }

  const groqController = new AbortController();
  const timeoutMs = Math.max(60000, numberOfQuestions * 2000);
  const groqTimeout = setTimeout(() => groqController.abort(), timeoutMs);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "user", content: messageContent }],
      temperature: 0.7,
      max_completion_tokens: Math.min(32000, Math.max(8000, numberOfQuestions * 500)),
    }),
    signal: groqController.signal,
  });

  clearTimeout(groqTimeout);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from Groq");

  return parseQuestions(content);
}

// Multimodal Gemini - can process images directly
async function generateWithGeminiMultimodal(
  contents: DocumentContent[],
  numberOfQuestions: number
): Promise<QuizQuestion[]> {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured");

  const promptText = `You are an aviation exam question generator. Based on the following study materials (text and/or images), generate exactly ${numberOfQuestions} multiple-choice questions.

RULES:
- Each question must have exactly 4 options labeled a, b, c, d
- Only one option should be correct
- Include a brief explanation for the correct answer
- Questions should test understanding, not just memorization
- Focus on key aviation concepts, regulations, and procedures
- If images contain diagrams, charts, or text, use that information to create questions

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question_text": "What is...",
      "options": [
        {"id": "a", "text": "Option A"},
        {"id": "b", "text": "Option B"},
        {"id": "c", "text": "Option C"},
        {"id": "d", "text": "Option D"}
      ],
      "correct_answer_id": "a",
      "explanation": "The correct answer is A because..."
    }
  ]
}`;

  // Build parts array with text and images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: promptText }];

  for (const doc of contents) {
    if (doc.type === "text" && doc.text) {
      parts.push({ text: `\n--- Document: ${doc.title} ---\n${doc.text.substring(0, 100000)}` });
    } else if (doc.type === "image" && doc.imageBase64) {
      parts.push({ text: `\n--- Image: ${doc.title} ---` });
      parts.push({
        inlineData: {
          mimeType: doc.mimeType || "image/jpeg",
          data: doc.imageBase64,
        },
      });
    }
  }

  const geminiController = new AbortController();
  const geminiTimeoutMs = Math.max(60000, numberOfQuestions * 2000);
  const geminiTimeout = setTimeout(() => geminiController.abort(), geminiTimeoutMs);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: Math.min(32000, Math.max(8000, numberOfQuestions * 500)),
          responseMimeType: "application/json",
        },
      }),
      signal: geminiController.signal,
    }
  );

  clearTimeout(geminiTimeout);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini");

  return parseQuestions(content);
}

// In-memory rate limiter (per serverless instance)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 30_000; // 30 seconds between requests per user

export async function POST(request: Request) {
  const requestStart = Date.now();
  try {
    const body = await request.json();
    const { documentIds, numberOfQuestions = 10 } = body;

    if (!documentIds?.length) {
      return NextResponse.json(
        { error: "Missing documentIds" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Derive userId from session — never trust client-supplied userId
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // Rate limiting: 1 request per 30 seconds per user
    const lastRequest = rateLimitMap.get(userId);
    const now = Date.now();
    if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
      console.log(`[quiz-gen] RATE_LIMITED user=${userId} waitSec=${waitSec}`);
      return NextResponse.json(
        { error: `Please wait ${waitSec} seconds before generating another exam.` },
        { status: 429 }
      );
    }
    rateLimitMap.set(userId, now);

    console.log(`[quiz-gen] START user=${userId} docs=${documentIds.length} requestedQ=${numberOfQuestions}`);

    // Enforce quiz quota from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, monthly_quizzes_remaining, last_quota_reset_date")
      .eq("id", userId)
      .single();

    if (profile && profile.plan !== "captains_club") {
      // Reset monthly quota if needed (first of month)
      const now = new Date();
      const lastReset = profile.last_quota_reset_date
        ? new Date(profile.last_quota_reset_date)
        : null;
      const needsReset =
        !lastReset ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear();

      if (needsReset) {
        await supabase
          .from("profiles")
          .update({
            monthly_quizzes_remaining: 5,
            last_quota_reset_date: now.toISOString(),
          })
          .eq("id", userId);
        // Refresh the value after reset
        profile.monthly_quizzes_remaining = 5;
      }

      if ((profile.monthly_quizzes_remaining ?? 0) <= 0) {
        console.log(`[quiz-gen] QUOTA_BLOCKED user=${userId} plan=${profile.plan} remaining=0`);
        return NextResponse.json(
          { error: "Monthly exam limit reached. Upgrade to Captain's Club for unlimited exams." },
          { status: 403 }
        );
      }
    }

    // Get document contents (text and images) — fetched in parallel
    const contents = await getDocumentContents(supabase, documentIds, userId);
    const textCount = contents.filter((c) => c.type === "text").length;
    const imageCount = contents.filter((c) => c.type === "image").length;
    console.log(`[quiz-gen] CONTENT user=${userId} extracted=${contents.length}/${documentIds.length} text=${textCount} images=${imageCount}`);

    if (!contents.length) {
      return NextResponse.json(
        { error: "Could not extract content from selected documents" },
        { status: 400 }
      );
    }

    // Combine all text content for analysis and chunking
    const allText = contents
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n\n");
    const imageContents = contents.filter((c) => c.type === "image");
    const totalChars = allText.length;

    // Smart question cap based on content size — avoid wasting API calls on thin docs
    // ~1 good question per 500 chars of content is a reasonable density
    const contentBasedMax = Math.max(5, Math.ceil(totalChars / 500) + imageContents.length * 3);
    const effectiveQuestions = Math.min(numberOfQuestions, contentBasedMax);

    if (effectiveQuestions < numberOfQuestions) {
      console.log(`[quiz-gen] CAPPED user=${userId} requested=${numberOfQuestions} effective=${effectiveQuestions} chars=${totalChars}`);
    }

    // Batch generation: split into chunks of up to 25 questions, run in PARALLEL
    const BATCH_SIZE = 25;
    const numBatches = Math.ceil(effectiveQuestions / BATCH_SIZE);
    let questions: QuizQuestion[] = [];
    let aiProvider = "groq";

    const chunkSize = totalChars > 0 ? Math.ceil(totalChars / numBatches) : 0;

    // Build all batch tasks upfront
    const batchTasks = Array.from({ length: numBatches }, (_, batch) => {
      const questionsNeeded = Math.min(BATCH_SIZE, effectiveQuestions - batch * BATCH_SIZE);
      const batchContents: DocumentContent[] = [];

      if (totalChars > 0) {
        const start = batch * chunkSize;
        const end = Math.min(start + chunkSize, totalChars);
        const textChunk = allText.substring(start, end);
        if (textChunk.trim()) {
          batchContents.push({
            title: `Document section ${batch + 1}/${numBatches}`,
            type: "text",
            text: textChunk,
          });
        }
      }
      if (batch === 0) {
        batchContents.push(...imageContents);
      }

      return { batch, questionsNeeded, batchContents };
    }).filter((t) => t.batchContents.length > 0 && t.questionsNeeded > 0);

    console.log(`[quiz-gen] PARALLEL_START user=${userId} batches=${batchTasks.length} effective=${effectiveQuestions}/${numberOfQuestions}`);

    // Run all batches in parallel — each with its own Groq→Gemini fallback
    const results = await Promise.allSettled(
      batchTasks.map(async ({ batch, questionsNeeded, batchContents }) => {
        console.log(`[quiz-gen] BATCH ${batch + 1}/${numBatches} user=${userId} q=${questionsNeeded} textLen=${batchContents[0]?.text?.length ?? 0}`);
        try {
          return await generateWithGroqMultimodal(batchContents, questionsNeeded);
        } catch (groqErr) {
          console.log(`[quiz-gen] GROQ_FAILED batch=${batch + 1} error=${groqErr instanceof Error ? groqErr.message : "unknown"}`);
          aiProvider = "gemini";
          return await generateWithGeminiMultimodal(batchContents, questionsNeeded);
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        questions.push(...result.value);
      } else {
        console.log(`[quiz-gen] BATCH_FAILED error=${result.reason}`);
      }
    }

    console.log(`[quiz-gen] PARALLEL_DONE user=${userId} totalQuestions=${questions.length}/${numberOfQuestions}`);

    if (!questions.length) {
      return NextResponse.json(
        { error: "No questions were generated" },
        { status: 500 }
      );
    }

    // Build quiz title from already-fetched document content titles (no extra queries)
    const docTitles = contents.map((c) => c.title);
    const quizTitle = `Quiz: ${docTitles.join(", ")}`.substring(0, 200);

    // Insert quiz with 'generating' status — only set 'active' after questions succeed
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        title: quizTitle,
        document_ids: documentIds,
        question_count: questions.length,
        status: "generating",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Failed to save quiz" },
        { status: 500 }
      );
    }

    // Insert questions with correct column names for existing Supabase schema
    const questionRows = questions.map((q, index) => {
      const correctIndex = q.options.findIndex((opt: { id: string }) => opt.id === q.correct_answer_id);
      return {
        quiz_id: quiz.id,
        text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer_id,
        correct_answer_index: correctIndex >= 0 ? correctIndex : 0,
        explanation: q.explanation || "",
        order_index: index,
      };
    });

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questionRows);

    if (questionsError) {
      // Clean up: delete questions that may have partially inserted, then the quiz
      await supabase.from("questions").delete().eq("quiz_id", quiz.id);
      const { error: cleanupError } = await supabase.from("quizzes").delete().eq("id", quiz.id);
      if (cleanupError) {
        console.log(`[quiz-gen] CLEANUP_FAILED quizId=${quiz.id} error=${cleanupError.message}`);
      }
      return NextResponse.json(
        { error: "Failed to save quiz questions" },
        { status: 500 }
      );
    }

    // Mark quiz as active now that questions are saved
    await supabase.from("quizzes").update({ status: "active" }).eq("id", quiz.id);

    // Decrement monthly quiz quota for non-premium users
    if (profile && profile.plan !== "captains_club") {
      await supabase
        .from("profiles")
        .update({
          monthly_quizzes_remaining: Math.max(0, (profile.monthly_quizzes_remaining ?? 1) - 1),
        })
        .eq("id", userId);
    }

    const durationMs = Date.now() - requestStart;
    console.log(`[quiz-gen] SUCCESS user=${userId} quizId=${quiz.id} questions=${questions.length} provider=${aiProvider} duration=${durationMs}ms`);

    return NextResponse.json({ quizId: quiz.id, questionCount: questions.length });
  } catch (err) {
    const durationMs = Date.now() - requestStart;
    console.log(`[quiz-gen] ERROR duration=${durationMs}ms error=${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
