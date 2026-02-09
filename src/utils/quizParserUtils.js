/* eslint-disable no-control-regex, no-useless-escape, no-console */
import logger from '../services/loggerService.js';

class QuizJSONParser {
  constructor(options = {}) {
    this.enableLogging = options.enableLogging || false;
    this.throwOnUnrecoverable = options.throwOnUnrecoverable || true;
    this.correctionStats = {
      totalAttempts: 0,
      successfulCorrections: 0,
      failedCorrections: 0,
      correctionTypes: {}
    };
  }

  /**
   * Main method to parse and correct LLM-generated quiz JSON
   * @param {string} rawResponse - Raw response from LLM
   * @returns {Object} - Parsed and validated quiz object
   */
  parseQuizJSON(rawResponse) {
    this.correctionStats.totalAttempts++;
    
    logger.debug('QuizParser', `Raw LLM Response Length: ${rawResponse.length}`);
    logger.debug('QuizParser', `Raw Response Preview: ${rawResponse.substring(0, 200)}...`);

    // Declare correctedJSON at the outer scope so it's available in the catch block
    let cleanedJSON = '';
    let correctedJSON = '';
    
    try {
      // Step 1: Clean and extract JSON
      cleanedJSON = this.extractAndCleanJSON(rawResponse);
      
      // Step 2: Apply progressive correction strategies
      correctedJSON = this.applyCorrections(cleanedJSON);
      
      // Step 3: Parse and validate
      let parsedData = JSON.parse(correctedJSON);
      
      // Step 4: Post-parse validation and correction
      let validatedData = this.validateAndCorrectStructure(parsedData);
      
      this.correctionStats.successfulCorrections++;
      
      logger.debug('QuizParser', `Successfully parsed quiz with ${validatedData.questions?.length || 0} questions`);
      this.logStats();
      
      return validatedData;
      
    } catch (error) {
      this.correctionStats.failedCorrections++;
      
      logger.error('QuizParser', `Failed to parse quiz JSON: ${error.message}`);
      
      // Analyze the type of parsing failure
      const failureAnalysis = this.analyzeParsingFailure(rawResponse, correctedJSON, error);
      logger.debug('QuizParser', `Failure Analysis: ${JSON.stringify(failureAnalysis)}`);
      
      // Only log correctedJSON if it's defined
      if (typeof correctedJSON !== 'undefined') {
        logger.debug('QuizParser', `Problematic JSON (first 500 chars): ${correctedJSON.substring(0, 500)}`);
        logger.debug('QuizParser', `Problematic JSON (last 500 chars): ${correctedJSON.substring(Math.max(0, correctedJSON.length - 500))}`);
      } else {
        logger.debug('QuizParser', 'JSON parsing failed before corrections could be applied');
      }
      logger.debug('QuizParser', `Attempted corrections: ${Object.keys(this.correctionStats.correctionTypes)}`);
      this.logStats();
      
      if (this.throwOnUnrecoverable) {
        const enhancedError = new Error(`Unable to parse quiz JSON after corrections: ${error.message}. Analysis: ${this.analyzeParsingFailure(rawResponse, correctedJSON, error).summary}`);
        enhancedError.originalError = error;
        enhancedError.analysisDetails = this.analyzeParsingFailure(rawResponse, correctedJSON, error);
        throw enhancedError;
      }
      
      return this.createFallbackStructure();
    }
  }

