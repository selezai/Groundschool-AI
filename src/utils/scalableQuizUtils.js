console.log('--- scalableQuizUtils.js script starting ---');
import { QuizJSONParser } from './quizParserUtils.js';
// eslint-disable-next-line no-unused-vars
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const defaultSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const defaultGenerationConfig = {
  // candidateCount: 1, // Default is 1
  // stopSequences: [],
  // maxOutputTokens: undefined, // Let model decide or set if specific limit needed
  temperature: 0.7, // Adjust for creativity vs. determinism
  topP: 0.9,        // Adjust nucleus sampling
  topK: 40,         // Adjust top-k sampling
};

class ScalableQuizGenerator {
  constructor(genAIInstance, options = {}) {
    this.genAI = genAIInstance;
    this.apiKey = options.apiKey; // May still be needed for other things or if parser uses it
    this.parser = new QuizJSONParser({
      apiKey: this.apiKey,
      enableLogging: options.enableLogging || false,
      throwOnUnrecoverable: options.throwOnUnrecoverable !== undefined ? options.throwOnUnrecoverable : false,
    });
    
    this.strategy = options.strategy || 'auto';
    this.questionsPerDocument = options.questionsPerDocument || 3;
    this.maxDocumentsPerBatch = options.maxDocumentsPerBatch || 5; // Adjusted default
    this.modelName = options.model || 'gemini-1.5-flash-latest';
    
    this.maxRetries = options.maxRetries || 2;
    this.concurrentRequests = options.concurrentRequests || 3; // Adjusted default
    this.rateLimitDelay = options.rateLimitDelay || 1500; // ms, adjusted default

    this.options = options; // Store all options for flexibility
    this.logTag = '[ScalableQuiz]';

    if (!this.genAI) {
      throw new Error(`${this.logTag} GoogleGenerativeAI instance (genAI) is required.`);
    }
    if (this.options.enableLogging) {
      console.info(`${this.logTag} Initialized with model: ${this.modelName}, strategy: ${this.strategy}`);
    }
  }

  async generateScaledQuiz(documentInfos, totalQuestions = 10, onProgressUpdate = () => {}) {
    if (!Array.isArray(documentInfos) || documentInfos.some(docInfo => 
        !docInfo || typeof docInfo.id !== 'string' || 
        typeof docInfo.title !== 'string' || !docInfo.content ||
        !docInfo.content.inlineData || !docInfo.content.inlineData.data || !docInfo.content.inlineData.mimeType
    )) {
      console.error(`${this.logTag} Invalid documentInfos input for generateScaledQuiz. Expected array of objects with id, title, and valid content (Part with inlineData).`, { documentInfos });
      throw new Error('Invalid documentInfos input: Expected array of objects with id, title, and valid content (Part with inlineData).');
    }
    if (this.options.enableLogging) {
      console.info(`${this.logTag} 🎯 Generating ${totalQuestions} questions from ${documentInfos.length} documents using ${this.modelName}`);
    }
    onProgressUpdate(`Starting scalable exam generation for ${documentInfos.length} document(s)...`);
    
    if (documentInfos.length === 0) {
      console.warn(`${this.logTag} No documents provided to generateScaledQuiz.`);
      return { questions: [], metadata: { strategy: 'none', message: 'No documents provided' } };
    }
    
    // Single document optimization
    if (documentInfos.length === 1) {
      if (this.options.enableLogging) console.info(`${this.logTag} Single document detected, using generateFromSingleDocument directly.`);
      onProgressUpdate('Single document detected. Generating questions directly...');
      return await this.generateFromSingleDocument(documentInfos[0], totalQuestions, 0, onProgressUpdate); 
    }
    
    const strategyToUse = this.strategy === 'auto' ? this.determineOptimalStrategy(documentInfos.length, totalQuestions) : this.strategy;
    if (this.options.enableLogging) console.info(`${this.logTag} 📋 Using strategy: ${strategyToUse}`);
    onProgressUpdate(`Determined strategy: ${strategyToUse}. Proceeding with generation...`);
    
    let result;
    switch (strategyToUse) {
      case 'perDocument':
        result = await this.generatePerDocumentQuiz(documentInfos, totalQuestions, onProgressUpdate);
        break;
      case 'batched':
        result = await this.generateBatchedQuiz(documentInfos, totalQuestions, onProgressUpdate);
        break;
      case 'hybrid':
        result = await this.generateHybridQuiz(documentInfos, totalQuestions, onProgressUpdate);
        break;
      default: // 'balanced'
        result = await this.generateBalancedQuiz(documentInfos, totalQuestions, onProgressUpdate);
        break;
    }
    return result;
  }

