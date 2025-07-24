// test-gemini-quiz-generation.js (at project root)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProductionQuizGenerator } from './src/utils/quizParserUtils.js'; // Path adjusted for root location

// Main test function
async function runTest() {
  console.log('🚀 Running Isolated End-to-End Quiz Generation Test...');

  const apiKeyForTest = process.env.GOOGLE_API_KEY;

  if (!apiKeyForTest) {
    console.error('❌ ERROR: GOOGLE_API_KEY environment variable is not set. Please set it to run this test.');
    process.exit(1);
  }

  let testGenAI;
  try {
    testGenAI = new GoogleGenerativeAI(apiKeyForTest);
    console.log('✅ GoogleGenerativeAI client initialized for test.');
  } catch (error) {
    console.error('❌ Failed to initialize GoogleGenerativeAI for test:', error);
    process.exit(1);
  }

  const sampleDocumentText = `
    The Water Cycle:
    The water cycle, also known as the hydrological cycle, describes the continuous movement of water on, above, and below the surface of the Earth. 
    Key stages include:
    1. Evaporation: Water turns from liquid to gas (water vapor).
    2. Transpiration: Water vapor is released from plants.
    3. Condensation: Water vapor turns back into liquid, forming clouds.
    4. Precipitation: Water falls back to Earth (rain, snow, sleet, hail).
    5. Collection: Water gathers in rivers, lakes, oceans, or underground.
  `;
  const documentParts = [{ text: sampleDocumentText }];
  const questionCount = 3; // Requesting 3 questions

  console.log(`📝 Preparing to generate ${questionCount} questions from sample text...`);

  const quizGenerator = new ProductionQuizGenerator(apiKeyForTest, testGenAI, {
    enableLogging: true,
    model: 'gemini-1.5-flash-latest'
  });

  try {
    console.log('⏳ Calling ProductionQuizGenerator.generateQuiz...');
    const startTime = Date.now();
    const result = await quizGenerator.generateQuiz(documentParts, questionCount);
    const duration = Date.now() - startTime;
    console.log(`✅ generateQuiz call completed in ${duration}ms.`);

    console.log('\n--- Full Generation Result ---');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.quiz) {
      console.log('\n🎉 Successfully generated quiz:');
    } else {
      console.error('\n❌ Failed to generate quiz:');
    }
    
    console.log('\n--- Parser Stats from ProductionQuizGenerator ---');
    console.log(JSON.stringify(quizGenerator.generator.getParserStats(), null, 2));

    console.log('\n--- Metrics from ProductionQuizGenerator ---');
    console.log(JSON.stringify(quizGenerator.getMetrics(), null, 2));

  } catch (error) {
    console.error('❌ An unexpected error occurred during the test:', error);
  }
  
  console.log('\n🚀 Test execution finished.');
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error in test runner:', error);
  process.exit(1);
});
