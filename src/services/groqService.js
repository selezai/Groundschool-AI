/**
 * Groq AI Service
 * 
 * Provides quiz generation using Groq's API (Llama 3.3 70B).
 * Uses direct REST API calls to avoid dependency conflicts.
 * 
 * Groq is used as the PRIMARY AI provider due to:
 * - Free tier with generous limits (30 req/min)
 * - Extremely fast inference (10x faster than Gemini)
 * - Reliable uptime
 * - Excellent structured JSON output from Llama 3.3 70B
 */

import Constants from 'expo-constants';
import logger from './loggerService.js';

const GROQ_API_KEY = Constants.expoConfig?.extra?.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Check if Groq is configured and available
 */
export const isGroqAvailable = () => {
  return !!GROQ_API_KEY;
};

/**
 * Build the aviation quiz generation prompt
 * @param {number} questionCount - Number of questions to generate
 * @returns {string} The system prompt for quiz generation
 */
const buildQuizPrompt = (questionCount = 10) => {
  return `You are an AVIATION EDUCATION expert specializing in pilot training and aviation knowledge. Generate EXACTLY ${questionCount} multiple-choice questions based STRICTLY on the aviation content from the provided documents.

CONTENT REQUIREMENTS:
- Questions MUST be directly related to AVIATION topics (flight training, regulations, aircraft systems, weather, navigation, etc.)
- Questions MUST be based on the specific content in the provided documents
- DO NOT generate questions about unrelated topics (general knowledge, non-aviation subjects)
- If the document contains non-aviation content, IGNORE it and focus only on aviation-related sections
- Each question must test practical aviation knowledge relevant to pilots

QUESTION LIMIT ENFORCEMENT:
- Generate EXACTLY ${questionCount} questions, NO MORE, NO LESS
- Count your questions before responding to ensure exact count
- If you generate more than ${questionCount} questions, remove the extras

CRITICAL JSON FORMAT REQUIREMENTS:
1. Return ONLY valid JSON, no markdown, no explanations, no code blocks
2. Each option must be EXACTLY: {"id": "A", "text": "Option text"}
3. NEVER use: {"id": "A": "Option text"} - this is WRONG
4. NEVER use: {"id": "A": "text": "Option text"} - this is WRONG
5. Ensure all JSON strings are properly escaped
6. No trailing commas anywhere in the JSON

Required JSON structure:
{
  "questions": [
    {
      "text": "Aviation-specific question text here",
      "options": [
        {"id": "A", "text": "First aviation option"},
        {"id": "B", "text": "Second aviation option"},
        {"id": "C", "text": "Third aviation option"},
        {"id": "D", "text": "Fourth aviation option"}
      ],
      "correct": "A",
      "explanation": "Aviation-focused explanation of why this answer is correct"
    }
  ]
}

VALIDATION CHECKLIST before responding:
- Generated EXACTLY ${questionCount} questions (count them!)
- All questions are aviation-related and based on document content
- Each option has both "id" and "text" keys
- No extra colons in option objects
- Valid JSON syntax throughout
- All strings properly quoted and escaped
- No trailing commas
- No markdown code blocks or explanations outside JSON

Generate the aviation quiz JSON now:`;
};

/**
 * Call Groq API to generate quiz questions from document text
 * @param {string} documentText - The extracted text content from documents
 * @param {number} questionCount - Number of questions to generate
 * @returns {Promise<string>} Raw JSON string response from Groq
 */
