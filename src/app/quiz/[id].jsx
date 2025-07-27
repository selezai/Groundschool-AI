import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getQuizWithQuestions, submitQuizAttempt } from '../../services/quizService';
import offlineService from '../../services/offlineService';
import logger from '../../services/loggerService';
import { Platform } from 'react-native';
import CustomWebAlert from '../../components/CustomWebAlert';
// These imports are used by createThemedStyles internally
// eslint-disable-next-line no-unused-vars
import { darkColors, spacing, typography, createThemedStyles, useTheme } from '../../theme/theme';

const QuizScreen = () => {
  // Initialize styles at the component level
  // useTheme() is now called inside the getStyles() function returned by createThemedStyles
  const styles = getStyles();
  
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [isWebAlertVisible, setIsWebAlertVisible] = useState(false);
  const [webAlertConfig, setWebAlertConfig] = useState({});


  const handleReturnToQuizzes = useCallback(() => {
    logger.debug('QuizScreen: handleReturnToQuizzes called.');
    try {
      logger.info('QuizScreen: Navigating to /home using router.replace.');
      router.replace('/home');
      logger.info('QuizScreen: router.replace("/home") initiated.');
    } catch (e) {
      logger.error('QuizScreen: Error during router.replace("/home"). Attempting fallback.', e);
      // Fallback if replace fails for some reason, though unlikely.
      router.navigate('/home');
    }
  }, [router]);

  const showExitConfirmation = useCallback(() => {
    if (quizCompleted || !questions || questions.length === 0) {
      handleReturnToQuizzes();
      return;
    }

    if (Platform.OS === 'web') {
      setWebAlertConfig({
        title: 'Exit Exam?',
        message: 'Are you sure you want to exit? Your progress may be lost.',
        buttons: [
          { text: 'Cancel', onPress: () => setIsWebAlertVisible(false) }, // Simpler button config for now
          { text: 'Exit', style: 'destructive', onPress: () => { setIsWebAlertVisible(false); handleReturnToQuizzes(); } }
        ]
      });
      setIsWebAlertVisible(true);
    } else {
      Alert.alert(
        'Exit Exam?',
        'Are you sure you want to exit? Your progress may be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: handleReturnToQuizzes }
        ],
        { cancelable: false }
      );
    }
  }, [quizCompleted, questions, handleReturnToQuizzes, setWebAlertConfig, setIsWebAlertVisible]);

  const checkNetworkStatus = async () => {
    const connected = await offlineService.getNetworkStatus();
    setIsOffline(!connected);
  };

  const handleNetworkChange = useCallback((connected) => {
    setIsOffline(!connected);
    logger.info('QuizScreen', `Network status changed: ${connected ? 'online' : 'offline'}`);
    if (connected && quizCompleted) {
      syncQuizData();
    }
  }, [quizCompleted]);

  useEffect(() => {
    if (id) {
      fetchQuiz(id);
    }
    setStartTime(Date.now());
    checkNetworkStatus();
    const removeListener = offlineService.addNetworkListener(handleNetworkChange);
    return () => {
      removeListener();
    };
  }, [id, handleNetworkChange]);

  const syncQuizData = async () => {
    try {
      await offlineService.syncOfflineData();
      logger.info('QuizScreen: Synced offline quiz data');
    } catch (error) {
      logger.error('QuizScreen: Failed to sync offline quiz data', error);
    }
  };

  const fetchQuiz = async (quizId) => {
    setIsLoading(true);
    setError(null);
    try {
      const quizData = await getQuizWithQuestions(quizId);
      if (quizData && quizData.questions && Array.isArray(quizData.questions)) {
        quizData.questions.forEach(question => {
          if (question.options && Array.isArray(question.options) && question.options.length > 0) {
            const firstOption = question.options[0];
            if (typeof firstOption === 'string') {
              question.options = question.options.map((optText, index) => ({
                id: String.fromCharCode(65 + index),
                text: optText
              }));
            } else if (typeof firstOption === 'object' && firstOption !== null) {
              question.options = question.options.map((optObj, index) => {
                let textValue = optObj.text;
                if (optObj.text && typeof optObj.text === 'object' && Object.prototype.hasOwnProperty.call(optObj.text, 'text')) {
                  textValue = optObj.text.text;
                }
                return {
                  ...optObj,
                  id: optObj.id || String.fromCharCode(65 + index),
                  text: textValue
                };
              });
            }
          }
        });
      }
      setQuiz(quizData);
      setQuestions(quizData.questions || []);
      logger.info('QuizScreen: Quiz loaded successfully', { quizId, questionCount: quizData.questions?.length || 0 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('QuizScreen: Error loading quiz', err);
      setError('Failed to load exam. Please try again.');
      Alert.alert('Error', 'Could not load exam: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAnswer = (index) => {
    if (quizCompleted) return;
    setSelectedAnswerIndex(index);
  };

  const handleNextQuestion = () => {
    if (selectedAnswerIndex === null) {
      Alert.alert('Select an Answer', 'Please select an answer before proceeding.');
      return;
    }
    const responseTime = Math.round((Date.now() - (answers[questions[currentQuestionIndex - 1]?.id]?.timestamp || startTime)) / 1000);
    const currentQuestion = questions[currentQuestionIndex];
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        questionIndex: currentQuestionIndex,
        selectedAnswerIndex,
        isCorrect: selectedAnswerIndex === currentQuestion.correct_answer_index,
        responseTime,
        timestamp: Date.now()
      }
    };
    setAnswers(newAnswers);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswerIndex(null);
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers) => {
    const answersArray = Object.values(finalAnswers);
    const correctAnswers = answersArray.filter(answer => answer.isCorrect).length;
    const finalScore = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0;
    setScore(finalScore);
    setQuizCompleted(true);
    setIsSubmitting(true);
    const completionTime = Math.round((Date.now() - startTime) / 1000);
    const formattedAnswers = answersArray.map(answer => ({
      questionId: answer.questionId,
      selectedAnswer: questions[answer.questionIndex]?.options[answer.selectedAnswerIndex]?.id || 'A',
      selectedAnswerIndex: answer.selectedAnswerIndex,
      isCorrect: answer.isCorrect,
      responseTime: answer.responseTime || 0
    }));
    try {
      await submitQuizAttempt(id, formattedAnswers, finalScore, completionTime);
      logger.info('QuizScreen: Quiz completed and submitted', { quizId: id, score: finalScore, correctAnswers, totalQuestions: questions.length, completionTime, isOffline });
      if (!isOffline) {
        syncQuizData();
      }
    } catch (error) {
      logger.error('QuizScreen: Error submitting quiz attempt', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setAnswers({});
    setQuizCompleted(false);
    setScore(0);
    setStartTime(Date.now());
  };

  const renderQuestion = () => {
    if (questions.length === 0 || !questions[currentQuestionIndex]) return null;
    const currentQuestion = questions[currentQuestionIndex];
    const options = currentQuestion.options || [];
    return (
      <View style={styles.questionContainer}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }]} /></View>
          <Text style={styles.progressText}>Question {currentQuestionIndex + 1} of {questions.length}</Text>
        </View>
        <Text style={styles.questionText}>{typeof currentQuestion.text === 'object' && currentQuestion.text.text ? currentQuestion.text.text : currentQuestion.text}</Text>
        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity key={option.id || index} style={[styles.optionButton, selectedAnswerIndex === index && styles.selectedOption]} onPress={() => handleSelectAnswer(index)} disabled={quizCompleted}>
              <Text style={[styles.optionPrefix, selectedAnswerIndex === index && styles.selectedOptionPrefix]}>{option.id}</Text>
              <Text style={[styles.optionText, selectedAnswerIndex === index && styles.selectedOptionText]}>{option.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.nextButton, (selectedAnswerIndex === null && !quizCompleted) && styles.disabledButton]} onPress={handleNextQuestion} disabled={selectedAnswerIndex === null && !quizCompleted}>
          <Text style={styles.nextButtonText}>{currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResults = () => {
    const answersArray = Object.values(answers);
    const correctAnswers = answersArray.filter(answer => answer.isCorrect).length;
    return (
      <View style={styles.resultsContainer}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Your Score</Text>
          <Text style={styles.scoreValue}>{score}%</Text>
          <Text style={styles.scoreDetails}>{correctAnswers} correct out of {questions.length} questions</Text>
        </View>
        <View style={styles.resultsSummary}>
          <Text style={styles.examTitleText}>Exam Title: {quiz?.title || 'N/A'}</Text>
          {questions.map((question, index) => {
            const answer = answers[question.id];
            const isCorrect = answer?.isCorrect;
            const questionText = typeof question.text === 'object' && question.text.text ? question.text.text : question.text;
            const correctAnswerText = question.options && question.options[question.correct_answer_index] ? question.options[question.correct_answer_index].text : 'N/A';
            const userAnswerText = answer && question.options && question.options[answer.selectedAnswerIndex] ? question.options[answer.selectedAnswerIndex].text : 'N/A';
            return (
              <View key={question.id || index} style={[styles.summaryItem, { borderLeftColor: isCorrect ? '#10b981' : '#ef4444' }, index === questions.length - 1 && styles.summaryItemLast]}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryQuestionNumber}>Question {index + 1}</Text>
                  {isCorrect ? (
                    <View style={styles.correctBadge}>
                      <Ionicons name="checkmark" size={16} color={darkColors.text} />
                      <Text style={styles.badgeText}>Correct</Text>
                    </View>
                  ) : (
                    <View style={styles.incorrectBadge}>
                      <Ionicons name="close" size={16} color={darkColors.text} />
                      <Text style={styles.badgeText}>Incorrect</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.summaryQuestionText}>{`${index + 1}. ${questionText}`}</Text>
                <Text>
                  <Text style={styles.summaryAnswerText}>Correct answer: </Text>
                  <Text style={styles.summaryCorrectAnswer}>{correctAnswerText}</Text>
                </Text>
                {!isCorrect && (
                  <Text>
                    <Text style={styles.summaryAnswerText}>Your answer: </Text>
                    <Text style={styles.summaryIncorrectAnswerText}>{userAnswerText}</Text>
                  </Text>
                )}
                {question.explanation && <Text style={styles.summaryExplanation}>{question.explanation}</Text>}
              </View>
            );
          })}
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.restartButton} onPress={handleRestartQuiz}><Text style={styles.restartButtonText}>Restart Exam</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.returnButton, styles.resultsReturnButton]} onPress={handleReturnToQuizzes}><Text style={styles.returnButtonText}>Return to Home</Text></TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: quiz?.title || 'Loading Exam...', headerTintColor: darkColors.text, headerStyle: { backgroundColor: darkColors.background } }} />
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={darkColors.text} /><Text style={styles.loadingText}>Loading exam...</Text></View>
      </SafeAreaView>
    );
  }

  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Saving Results...', headerTintColor: darkColors.text, headerStyle: { backgroundColor: darkColors.background } }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={darkColors.text} />
          <Text style={styles.loadingText}>Saving your exam results...</Text>
          {isOffline && (<Text style={styles.offlineText}>You're currently offline. Your results will be saved locally and synced when you're back online.</Text>)}
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Error', headerTintColor: darkColors.text, headerStyle: { backgroundColor: darkColors.background } }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchQuiz(id)}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>
          <TouchableOpacity style={styles.returnButton} onPress={handleReturnToQuizzes}><Text style={styles.returnButtonText}>Return to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: quizCompleted ? 'Exam Results' : (quiz?.title || quiz?.name || 'Exam'),
          headerTintColor: darkColors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={showExitConfirmation} style={styles.backButtonContainer}>
              <Ionicons name="arrow-back" size={28} color={darkColors.text} />
            </TouchableOpacity>
          ),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: darkColors.background },
        }}
      />
      {isOffline && (<View style={styles.offlineBanner}><Ionicons name="cloud-offline" size={16} color={darkColors.text} /><Text style={styles.offlineBannerText}>You're offline. Your progress will be saved locally.</Text></View>)}
      <ScrollView contentContainerStyle={quizCompleted ? styles.resultsScrollContent : styles.scrollContent}>
        {quizCompleted ? renderResults() : renderQuestion()}
      </ScrollView>
      <CustomWebAlert
        visible={isWebAlertVisible}
        title={webAlertConfig.title}
        message={webAlertConfig.message}
        buttons={webAlertConfig.buttons}
        onClose={() => setIsWebAlertVisible(false)}
      />
    </SafeAreaView>
  );
};

