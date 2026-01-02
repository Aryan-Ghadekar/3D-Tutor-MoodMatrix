"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Brain, Check, HelpCircle, Timer, ArrowLeft, Home } from 'lucide-react';
import Header from '../../components/Header';

export default function KnowledgeTestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get topic from URL or use default
  const topic = searchParams.get('topic') || "Physics";
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);

  const testQuestions = [
    {
      id: 1,
      question: "How would you rate your understanding of this topic?",
      options: [
        { id: 'beginner', label: 'Beginner', description: 'New to the concept' },
        { id: 'intermediate', label: 'Intermediate', description: 'Some prior knowledge' },
        { id: 'advanced', label: 'Advanced', description: 'Comfortable with concepts' }
      ]
    },
    {
      id: 2,
      question: "How confident are you with mathematical derivations?",
      options: [
        { id: 'low', label: 'Low', description: 'Need step-by-step guidance' },
        { id: 'medium', label: 'Medium', description: 'Can follow derivations' },
        { id: 'high', label: 'High', description: 'Can derive formulas myself' }
      ]
    },
    {
      id: 3,
      question: "What's your main learning objective?",
      options: [
        { id: 'concepts', label: 'Understand Concepts', description: 'Focus on theory' },
        { id: 'problems', label: 'Solve Problems', description: 'Practice applications' },
        { id: 'exam', label: 'Exam Preparation', description: 'Test-oriented study' }
      ]
    }
  ];

  const handleAnswer = (questionId, answerId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
    
    // Auto-advance after answering
    if (currentQuestion < testQuestions.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 500);
    }
  };

  const calculateScore = () => {
    const score = Object.values(answers).length * 10;
    return Math.min(score, 100);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const score = calculateScore();
      const knowledgeLevel = answers[1] || 'intermediate';
      
      // Save results to localStorage
      const testResults = {
        topic,
        score,
        answers,
        knowledgeLevel,
        completedAt: new Date().toISOString()
      };
      
      localStorage.setItem('lastTestResults', JSON.stringify(testResults));
      
      // If we have a user profile API, call it
      try {
        await fetch('/api/user/profile/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testResults)
        });
      } catch (apiError) {
        console.log('API not available, using localStorage only');
      }
      
      // Navigate to STUDY SESSION page
      router.push('/study-session');
      
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Error saving test results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Save empty results to localStorage
    const testResults = {
      topic,
      score: 0,
      answers: {},
      knowledgeLevel: 'beginner',
      completedAt: new Date().toISOString(),
      skipped: true
    };
    
    localStorage.setItem('lastTestResults', JSON.stringify(testResults));
    
    // Navigate to STUDY SESSION page
    router.push('/study-session');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <main className="pt-16 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header with navigation */}
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            
            <button
              onClick={() => router.push('/study-session')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          </div>

          {/* Main test container */}
          <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    Knowledge Assessment
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Topic: <span className="font-medium">{topic}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Timer className="w-4 h-4" />
                <span>2-3 minutes</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Question {currentQuestion + 1} of {testQuestions.length}</span>
                <span>{Math.round((currentQuestion + 1) / testQuestions.length * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${((currentQuestion + 1) / testQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Current Question */}
            <div className="mb-8">
              <div className="flex items-start gap-3 mb-6">
                <HelpCircle className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h2 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white mb-3">
                    {testQuestions[currentQuestion]?.question}
                  </h2>
                  <div className="space-y-3">
                    {testQuestions[currentQuestion]?.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleAnswer(testQuestions[currentQuestion].id, option.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all
                          ${answers[testQuestions[currentQuestion].id] === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white mb-1">
                              {option.label}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {option.description}
                            </div>
                          </div>
                          {answers[testQuestions[currentQuestion].id] === option.id && (
                            <Check className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex gap-3">
                {currentQuestion > 0 && (
                  <button
                    onClick={() => setCurrentQuestion(prev => prev - 1)}
                    className="px-6 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Previous
                  </button>
                )}
                
                {currentQuestion < testQuestions.length - 1 && (
                  <button
                    onClick={() => setCurrentQuestion(prev => prev + 1)}
                    disabled={!answers[testQuestions[currentQuestion].id]}
                    className="px-6 py-2 rounded-lg bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next Question
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="px-6 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Skip assessment
                </button>
                
                {currentQuestion === testQuestions.length - 1 && (
                  <button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length < testQuestions.length || loading}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      'Complete Assessment'
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* Info footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                This assessment helps us personalize your study materials based on your current knowledge level.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}