  determineOptimalStrategy(documentCount, totalQuestions) {
    if (this.options.enableLogging) {
        console.info(`${this.logTag} [Strategy] Determining for ${documentCount} docs, ${totalQuestions} Qs. Config: QsPerDoc=${this.questionsPerDocument}, MaxDocsPerBatch=${this.maxDocumentsPerBatch}`);
    }
    if (documentCount === 0) return 'balanced'; // Or handle error, though generateScaledQuiz checks this
    if (documentCount === 1) return 'perDocument'; // Handled by generateScaledQuiz, but good for clarity

    const avgQuestionsPerDocTarget = totalQuestions / documentCount;

    if (avgQuestionsPerDocTarget < 1 && totalQuestions < documentCount) { // Fewer questions than docs
        if (this.options.enableLogging) console.info(`${this.logTag} [Strategy] Decision: Fewer Qs than docs. Using 'balanced' to pick best docs.`);
        return 'balanced'; // Let balanced mode pick best docs for few questions
    }
    if (documentCount <= this.maxDocumentsPerBatch) {
        if (this.options.enableLogging) console.info(`${this.logTag} [Strategy] Decision: Docs fit in one batch. Using 'balanced'.`);
        return 'balanced'; // All docs can be sent in one go
    }
    if (avgQuestionsPerDocTarget >= this.questionsPerDocument && documentCount > this.maxDocumentsPerBatch) {
        if (this.options.enableLogging) console.info(`${this.logTag} [Strategy] Decision: High Qs/doc, many docs. Using 'batched'.`);
        return 'batched'; // Good candidate for batching
    }
    // If asking for very few questions per document on average, and many documents
    if (avgQuestionsPerDocTarget < (this.questionsPerDocument / 2) && documentCount > this.maxDocumentsPerBatch * 1.5) {
        if (this.options.enableLogging) console.info(`${this.logTag} [Strategy] Decision: Low Qs/doc, many docs. Using 'perDocument'.`);
        return 'perDocument';
    }
    
    if (this.options.enableLogging) console.info(`${this.logTag} [Strategy] Decision: Defaulting to 'hybrid'.`);
    return 'hybrid'; // Default for complex cases
  }