// Create themed styles using the centralized theme system
const getStyles = createThemedStyles((theme) => ({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: theme.spacing.xs, 
    fontSize: theme.typography.body.fontSize, 
    color: theme.colors.text 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: theme.spacing.md 
  },
  errorText: { 
    fontSize: theme.typography.h4.fontSize, 
    color: theme.colors.error, 
    textAlign: 'center', 
    marginBottom: theme.spacing.md 
  },
  retryButton: { 
    backgroundColor: theme.colors.accent, 
    paddingVertical: theme.spacing.sm, 
    paddingHorizontal: theme.spacing.lg, 
    borderRadius: theme.spacing.xs, 
    marginBottom: theme.spacing.xs 
  },
  retryButtonText: { 
    color: theme.colors.background, 
    fontSize: theme.typography.body.fontSize, 
    fontWeight: 'bold' 
  },
  returnButton: {
    backgroundColor: '#6b7280',
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.l,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.spacing.xs,
  },
  returnButtonText: { 
    color: '#FFFFFF',
    fontSize: theme.typography.body.fontSize, 
    fontWeight: '600' 
  },
  resultsReturnButton: {
    // This style is applied alongside returnButton.
    // It can be empty if returnButton handles all necessary styling,
    // or contain specific overrides for the results screen if needed.
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  restartButton: {
    backgroundColor: '#6b7280',
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.l,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartButtonText: { 
    color: '#FFFFFF',
    fontSize: theme.typography.body.fontSize, 
    fontWeight: '600' 
  },
  backButtonContainer: { 
    marginLeft: theme.spacing.md, 
    paddingVertical: theme.spacing.xs / 2, 
    paddingHorizontal: theme.spacing.xs 
  },
  offlineBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.cardBorder, 
    paddingVertical: theme.spacing.xs, 
    paddingHorizontal: theme.spacing.md, 
    justifyContent: 'center' 
  },
  offlineBannerText: { 
    color: theme.colors.text, 
    marginLeft: theme.spacing.xs, 
    fontSize: theme.typography.caption.fontSize 
  },
  offlineText: { 
    marginTop: theme.spacing.xs, 
    fontSize: theme.typography.caption.fontSize, 
    color: theme.colors.textSecondary, 
    textAlign: 'center', 
    paddingHorizontal: theme.spacing.md 
  },
  scrollContent: { 
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    flexGrow: 1 
  },
  resultsScrollContent: { 
    paddingBottom: theme.spacing.md 
  },
  questionContainer: {
    padding: theme.spacing.s,
    backgroundColor: '#1a1a2e',
    marginTop: theme.spacing.s,
    marginBottom: 0,
    borderRadius: theme.spacing.xs,
  },
  progressContainer: { 
    marginBottom: theme.spacing.md, 
    alignItems: 'center' 
  },
  progressBar: { 
    height: 10, 
    width: '100%', 
    backgroundColor: theme.colors.neutral, 
    borderRadius: 5, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: theme.colors.accent, 
    borderRadius: 5 
  },
  progressText: { 
    marginTop: theme.spacing.xs / 2, 
    fontSize: theme.typography.caption.fontSize, 
    color: theme.colors.textSecondary 
  },
  questionText: { 
    fontSize: theme.typography.h4.fontSize, 
    fontWeight: 'bold', 
    marginBottom: theme.spacing.md, 
    color: theme.colors.text, 
    lineHeight: 24 
  },
  optionsContainer: { 
    marginBottom: theme.spacing.s 
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    paddingVertical: 20,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  selectedOption: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  optionPrefix: { 
    fontSize: theme.typography.body.fontSize, 
    fontWeight: 'bold', 
    color: theme.colors.accent, 
    marginRight: theme.spacing.xs 
  },
  selectedOptionPrefix: { 
    color: theme.colors.background 
  },
  optionText: { 
    fontSize: theme.typography.body.fontSize, 
    color: theme.colors.text, 
    flex: 1 
  },
  selectedOptionText: { 
    color: theme.colors.background 
  },
  nextButton: { 
    backgroundColor: theme.colors.accent, 
    paddingVertical: 20, 
    borderRadius: theme.spacing.xs, 
    alignItems: 'center' 
  },
  disabledButton: { 
    backgroundColor: theme.colors.cardBorder 
  },
  nextButtonText: { 
    color: theme.colors.background, 
    fontSize: theme.typography.body.fontSize, 
    fontWeight: '600' 
  },
  resultsContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: theme.spacing.s,
    padding: theme.spacing.l,
    marginHorizontal: theme.spacing.m,
    alignItems: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: theme.spacing.xs,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.l,
    width: '100%',
  },
  scoreLabel: { 
    fontSize: theme.typography.h2.fontSize, 
    color: theme.colors.textSecondary, 
    marginBottom: theme.spacing.xs / 2 
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.accent, // Changed to accent color
    marginBottom: theme.spacing.xs,
  },
  scoreDetails: {
    fontSize: theme.typography.body.fontSize,
    color: '#9ca3af',
  },
  examTitleText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text, // Changed to default text color (white for dark theme)
    marginBottom: theme.spacing.md,
    textAlign: 'left', // Align with question cards
    paddingHorizontal: theme.spacing.m, // Match resultsContainer horizontal margin for alignment
  },
  resultsSummary: {
    marginTop: theme.spacing.l,
  },
  summaryTitle: { 
    fontSize: theme.typography.h2.fontSize, 
    fontWeight: 'bold', 
    color: theme.colors.text, 
    marginBottom: theme.spacing.md, 
    textAlign: 'center' 
  },
  summaryItem: { 
    backgroundColor: '#16213e',
    borderRadius: theme.spacing.xs,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.s,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent', // Conditional: overridden in JSX
  },
  summaryItemLast: { 
    borderBottomWidth: 0, 
    marginBottom: 0, 
    paddingBottom: 0 
  },
  summaryHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: theme.spacing.xs 
  },
  summaryQuestionNumber: { 
    fontSize: theme.typography.body.fontSize, 
    fontWeight: 'bold', 
    color: theme.colors.text 
  },
  correctBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.success, 
    paddingHorizontal: theme.spacing.xs, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  incorrectBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.error, 
    paddingHorizontal: theme.spacing.xs, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  badgeText: { 
    color: theme.colors.text, 
    fontSize: theme.typography.caption.fontSize, 
    fontWeight: 'bold', 
    marginLeft: 5 
  },
  summaryQuestionText: { 
    fontSize: theme.typography.body.fontSize, 
    color: theme.colors.text, 
    marginBottom: theme.spacing.xs / 2 
  },
  summaryCorrectAnswer: { 
    fontSize: theme.typography.caption.fontSize, 
    color: '#10b981', 
    marginBottom: 3 
  },
  summaryIncorrectAnswerText: {
    fontSize: theme.typography.caption.fontSize,
    color: '#ef4444',
    marginBottom: 3,
  },
  summaryAnswerText: {
    fontSize: theme.typography.caption.fontSize,
    color: '#9ca3af',
    lineHeight: Math.round(theme.typography.caption.fontSize * 1.4),
  },
  summaryYourAnswer: { 
    fontSize: theme.typography.caption.fontSize, 
    color: theme.colors.error, 
    marginBottom: 3 
  },
  summaryExplanation: { 
    fontSize: theme.typography.caption.fontSize, 
    color: theme.colors.textSecondary, 
    fontStyle: 'italic' 
  },
  actionButtons: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: theme.spacing.m,
  },
  restartButton: {
    backgroundColor: '#10b981',
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.l,
    borderRadius: theme.spacing.xs,
    alignItems: 'center',
    marginHorizontal: theme.spacing.xs,
  },
  restartButtonText: { 
    color: '#FFFFFF',
    fontSize: theme.typography.body.fontSize, 
    fontWeight: '600' 
  },
}));

export default QuizScreen;