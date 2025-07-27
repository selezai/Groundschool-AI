-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_ids UUID[] NOT NULL, -- Array of document IDs used to generate this quiz
    question_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options TEXT[] NOT NULL, -- Array of options (A, B, C, D)
    correct_answer TEXT NOT NULL, -- The letter of the correct answer (A, B, C, D)
    correct_answer_index INTEGER NOT NULL, -- Index of the correct answer (0, 1, 2, 3)
    explanation TEXT,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    topic TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create quiz_attempts table to track user attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    completion_time INTEGER, -- Time taken in seconds
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, quiz_id, started_at) -- Prevent duplicate attempts at the same time
);

-- Create quiz_question_responses table to track user responses to individual questions
CREATE TABLE IF NOT EXISTS public.quiz_question_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    selected_answer TEXT, -- The letter of the selected answer (A, B, C, D)
    selected_answer_index INTEGER, -- Index of the selected answer (0, 1, 2, 3)
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    response_time INTEGER, -- Time taken to answer in seconds
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(attempt_id, question_id) -- Each question can only be answered once per attempt
);

-- Enable Row Level Security
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_question_responses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for quizzes
CREATE POLICY "Users can view their own quizzes" 
    ON public.quizzes FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quizzes" 
    ON public.quizzes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quizzes" 
    ON public.quizzes FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quizzes" 
    ON public.quizzes FOR DELETE 
    USING (auth.uid() = user_id);

-- Create RLS policies for quiz_questions
CREATE POLICY "Users can view questions for their quizzes" 
    ON public.quiz_questions FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.quizzes 
        WHERE quizzes.id = quiz_questions.quiz_id 
        AND quizzes.user_id = auth.uid()
    ));

CREATE POLICY "Users can create questions for their quizzes" 
    ON public.quiz_questions FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.quizzes 
        WHERE quizzes.id = quiz_questions.quiz_id 
        AND quizzes.user_id = auth.uid()
    ));

CREATE POLICY "Users can update questions for their quizzes" 
    ON public.quiz_questions FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM public.quizzes 
        WHERE quizzes.id = quiz_questions.quiz_id 
        AND quizzes.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete questions for their quizzes" 
    ON public.quiz_questions FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM public.quizzes 
        WHERE quizzes.id = quiz_questions.quiz_id 
        AND quizzes.user_id = auth.uid()
    ));

-- Create RLS policies for quiz_attempts
CREATE POLICY "Users can view their own quiz attempts" 
    ON public.quiz_attempts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quiz attempts" 
    ON public.quiz_attempts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quiz attempts" 
    ON public.quiz_attempts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quiz attempts" 
    ON public.quiz_attempts FOR DELETE 
    USING (auth.uid() = user_id);

-- Create RLS policies for quiz_question_responses
CREATE POLICY "Users can view their own question responses" 
    ON public.quiz_question_responses FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.quiz_attempts 
        WHERE quiz_attempts.id = quiz_question_responses.attempt_id 
        AND quiz_attempts.user_id = auth.uid()
    ));

CREATE POLICY "Users can create their own question responses" 
    ON public.quiz_question_responses FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.quiz_attempts 
        WHERE quiz_attempts.id = quiz_question_responses.attempt_id 
        AND quiz_attempts.user_id = auth.uid()
    ));

CREATE POLICY "Users can update their own question responses" 
    ON public.quiz_question_responses FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM public.quiz_attempts 
        WHERE quiz_attempts.id = quiz_question_responses.attempt_id 
        AND quiz_attempts.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete their own question responses" 
    ON public.quiz_question_responses FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM public.quiz_attempts 
        WHERE quiz_attempts.id = quiz_question_responses.attempt_id 
        AND quiz_attempts.user_id = auth.uid()
    ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_responses_attempt_id ON public.quiz_question_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_responses_question_id ON public.quiz_question_responses(question_id);