  /**
   * Extract JSON from response and apply basic cleaning
   */
  extractAndCleanJSON(rawResponse) {
    // Remove markdown code blocks
    let cleaned = rawResponse.replace(/```json\s*|\s*```/g, '');
    
    // Find JSON object boundaries
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
      throw new Error('No valid JSON object found in response');
    }
    
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    
    // Basic cleanup
    cleaned = cleaned
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Remove control characters
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '  '); // Convert tabs to spaces
    
    return cleaned;
  }

  /**
   * Apply multiple correction strategies progressively
   */
  applyCorrections(jsonString) {
    let corrected = jsonString;
    
    // Strategy 0: Handle truncated JSON
    corrected = this.handleTruncatedJSON(corrected);
    
    // Strategy 1: Fix malformed option objects
    corrected = this.fixMalformedOptions(corrected);
    
    // Strategy 2: Fix common JSON syntax errors
    corrected = this.fixCommonSyntaxErrors(corrected);
    
    // Strategy 3: Fix trailing commas
    corrected = this.fixTrailingCommas(corrected);
    
    // Strategy 4: Fix quote mismatches
    corrected = this.fixQuoteMismatches(corrected);
    
    return corrected;
  }

  /**
   * Detect and handle truncated JSON responses
   */
  handleTruncatedJSON(jsonString) {
    logger.debug('QuizParser', 'Checking for truncated JSON...');
    
    // Check if JSON appears to be truncated
    const isTruncated = this.detectTruncation(jsonString);
    
    if (isTruncated) {
      logger.warn('QuizParser', 'Detected truncated JSON response. Attempting to recover...');
      
      return this.recoverTruncatedJSON(jsonString);
    }
    
    return jsonString;
  }

  /**
   * Detect if JSON appears to be truncated
   */
  detectTruncation(jsonString) {
    const trimmed = jsonString.trim();
    
    // Check for incomplete structure
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    
    // If braces/brackets don't match, likely truncated
    if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
      return true;
    }
    
    // Check if it ends abruptly (common truncation patterns)
    const truncationPatterns = [
      /"[^"]*$/,  // Ends with incomplete string
      /,\s*$/,    // Ends with comma
      /:\s*$/,    // Ends with colon
      /\[\s*$/,   // Ends with open bracket
      /\{\s*$/,   // Ends with open brace
    ];
    
    return truncationPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Attempt to recover a truncated JSON by completing the structure
   */
  recoverTruncatedJSON(jsonString) {
    let recovered = jsonString.trim();
    
    // Try partial parsing first - extract complete questions
    const partialResult = this.attemptPartialParsing(recovered);
    if (partialResult) {
      logger.debug('QuizParser', `Partial parsing successful - extracted ${partialResult.questions?.length || 0} complete questions`);
      return JSON.stringify(partialResult);
    }
    
    // Fallback to traditional recovery
    // Remove any incomplete trailing content
    recovered = this.removeIncompleteTrailingContent(recovered);
    
    // Close any unclosed structures
    recovered = this.closeUnfinishedStructures(recovered);
    
    this.trackCorrection('truncated_json_recovery');
    
    logger.debug('QuizParser', 'Truncated JSON recovery applied');
    
    return recovered;
  }

  /**
   * Attempt to extract complete questions from truncated JSON
   */
  attemptPartialParsing(jsonString) {
    try {
      logger.debug('QuizParser', 'Attempting partial parsing of truncated JSON...');
      
      // Look for the title and start of questions array
      const titleMatch = jsonString.match(/"title"\s*:\s*"([^"]+)"/i);
      const title = titleMatch ? titleMatch[1] : 'Extracted Quiz';
      
      // More flexible approach: find question boundaries and extract complete objects
      // Look for questions that start with { and have all required fields
      const questionStartPattern = /\{\s*"text"\s*:\s*"[^"]*"/g;
      const completeQuestions = [];
      let startMatch;
      
      while ((startMatch = questionStartPattern.exec(jsonString)) !== null) {
        const startIndex = startMatch.index;
        
        // Find the matching closing brace for this question
        let braceCount = 0;
        let endIndex = -1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = startIndex; i < jsonString.length; i++) {
          const char = jsonString[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i;
                break;
              }
            }
          }
        }
        
        if (endIndex > startIndex) {
          const questionJson = jsonString.substring(startIndex, endIndex + 1);
          
          try {
            const question = JSON.parse(questionJson);
            
            // Validate question structure more thoroughly
            if (question.text && 
                question.options && 
                Array.isArray(question.options) && 
                question.options.length >= 4 &&
                question.correct_answer_id && 
                question.explanation) {
              
              // Validate that options have proper structure
              const validOptions = question.options.every(opt => 
                opt && typeof opt === 'object' && opt.id && opt.text
              );
              
              if (validOptions) {
                completeQuestions.push(question);
                logger.debug('QuizParser', `Found complete question: "${question.text.substring(0, 50)}..."`);
              }
            }
          } catch (e) {
            logger.debug('QuizParser', `Skipping malformed question: ${e.message}`);
          }
        }
      }
      
      // If we found at least one complete question, return partial result
      if (completeQuestions.length > 0) {
        this.trackCorrection('partial_parsing_success');
        logger.debug('QuizParser', `Partial parsing successful: extracted ${completeQuestions.length} complete questions`);
        return {
          title: title,
          questions: completeQuestions
        };
      }
      
      logger.debug('QuizParser', 'No complete questions found in truncated JSON');
      return null;
    } catch (error) {
      logger.warn('QuizParser', `Partial parsing failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Remove incomplete trailing content that can't be parsed
   */
  removeIncompleteTrailingContent(jsonString) {
    let cleaned = jsonString;
    
    // Remove incomplete string at the end
    cleaned = cleaned.replace(/"[^"]*$/, '');
    
    // Remove trailing comma or colon
    cleaned = cleaned.replace(/[,:;]\s*$/, '');
    
    // Find the last complete question object
    const lastCompleteQuestionMatch = cleaned.lastIndexOf('}');
    if (lastCompleteQuestionMatch !== -1) {
      // Keep everything up to the last complete object
      cleaned = cleaned.substring(0, lastCompleteQuestionMatch + 1);
    }
    
    return cleaned;
  }

  /**
   * Close unfinished JSON structures
   */
  closeUnfinishedStructures(jsonString) {
    let completed = jsonString;
    
    // Count open/close braces and brackets
    const openBraces = (completed.match(/\{/g) || []).length;
    const closeBraces = (completed.match(/\}/g) || []).length;
    const openBrackets = (completed.match(/\[/g) || []).length;
    const closeBrackets = (completed.match(/\]/g) || []).length;
    
    // Close missing brackets first (for questions array)
    const missingCloseBrackets = openBrackets - closeBrackets;
    for (let i = 0; i < missingCloseBrackets; i++) {
      completed += ']';
    }
    
    // Close missing braces (for main object)
    const missingCloseBraces = openBraces - closeBraces;
    for (let i = 0; i < missingCloseBraces; i++) {
      completed += '}';
    }
    
    return completed;
  }

  /**
   * Fix malformed option objects - the main issue you're facing
   */
  fixMalformedOptions(jsonString) {
    let corrected = jsonString;
    let correctionCount = 0;
    
    // Pattern 1: {"id": "A": "Option text"} -> {"id": "A", "text": "Option text"}
    const pattern1 = /\{"id":\s*"([A-Z])"\s*:\s*"([^"]+)"\}/g;
    corrected = corrected.replace(pattern1, (match, id, text) => {
      correctionCount++;
      this.trackCorrection('pattern1_id_colon_text');
      logger.debug('QuizParser', `Fixed Pattern 1: ${match} -> {"id": "${id}", "text": "${text}"}`);
      return `{"id": "${id}", "text": "${text}"}`;
    });
    
    // Pattern 2: {"id": "A": "text": "Option text"} -> {"id": "A", "text": "Option text"}
    const pattern2 = /\{"id":\s*"([A-Z])"\s*:\s*"text"\s*:\s*"([^"]+)"\}/g;
    corrected = corrected.replace(pattern2, (match, id, text) => {
      correctionCount++;
      this.trackCorrection('pattern2_id_colon_text_colon');
      logger.debug('QuizParser', `Fixed Pattern 2: ${match} -> {"id": "${id}", "text": "${text}"}`);
      return `{"id": "${id}", "text": "${text}"}`;
    });
    
    // Pattern 3: More flexible - any {"id": "X": "content"} pattern
    const pattern3 = /\{"id":\s*"([A-Z])"\s*:\s*"([^"]*(?:"[^{"]}"[^"]*)*[^"]*)"\}/g;
    corrected = corrected.replace(pattern3, (match, id, content) => {
      // Only apply if it doesn't already have proper structure
      if (!match.includes('"text":')) {
        correctionCount++;
        this.trackCorrection('pattern3_flexible_id_content');
        logger.debug('QuizParser', `Fixed Pattern 3: ${match} -> {"id": "${id}", "text": "${content}"}`);
        return `{"id": "${id}", "text": "${content}"}`;
      }
      return match;
    });
    
    // Pattern 4: Handle cases where there might be nested quotes or escaped content
    const pattern4 = /\{"id":\s*"([A-Z])"\s*:\s*"([^"]}(?:\\"[^"]}]*)*[^"]}]*)"\}/g;
    corrected = corrected.replace(pattern4, (match, id, content) => {
      if (!match.includes('"text":')) {
        correctionCount++;
        this.trackCorrection('pattern4_escaped_content');
        logger.debug('QuizParser', `Fixed Pattern 4: ${match} -> {"id": "${id}", "text": "${content}"}`);
        return `{"id": "${id}", "text": "${content}"}`;
      }
      return match;
    });
    
    if (correctionCount > 0) {
      logger.debug('QuizParser', `Applied ${correctionCount} option format corrections`);
    }
    
    return corrected;
  }

  /**
   * Fix common JSON syntax errors
   */
  fixCommonSyntaxErrors(jsonString) {
    let corrected = jsonString;
    
    // Fix double colons
    corrected = corrected.replace(/::+/g, ':');
    this.trackCorrection('double_colons');
    
    // Fix missing commas between objects/arrays
    corrected = corrected.replace(/\}\s*\{/g, '}, {');
    corrected = corrected.replace(/\]\s*\[/g, '], [');
    this.trackCorrection('missing_commas');
    
    // Fix extra commas before closing brackets
    corrected = corrected.replace(/,\s*([}\]])/g, '$1');
    this.trackCorrection('extra_commas_before_close');
    
    // Fix escaped quotes in field values like "difficulty": \"easy\"
    corrected = corrected.replace(/: ?\\"([^\\]*)\\"([,\}\]])/g, ': "$1"$2');
    this.trackCorrection('escaped_quotes_in_values');
    
    return corrected;
  }

  /**
   * Fix trailing commas
   */
  fixTrailingCommas(jsonString) {
    // Remove trailing commas before } or ]
    const fixed = jsonString.replace(/,(\s*[}\]])/g, '$1');
    if (fixed !== jsonString) {
      this.trackCorrection('trailing_commas');
    }
    return fixed;
  }

  /**
   * Fix quote mismatches and escaping issues
   */
  fixQuoteMismatches(jsonString) {
    this.trackCorrection('unescaped_quotes');
    
    // Replace unescaped quotes within values
    let corrected = jsonString.replace(/: ?"([^"]*)"([^,\}\]]*)[,\}\]]/g, (match, p1, p2) => {
      if (p2.includes('"')) {
        return match.replace(/"/g, '\"');
      }
      return match;
    });
    
    // Fix escaped quotes in JSON values (e.g., "difficulty": \"easy\")
    corrected = corrected.replace(/: ?\\"([^\\]*)\\"([,\}\]])/g, ': "$1"$2');
    
    // Fix double escaped quotes in explanations or other text fields
    corrected = corrected.replace(/\\\\"([^"]*)\\\\"/, '"$1"');
    
    return corrected;
  }

  /**
   * Validate and correct the parsed structure
   */
  validateAndCorrectStructure(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Parsed data is not a valid object');
    }

    // Ensure questions array exists
    if (!Array.isArray(data.questions)) {
      logger.debug('QuizParser', 'Creating missing questions array');
      data.questions = [];
      this.trackCorrection('missing_questions_array');
    }

    // Validate and correct each question
    data.questions = data.questions.map((question, index) => {
      return this.validateQuestion(question, index);
    }).filter(q => q !== null);

    return data;
  }

  /**
   * Validate and correct individual question structure
   */
  validateQuestion(question, index) {
    if (!question || typeof question !== 'object') {
      logger.debug('QuizParser', `Removing invalid question at index ${index}`);
      return null;
    }

    // Ensure options array exists
    if (!Array.isArray(question.options)) {
      logger.debug('QuizParser', `Creating missing options array for question ${index}`);
      question.options = [];
      this.trackCorrection('missing_options_array');
    }

    // Validate and correct each option
    question.options = question.options.map((option, optIndex) => {
      return this.validateOption(option, index, optIndex);
    }).filter(o => o !== null);

    // Ensure minimum structure
    if (!question.text && !question.question) {
      logger.debug('QuizParser', `Question ${index} missing text/question field`);
      question.text = question.text || question.question || `Question ${index + 1}`;
    }

    return question;
  }

  /**
   * Validate and correct individual option structure
   */
  validateOption(option, questionIndex, optionIndex) {
    if (!option || typeof option !== 'object') {
      logger.debug('QuizParser', `Removing invalid option at Q${questionIndex}:O${optionIndex}`);
      return null;
    }

    // Ensure required fields
    if (!option.id) {
      option.id = String.fromCharCode(65 + optionIndex); // A, B, C, D...
      this.trackCorrection('missing_option_id');
    }

    if (!option.text) {
      // Check if the option has a direct string value instead of text field
      const keys = Object.keys(option);
      if (keys.length === 2 && option.id) {
        const otherKey = keys.find(k => k !== 'id');
        if (otherKey && typeof option[otherKey] === 'string') {
          option.text = option[otherKey];
          delete option[otherKey];
          this.trackCorrection('moved_text_from_other_field');
        }
      }
      
      if (!option.text) {
        option.text = `Option ${option.id}`;
        this.trackCorrection('missing_option_text');
      }
    }

    return option;
  }

  /**
   * Create fallback structure when all else fails
   */
  createFallbackStructure() {
    logger.warn('QuizParser', 'Creating fallback quiz structure');
    
    return {
      questions: [],
      metadata: {
        generated: new Date().toISOString(),
        status: 'fallback',
        error: 'Unable to parse original response'
      }
    };
  }

  /**
   * Track correction statistics
   */
  trackCorrection(type) {
    if (!this.correctionStats.correctionTypes[type]) {
      this.correctionStats.correctionTypes[type] = 0;
    }
    this.correctionStats.correctionTypes[type]++;
  }

  /**
   * Log correction statistics
   */
  logStats() {
    const stats = {
      totalAttempts: this.correctionStats.totalAttempts,
      successRate: `${((this.correctionStats.successfulCorrections / this.correctionStats.totalAttempts) * 100).toFixed(1)}%`,
      correctionTypes: this.correctionStats.correctionTypes
    };
    logger.debug('QuizParser', `Parser Statistics: ${JSON.stringify(stats)}`);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.correctionStats = {
      totalAttempts: 0,
      successfulCorrections: 0,
      failedCorrections: 0,
      correctionTypes: {}
    };
  }

  /**
   * Get current statistics
   */
  getStats() {
    return { ...this.correctionStats };
  }

  /**
   * Analyze parsing failure to provide detailed diagnostic information
   */
  analyzeParsingFailure(rawResponse, correctedJSON, error) {
    const analysis = {
      summary: '',
      details: {},
      recommendations: []
    };

    // Basic response analysis
    analysis.details.rawResponseLength = rawResponse.length;
    analysis.details.correctedJSONLength = correctedJSON ? correctedJSON.length : 0;
    analysis.details.errorMessage = error.message;
    analysis.details.errorType = error.name;

    // Check for truncation indicators
    const isTruncated = this.detectTruncation(correctedJSON || rawResponse);
    analysis.details.appearsTruncated = isTruncated;

    if (isTruncated) {
      analysis.summary = 'JSON appears to be truncated - incomplete response from AI';
      analysis.recommendations.push('Consider reducing the number of questions requested');
      analysis.recommendations.push('Try splitting the request into smaller batches');
      analysis.recommendations.push('Check AI model token limits and response size constraints');
    }

    // Check for common JSON syntax issues
    if (correctedJSON) {
      const syntaxIssues = this.identifySyntaxIssues(correctedJSON);
      analysis.details.syntaxIssues = syntaxIssues;
      
      if (syntaxIssues.length > 0) {
        analysis.summary = analysis.summary || 'JSON contains syntax errors that could not be automatically corrected';
        analysis.recommendations.push('Review AI prompt to ensure proper JSON format instructions');
      }
    }

    // Check for structure issues
    const structureIssues = this.identifyStructureIssues(correctedJSON || rawResponse);
    analysis.details.structureIssues = structureIssues;
    
    if (structureIssues.length > 0 && !analysis.summary) {
      analysis.summary = 'JSON structure does not match expected quiz format';
      analysis.recommendations.push('Verify AI prompt includes proper quiz structure examples');
    }

    // Default summary if none set
    if (!analysis.summary) {
      analysis.summary = 'Unknown JSON parsing error';
      analysis.recommendations.push('Enable detailed logging for more diagnostic information');
    }

    return analysis;
  }

  /**
   * Identify specific syntax issues in JSON
   */
  identifySyntaxIssues(jsonString) {
    const issues = [];
    
    // Check for unmatched quotes
    const quotes = jsonString.match(/"/g) || [];
    if (quotes.length % 2 !== 0) {
      issues.push('Unmatched quotes detected');
    }
    
    // Check for trailing commas
    if (/,\s*[}\]]/.test(jsonString)) {
      issues.push('Trailing commas found');
    }
    
    // Check for missing commas
    if (/}\s*{/.test(jsonString) || /]\s*\[/.test(jsonString)) {
      issues.push('Missing commas between objects/arrays');
    }
    
    // Check for unescaped characters
    if (/"[^"]*\n[^"]*"/.test(jsonString)) {
      issues.push('Unescaped newlines in strings');
    }
    
    return issues;
  }

  /**
   * Identify structure issues in the JSON
   */
  identifyStructureIssues(jsonString) {
    const issues = [];
    
    // Check for expected quiz structure
    if (!jsonString.includes('"questions"')) {
      issues.push('Missing "questions" array');
    }
    
    // Check for expected question properties
    const hasText = jsonString.includes('"text"') || jsonString.includes('"question"');
    if (!hasText) {
      issues.push('Questions missing text/question property');
    }
    
    if (!jsonString.includes('"options"')) {
      issues.push('Questions missing options array');
    }
    
    if (!jsonString.includes('"correct_answer"')) {
      issues.push('Questions missing correct_answer property');
    }
    
    return issues;
  }
}

// Usage example and testing
function demonstrateUsage() {
  const parser = new QuizJSONParser({ 
    enableLogging: true,
    throwOnUnrecoverable: false 
  });

  // Example malformed responses from your Gemini issues
  const malformedExamples = [
    // Example 1: Missing "text" key
    `{
      "questions": [
        {
          "text": "What should you check first?",
          "options": [
            {"id": "A": "Checking the fuel level"},
            {"id": "B", "text": "Checking the oil"},
            {"id": "C": "Checking the tires"},
            {"id": "D", "text": "Starting the engine"}
          ],
          "correct": "A"
        }
      ]
    }`,
    
    // Example 2: Extra colon with "text" key
    `{
      "questions": [
        {
          "text": "Which is correct?",
          "options": [
            {"id": "A", "text": "Option A"},
            {"id": "B": "text": "Option B"},
            {"id": "C", "text": "Option C"},
            {"id": "D": "text": "Option D"}
          ],
          "correct": "B"
        }
      ]
    }`,
    
    // Example 3: Mixed errors
    `{
      "questions": [
        {
          "text": "Mixed error example",
          "options": [
            {"id": "A": "First option"},
            {"id": "B", "text": "Second option"},
            {"id": "C": "text": "Third option"},
            {"id": "D", "text": "Fourth option"}
          ],
          "correct": "A"
        }
      ]
    }`
  ];

  console.log('🧪 Testing malformed JSON examples...\n');

  malformedExamples.forEach((example, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    try {
      const result = parser.parseQuizJSON(example);
      console.log('✅ Parsed successfully:', result.questions.length, 'questions');
      
      // Show corrected options
      result.questions.forEach((q, qIndex) => {
        console.log(`Q${qIndex + 1} Options:`, q.options.map(o => `${o.id}: ${o.text}`));
      });
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
  });

  console.log('\n📊 Final Statistics:');
  parser.logStats();
}



/**
 * Integration guide for using QuizJSONParser with Google Gemini
 * This shows how to integrate the robust parser into your existing workflow
 */

class GeminiQuizGenerator {
  constructor(apiKey, genAIInstance, options = {}) { // Added genAIInstance
    this.apiKey = apiKey; // Retained for potential future use or if genAIInstance is not primary
    this.genAI = genAIInstance;
    this.apiKey = apiKey;
    this.parser = new QuizJSONParser({
      enableLogging: options.enableLogging || false,
      throwOnUnrecoverable: options.throwOnUnrecoverable || false
    });
    this.model = options.model || 'gemini-1.5-flash-latest';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Enhanced prompt that works better with the parser
   */
  buildEnhancedPrompt(questionCount = 10) { // Removed documents parameter
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
✓ Generated EXACTLY ${questionCount} questions (count them!)
✓ All questions are aviation-related and based on document content
✓ Each option has both "id" and "text" keys
✓ No extra colons in option objects
✓ Valid JSON syntax throughout
✓ All strings properly quoted and escaped
✓ No trailing commas
✓ No markdown code blocks or explanations outside JSON

Generate the aviation quiz JSON now:`; // Document content will be passed as separate parts
  }

  /**
   * Main method to generate quiz with robust error handling
   */
  async generateQuiz(documentParts, questionCount = 10) { // Changed documents to documentParts
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🚀 Quiz generation attempt ${attempt}/${this.maxRetries}`);
        
        // Generate with Gemini
        const rawResponse = await this.callGemini(documentParts, questionCount, attempt);
        
        // Parse with robust parser
        const parsedQuiz = this.parser.parseQuizJSON(rawResponse);
        
        // Validate minimum quality
        if (this.validateQuizQuality(parsedQuiz, questionCount)) {
          console.log(`✅ Successfully generated quiz with ${parsedQuiz.questions.length} questions`);
          return {
            success: true,
            quiz: parsedQuiz,
            attempts: attempt,
            stats: this.parser.getStats()
          };
        } else {
          throw new Error('Generated quiz did not meet quality requirements');
        }
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ Retrying in ${this.retryDelay}ms...`);
          await this.sleep(this.retryDelay);
          // Exponential backoff
          this.retryDelay *= 1.5;
        }
      }
    }
    
    // All attempts failed
    console.error('❌ All quiz generation attempts failed');
    return {
      success: false,
      error: lastError.message,
      attempts: this.maxRetries,
      stats: this.parser.getStats()
    };
  }

  /**
   * Call Gemini API with enhanced error handling
   */
  async callGemini(documentParts, questionCount, attempt) { // Changed documents to documentParts
    const instructionPromptText = this.buildEnhancedPrompt(questionCount);
    
    // Add attempt-specific variations to reduce repetition
    const instructionPromptWithVariation = this.addAttemptVariation(instructionPromptText, attempt);

    const finalApiContents = [{
      role: 'user',
      parts: [
        { text: instructionPromptWithVariation }, 
        ...documentParts 
      ]
    }];
    
    try {
      // Replace this with your actual Gemini API call
      const response = await this.makeGeminiRequest(finalApiContents); // Pass constructed finalApiContents
      
      if (!response || !response.text) {
        throw new Error('Empty response from Gemini API');
      }
      
      return response.text;
      
    } catch (error) {
      if (error.message.includes('rate limit')) {
        throw new Error('Rate limited by Gemini API');
      } else if (error.message.includes('quota')) {
        throw new Error('Quota exceeded for Gemini API');
      } else {
        throw new Error(`Gemini API error: ${error.message}`);
      }
    }
  }

  /**
   * Add slight variations to prompt on retries to avoid identical responses
   */
  addAttemptVariation(prompt, attempt) {
    if (attempt === 1) return prompt;
    
    const variations = [
      '\nIMPORTANT: Ensure perfect JSON formatting in your response.',
      '\nREMINDER: Double-check option object structure before responding.',
      '\nNOTE: Previous attempt had formatting issues. Be extra careful with JSON syntax.'
    ];
    
    return prompt + variations[(attempt - 2) % variations.length];
  }

  /**
   * Validate the quality of generated quiz
   */
  validateQuizQuality(quiz, expectedCount) {
    if (!quiz || !quiz.questions || !Array.isArray(quiz.questions)) {
      return false;
    }
    
    const questions = quiz.questions;
    
    // Check minimum question count (allow some flexibility)
    if (questions.length < Math.max(1, expectedCount * 0.6)) {
      console.warn(`⚠️ Too few questions: ${questions.length} < ${expectedCount * 0.6}`);
      return false;
    }
    
    // Check each question quality
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      // Must have text
      if (!q.text || q.text.trim().length < 10) {
        console.warn(`⚠️ Question ${i} has insufficient text`);
        return false;
      }
      
      // Must have options
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        console.warn(`⚠️ Question ${i} has insufficient options`);
        return false;
      }
      
      // Check option quality
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        if (!opt.id || !opt.text || opt.text.trim().length < 2) {
          console.warn(`⚠️ Question ${i}, Option ${j} is malformed`);
          return false;
        }
      }
      
      // Must have correct answer
      if (!q.correct) {
        console.warn(`⚠️ Question ${i} missing correct answer`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Placeholder for actual Gemini API call
   * Replace this with your actual implementation
   */
  async makeGeminiRequest(contentsForApi) { // Changed prompt to contentsForApi
    if (!this.genAI) {
      throw new Error('Gemini AI client (genAI) not provided to GeminiQuizGenerator');
    }
    const model = this.genAI.getGenerativeModel({ model: this.model });

    // Log the request being sent to Gemini for debugging
    if (this.parser.enableLogging) { // Assuming parser's enableLogging can be used here
      console.log('🔍 Gemini API Request:', JSON.stringify(contentsForApi, null, 2));
    }

    const result = await model.generateContent({ contents: contentsForApi });
    const response = result.response;

    if (!response || typeof response.text !== 'function') {
      console.error('GeminiQuizGenerator:makeGeminiRequest', 'Invalid response structure from Gemini API. Full response:', JSON.stringify(response));
      throw new Error('Invalid or empty response from Gemini API (no text function or undefined response)');
    }
    
    const responseText = response.text();
    if (responseText === undefined || responseText === null) {
      console.error('GeminiQuizGenerator:makeGeminiRequest', 'Gemini API response.text() returned undefined or null. Full response:', JSON.stringify(response));
      throw new Error('Empty text response from Gemini API (text is undefined/null)');
    }
    
    return { text: responseText };
  }

  /**
   * Utility method for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get parser statistics
   */
  getParserStats() {
    return this.parser.getStats();
  }

  /**
   * Reset parser statistics
   */
  resetParserStats() {
    this.parser.resetStats();
  }
}

/**
 * Example usage and testing
 */
class QuizGenerationDemo {
  static async demonstrateUsage() {
    console.log('🎯 Quiz Generation Integration Demo\n');
    
    // Mock documents
    const sampleDocuments = [
      `Vehicle Safety Checklist:
      1. Check fuel level before starting
      2. Inspect tires for proper pressure
      3. Verify oil levels
      4. Test brakes before driving
      5. Ensure mirrors are adjusted properly`,
      
      `Emergency Procedures:
      - If engine overheats, pull over safely
      - Keep emergency kit in vehicle
      - Call for help if needed
      - Never ignore warning lights`
    ];
    
    // Initialize generator (passing null for genAIInstance as it's not used in this parser-focused demo part)
    const generator = new GeminiQuizGenerator('demo-key', null, {
      enableLogging: true,
      throwOnUnrecoverable: false,
      maxRetries: 2
    });
    
    // Simulate malformed responses that would come from Gemini
    const simulatedMalformedResponse = `{
      "questions": [
        {
          "text": "What should you check first before starting a vehicle?",
          "options": [
            {"id": "A": "Check fuel level"},
            {"id": "B", "text": "Check oil level"},
            {"id": "C": "text": "Check tire pressure"},
            {"id": "D", "text": "Start the engine"}
          ],
          "correct": "A",
          "explanation": "Fuel level should be checked first for safety"
        },
        {
          "text": "What should you do if the engine overheats?",
          "options": [
            {"id": "A", "text": "Keep driving"},
            {"id": "B": "Pull over safely"},
            {"id": "C", "text": "Turn off air conditioning"},
            {"id": "D": "text": "Add cold water to radiator"}
          ],
          "correct": "B",
          "explanation": "Always pull over safely when engine overheats"
        }
      ]
    }`;
    
    console.log('📝 Testing with simulated malformed Gemini response...\n');
    
    // Test the parser directly
    try {
      const result = generator.parser.parseQuizJSON(simulatedMalformedResponse);
      console.log('✅ Parser successfully corrected malformed JSON');
      console.log('📊 Generated quiz structure:');
      
      result.questions.forEach((q, index) => {
        console.log(`\nQ${index + 1}: ${q.text}`);
        q.options.forEach(opt => {
          console.log(`  ${opt.id}. ${opt.text}`);
        });
        console.log(`  Correct: ${q.correct}`);
      });
      
    } catch (error) {
      console.error('❌ Parser failed:', error.message);
    }
    
    console.log('\n📊 Parser Statistics:');
    console.log(generator.getParserStats());
  }

  /**
   * Test different types of malformed JSON
   */
  static testMalformedPatterns() {
    console.log('\n🧪 Testing Various Malformed Patterns\n');
    
    const parser = new QuizJSONParser({ enableLogging: true });
    
    const testCases = [
      {
        name: 'Missing "text" key',
        json: '{"questions":[{"text":"Test","options":[{"id":"A":"Option A"}],"correct":"A"}]}'
      },
      {
        name: 'Extra colon with "text"',
        json: '{"questions":[{"text":"Test","options":[{"id":"A":"text":"Option A"}],"correct":"A"}]}'
      },
      {
        name: 'Mixed errors',
        json: '{"questions":[{"text":"Test","options":[{"id":"A":"Option A"},{"id":"B":"text":"Option B"}],"correct":"A"}]}'
      },
      {
        name: 'Trailing commas',
        json: '{"questions":[{"text":"Test","options":[{"id":"A","text":"Option A"},],"correct":"A"}]}'
      }
    ];
    
    testCases.forEach((testCase, index) => {
      console.log(`\n--- Test Case ${index + 1}: ${testCase.name} ---`);
      try {
        const result = parser.parseQuizJSON(testCase.json);
        console.log('✅ Successfully parsed and corrected');
        console.log('Options:', result.questions[0].options.map(o => `${o.id}: ${o.text}`));
      } catch (error) {
        console.error('❌ Failed to parse:', error.message);
      }
    });
    
    console.log('\n📊 Final Test Statistics:');
    parser.logStats();
  }
}

/**
 * Production-ready wrapper that combines everything
 */
class ProductionQuizGenerator {
  constructor(geminiApiKey, genAIInstance, options = {}) { // Added genAIInstance
    this.generator = new GeminiQuizGenerator(geminiApiKey, genAIInstance, {
      enableLogging: options.enableLogging || false,
      throwOnUnrecoverable: false, // Always use fallback in production
      maxRetries: options.maxRetries || 3,
      model: options.model || 'gemini-1.5-flash-latest'
    });
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      retriesUsed: 0,
      correctionsApplied: 0,
      averageQuestionsGenerated: 0
    };
  }

  /**
   * Production method with comprehensive error handling and metrics
   */
  async generateQuiz(documentParts, questionCount = 10, options = {}) { // Changed documents to documentParts
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      // Validate inputs
      // Validate inputs for documentParts (array of objects with text or inlineData)
      if (!Array.isArray(documentParts) || documentParts.length === 0) {
        throw new Error('documentParts array is required and must not be empty');
      }
      for (const part of documentParts) {
        if (!part.text && !part.inlineData) {
          throw new Error('Each part in documentParts must have a text or inlineData property');
        }
      }
      
      if (questionCount < 1 || questionCount > 50) {
        throw new Error('Question count must be between 1 and 50');
      }
      
      // Generate quiz
      const result = await this.generator.generateQuiz(documentParts, questionCount);
      
      // Update metrics
      if (result.success) {
        this.metrics.successfulRequests++;
        this.metrics.retriesUsed += (result.attempts - 1);
        
        const parserStats = result.stats;
        this.metrics.correctionsApplied += Object.values(parserStats.correctionTypes).reduce((a, b) => a + b, 0);
        
        const questionsGenerated = result.quiz.questions.length;
        this.metrics.averageQuestionsGenerated = (
          (this.metrics.averageQuestionsGenerated * (this.metrics.successfulRequests - 1) + questionsGenerated) / 
          this.metrics.successfulRequests
        );
        
        return {
          success: true,
          quiz: result.quiz,
          metadata: {
            generatedAt: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
            attemptsUsed: result.attempts,
            correctionsApplied: Object.values(parserStats.correctionTypes).reduce((a, b) => a + b, 0),
            questionsRequested: questionCount,
            questionsGenerated: questionsGenerated,
            model: this.generator.model
          }
        };
      } else {
        return {
          success: false,
          error: result.error,
          metadata: {
            generatedAt: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
            attemptsUsed: result.attempts,
            model: this.generator.model
          }
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          attemptsUsed: 1,
          model: this.generator.model
        }
      };
    }
  }

  /**
   * Get production metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      averageRetriesPerRequest: this.metrics.totalRequests > 0 ? 
        (this.metrics.retriesUsed / this.metrics.totalRequests).toFixed(2) : '0',
      parserStats: this.generator.getParserStats()
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      retriesUsed: 0,
      correctionsApplied: 0,
      averageQuestionsGenerated: 0
    };
    this.generator.resetParserStats();
  }

  /**
   * Health check method
   */
  async healthCheck() {
    const testPayloadParts = [{ text: 'Test document for health check' }];
    const result = await this.generateQuiz(testPayloadParts, 1);
    
    return {
      healthy: result.success,
      timestamp: new Date().toISOString(),
      details: result.metadata
    };
  }
}