const callGroqAPI = async (documentText, questionCount = 10) => {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key is not configured');
  }

  const systemPrompt = buildQuizPrompt(questionCount);

  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Here is the document content to generate quiz questions from:\n\n${documentText}`
      }
    ],
    temperature: 0.7,
    max_tokens: 8000,
    response_format: { type: 'json_object' }
  };

  logger.info('groqService', 'Calling Groq API', {
    model: GROQ_MODEL,
    questionCount,
    documentTextLength: documentText.length
  });

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('groqService', 'Groq API request failed', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    });
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response structure from Groq API');
  }

  const content = data.choices[0].message.content;

  logger.info('groqService', 'Groq API response received', {
    model: data.model,
    usage: data.usage,
    responseLength: content?.length
  });

  return content;
};

/**
 * Convert a base64 file part to text for Groq (Groq doesn't support inline file data like Gemini)
 * For PDFs, we extract text. For text files, we decode directly.
 * @param {Object} filePart - The generative part object with inlineData
 * @returns {string} Extracted text content
 */
export const extractTextFromPart = (filePart) => {
  if (!filePart || !filePart.inlineData) {
    throw new Error('Invalid file part: missing inlineData');
  }

  const { data, mimeType } = filePart.inlineData;

  // For text-based formats, decode base64 directly
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'text/markdown') {
    try {
      return atob(data);
    } catch (_e) {
      logger.warn('groqService', 'Failed to decode base64 text, using raw data');
      return data;
    }
  }

  // For PDFs and other binary formats, decode base64 and extract readable text
  // This is a best-effort extraction - binary content will be filtered out
  if (mimeType === 'application/pdf') {
    try {
      const binaryString = atob(data);
      // Extract text streams from PDF (simplified extraction)
      const textContent = extractTextFromPDFBinary(binaryString);
      if (textContent && textContent.length > 50) {
        return textContent;
      }
      logger.warn('groqService', 'PDF text extraction yielded minimal content, using raw decode');
      // Fallback: return printable characters
      return binaryString.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
    } catch (_e) {
      logger.warn('groqService', 'Failed to extract text from PDF');
      return '[PDF content - text extraction failed]';
    }
  }

  // For images and other formats, return a placeholder
  logger.warn('groqService', `Unsupported mime type for text extraction: ${mimeType}`);
  return `[Document content of type ${mimeType} - cannot extract text for Groq]`;
};

/**
 * Simple PDF text extraction from binary string
 * Extracts text between BT/ET markers and stream content
 * @param {string} binaryString - Raw PDF binary as string
 * @returns {string} Extracted text
 */
const extractTextFromPDFBinary = (binaryString) => {
  const textParts = [];

  // Method 1: Extract text between parentheses in BT/ET blocks
  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(binaryString)) !== null) {
    const block = btMatch[1];
    // Extract text in parentheses (Tj operator)
    const tjRegex = /\(([^)]*)\)/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const text = tjMatch[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
      if (text.trim().length > 0) {
        textParts.push(text);
      }
    }
  }

  // Method 2: Extract from stream objects
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  while ((streamMatch = streamRegex.exec(binaryString)) !== null) {
    const streamContent = streamMatch[1];
    // Only use if it looks like text content
    const printable = streamContent.replace(/[^\x20-\x7E\n\r\t]/g, '');
    if (printable.length > streamContent.length * 0.5 && printable.length > 20) {
      textParts.push(printable);
    }
  }

  return textParts.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Generate quiz questions using Groq
 * @param {string} documentText - Text content from documents
 * @param {number} questionCount - Number of questions to generate
 * @returns {Promise<Object>} Parsed quiz result { success, quiz, error }
 */
export const generateQuizWithGroq = async (documentText, questionCount = 10) => {
  try {
    logger.info('groqService', 'Starting quiz generation with Groq', { questionCount, textLength: documentText.length });

    const rawResponse = await callGroqAPI(documentText, questionCount);

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      logger.error('groqService', 'Failed to parse Groq response as JSON', {
        error: parseError.message,
        responsePreview: rawResponse?.substring(0, 200)
      });
      throw new Error(`Failed to parse Groq response: ${parseError.message}`);
    }

    // Validate the structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Groq response missing questions array');
    }

    // Validate and normalize each question to match quizService expected schema
    // quizService expects: { text, options: [{id, text}], correct_answer_id, explanation }
    // Groq returns:        { text, options: [{id, text}], correct, explanation }
    const validQuestions = parsed.questions
      .filter(q => {
        const hasText = q.text || q.question_text;
        const hasOptions = q.options && Array.isArray(q.options) && q.options.length >= 2;
        const hasCorrect = q.correct || q.correct_answer_id;
        if (!hasText || !hasOptions || !hasCorrect) {
          logger.warn('groqService', 'Filtering out invalid question', { text: (q.text || q.question_text)?.substring(0, 50) });
          return false;
        }
        return q.options.every(opt => opt.id && opt.text);
      })
      .map(q => {
        const correctId = q.correct_answer_id || q.correct;
        return {
          text: q.text || q.question_text,
          options: q.options,
          correct_answer_id: correctId,
          correct: correctId,
          explanation: q.explanation || null
        };
      });

    if (validQuestions.length === 0) {
      throw new Error('No valid questions in Groq response');
    }

    logger.info('groqService', 'Successfully generated quiz with Groq', {
      requestedCount: questionCount,
      generatedCount: validQuestions.length
    });

    return {
      success: true,
      quiz: { questions: validQuestions },
      provider: 'groq',
      metadata: {
        model: GROQ_MODEL,
        questionsGenerated: validQuestions.length,
        questionsRequested: questionCount
      }
    };

  } catch (error) {
    logger.error('groqService', 'Groq quiz generation failed', { error: error.message });
    return {
      success: false,
      error: error.message,
      provider: 'groq'
    };
  }
};

export default {
  isGroqAvailable,
  generateQuizWithGroq,
  extractTextFromPart
};
