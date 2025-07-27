import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../services/supabaseClient';
import { generateQuestionsFromDocument } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';

export default function GeminiTestScreen() {
  const { session } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);

  // Add a log entry
  const addLog = (message, type = 'info') => {
    setLog(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  // Fetch documents
  useEffect(() => {
    async function fetchDocuments() {
      if (!session) return;
      
      setIsLoading(true);
      addLog('Fetching documents...');
      
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setDocuments(data || []);
        addLog(`Found ${data.length} documents`);
      } catch (err) {
        setError(err.message);
        addLog(`Error fetching documents: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDocuments();
  }, [session]);

  // Generate questions from the selected document
  const handleGenerateQuestions = async () => {
    if (!selectedDocument) {
      addLog('No document selected', 'error');
      return;
    }
    
    setIsGenerating(true);
    setQuestions([]);
    setError(null);
    addLog(`Generating questions from "${selectedDocument.title}"...`);
    addLog('This may take a minute depending on document size and complexity...');
    
    try {
      const generatedQuestions = await generateQuestionsFromDocument(selectedDocument, 3, 'medium');
      setQuestions(generatedQuestions);
      addLog(`Successfully generated ${generatedQuestions.length} questions!`, 'success');
    } catch (err) {
      setError(err.message);
      addLog(`Error generating questions: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Gemini AI Test' }} />
      
      <ScrollView style={styles.content}>
        {/* Document Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select a Document</Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color="#4F46E5" />
          ) : documents.length === 0 ? (
            <Text style={styles.emptyText}>No documents found. Please upload a document first.</Text>
          ) : (
            <ScrollView horizontal style={styles.documentList}>
              {documents.map(doc => (
                <TouchableOpacity
                  key={doc.id}
                  style={[
                    styles.documentCard,
                    selectedDocument?.id === doc.id && styles.selectedDocument
                  ]}
                  onPress={() => {
                    setSelectedDocument(doc);
                    addLog(`Selected document: "${doc.title}"`);
                  }}
                >
                  <Text style={styles.documentTitle} numberOfLines={2}>{doc.title}</Text>
                  <Text style={styles.documentType}>{doc.document_type || 'Unknown type'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        
        {/* Generate Questions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Generate Questions</Text>
          
          <TouchableOpacity
            style={[
              styles.generateButton,
              (!selectedDocument || isGenerating) && styles.disabledButton
            ]}
            onPress={handleGenerateQuestions}
            disabled={!selectedDocument || isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>
                Generate 3 Questions
              </Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Results */}
        {questions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Generated Questions</Text>
            
            {questions.map((question, index) => (
              <View key={index} style={styles.questionCard}>
                <Text style={styles.questionText}>{question.text}</Text>
                
                <View style={styles.options}>
                  {question.options.map((option, optIndex) => (
                    <View 
                      key={optIndex} 
                      style={[
                        styles.option,
                        question.correct_answer_index === optIndex && styles.correctOption
                      ]}
                    >
                      <Text style={styles.optionText}>{option}</Text>
                    </View>
                  ))}
                </View>
                
                <View style={styles.explanation}>
                  <Text style={styles.explanationTitle}>Explanation:</Text>
                  <Text style={styles.explanationText}>{question.explanation}</Text>
                </View>
                
                <View style={styles.metaInfo}>
                  <Text style={styles.metaText}>Difficulty: {question.difficulty}</Text>
                  <Text style={styles.metaText}>Topic: {question.topic}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* Log Console */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Console</Text>
          
          <View style={styles.logConsole}>
            {log.map((entry, index) => (
              <Text 
                key={index} 
                style={[
                  styles.logEntry,
                  entry.type === 'error' && styles.logError,
                  entry.type === 'success' && styles.logSuccess
                ]}
              >
                [{entry.timestamp.toLocaleTimeString()}] {entry.message}
              </Text>
            ))}
            
            {log.length === 0 && (
              <Text style={styles.emptyText}>No activity yet</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  documentList: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  documentCard: {
    width: 150,
    height: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  selectedDocument: {
    backgroundColor: '#E0E7FF',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  documentType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  generateButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  questionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  options: {
    marginBottom: 16,
  },
  option: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  correctOption: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#059669',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
  },
  explanation: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: '#374151',
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  logConsole: {
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 6,
    maxHeight: 200,
  },
  logEntry: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#D1D5DB',
    marginBottom: 4,
  },
  logError: {
    color: '#EF4444',
  },
  logSuccess: {
    color: '#10B981',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
});