/**
 * Utility functions for common tasks
 */
class QuizUtilities {
  /**
   * Validate quiz JSON structure without parsing
   */
  static validateQuizStructure(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      if (!data.questions || !Array.isArray(data.questions)) {
        return { valid: false, error: 'Missing or invalid questions array' };
      }
      
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        
        if (!q.text) {
          return { valid: false, error: `Question ${i} missing text` };
        }
        
        if (!q.options || !Array.isArray(q.options)) {
          return { valid: false, error: `Question ${i} missing options array` };
        }
        
        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j];
          if (!opt.id || !opt.text) {
            return { valid: false, error: `Question ${i}, Option ${j} missing id or text` };
          }
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: `JSON parse error: ${error.message}` };
    }
  }

  /**
   * Convert quiz to different formats
   */
  static convertQuizFormat(quiz, format = 'simple') {
    switch (format) {
    case 'simple':
      return quiz.questions.map((q, i) => ({
        question: q.text,
        options: q.options.map(o => o.text),
        answer: q.options.findIndex(o => o.id === q.correct)
      }));
        
    case 'kahoot':
      return {
        title: 'Generated Quiz',
        questions: quiz.questions.map(q => ({
          question: q.text,
          answers: q.options.map(o => ({
            answer: o.text,
            correct: o.id === q.correct
          }))
        }))
      };
        
    case 'csv': {
      const csvRows = [['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct', 'Explanation']];
      quiz.questions.forEach(q => {
        const row = [q.text];
        ['A', 'B', 'C', 'D'].forEach(id => {
          const option = q.options.find(o => o.id === id);
          row.push(option ? option.text : '');
        });
        row.push(q.correct);
        row.push(q.explanation || '');
        csvRows.push(row);
      });
      return csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }
        
    default:
      return quiz;
    }
  }

  /**
   * Analyze quiz difficulty and quality
   */
  static analyzeQuiz(quiz) {
    const analysis = {
      totalQuestions: quiz.questions.length,
      averageQuestionLength: 0,
      averageOptionLength: 0,
      optionDistribution: { A: 0, B: 0, C: 0, D: 0 },
      qualityScore: 0,
      issues: []
    };

    let totalQuestionChars = 0;
    let totalOptionChars = 0;
    let totalOptions = 0;

    quiz.questions.forEach((q, index) => {
      // Length analysis
      totalQuestionChars += q.text.length;
      
      q.options.forEach(opt => {
        totalOptionChars += opt.text.length;
        totalOptions++;
        if (analysis.optionDistribution[opt.id] !== undefined) {
          analysis.optionDistribution[opt.id]++;
        }
      });

      // Quality checks
      if (q.text.length < 20) {
        analysis.issues.push(`Question ${index + 1}: Very short question text`);
      }
      
      if (q.options.length < 4) {
        analysis.issues.push(`Question ${index + 1}: Less than 4 options`);
      }
      
      const optionLengths = q.options.map(o => o.text.length);
      const avgOptLength = optionLengths.reduce((a, b) => a + b, 0) / optionLengths.length;
      const maxOptLength = Math.max(...optionLengths);
      const minOptLength = Math.min(...optionLengths);
      
      if (maxOptLength / minOptLength > 3) {
        analysis.issues.push(`Question ${index + 1}: Large variation in option lengths`);
      }
    });

    analysis.averageQuestionLength = Math.round(totalQuestionChars / quiz.questions.length);
    analysis.averageOptionLength = Math.round(totalOptionChars / totalOptions);
    
    // Calculate quality score (0-100)
    let score = 100;
    score -= analysis.issues.length * 10; // -10 points per issue
    if (analysis.averageQuestionLength < 30) score -= 20;
    if (analysis.averageOptionLength < 10) score -= 15;
    
    // Check answer distribution balance
    const correctAnswers = quiz.questions.map(q => q.correct);
    const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
    correctAnswers.forEach(answer => {
      if (answerCounts[answer] !== undefined) answerCounts[answer]++;
    });
    
    const maxAnswers = Math.max(...Object.values(answerCounts));
    const minAnswers = Math.min(...Object.values(answerCounts));
    if (maxAnswers / Math.max(minAnswers, 1) > 2) {
      score -= 15;
      analysis.issues.push('Unbalanced correct answer distribution');
    }

    analysis.qualityScore = Math.max(0, score);
    
    return analysis;
  }
}

export {
  QuizJSONParser,
  GeminiQuizGenerator,
  ProductionQuizGenerator,
  QuizUtilities,
  QuizGenerationDemo
};

// Demo execution
if (typeof require !== 'undefined' && require.main === module) {
  console.log('SCRIPT_ENTRY_POINT: quizParserUtils.js main execution block reached.');
  console.log('🎯 Running Quiz Generation Integration Demo...\n');
  
  QuizGenerationDemo.demonstrateUsage().then(() => {
    QuizGenerationDemo.testMalformedPatterns();
  }).catch(console.error);
}