  async generatePerDocumentQuiz(documentInfos, totalQuestions, onProgressUpdate = () => {}) {
    if (this.options.enableLogging) console.info(`${this.logTag} 📄 Using per-document strategy for ${documentInfos.length} documents, aiming for ${totalQuestions} total questions.`);
    onProgressUpdate(`Using per-document strategy for ${documentInfos.length} documents, targeting ${totalQuestions} questions...`);
    
    const questionsPerDoc = Math.max(1, Math.ceil(totalQuestions / documentInfos.length));
    if (this.options.enableLogging) console.info(`${this.logTag} Aiming for ~${questionsPerDoc} questions per document.`);
    let allQuestions = [];
    
    const documentBatches = this.createConcurrentBatches(documentInfos, this.concurrentRequests);
    
    for (const [batchIdx, docBatch] of documentBatches.entries()) {
      onProgressUpdate(`Processing document batch ${batchIdx + 1} of ${documentBatches.length} (per-document strategy)...`);
      const batchPromises = docBatch.map(async (docInfo, indexInBatch) => {
        const overallDocIndex = documentInfos.indexOf(docInfo);
        try {
          return await this.generateFromSingleDocument(docInfo, questionsPerDoc, overallDocIndex, onProgressUpdate);
        } catch (error) {
          console.error(`${this.logTag} Error generating from single document ID ${docInfo.id} (index ${overallDocIndex}):`, error);
          onProgressUpdate(`Error generating questions for document ${docInfo.title || docInfo.id}: ${error.message}`);
          return { questions: [], metadata: { error: true, documentId: docInfo.id, strategy: 'perDocument' } }; // Ensure consistent return
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, i) => {
        const docInfo = docBatch[i]; // Get the corresponding docInfo
        if (result.status === 'fulfilled' && result.value && result.value.questions) {
          if (this.options.enableLogging) console.info(`${this.logTag} Successfully got ${result.value.questions.length} questions for doc ID ${docInfo.id}.`);
          allQuestions.push(...result.value.questions);
          // onProgressUpdate(`Successfully processed document: ${docInfo.title || docInfo.id}`); // Potentially too verbose, covered by generateFromSingleDocument
        } else {
          console.warn(`${this.logTag} ⚠️ Failed to generate from document ID ${docInfo.id}:`, result.reason || 'No questions returned');
          onProgressUpdate(`Failed to generate questions for document ${docInfo.title || docInfo.id}. Reason: ${result.reason || 'Unknown'}`);
        }
      });
      
      if (documentBatches.indexOf(docBatch) < documentBatches.length - 1) {
        await this.sleep(this.rateLimitDelay);
      }
    }
    
    return this.finalizeQuiz(allQuestions, totalQuestions, 'perDocument');
  }

  async generateBatchedQuiz(documentInfos, totalQuestions, onProgressUpdate = () => {}) {
    if (this.options.enableLogging) console.info(`${this.logTag} 📦 Using batched strategy for ${documentInfos.length} documents, ${totalQuestions} total questions.`);
    onProgressUpdate(`Using batched strategy for ${documentInfos.length} documents, targeting ${totalQuestions} questions...`);
    
    const docBatches = this.createDocumentBatches(documentInfos, this.maxDocumentsPerBatch);
    const questionsPerBatchTarget = Math.max(1, Math.ceil(totalQuestions / docBatches.length));
    let allQuestions = [];
    
    for (let i = 0; i < docBatches.length; i++) {
      const batch = docBatches[i];
      if (this.options.enableLogging) console.info(`${this.logTag} 📦 Processing batch ${i + 1}/${docBatches.length} with ${batch.length} documents, aiming for ${questionsPerBatchTarget} questions.`);
      onProgressUpdate(`Processing batch ${i + 1}/${docBatches.length} with ${batch.length} documents (batched strategy), aiming for ${questionsPerBatchTarget} questions.`);
      
      try {
        const batchResult = await this.generateFromDocumentBatch(batch, questionsPerBatchTarget, i, onProgressUpdate);
        if (batchResult && batchResult.questions) {
          if (this.options.enableLogging) console.info(`${this.logTag} Batch ${i+1} yielded ${batchResult.questions.length} questions.`);
          allQuestions.push(...batchResult.questions);
        } else {
          console.warn(`${this.logTag} Batch ${i+1} yielded no questions or invalid result.`);
          onProgressUpdate(`Batch ${i + 1} yielded no questions or an invalid result.`);
        }
      } catch (error) {
        console.error(`${this.logTag} ⚠️ Batch ${i + 1} failed:`, error);
        onProgressUpdate(`Error processing batch ${i + 1}: ${error.message}`);
      }
      
      if (i < docBatches.length - 1) {
        await this.sleep(this.rateLimitDelay);
      }
    }
    
    return this.finalizeQuiz(allQuestions, totalQuestions, 'batched');
  }
  
  async generateHybridQuiz(documentInfos, totalQuestions) {
    if (this.options.enableLogging) console.info(`${this.logTag} 🔄 Using hybrid strategy for ${documentInfos.length} docs, ${totalQuestions} Qs.`);
    
    const splitIndex = Math.ceil(documentInfos.length / 2);
    const firstHalfDocs = documentInfos.slice(0, splitIndex);
    const secondHalfDocs = documentInfos.slice(splitIndex);

    const questionsFromFirstHalf = Math.ceil(totalQuestions * (firstHalfDocs.length / documentInfos.length));
    const questionsFromSecondHalf = totalQuestions - questionsFromFirstHalf;
    
    let allQuestions = [];
    
    if (firstHalfDocs.length > 0 && questionsFromFirstHalf > 0) {
      if (this.options.enableLogging) console.info(`${this.logTag} Hybrid: Part 1 (per-document) for ${firstHalfDocs.length} docs, ${questionsFromFirstHalf} Qs.`);
      const firstHalfResult = await this.generatePerDocumentQuiz(firstHalfDocs, questionsFromFirstHalf);
      if (firstHalfResult && firstHalfResult.questions) allQuestions.push(...firstHalfResult.questions);
    }
    
    if (secondHalfDocs.length > 0 && questionsFromSecondHalf > 0) {
      if (this.options.enableLogging) console.info(`${this.logTag} Hybrid: Part 2 (batched) for ${secondHalfDocs.length} docs, ${questionsFromSecondHalf} Qs.`);
      const secondHalfResult = await this.generateBatchedQuiz(secondHalfDocs, questionsFromSecondHalf);
      if (secondHalfResult && secondHalfResult.questions) allQuestions.push(...secondHalfResult.questions);
    }
    
    return this.finalizeQuiz(allQuestions, totalQuestions, 'hybrid');
  }

  async generateBalancedQuiz(documentInfos, totalQuestions) {
    if (this.options.enableLogging) console.info(`${this.logTag} ⚖️ Using balanced strategy for ${documentInfos.length} docs, ${totalQuestions} Qs.`);
    
    const textualPrompt = this.buildBalancedPromptText(documentInfos, totalQuestions);
    const promptParts = [{ text: textualPrompt }];
    documentInfos.forEach(docInfo => {
      if (docInfo && docInfo.content) {
        promptParts.push(docInfo.content);
      } else if (docInfo) {
        console.warn(`${this.logTag} [Balanced] Document content missing for ID: ${docInfo.id}`);
      }
    });
    
    try {
      const { responseText, metadata: callMeta } = await this.callGemini(promptParts, { type: 'balanced', ids: documentInfos.map(d => d.id) });
      const quiz = this.parser.parseQuizJSON(responseText);
      
      if (quiz && quiz.questions) {
         if (this.options.enableLogging) console.info(`${this.logTag} [Balanced] Successfully parsed ${quiz.questions.length} questions.`);
        return this.finalizeQuiz(quiz.questions, totalQuestions, 'balanced', callMeta?.suggestedTitle || quiz.title);
      } else {
        console.warn(`${this.logTag} [Balanced] Failed to parse quiz from response or no questions found.`);
        return this.finalizeQuiz([], totalQuestions, 'balanced');
      }
    } catch (error) {
      console.error(`${this.logTag} [Balanced] Error in balanced quiz generation:`, error);
      
      // Check if this is a truncation error and retry with fewer questions
      if (this.isTruncationError(error) && totalQuestions > 10) {
        const reducedQuestions = Math.max(10, Math.floor(totalQuestions * 0.6));
        console.warn(`${this.logTag} [Balanced] Detected truncation error. Retrying with ${reducedQuestions} questions instead of ${totalQuestions}`);
        
        try {
          return await this.generateBalancedQuiz(documentInfos, reducedQuestions, onProgressUpdate);
        } catch (retryError) {
          console.error(`${this.logTag} [Balanced] Retry with fewer questions also failed:`, retryError);
        }
      }
      
      return this.finalizeQuiz([], totalQuestions, 'balanced');
    }
  }

  async generateFromSingleDocument(documentInfo, questionCount, documentIndex, onProgressUpdate = () => {}) {
    // Proactive question count adjustment based on document size
    const adjustedQuestionCount = this.adjustQuestionCountForDocument(documentInfo, questionCount);
    if (adjustedQuestionCount !== questionCount) {
      console.log(`${this.logTag} [Single Doc] Proactively reduced questions from ${questionCount} to ${adjustedQuestionCount} based on document size`);
      onProgressUpdate(`📊 Adjusted to ${adjustedQuestionCount} questions for large document "${documentInfo.title || `Document ${documentIndex + 1}`}"...`);
      questionCount = adjustedQuestionCount;
    }
    
    if (this.options.enableLogging) console.info(`${this.logTag} Generating ~${questionCount} Qs from single document ID ${documentInfo.id} (index ${documentIndex}).`);
    onProgressUpdate(`Preparing to generate ${questionCount} questions for document: ${documentInfo.title || `ID ${documentInfo.id}`}...`);
    const textualPrompt = this.buildPromptForSingleDocument(questionCount, documentInfo.title, documentInfo.id, documentIndex);
    
    const promptParts = [{ text: textualPrompt }];
    if (documentInfo && documentInfo.content) {
      promptParts.push(documentInfo.content);
    } else {
      onProgressUpdate(`Content missing for document: ${documentInfo.title || `ID ${documentInfo.id}`}. Skipping.`);
      console.error(`${this.logTag} Content missing for single document ID ${documentInfo.id}`);
      return { questions: [], metadata: { error: true, message: `Content missing for doc ${documentInfo.id}`, strategy:'single', documentId: documentInfo.id } };
    }

    let quiz = null;
    let callMeta = null;
    
    try {
      const { responseText, metadata } = await this.callGemini(
        promptParts, 
        { type: 'single-doc', index: documentIndex, id: documentInfo.id, title: documentInfo.title }, // Added title for callGemini logging
        1, // attempt number
        onProgressUpdate
      );
      callMeta = metadata;
      onProgressUpdate(`AI response received for "${documentInfo.title || `ID ${documentInfo.id}`}". Parsing questions...`);
      quiz = this.parser.parseQuizJSON(responseText);
      if (quiz.questions && quiz.questions.length > 0) {
        onProgressUpdate(`Successfully parsed ${quiz.questions.length} questions for "${documentInfo.title || `ID ${documentInfo.id}`}".`);
        
        // Return successful result immediately
        return { 
          questions: quiz.questions || [], 
          metadata: { 
            documentId: documentInfo.id, 
            documentTitle: documentInfo.title, 
            strategy: 'single',
            suggestedTitle: callMeta?.suggestedTitle || quiz.title 
          } 
        };
      } else {
        onProgressUpdate(`No questions parsed or error during parsing for "${documentInfo.title || `ID ${documentInfo.id}`}".`);
      }
    } catch (error) {
      console.error(`${this.logTag} [Single Doc] Error generating from document ${documentInfo.id}:`, error);
      
      // Check if this is a truncation error and retry with fewer questions
      if (this.isTruncationError(error) && questionCount > 3) {
        // More aggressive reduction: 70% reduction instead of 40%
        const reducedQuestions = Math.max(3, Math.floor(questionCount * 0.3));
        console.warn(`${this.logTag} [Single Doc] Detected truncation error. Retrying with ${reducedQuestions} questions instead of ${questionCount}`);
        onProgressUpdate(`🔄 Truncation detected. Retrying with ${reducedQuestions} questions for "${documentInfo.title || `ID ${documentInfo.id}`}"...`);
        
        try {
          return await this.generateFromSingleDocument(documentInfo, reducedQuestions, documentIndex, onProgressUpdate);
        } catch (retryError) {
          console.error(`${this.logTag} [Single Doc] Retry with fewer questions also failed:`, retryError);
          
          // If still failing, try ultra-minimal approach (2 questions)
          if (this.isTruncationError(retryError) && reducedQuestions > 2) {
            console.warn(`${this.logTag} [Single Doc] Final attempt with minimal questions (2)`);
            onProgressUpdate(`⚡ Final attempt with 2 questions for "${documentInfo.title || `ID ${documentInfo.id}`}"...`);
            
            try {
              return await this.generateFromSingleDocument(documentInfo, 2, documentIndex, onProgressUpdate);
            } catch (finalError) {
              console.error(`${this.logTag} [Single Doc] All retry attempts failed:`, finalError);
              onProgressUpdate(`❌ Failed to generate questions for "${documentInfo.title || `ID ${documentInfo.id}`}" after all attempts.`);
            }
          } else {
            onProgressUpdate(`❌ Failed to generate questions for "${documentInfo.title || `ID ${documentInfo.id}`}" even with reduced count.`);
          }
        }
      }
      
      return { questions: [], metadata: { error: true, message: error.message, strategy:'single', documentId: documentInfo.id } };
    }
    
    // If we reach here, no questions were generated successfully
    return { questions: [], metadata: { error: true, message: 'No questions generated', strategy:'single', documentId: documentInfo.id } };
  }

  async generateFromDocumentBatch(batchOfDocumentInfos, questionCount, batchIndex, onProgressUpdate = () => {}) {
    if (this.options.enableLogging) console.info(`${this.logTag} Generating ~${questionCount} Qs from batch ${batchIndex} with ${batchOfDocumentInfos.length} documents.`);
    onProgressUpdate(`Preparing to generate ${questionCount} questions for document batch ${batchIndex + 1} (${batchOfDocumentInfos.length} documents)...`);
    const textualPrompt = this.buildBatchPromptText(batchOfDocumentInfos, questionCount, batchIndex);
    
    const promptParts = [{ text: textualPrompt }];
    batchOfDocumentInfos.forEach(docInfo => {
      if (docInfo && docInfo.content) {
        promptParts.push(docInfo.content);
      } else if (docInfo) {
        console.warn(`${this.logTag} [Batch] Document content missing for ID: ${docInfo.id} in batch ${batchIndex}`);
        onProgressUpdate(`[Batch ${batchIndex + 1}] Document content missing for ID: ${docInfo.id}. It will be excluded from this batch prompt.`);
      }
    });

    const { responseText, metadata: callMeta } = await this.callGemini(
      promptParts, 
      { type: 'batch', index: batchIndex, ids: batchOfDocumentInfos.map(d => d.id) },
      1, // attempt number
      onProgressUpdate
    );
    onProgressUpdate(`AI response received for batch ${batchIndex + 1}. Parsing questions...`);
    const quiz = this.parser.parseQuizJSON(responseText);
    if (quiz.questions && quiz.questions.length > 0) {
      onProgressUpdate(`Successfully parsed ${quiz.questions.length} questions for batch ${batchIndex + 1}.`);
    } else {
      onProgressUpdate(`No questions parsed or error during parsing for batch ${batchIndex + 1}.`);
    }
    return { 
      questions: quiz.questions || [], 
      metadata: { 
        batchIndex: batchIndex, 
        documentIds: batchOfDocumentInfos.map(d => d.id), 
        strategy: 'batch',
        suggestedTitle: callMeta?.suggestedTitle || quiz.title 
      } 
    };
  }
  
  // --- Prompt Building Helpers ---
  _getBasePromptRequirements(questionCount) {
    return `
Generate EXACTLY ${questionCount} multiple-choice questions from the document.

RULES:
- 4 options per question (A,B,C,D)
- Include correct_answer_id and brief explanation
- Questions must have "text" field
- Return ONLY JSON, no markdown

JSON FORMAT:
{
  "title": "Exam Title",
  "questions": [
    {
      "text": "Question text here?",
      "options": [
        {"id": "A", "text": "Option A"},
        {"id": "B", "text": "Option B"},
        {"id": "C", "text": "Option C"},
        {"id": "D", "text": "Option D"}
      ],
      "correct_answer_id": "B",
      "explanation": "Brief explanation",
      "difficulty": "medium"
    }
    // ... more questions ...
  ]
}`;
  }

  buildPromptForSingleDocument(questionCount, docTitle, docId, docIndex) {
    return `Generate exam questions based ON THE PROVIDED DOCUMENT FILE (details below).
Document Title: '${docTitle}'
Document ID: '${docId}'
Document Index (for context): ${docIndex}

${this._getBasePromptRequirements(questionCount)}
`;
  }

  buildBalancedPromptText(documentInfos, totalQuestions) {
    const docTitles = documentInfos.map((docInfo, i) => `  - Document ${i + 1} (ID: '${docInfo.id}', Title: '${docInfo.title}')`).join('\n');
    return `Generate a total of ${totalQuestions} multiple-choice questions from the ${documentInfos.length} provided document files. 
Ensure a balanced representation of questions from all documents if possible. Prioritize accuracy and relevance to each document's specific content.

Provided Documents:
${docTitles}

${this._getBasePromptRequirements(totalQuestions)}
`;
  }

  buildBatchPromptText(batchOfDocumentInfos, questionCount, batchIndex) {
    const questionsPerDocApprox = Math.max(1, Math.floor(questionCount / batchOfDocumentInfos.length));
    const docTitles = batchOfDocumentInfos.map((docInfo, i) => `  - Document ${i + 1} in Batch (ID: '${docInfo.id}', Title: '${docInfo.title}')`).join('\n');
    return `You are processing Batch ${batchIndex + 1}.
Generate a total of ${questionCount} multiple-choice questions from the ${batchOfDocumentInfos.length} document files in this batch.
Aim to generate approximately ${questionsPerDocApprox} questions from EACH document in this batch.

Documents in this Batch:
${docTitles}

${this._getBasePromptRequirements(questionCount)}
`;
  }

  // --- Utility Methods ---
  createDocumentBatches(documents, maxPerBatch) {
    const batches = [];
    for (let i = 0; i < documents.length; i += maxPerBatch) {
      batches.push(documents.slice(i, i + maxPerBatch));
    }
    return batches;
  }

  createConcurrentBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  finalizeQuiz(allQuestions, totalQuestions, strategy, suggestedTitle = null) {
    if (this.options.enableLogging) console.info(`${this.logTag} Finalizing quiz. Initially ${allQuestions.length} questions, target ${totalQuestions}. Strategy: ${strategy}`);
    const selectedQuestions = this.selectBestQuestions(allQuestions, totalQuestions);
    if (this.options.enableLogging) console.info(`${this.logTag} Selected ${selectedQuestions.length} best questions.`);
    return { 
      questions: selectedQuestions, 
      metadata: { 
        strategy: strategy, 
        requestedQuestions: totalQuestions, 
        generatedQuestions: allQuestions.length,
        selectedQuestions: selectedQuestions.length,
        suggestedTitle: suggestedTitle 
      } 
    };
  }

  selectBestQuestions(questions, targetCount) {
    // Simple selection for now, can be expanded (e.g., ensure variety, difficulty spread)
    if (!Array.isArray(questions)) return [];
    return questions.slice(0, targetCount);
  }

  async callGemini(promptParts, batchInfo = null, attempt = 1, onProgressUpdate = () => {}) {
    if (this.options.enableLogging) {
      const partsSummary = promptParts.map(p => {
        if (p.text) return { type: 'text', length: p.text.length, preview: p.text.substring(0, 70) + (p.text.length > 70 ? '...' : '') };
        if (p.inlineData) return { type: 'inlineData', mimeType: p.inlineData.mimeType, dataLength: p.inlineData.data?.length };
        return { type: 'unknown' };
      });
      console.info(`${this.logTag} [callGemini] Attempt ${attempt}/${this.maxRetries + 1}. Sending ${promptParts.length} parts to API. Batch: ${JSON.stringify(batchInfo)}. Structure:`, JSON.stringify(partsSummary, null, 2));
    }
    if (batchInfo) {
      if (batchInfo.type === 'single-doc') {
        onProgressUpdate(`Calling AI for document: ${batchInfo.title || `ID ${batchInfo.id}`} (Attempt ${attempt})...`);
      } else if (batchInfo.type === 'batch') {
        onProgressUpdate(`Calling AI for document batch ${batchInfo.index + 1} (Attempt ${attempt})...`);
      } else {
        onProgressUpdate(`Calling AI for ${batchInfo.type || 'item'} (Attempt ${attempt})...`);
      }
    } else {
      onProgressUpdate(`Calling AI (Attempt ${attempt})...`);
    }

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        safetySettings: this.options.safetySettings || defaultSafetySettings,
        generationConfig: this.options.generationConfig || defaultGenerationConfig
      });
      
