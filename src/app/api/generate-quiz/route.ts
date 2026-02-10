import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer);
    return pdfData.text || "";
  } catch {
    try {
      return buffer.toString("utf-8");
    } catch {
      return "";
    }
  }
}

async function getDocumentContents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentIds: string[],
  userId: string
): Promise<DocumentContent[]> {
  const contents: DocumentContent[] = [];

  for (const docId of documentIds) {
    const { data: doc } = await supabase
      .from("documents")
      .select("file_path, title, content_type")
      .eq("id", docId)
      .eq("user_id", userId)
      .single();

    if (!doc) continue;

    const { data: fileData } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (!fileData) continue;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const lowerPath = doc.file_path.toLowerCase();
    const contentType = doc.content_type || "";

    // Handle PDFs - extract text
    if (contentType === "application/pdf" || lowerPath.endsWith(".pdf")) {
      const text = await extractTextFromPdf(buffer);
      if (text.trim()) {
        contents.push({ title: doc.title, type: "text", text });
      }
      continue;
    }

    // Handle images - keep as base64 for multimodal AI
    if (isImageFile(contentType, doc.file_path)) {
      contents.push({
        title: doc.title,
        type: "image",
        imageBase64: buffer.toString("base64"),
        mimeType: getMimeType(contentType, doc.file_path),
      });
      continue;
    }

    // Handle text files
    if (contentType.startsWith("text/") || lowerPath.endsWith(".txt") || lowerPath.endsWith(".md")) {
      const text = buffer.toString("utf-8");
      if (text.trim()) {
        contents.push({ title: doc.title, type: "text", text });
      }
      continue;
    }

    // Try as text for unknown types
    try {
      const text = buffer.toString("utf-8");
      if (text.trim()) {
        contents.push({ title: doc.title, type: "text", text });
      }
    } catch {
      // Skip if can't read
    }
  }

  return contents;
}

function buildPrompt(documentText: string, numberOfQuestions: number): string {
  return `You are an aviation exam question generator. Based on the following study material, generate exactly ${numberOfQuestions} multiple-choice questions.

RULES:
- Each question must have exactly 4 options labeled a, b, c, d
- Only one option should be correct
- Include a brief explanation for the correct answer
- Questions should test understanding, not just memorization
- Focus on key aviation concepts, regulations, and procedures

STUDY MATERIAL:
${documentText.substring(0, 30000)}

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

async function generateWithGroq(prompt: string): Promise<QuizQuestion[]> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from Groq");

  return parseQuestions(content);
}

async function generateWithGemini(prompt: string): Promise<QuizQuestion[]> {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini");

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
      parts.push({ text: `\n--- Document: ${doc.title} ---\n${doc.text.substring(0, 30000)}` });
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini");

  return parseQuestions(content);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentIds, numberOfQuestions = 10, userId } = body;

    if (!documentIds?.length || !userId) {
      return NextResponse.json(
        { error: "Missing documentIds or userId" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get document contents (text and images)
    const contents = await getDocumentContents(supabase, documentIds, userId);
    if (!contents.length) {
      return NextResponse.json(
        { error: "Could not extract content from selected documents" },
        { status: 400 }
      );
    }

    // Check if we have any images - if so, use multimodal Gemini
    const hasImages = contents.some((c) => c.type === "image");
    let questions: QuizQuestion[];

    if (hasImages) {
      // Use Gemini multimodal for images
      try {
        questions = await generateWithGeminiMultimodal(contents, numberOfQuestions);
      } catch {
        return NextResponse.json(
          { error: "Failed to generate quiz from images. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // Text only - try Groq first, fall back to Gemini
      const textContent = contents
        .filter((c) => c.type === "text" && c.text)
        .map((c) => `--- Document: ${c.title} ---\n${c.text}`)
        .join("\n\n");

      const prompt = buildPrompt(textContent, numberOfQuestions);

      try {
        questions = await generateWithGroq(prompt);
      } catch {
        try {
          questions = await generateWithGemini(prompt);
        } catch {
          return NextResponse.json(
            { error: "Failed to generate quiz. Please try again." },
            { status: 500 }
          );
        }
      }
    }

    if (!questions.length) {
      return NextResponse.json(
        { error: "No questions were generated" },
        { status: 500 }
      );
    }

    // Create quiz record
    const docTitles = await Promise.all(
      documentIds.map(async (id: string) => {
        const { data } = await supabase
          .from("documents")
          .select("title")
          .eq("id", id)
          .single();
        return data?.title || "Unknown";
      })
    );

    const quizTitle = `Quiz: ${docTitles.join(", ")}`.substring(0, 200);

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        title: quizTitle,
        document_ids: documentIds,
        question_count: questions.length,
        status: "active",
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
      // Clean up the quiz record
      await supabase.from("quizzes").delete().eq("id", quiz.id);
      return NextResponse.json(
        { error: "Failed to save quiz questions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ quizId: quiz.id, questionCount: questions.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
