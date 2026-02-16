import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

interface BankQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: string;
  source: string;
  image?: string | null;
  image_url?: string | null;
}

interface QuestionBank {
  subject: string;
  subject_code: string;
  licence: string;
  total_questions: number;
  questions: BankQuestion[];
}

const SUBJECT_MAP: Record<string, { file: string; name: string; licence: string }> = {
  pof: { file: "pof.json", name: "Principles of Flight", licence: "PPL(A)" },
  atg: { file: "atg.json", name: "Aircraft Technical & General", licence: "PPL(A)" },
  met: { file: "met.json", name: "Meteorology", licence: "PPL(A)" },
  law: { file: "law.json", name: "Air Law", licence: "PPL(A)" },
  nav: { file: "nav.json", name: "Navigation", licence: "PPL(A)" },
  hp: { file: "hp.json", name: "Human Performance", licence: "PPL(A)" },
  fp: { file: "fp.json", name: "Flight Planning", licence: "PPL(A)" },
  radio: { file: "radio.json", name: "Restricted Radio", licence: "PPL(A)" },
  hpof: { file: "hpof.json", name: "Helicopter Principles of Flight", licence: "PPL(H)" },
  hfp: { file: "hfp.json", name: "Helicopter Flight Planning", licence: "PPL(H)" },
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subjectCode, questionCount = 40 } = body;

    if (!subjectCode || !SUBJECT_MAP[subjectCode]) {
      return NextResponse.json({ error: "Invalid subject code" }, { status: 400 });
    }

    const subject = SUBJECT_MAP[subjectCode];
    const bankPath = path.join(process.cwd(), "question-bank-data", subject.file);

    if (!fs.existsSync(bankPath)) {
      return NextResponse.json({ error: "Question bank not found" }, { status: 404 });
    }

    const bankData: QuestionBank = JSON.parse(fs.readFileSync(bankPath, "utf-8"));

    // Pick random questions up to the requested count
    const count = Math.min(questionCount, bankData.questions.length);
    const selectedQuestions = shuffleArray(bankData.questions).slice(0, count);

    // Create quiz in Supabase
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: user.id,
        title: `${subject.name} - Practice Exam`,
        document_ids: [],
        question_count: count,
        status: "active",
      })
      .select()
      .single();

    if (quizError || !quiz) {
      console.error("Failed to create quiz:", quizError);
      return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
    }

    // Insert questions
    const questionRows = selectedQuestions.map((q, index) => {
      const correctIndex = q.options.findIndex((opt) => opt.id === q.correct_answer);
      const imageUrl = q.image_url || q.image || null;
      return {
        quiz_id: quiz.id,
        text: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        correct_answer_index: correctIndex >= 0 ? correctIndex : 0,
        explanation: q.explanation || "",
        order_index: index,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
    });

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questionRows);

    if (questionsError) {
      // Clean up the quiz if questions fail
      await supabase.from("quizzes").delete().eq("id", quiz.id);
      console.error("Failed to insert questions:", questionsError);
      return NextResponse.json({ error: "Failed to save questions" }, { status: 500 });
    }

    return NextResponse.json({
      quizId: quiz.id,
      questionCount: count,
      subject: subject.name,
    });
  } catch (err) {
    console.error("Question bank start error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