      onProgressUpdate(`Sending ${promptParts.length} parts to AI model '${this.modelName}'...`);
      const result = await model.generateContentStream({ contents: [{ role: 'user', parts: promptParts }] });
      
      let responseText = '';
      for await (const chunk of result.stream) {
        responseText += chunk.text();
      }

      if (!responseText.trim()) {
        console.warn(`${this.logTag} [callGemini] Empty response text from API. Batch: ${JSON.stringify(batchInfo)} Attempt: ${attempt}`);
        throw new Error('Empty response text from Gemini API.'); 
      }

      if (this.options.enableLogging) {
        console.info(`${this.logTag} [callGemini] Received response (first 100 chars): "${responseText.substring(0,100)}..." Batch: ${JSON.stringify(batchInfo)}`);
      }
      
      let suggestedTitle = null;
      try {
        const parsedJson = JSON.parse(responseText);
        if (parsedJson && parsedJson.title) {
          suggestedTitle = parsedJson.title;
        }
      } catch (e) { /* ignore parsing error for title extraction */ }

      let successTargetName = 'request';
      if (batchInfo) {
        if (batchInfo.type === 'single-doc') successTargetName = `document ${batchInfo.title || `ID ${batchInfo.id}`}`;
        else if (batchInfo.type === 'batch') successTargetName = `batch ${batchInfo.index + 1}`;
        else successTargetName = batchInfo.type || 'item';
      }
      onProgressUpdate(`AI call successful for ${successTargetName}. Processing response...`);
      return { responseText, metadata: { suggestedTitle } };

    } catch (error) {
      let targetName = 'request';
      if (batchInfo) {
        if (batchInfo.type === 'single-doc') targetName = `document ${batchInfo.title || `ID ${batchInfo.id}`}`;
        else if (batchInfo.type === 'batch') targetName = `batch ${batchInfo.index + 1}`;
        else targetName = batchInfo.type || 'item';
      }

      if (attempt <= this.maxRetries) {
        if (this.options.enableLogging) {
            console.warn(`${this.logTag} [callGemini] Attempt ${attempt}/${this.maxRetries} failed for ${targetName}. Error: ${error.message}. Retrying... Batch: ${JSON.stringify(batchInfo)}`);
        }
        onProgressUpdate(`AI call failed for ${targetName} (Attempt ${attempt}): ${error.message}. Retrying (${attempt}/${this.maxRetries})...`);
        await this.sleep(this.rateLimitDelay * attempt); // Exponential backoff
        return this.callGemini(promptParts, batchInfo, attempt + 1, onProgressUpdate);
      } else {
        if (this.options.enableLogging) {
            console.error(`${this.logTag} [callGemini] Failed after ${attempt -1} attempts for ${targetName}. Error: ${error.message}. Batch: ${JSON.stringify(batchInfo)}`);
        }
        onProgressUpdate(`AI call failed definitively for ${targetName} after ${attempt -1} attempts: ${error.message}`);
        throw error; // Re-throw after max retries
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Proactively adjust question count based on document characteristics
   */
  adjustQuestionCountForDocument(documentInfo, requestedCount) {
    // If no document info available, return original count
    if (!documentInfo) return requestedCount;
    
    // Check document size indicators
    const title = documentInfo.title || '';
    const hasContent = documentInfo.content && documentInfo.content.data;
    
    // Large document indicators
    const isLargeDocument = 
      title.toLowerCase().includes('implementation guide') ||
      title.toLowerCase().includes('manual') ||
      title.toLowerCase().includes('documentation') ||
      (hasContent && documentInfo.content.data.length > 1000000); // >1MB base64
    
    if (isLargeDocument && requestedCount > 5) {
      // For large documents, cap at 5 questions initially
      return Math.min(5, requestedCount);
    }
    
    // Very large document - cap at 3
    if (hasContent && documentInfo.content.data.length > 2000000 && requestedCount > 3) {
      return 3;
    }
    
    return requestedCount;
  }

  /**
   * Check if an error is likely due to JSON truncation
   */
  isTruncationError(error) {
    if (!error) return false;
    
    // Check error message for truncation indicators
    const errorMessage = error.message?.toLowerCase() || '';
    const truncationIndicators = [
      'json appears to be truncated',
      'incomplete response from ai',
      'unexpected end of json',
      'unterminated string',
      'unexpected token',
      'malformed json',
      'parsing error'
    ];
    
    const hasIndicator = truncationIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
    
    // Check if error has analysis details indicating truncation
    if (error.analysisDetails?.details?.appearsTruncated) {
      return true;
    }
    
    // Check if error analysis summary mentions truncation
    if (error.analysisDetails?.summary?.toLowerCase().includes('truncated')) {
      return true;
    }
    
    return hasIndicator;
  }
}


// --- Demo and Testing Class ---
class ScalingDemo {
  static mockCallCount = 0;
  static lastPromptPartsReceived = null;

  static getMockGenAI() {
    ScalingDemo.mockCallCount = 0; // Reset for each test run potentially
    ScalingDemo.lastPromptPartsReceived = null;
    return {
      getGenerativeModel: ({ model }) => ({ // Added model destructuring
        generateContentStream: async ({ contents }) => { // Expecting { contents: [{role:'user', parts: promptPartsArray}] }
          ScalingDemo.mockCallCount++;
          const promptPartsArray = contents[0].parts;
          ScalingDemo.lastPromptPartsReceived = promptPartsArray;

          let textualPrompt = "";
          const textPartObject = promptPartsArray.find(part => part && typeof part.text === 'string');
          if (textPartObject && textPartObject.text) {
            textualPrompt = textPartObject.text;
          }

          const filePartsCount = promptPartsArray.filter(p => p.inlineData).length;
          console.info(`[Mock Gemini Call #${ScalingDemo.mockCallCount}] Model: ${model}. Received ${promptPartsArray.length} parts (${filePartsCount} file parts). Textual prompt (start): "${textualPrompt.substring(0, 150)}..."`);

          let numQuestionsToGenerate = 1;
          const match = textualPrompt.match(/Generate EXACTLY (\d+)|Generate a total of (\d+)|You MUST generate (\d+)/);
          if (match) {
            numQuestionsToGenerate = parseInt(match[1] || match[2] || match[3] || '1', 10);
          }
          
          const questions = [];
          for (let i = 0; i < numQuestionsToGenerate; i++) {
            questions.push({
              question_text: `Mock Question ${i + 1}/${numQuestionsToGenerate} for call ${ScalingDemo.mockCallCount}`,
              options: [
                { id: 'A', text: `Option A (Call ${ScalingDemo.mockCallCount})` },
                { id: 'B', text: `Option B (Call ${ScalingDemo.mockCallCount})` },
                { id: 'C', text: `Option C (Call ${ScalingDemo.mockCallCount})` },
                { id: 'D', text: `Option D (Call ${ScalingDemo.mockCallCount})` }
              ],
              correct_answer_id: 'A',
              explanation: `Mock explanation for Q${i+1}. File parts received: ${filePartsCount}.`,
              difficulty: "medium",
              source_document_reference: `Mock Source (Call ${ScalingDemo.mockCallCount})`
            });
          }
          const mockResponseJson = JSON.stringify({ title: `Mock Quiz (Call ${ScalingDemo.mockCallCount})`, questions });
          
          // Simulate streaming
          const stream = (async function* () {
            yield { text: () => mockResponseJson };
          })();

          await new Promise(r => setTimeout(r, 50)); // Simulate network delay
          return { stream }; // Return the async generator
        }
      })
    };
  }

  static _createMockDoc(id, titleSuffix, charCount = 100) {
    const contentData = Buffer.from("M".repeat(charCount)).toString('base64'); // Simple mock base64
    return {
      id: `doc_${id}`,
      title: `Document ${titleSuffix}`,
      content: { inlineData: { data: contentData, mimeType: 'application/pdf' } } // Gemini Part structure
    };
  }

  static async demonstrateScaling() {
    const mockGenAI = ScalingDemo.getMockGenAI();
    const generator = new ScalableQuizGenerator(mockGenAI, { 
        enableLogging: true, 
        strategy: 'auto', // Let it choose
        questionsPerDocument: 2, // For strategy calculation
        maxDocumentsPerBatch: 3   // For strategy calculation
    });

    const scenarios = [
      { docs: 1, questions: 3, name: "1 Doc, 3 Qs" },
      { docs: 3, questions: 6, name: "3 Docs, 6 Qs (Balanced)" },
      { docs: 5, questions: 5, name: "5 Docs, 5 Qs (Likely Batched/Hybrid)" },
      { docs: 7, questions: 7, name: "7 Docs, 7 Qs (Likely Hybrid/PerDoc)" },
      { docs: 10, questions: 5, name: "10 Docs, 5 Qs (Balanced for selection)" },
    ];

    for (const scenario of scenarios) {
      console.info(`\n--- DEMO: ${scenario.name} ---`);
      const mockDocs = Array.from({ length: scenario.docs }, (_, i) => ScalingDemo._createMockDoc(i + 1, String.fromCharCode(65 + i)));
      const result = await generator.generateScaledQuiz(mockDocs, scenario.questions);
      console.info(`[DEMO RESULT for ${scenario.name}] Strategy: ${result.metadata?.strategy}. Requested: ${scenario.questions}, Selected: ${result.questions?.length}`);
      if (result.questions?.length > 0) {
        console.info("  First question text:", result.questions[0].question_text);
      }
      console.info("  Last prompt parts received by mock:", ScalingDemo.lastPromptPartsReceived?.map(p => p.text ? {text: p.text.substring(0,50)+'...'} : {inlineData: p.inlineData.mimeType}));
    }
  }
  
  static async testGenerateFromSingleDocument() {
    console.info("\n--- Test: generateFromSingleDocument ---");
    const mockGenAI = ScalingDemo.getMockGenAI();
    const generator = new ScalableQuizGenerator(mockGenAI, { enableLogging: true });
    const doc = ScalingDemo._createMockDoc(1, "Single Test");
    const result = await generator.generateFromSingleDocument(doc, 2, 0);
    console.info("[Test Result Single Doc] Questions:", result.questions?.length);
    // console.log("Last prompt parts:", ScalingDemo.lastPromptPartsReceived);
  }

  static async testGenerateFromDocumentBatch() {
    console.info("\n--- Test: generateFromDocumentBatch ---");
    const mockGenAI = ScalingDemo.getMockGenAI();
    const generator = new ScalableQuizGenerator(mockGenAI, { enableLogging: true });
    const batchDocs = [ScalingDemo._createMockDoc(1, "Batch A"), ScalingDemo._createMockDoc(2, "Batch B")];
    const result = await generator.generateFromDocumentBatch(batchDocs, 4, 0);
    console.info("[Test Result Batch Doc] Questions:", result.questions?.length);
    // console.log("Last prompt parts:", ScalingDemo.lastPromptPartsReceived);
  }
  
  static showPromptComparison() {
    console.info("\n--- Prompt Comparison ---");
    const generator = new ScalableQuizGenerator(null, { enableLogging: false }); // No AI needed for prompt building
    const docs = [
        ScalingDemo._createMockDoc(1, "Alpha"),
        ScalingDemo._createMockDoc(2, "Beta"),
        ScalingDemo._createMockDoc(3, "Gamma")
    ];

    console.info("\n[Single Document Prompt (for Doc Alpha, 2 Qs)]");
    console.log(generator.buildPromptForSingleDocument(2, docs[0].title, docs[0].id, 0));

    console.info("\n[Balanced Prompt (for 3 Docs, 5 Qs)]");
    console.log(generator.buildBalancedPromptText(docs, 5));
    
    console.info("\n[Batch Prompt (for 3 Docs, 6 Qs, Batch 0)]");
    console.log(generator.buildBatchPromptText(docs, 6, 0));
  }
}

// Export for use
export { ScalableQuizGenerator, ScalingDemo };

// --- Conditional Demo Execution (Node.js environment) ---
/*
// This IIFE and its content will only run if not in a browser-like environment
// (where 'window' is typically defined). Useful for direct Node.js testing.
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
  (async () => {
    try {
      // Check if running as the main module
      const isMainModule = import.meta.url === \`file://\${process.argv[1]}\`;
      // A more robust check might be needed depending on how you run/import
      // For simple `node scalableQuizUtils.js`, process.argv[1] should be the file path.
      
      // Simple heuristic: if 'node' is in argv[0] and script path in argv[1]
      const scriptPath = process.argv[1];
      const runningAsScript = process.argv[0].includes('node') && scriptPath && (scriptPath.endsWith('scalableQuizUtils.js') || scriptPath.endsWith('scalableQuizUtils.mjs'));

      if (runningAsScript) { // Only run demo if executed directly
        console.info("ScalableQuizUtils: Running in Node.js environment, executing demo...");
        
        await ScalingDemo.testGenerateFromSingleDocument();
        await ScalingDemo.testGenerateFromDocumentBatch();
        
        console.info("\n--- Running Full Scaling Demonstration (demonstrateScaling) ---");
        await ScalingDemo.demonstrateScaling();
        
        console.info("\n--- Running Prompt Comparison (showPromptComparison) ---");
        ScalingDemo.showPromptComparison();
      }
    } catch (e) {
      console.warn('ScalableQuizUtils: Failed to execute Node.js specific demo block:', e.message, e.stack);
    }
  })();
}
*/