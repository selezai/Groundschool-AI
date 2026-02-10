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

async function getDocumentTexts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentIds: string[],
  userId: string
): Promise<string> {
  const texts: string[] = [];

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

    const text = await fileData.text();
    texts.push(`--- Document: ${doc.title} ---\n${text}`);
  }

  return texts.join("\n\n");
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

    // Get document texts
    const documentText = await getDocumentTexts(supabase, documentIds, userId);
    if (!documentText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from selected documents" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(documentText, numberOfQuestions);

    // Try Groq first, fall back to Gemini
    let questions: QuizQuestion[];
    try {
      console.log("Attempting quiz generation with Groq...");
      questions = await generateWithGroq(prompt);
      console.log(`Groq generated ${questions.length} questions`);
    } catch (groqError) {
      console.warn("Groq failed, falling back to Gemini:", groqError);
      try {
        questions = await generateWithGemini(prompt);
        console.log(`Gemini generated ${questions.length} questions`);
      } catch (geminiError) {
        console.error("Both AI providers failed:", geminiError);
        return NextResponse.json(
          { error: "Failed to generate quiz. Please try again." },
          { status: 500 }
        );
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
        document_id: documentIds[0],
        question_count: questions.length,
      })
      .select()
      .single();

    if (quizError || !quiz) {
      console.error("Failed to create quiz:", quizError);
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
      console.error("Failed to insert questions:", questionsError);
      // Clean up the quiz record
      await supabase.from("quizzes").delete().eq("id", quiz.id);
      return NextResponse.json(
        { error: "Failed to save quiz questions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ quizId: quiz.id, questionCount: questions.length });
  } catch (err) {
    console.error("Quiz generation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
