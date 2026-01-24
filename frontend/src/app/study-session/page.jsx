"use client";

import { useTheme } from "../theme-provider";
import Header from "../../components/Header";
import {
  ChevronLeft, ChevronRight, Play, Pause, Brain, HelpCircle, 
  MessageCircle, FileQuestion, AlertCircle, X as XIcon, User,
  BrainCircuit, Target, Lightbulb, AlertTriangle, ClipboardCheck,
  Trophy, CheckCircle, XCircle, Clock, BarChart, Image as ImageIcon,
  Download as DownloadIcon, AlertOctagon, TrendingUp, Eye, Hand,
  ExternalLink, BookOpen, Zap, PieChart, RefreshCw, Star,
  Users, Shield, Coffee, Wind, EyeOff, TestTube2, Hash,
  RotateCcw, Volume2, Maximize2, Settings, Mic, Sparkles,
  Home, SkipForward, SkipBack, FastForward, Rewind,
  Grid, List, Layers, Compass, Navigation
} from "lucide-react";
import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MisconceptionTracker from "@/lib/misconception-tracker";
import SessionStorage from "@/lib/session-storage";
import IntelligenceEngine from '../../lib/intelligenceEngine'; 
import { QuizStorage } from '../lib/quiz-storage';

// =========================================================
// STUDY SESSION PAGE - MAIN COMPONENT
// =========================================================
function StudySessionContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();

  // =========================================================
  // STATE MANAGEMENT - REORGANIZED FOR CLARITY
  // =========================================================
  
  // Session State
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing intelligent learning...');
  const [error, setError] = useState(null);
  
  // Lecture & Topics State
  const [lecturePlan, setLecturePlan] = useState(null);
  const [intelligenceEngine, setIntelligenceEngine] = useState(null);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [topicsCompleted, setTopicsCompleted] = useState(new Set());
  const [totalTopics, setTotalTopics] = useState(0);
  
  // Student Profile State
  const [studentGoal, setStudentGoal] = useState('gate');
  const [knowledgeLevel, setKnowledgeLevel] = useState('intermediate');
  const [cognitiveLoad, setCognitiveLoad] = useState('medium');
  const [studentProfile, setStudentProfile] = useState(null);
  
  // Slide State
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentSlideData, setCurrentSlideData] = useState(null);
  const [slideHistory, setSlideHistory] = useState([]);
  
  // Interaction State
  const [studentInteractions, setStudentInteractions] = useState([]);
  const [availableActions, setAvailableActions] = useState([
    'take-quiz', 'explain-more', 'ask-questions', 'view-progress'
  ]);
  const [activeView, setActiveView] = useState(null);
  const [userQuestion, setUserQuestion] = useState("");
  
  // Quiz State
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizHistory, setQuizHistory] = useState([]);
  const [quizDifficulty, setQuizDifficulty] = useState('medium'); // Track current quiz difficulty
  const [wrongAnswers, setWrongAnswers] = useState([]); // Track wrong answers for feedback slides
  
  // Learning Services
  const [misconceptionTracker, setMisconceptionTracker] = useState(null);
  const [sessionStorage, setSessionStorage] = useState(null);
  const [misconceptions, setMisconceptions] = useState([]);
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState([]);
  
  // UI State
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHelpOffer, setShowHelpOffer] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  
  // Refs
  const slideTimerRef = useRef(null);
  const interactionCountRef = useRef(0);
  const lastInteractionTimeRef = useRef(Date.now());
  const studyStartTimeRef = useRef(null);
  const currentTopicStartTimeRef = useRef(null);

  // =========================================================
  // INITIALIZATION - COMPLETELY REWRITTEN
  // =========================================================
  
  useEffect(() => {
    const initializeIntelligentSession = async () => {
      console.log('Starting intelligent study session initialization...');
      studyStartTimeRef.current = Date.now();
      
      try {
        // 1. Get or create session ID
        const newSessionId = await getOrCreateSessionId();
        setSessionId(newSessionId);
        console.log('Session ID:', newSessionId);
        
        // 2. Load student goal and preferences
        const { goal, level } = await loadStudentPreferences(searchParams);
        setStudentGoal(goal);
        setKnowledgeLevel(level);
        
        // 3. Initialize learning services
        await initializeLearningServices(newSessionId, goal);
        
        // 4. Initialize Intelligence Engine with REAL data
        const engine = await initializeIntelligenceEngine(newSessionId, goal, level);  
        
        // 5. Load or generate first slide
        await loadOrGenerateFirstSlide(engine); 
        
        // 6. Start tracking
        startProgressTracking();
        
        setLoading(false);
        console.log('Intelligent study session initialized successfully');
        
      } catch (err) {
        console.error('Session initialization failed:', err);
        setError(`Failed to initialize: ${err.message}`);
        createEmergencyLearningSession();
        setLoading(false);
      }
    };
    
    initializeIntelligentSession();
    
    // Cleanup
    return () => {
      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current);
      }
      saveSessionProgress();
    };
  }, []);

  // =========================================================
  // INITIALIZATION HELPER FUNCTIONS
  // =========================================================
  
  const getOrCreateSessionId = async () => {
    if (typeof window !== 'undefined') {
      // Check for existing session
      const existingSession = localStorage.getItem('current_intelligent_session');
      if (existingSession) {
        const sessionData = JSON.parse(existingSession);
        // Check if session is recent (less than 2 hours old)
        const sessionAge = Date.now() - new Date(sessionData.created).getTime();
        if (sessionAge < 2 * 60 * 60 * 1000) {
          return sessionData.sessionId;
        }
      }
      
      // Create new session
      const newSessionId = `intelligent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionData = {
        sessionId: newSessionId,
        created: new Date().toISOString(),
        version: '3.0'
      };
      localStorage.setItem('current_intelligent_session', JSON.stringify(sessionData));
      return newSessionId;
    }
    
    return `server_${Date.now()}`;
  };

  const loadStudentPreferences = async (searchParams) => {
    let goal = 'gate';
    let level = 'intermediate';
    
    // Get from URL params
    const urlGoal = searchParams.get("goal");
    const urlLevel = searchParams.get("level");
    
    // Get from localStorage
    if (typeof window !== 'undefined') {
      const savedGoal = localStorage.getItem('learning_goal');
      const savedLevel = localStorage.getItem('knowledge_level');
      
      goal = urlGoal || savedGoal || 'gate';
      level = urlLevel || savedLevel || 'intermediate';
      
      // Save for future
      localStorage.setItem('learning_goal', goal);
      localStorage.setItem('knowledge_level', level);
    } else {
      goal = urlGoal || 'gate';
      level = urlLevel || 'intermediate';
    }
    
    console.log('Student preferences:', { goal, level });
    return { goal, level };
  };

  const initializeLearningServices = async (sessionId, goal) => {
    console.log('Initializing learning services...');
    
    // Initialize Misconception Tracker
    const tracker = new MisconceptionTracker(sessionId);
    tracker.loadFromLocalStorage();
    setMisconceptionTracker(tracker);
    
    // Initialize Session Storage
    const storage = new SessionStorage();
    setSessionStorage(storage);
    
    // Create or load session
    if (!storage.getSession(sessionId)) {
      storage.createNewSession(goal, 'Intelligent Learning Session');
    }
    
    // Update misconception data
    updateMisconceptionData(tracker);
  };

  const initializeIntelligenceEngine = async (sessionId, goal, level) => {
    console.log('Initializing Intelligence Engine v3...');
    setLoadingMessage('Loading intelligent learning engine...');
    
    try {
      const engine = new IntelligenceEngine(sessionId);
      const analysis = await engine.initialize(goal, { knowledgeLevel: level });
      
      if (!analysis.success) {
        throw new Error('Intelligence Engine initialization failed');
      }
      
      setIntelligenceEngine(engine);
      setLecturePlan(engine.lecturePlan);
      setTotalTopics(engine.lecturePlan?.impTopics?.length || 0);
      
      console.log('Intelligence Engine initialized:', {
        topics: engine.lecturePlan?.impTopics?.length,
        enhancedTopics: engine.enhancedTopics?.length,
        studentGoal: engine.studentGoal
      });
      
      return engine;
      
    } catch (error) {
      console.error('Intelligence Engine failed:', error);
      throw new Error(`Learning system error: ${error.message}`);
    }
  };

  // =========================================================
  // DYNAMIC SLIDE GENERATION WITH THREE INPUT STREAMS
  // =========================================================
  
  const generateDynamicSlide = async (actionType = 'concept_explanation', userQuestion = '', engine = null, context = '') => {
    const activeEngine = engine || intelligenceEngine;
    const activeSessionId = sessionId;
    
    // More lenient validation - only require engine
    if (!activeEngine) {
      console.error('Missing engine:', { 
        engine: !!activeEngine, 
        sessionId: activeSessionId || sessionId || 'none'
      });
      throw new Error('Learning system not initialized - no intelligence engine');
    }
    
    // Ensure we always have a session ID (CREATE THIS EARLY)
    const finalSessionId = activeSessionId || sessionId || `temp_${Date.now()}`;
    
    setLoading(true);
    setLoadingMessage(`AI is generating ${actionType.replace('-', ' ')}...`);
    
    try {
      // Get current topic
      const currentTopic = activeEngine.getCurrentTopic();
      if (!currentTopic) {
        throw new Error('No current topic available');
      }
      
      // Get knowledge state from quiz storage
      const knowledgeState = QuizStorage.getStudentProfile();
      
      console.log('Requesting AI slide generation:', {
        actionType,
        topicIndex: currentTopicIndex,
        topicTitle: currentTopic.title,
        goal: studentGoal,
        knowledgeLevel: knowledgeState.knowledgeLevel,
        hasQuestion: !!userQuestion,
        hasContext: !!context,
        sessionId: finalSessionId // Log the actual session ID being used
      });
      
      const response = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: finalSessionId, 
          lecturePlan: lecturePlan || activeEngine.lecturePlan,
          goal: studentGoal,
          knowledgeState: knowledgeState,
          currentTopicIndex: currentTopicIndex,
          actionType: actionType,
          userQuestion: userQuestion,
          context: context
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('API Error handled gracefully:', {
          status: response.status,
          error: errorData.error || 'Unknown error',
          sessionId: finalSessionId
        });
        
        // Don't throw error, just show warning and continue
        setError(`Using fallback content due to API limitations`);
        return;
      }
      
      const result = await response.json();
      
      if (!result.success && !result.isFallback) {
        throw new Error(result.error || 'AI generation failed');
      }
      
      const newSlide = result.slide;
      
      // Show warning if fallback
      if (result.isFallback) {
        console.warn('Using fallback slide - AI temporarily unavailable');
      } else {
        console.log('AI slide generated:', {
          title: newSlide.title,
          aiModel: newSlide.metadata?.aiModel,
          hasImages: newSlide.images?.length > 0
        });
      }
      
      // Add to slides
      setSlides(prev => [...prev, newSlide]);
      setCurrentSlideIndex(slides.length);
      setCurrentSlideData(newSlide);
      
      // Track interaction
      trackStudentInteraction(actionType, {
        slideId: newSlide.id,
        topicIndex: currentTopicIndex,
        topicTitle: currentTopic.title,
        aiGenerated: !result.isFallback,
        userQuestion: userQuestion,
        sessionId: finalSessionId // Use finalSessionId in tracking
      });
      
      return newSlide;
      
    } catch (error) {
      console.error('AI slide generation failed:', error);
      setError(`Failed to generate content: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // =========================================================
  // SLIDE NAVIGATION AND INTERACTIONS
  // =========================================================
  
  // const handleNextSlide = async () => {
  //   try {
  //     // Mark current topic as completed if appropriate
  //     if (currentSlideData?.type === 'concept_explanation') {
  //       setTopicsCompleted(prev => new Set([...prev, currentTopicIndex]));
        
  //       if (intelligenceEngine) {
  //         intelligenceEngine.markTopicCompleted(currentTopicIndex);
  //       }
  //     }
      
  //     // Move to next topic or generate next slide for current topic
  //     let nextSlide;
      
  //     if (currentSlideData?.type !== 'concept_explanation') {
  //       // Generate next slide for current topic
  //       nextSlide = await generateDynamicSlide('concept_explanation', '');
  //     } else {
  //       // Move to next topic
  //       const nextTopicIndex = currentTopicIndex + 1;
        
  //       if (nextTopicIndex >= (lecturePlan?.impTopics?.length || 0)) {
  //         // Session completed
  //         handleSessionComplete();
  //         return;
  //       }
        
  //       setCurrentTopicIndex(nextTopicIndex);
        
  //       if (intelligenceEngine) {
  //         intelligenceEngine.setCurrentTopic(nextTopicIndex);
  //       }
        
  //       // Generate slide for next topic
  //       nextSlide = await generateDynamicSlide('concept_explanation', '');
  //     }
      
  //     setCurrentSlideIndex(prev => prev + 1);
      
  //   } catch (error) {
  //     console.error('Next slide failed:', error);
  //     setError(`Failed to load next slide: ${error.message}`);
  //   }
  // };
  
  // =========================================================
  // LEARNING ACTIONS - INTELLIGENT VERSION
  // =========================================================

  const handleTakeQuiz = async () => {
    if (!intelligenceEngine) {
      setError('Learning system not ready');
      return;
    }
    
    try {
      setLoading(true);
      setLoadingMessage('Generating quiz based on covered slides...');
      
      // Get content from all covered slides
      const coveredSlidesContent = slides.map(slide => ({
        title: slide.title || slide.content?.title || 'Slide Content',
        content: slide.content?.narrative || slide.content?.title || slide.title || '',
        keyInsights: slide.content?.keyInsights || [],
        topicTitle: slide.metadata?.topicTitle || slide.title || 'Unknown Topic'
      }));
      
      if (coveredSlidesContent.length === 0) {
        throw new Error('No slide content available for quiz generation');
      }
      
      console.log('Generating quiz from covered slides:', {
        slideCount: coveredSlidesContent.length,
        difficulty: quizDifficulty,
        topics: coveredSlidesContent.map(s => s.topicTitle)
      });
      
      // Generate quiz based on covered slides content
      const quizResponse = await fetch('/api/generate-quiz-from-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slidesContent: coveredSlidesContent,
          difficulty: quizDifficulty,
          studentGoal: studentGoal,
          knowledgeLevel: knowledgeLevel,
          questionCount: 5
        })
      });
      
      if (!quizResponse.ok) {
        throw new Error('Failed to generate quiz from slides');
      }
      
      const quizResult = await quizResponse.json();
      
      if (!quizResult.success || !quizResult.questions) {
        throw new Error(quizResult.error || 'Failed to generate quiz questions');
      }
      
      // Set quiz state
      setQuizData({
        questions: quizResult.questions,
        source: 'covered_slides',
        slideCount: coveredSlidesContent.length,
        difficulty: quizDifficulty
      });
      setActiveView('quiz');
      setQuizStarted(true);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setQuizScore(null);
      setQuizCompleted(false);
      setWrongAnswers([]); // Reset wrong answers for new quiz
      
      console.log('Quiz generated from slides:', {
        questionCount: quizResult.questions.length,
        difficulty: quizDifficulty,
        source: 'covered_slides'
      });
      
    } catch (err) {
      console.error('Quiz generation error:', err);
      setError(`Failed to load quiz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleQuizAnswer = async (answerIndex) => {
    if (!quizData || currentQuestionIndex >= quizData.questions.length) {
      return;
    }
    
    setSelectedAnswer(answerIndex);
    
    const currentQuestion = quizData.questions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    
    // Track answer
    const answerData = {
      questionIndex: currentQuestionIndex,
      selectedAnswer: answerIndex,
      isCorrect: isCorrect,
      question: currentQuestion.question,
      correctAnswer: currentQuestion.correctAnswer,
      questionText: currentQuestion.question,
      options: currentQuestion.options,
      explanation: currentQuestion.explanation || '',
      topic: currentQuestion.topic || 'General',
      difficulty: quizDifficulty,
      timestamp: Date.now()
    };
    
    setQuizHistory(prev => [...prev, answerData]);
    
    // Store wrong answer for feedback
    if (!isCorrect) {
      const wrongAnswerData = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        selectedAnswer: {
          index: selectedAnswer,
          text: currentQuestion.options?.[selectedAnswer]?.text || `Option ${selectedAnswer + 1}`
        },
        correctAnswer: {
          index: currentQuestion.correctAnswer,
          text: currentQuestion.options?.[currentQuestion.correctAnswer]?.text || `Option ${currentQuestion.correctAnswer + 1}`
        },
        explanation: currentQuestion.explanation || '',
        topic: currentQuestion.topic || 'General',
        misconceptions: currentQuestion.misconceptions || [],
        keyInsights: currentQuestion.keyInsights || []
      };
      setWrongAnswers(prev => [...prev, wrongAnswerData]);
      
      // Update misconception tracker if wrong answer
      if (misconceptionTracker) {
        // Safely access option texts
        const wrongAnswerText = currentQuestion.options?.[selectedAnswer]?.text || `Option ${selectedAnswer + 1}`;
        const correctAnswerText = currentQuestion.options?.[currentQuestion.correctAnswer]?.text || `Option ${currentQuestion.correctAnswer + 1}`;
        
        const misconception = {
          concept: currentQuestion.topic || 'Unknown Topic',
          type: 'quiz_error',
          question: currentQuestion.question,
          wrongAnswer: wrongAnswerText,
          correctAnswer: correctAnswerText,
          explanation: currentQuestion.explanation || 'Review needed',
          topicId: intelligenceEngine?.enhancedTopics?.[currentTopicIndex]?.id,
          severity: 'medium',
          confidence: 70
        };
        
        misconceptionTracker.addOrUpdateMisconception(misconception, `quiz_${Date.now()}`);
        misconceptionTracker.saveToLocalStorage();
        updateMisconceptionData(misconceptionTracker);
      }
    }
    
    // Move to next question or show results
    setTimeout(() => {
      if (currentQuestionIndex < quizData.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        handleQuizComplete();
      }
    }, 1500);
  };
  
  const handleQuizComplete = async () => {
    const correctAnswers = quizHistory.filter(q => q.isCorrect).length;
    const totalQuestions = quizHistory.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Update quiz questions with user answers for results display
    console.log('Quiz History before mapping:', quizHistory);
    
    const updatedQuizData = { ...quizData };
    updatedQuizData.questions = quizData.questions.map((question, index) => {
      const userAnswer = quizHistory.find(q => q.questionIndex === index);
      console.log(`Mapping question ${index}:`, {
        userAnswer: userAnswer,
        selectedAnswer: userAnswer ? userAnswer.selectedAnswer : 'not found'
      });
      
      return {
        ...question,
        userAnswer: userAnswer ? userAnswer.selectedAnswer : null
      };
    });
    
    console.log('Updated Quiz Data:', updatedQuizData.questions.map((q, i) => ({
      index: i,
      userAnswer: q.userAnswer,
      correctAnswer: q.correctAnswer
    })));
    
    setQuizData(updatedQuizData);
    setQuizScore(score);
    setQuizCompleted(true);
    
    console.log('Quiz completed:', {
      score,
      correct: correctAnswers,
      total: totalQuestions,
      wrongAnswers: wrongAnswers.length,
      difficulty: quizDifficulty
    });
    
    // Prepare quiz results
    const quizResults = {
      session_id: sessionId,
      lecture_id: lecturePlan?.lectureId || 'unknown',
      topic: 'Covered Slides Quiz',
      score: score,
      correct: correctAnswers,
      total: totalQuestions,
      difficulty: quizDifficulty,
      questions: quizData.questions,
      answers: quizHistory,
      misconceptions: wrongAnswers.map(wa => ({
        topic: wa.topic,
        concept: wa.question,
        question: wa.question,
        wrongAnswer: wa.selectedAnswer.text,
        correctAnswer: wa.correctAnswer.text,
        explanation: wa.explanation,
        type: 'quiz_error'
      })),
      weak_topics: [...new Set(wrongAnswers.map(wa => wa.topic))],
      recommendations: score < 60 
        ? ['Review fundamental concepts', 'Practice more problems', 'Focus on weak areas']
        : score < 80
        ? ['Good progress - keep practicing', 'Focus on advanced topics']
        : ['Excellent performance!', 'Ready for harder challenges']
    };
    
    // Save using QuizStorage
    QuizStorage.saveQuizResults(quizResults);
    
    // Also try backend
    try {
      await fetch('http://localhost:8001/save-quiz-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizResults)
      });
      console.log('Quiz results saved to backend');
    } catch (err) {
      console.warn('Backend save failed (local storage used):', err);
    }

    // Handle wrong answers - generate feedback slides
    if (wrongAnswers.length > 0) {
      console.log('Generating feedback slides for wrong answers...');
      
      for (const wrongAnswer of wrongAnswers) {
        try {
          const contextData = {
            wrongAnswer: wrongAnswer,
            quizContext: `Question: ${wrongAnswer.question.substring(0, 100)}...`,
            studentPerformance: {
              score: score,
              totalQuestions: totalQuestions,
              wrongAnswersCount: wrongAnswers.length
            }
          };
          await generateDynamicSlide('quiz-feedback', '', null, JSON.stringify(contextData));
        } catch (error) {
          console.error('Failed to generate feedback slide for wrong answer:', error);
        }
      }
    } else {
      // All answers correct - offer harder quiz
      console.log('All answers correct! Offering harder quiz...');
      setTimeout(() => {
        const offerHarderQuiz = window.confirm(
          `Excellent! You got ${correctAnswers}/${totalQuestions} correct!\n\nWould you like to try a harder quiz with more challenging questions?`
        );
        
        if (offerHarderQuiz) {
          // Increase difficulty and start new quiz
          const newDifficulty = quizDifficulty === 'easy' ? 'medium' : 
                               quizDifficulty === 'medium' ? 'hard' : 'expert';
          setQuizDifficulty(newDifficulty);
          setQuizStarted(false);
          setQuizCompleted(false);
          setCurrentQuestionIndex(0);
          setSelectedAnswer(null);
          setWrongAnswers([]);
          
          // Auto-start the harder quiz
          setTimeout(() => {
            handleTakeQuiz();
          }, 500);
        } else {
          // Return to slides
          setActiveView('slides');
        }
      }, 2000);
    }
  };

  
  const handleSessionComplete = () => {
    setActiveView('completion');
    
    // Save final session state
    if (sessionStorage) {
      sessionStorage.updateSession(sessionId, {
        completed: true,
        completedAt: new Date().toISOString(),
        finalScore: quizScore,
        topicsCompleted: Array.from(topicsCompleted),
        totalTimeSpent: Date.now() - studyStartTimeRef.current
      });
    }
    
    console.log('Study session completed');
  };

  const loadOrGenerateFirstSlide = async (engine) => {
    const activeEngine = engine || intelligenceEngine;
    
    if (!activeEngine) {
      throw new Error('Intelligence Engine not available');
    }
    
    setLoadingMessage('Generating intelligent learning content...');
    
    try {
      // Get first topic from engine
      const firstTopic = activeEngine.getCurrentTopic();
      if (!firstTopic) {
        throw new Error('No topics available in lecture plan');
      }
      
      // Generate first slide using the new dynamic system - PASS ENGINE
      const firstSlide = await generateDynamicSlide('concept_explanation', '', activeEngine);  // PASS ENGINE
      
      if (!firstSlide) {
        throw new Error('Failed to generate first slide');
      }
      
      // Set initial state
      setSlides([firstSlide]);
      setCurrentSlideData(firstSlide);
      setCurrentSlideIndex(0);
      setCurrentTopicIndex(0);
      
      // Start topic timer
      currentTopicStartTimeRef.current = Date.now();
      
      console.log('First slide loaded:', firstSlide.title);
      
    } catch (error) {
      console.error('Failed to load first slide:', error);
      throw error;
    }
  };
  
  // =========================================================
  // HELPER FUNCTIONS
  // =========================================================
  
  const trackStudentInteraction = (actionType, data) => {
    const interaction = {
      type: actionType,
      timestamp: Date.now(),
      topicIndex: currentTopicIndex,
      sessionId: sessionId,
      ...data
    };
    
    setStudentInteractions(prev => [...prev, interaction]);
    
    // Save to session storage
    if (sessionStorage) {
      sessionStorage.updateSession(sessionId, {
        interactions: [...studentInteractions, interaction]
      });
    }
    
    interactionCountRef.current += 1;
    lastInteractionTimeRef.current = Date.now();
  };
    
  const startProgressTracking = () => {
    // Start slide timer
    startSlideTimer();
    
    // Update cognitive load periodically
    const loadInterval = setInterval(() => {
      updateCognitiveLoad();
    }, 60000); // Every minute
    
    return () => clearInterval(loadInterval);
  };
  
  const renderAskQuestionsContent = () => {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-6 overflow-y-auto flex-1">
          {/* Sample Questions */}
          <div className="space-y-2 mb-6">
            {sampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleAskQuestion(question)}
                className={`w-full text-left p-3 rounded-lg transition border ${
                  theme === 'light' 
                    ? 'hover:bg-blue-50 border-blue-300' 
                    : 'hover:bg-blue-900 border-blue-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{question}</span>
                </div>
              </button>
            ))}
          </div>
          
          {/* Custom Question Input */}
          <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ask your own question:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion(userQuestion)}
                placeholder="Type your question here..."
                className={`flex-1 px-3 py-2 border rounded-lg text-sm ${
                  theme === 'light'
                    ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    : 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={() => handleAskQuestion(userQuestion)}
                disabled={!userQuestion.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  
  const updateMisconceptionData = (tracker) => {
    if (!tracker) return;
    
    const summary = tracker.getMisconceptionSummary();
    setMisconceptions(tracker.getTopMisconceptions(5));
    setStudentProfile(summary.studentProfile);
    
    // Get adaptive suggestions from Intelligence Engine if available
    if (intelligenceEngine) {
      const suggestions = intelligenceEngine.getAdaptiveRecommendations();
      setAdaptiveSuggestions(suggestions);
    }
  };

  const updateCognitiveLoad = () => {
    // Calculate cognitive load based on recent activity
    const now = Date.now();
    const minutesSinceLastInteraction = (now - lastInteractionTimeRef.current) / (1000 * 60);
    
    let newLoad = cognitiveLoad;
    
    if (minutesSinceLastInteraction < 1) {
      // Very recent interaction
      newLoad = 'high';
    } else if (minutesSinceLastInteraction > 5) {
      // No recent interaction
      newLoad = 'low';
    } else {
      newLoad = 'medium';
    }
    
    // Also consider quiz activity
    if (quizStarted && !quizCompleted) {
      newLoad = 'high';
    }
    
    if (newLoad !== cognitiveLoad) {
      setCognitiveLoad(newLoad);
      
      // Update in session storage
      if (sessionStorage && sessionId) {
        sessionStorage.updateCognitiveLoad(sessionId, newLoad);
      }
    }
  };

  const startSlideTimer = () => {
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
    }
    
    // Adjust timer based on cognitive load
    let timerDuration = 180000; // 3 minutes default
    
    if (cognitiveLoad === 'high') {
      timerDuration = 240000; // 4 minutes for high load
    } else if (cognitiveLoad === 'low') {
      timerDuration = 120000; // 2 minutes for low load
    }
    
    slideTimerRef.current = setTimeout(() => {
      // Offer help if user has been on slide too long
      if (!showHelpOffer) {
        setShowHelpOffer(true);
      }
    }, timerDuration);
  };

  const saveSessionProgress = useCallback(() => {
    if (!sessionId || !intelligenceEngine) return;
    
    const progress = {
      sessionId,
      currentTopicIndex,
      topicsCompleted: Array.from(topicsCompleted),
      currentSlideIndex,
      totalStudyTime: Date.now() - studyStartTimeRef.current,
      lastSaved: new Date().toISOString()
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`session_progress_${sessionId}`, JSON.stringify(progress));
    }
    
    // Also save to intelligence engine
    intelligenceEngine.saveSessionState();
  }, [sessionId, intelligenceEngine, currentTopicIndex, topicsCompleted, currentSlideIndex]);

  // =========================================================
  // SLIDE NAVIGATION - INTELLIGENT VERSION
  // =========================================================
  
  const generateNewSlide = async (topicIndex, actionType = null, context = '') => {
    if (!intelligenceEngine) {
      console.error('Intelligence engine not available');
      return null;
    }
    
    try {
      setLoading(true);
      setLoadingMessage(actionType ? 
        `Generating ${actionType.replace('-', ' ')} content...` : 
        'Generating learning content...'
      );
      
      // Generate slide using Intelligence Engine
      const slide = await intelligenceEngine.generateSlideContent(
        topicIndex, 
        actionType, 
        context
      );
      
      if (!slide) {
        throw new Error('Failed to generate slide');
      }
      
      // Update slides array
      const newSlides = [...slides];
      
      // If this is a new topic or action, add to slides
      if (topicIndex >= newSlides.length || actionType) {
        newSlides.push(slide);
        setCurrentSlideIndex(newSlides.length - 1);
      } else {
        // Replacing existing slide
        newSlides[topicIndex] = slide;
        setCurrentSlideIndex(topicIndex);
      }
      
      setSlides(newSlides);
      setCurrentSlideData(slide);
      
      // Track interaction
      if (actionType) {
        const interaction = {
          type: actionType,
          context: context,
          timestamp: new Date().toISOString(),
          topicIndex: topicIndex,
          slideId: slide.id,
          cognitiveLoad: cognitiveLoad
        };
        
        setStudentInteractions(prev => [...prev, interaction]);
        interactionCountRef.current++;
        lastInteractionTimeRef.current = Date.now();
        
        // Update session storage
        if (sessionStorage && sessionId) {
          sessionStorage.addInteractionToSession(sessionId, interaction);
          sessionStorage.addSlideToSession(sessionId, slide);
        }
        
        // Update Intelligence Engine progress
        const currentTopic = intelligenceEngine.enhancedTopics?.[topicIndex];
        if (currentTopic) {
          intelligenceEngine.updateTopicProgress(currentTopic.id, {
            slidesViewed: (intelligenceEngine.topicProgress[currentTopic.id]?.slidesViewed || 0) + 1,
            lastAccessed: new Date().toISOString()
          });
        }
      }
      
      // Restart slide timer
      startSlideTimer();
      
      console.log(`Slide generated: ${slide.title}`, {
        actionType,
        topicIndex,
        totalSlides: newSlides.length
      });
      
      return slide;
      
    } catch (err) {
      console.error('Error generating slide:', err);
      setError(`Failed to generate content: ${err.message}`);
      
      // Create emergency slide
      const emergencySlide = createEmergencySlide(
        intelligenceEngine.enhancedTopics?.[topicIndex]?.title || 'Learning Content',
        actionType,
        context
      );
      
      const newSlides = [...slides, emergencySlide];
      setSlides(newSlides);
      setCurrentSlideIndex(newSlides.length - 1);
      setCurrentSlideData(emergencySlide);
      
      return emergencySlide;
      
    } finally {
      setLoading(false);
    }
  };

  const handleNextSlide = async () => {
    if (loading) return;
    
    // Check if we're at the end of current topic slides
    if (currentSlideIndex >= slides.length - 1) {
      // Move to next topic in lecture plan
      const nextTopicIndex = currentTopicIndex + 1;
      
      if (nextTopicIndex < totalTopics) {
        // Mark current topic as completed
        const updatedCompleted = new Set(topicsCompleted);
        updatedCompleted.add(currentTopicIndex);
        setTopicsCompleted(updatedCompleted);
        
        // Update Intelligence Engine
        if (intelligenceEngine) {
          const currentTopic = intelligenceEngine.enhancedTopics?.[currentTopicIndex];
          if (currentTopic) {
            intelligenceEngine.updateTopicProgress(currentTopic.id, {
              completed: true,
              timeSpent: Date.now() - (currentTopicStartTimeRef.current || Date.now())
            });
          }
        }
        
        // Generate slide for next topic
        setCurrentTopicIndex(nextTopicIndex);
        currentTopicStartTimeRef.current = Date.now();
        await generateDynamicSlide('concept_explanation', '');
        
      } else {
        // All topics completed
        await generateCompletionSlide();
      }
      
    } else {
      // Move to next slide in current topic
      const nextIndex = currentSlideIndex + 1;
      setCurrentSlideIndex(nextIndex);
      setCurrentSlideData(slides[nextIndex]);
    }
    
    setActiveView(null);
    setShowHelpOffer(false);
  };

  const handlePreviousSlide = () => {
    if (currentSlideIndex > 0) {
      const prevIndex = currentSlideIndex - 1;
      setCurrentSlideIndex(prevIndex);
      setCurrentSlideData(slides[prevIndex]);
      setActiveView(null);
    }
  };

  const jumpToTopic = async (topicIndex) => {
    if (topicIndex < 0 || topicIndex >= totalTopics || topicIndex === currentTopicIndex) {
      return;
    }
    
    setLoading(true);
    setLoadingMessage(`Loading topic ${topicIndex + 1}...`);
    
    try {
      // Generate slide for the selected topic
      await generateNewSlide(topicIndex, 'topic-jump', `Jumped to topic ${topicIndex + 1}`);
      setCurrentTopicIndex(topicIndex);
      currentTopicStartTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to jump to topic:', error);
      setError(`Failed to load topic: ${error.message}`);
    } finally {
      setLoading(false);
      setShowProgressModal(false);
    }
  };

  const getAdaptiveQuizDifficulty = () => {
    // Base difficulty on cognitive load
    if (cognitiveLoad === 'high') return 'easy';
    if (cognitiveLoad === 'low') return 'hard';
    
    // Consider previous performance if available
    if (studentProfile?.averageScore !== undefined) {
      if (studentProfile.averageScore >= 80) return 'hard';
      if (studentProfile.averageScore <= 50) return 'easy';
    }
    
    return 'medium';
  };

  const handleExplainMore = async () => {
    const currentTopic = intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
    if (!currentTopic) {
      setError('No topic available for detailed explanation');
      return;
    }
    
    const explainContext = `Provide detailed explanation with advanced insights, multiple analogies, and complex examples for ${currentTopic.title}`;
    
    await generateDynamicSlide(
      'explain-more',
      ''  // userQuestion is empty for explain-more
    );
    
    setActiveView(null);
  };

  const handleAskQuestion = async (question = '') => {
    const questionToAsk = question || userQuestion;
    
    if (!questionToAsk.trim()) {
      setError('Please enter a question');
      return;
    }
    
    const currentTopic = intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
    if (!currentTopic) {
      setError('No topic available for questions');
      return;
    }
    
    const questionContext = `Question about ${currentTopic.title}: ${questionToAsk}`;
    
    await generateDynamicSlide(
      'ask-question',
      questionToAsk  // Pass the actual question
    );
    
    setUserQuestion('');
    setActiveView(null);
  };

  const handleSubmitQuestion = () => {
    if (userQuestion.trim()) {
      handleAskQuestion(userQuestion);
    }
  };

  // =========================================================
  // QUIZ HANDLING - INTELLIGENT VERSION
  // =========================================================
  
  const handleAnswerSelect = (answerId) => {
    setSelectedAnswer(answerId);
    
    // Provide immediate feedback for learning
    if (quizData && quizData[currentQuestionIndex]) {
      const currentQuestion = quizData[currentQuestionIndex];
      if (answerId === currentQuestion.correctAnswer) {
        // Correct answer - visual feedback only
        console.log('Correct answer selected');
      } else {
        // Wrong answer - visual feedback only
        console.log('Wrong answer selected');
      }
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !quizData) return;
    
    // Mark question as answered
    const updatedQuizData = [...quizData];
    updatedQuizData[currentQuestionIndex] = {
      ...updatedQuizData[currentQuestionIndex],
      userAnswer: selectedAnswer,
      answeredAt: new Date().toISOString()
    };
    setQuizData(updatedQuizData);
    
    // Brief pause to show feedback, then move to next question
    setTimeout(() => {
      handleNextQuestion();
    }, 1500);
  };

  const handleNextQuestion = async () => {
    if (!quizData) return;
    
    if (currentQuestionIndex >= quizData.questions.length - 1) {
      // Quiz completed - calculate score
      const score = calculateQuizScore();
      setQuizScore(score);
      setQuizCompleted(true);
      
      // Record quiz results
      const currentTopic = intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
      const quizId = `quiz_${Date.now()}`;
      const quizResults = {
        timestamp: new Date().toISOString(),
        topicId: currentTopic?.id,
        topicTitle: currentTopic?.title || 'Unknown',
        score: score,
        totalQuestions: quizData.questions.length,
        correctAnswers: quizData.questions.filter(q => q.userAnswer === q.correctAnswer).length,
        difficulty: getAdaptiveQuizDifficulty(),
        cognitiveLoadDuring: cognitiveLoad
      };
      
      setQuizHistory(prev => [...prev, quizResults]);
      
      // Update Intelligence Engine
      if (intelligenceEngine && currentTopic) {
        intelligenceEngine.updateTopicProgress(currentTopic.id, {
          quizAttempted: true,
          quizScore: score,
          lastQuizAttempt: new Date().toISOString()
        });
      }
      
      // Update misconception tracker
      if (misconceptionTracker) {
        misconceptionTracker.addQuizResults({
          questions: quizData.questions,
          topic: currentTopic?.title || 'Unknown',
          score: score
        }, quizData.questions.map(q => q.userAnswer), quizId);
        
        misconceptionTracker.saveToLocalStorage();
        updateMisconceptionData(misconceptionTracker);
      }
      
      // Update session storage
      if (sessionStorage && sessionId) {
        sessionStorage.addQuizToSession(sessionId, {
          id: quizId,
          topic: currentTopic?.title || 'Unknown',
          questions: quizData.questions
        }, {
          score: score,
          misconceptions: misconceptionTracker ? misconceptionTracker.getTopMisconceptions(3) : []
        });
      }
      
      // Analyze quiz results with backend
      try {
        setLoading(true);
        setLoadingMessage('Analyzing quiz results and identifying mistakes...');
        
        const analysisResponse = await fetch('http://localhost:8001/analyze-quiz-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            quizId: quizId,
            questions: quizData.questions,
            answers: quizData.questions.map(q => ({
              selectedOption: q.userAnswer,
              questionId: q.id
            })),
            topic: currentTopic || {},
            studentGoal: studentGoal
          })
        });
        
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          const analysis = analysisData.analysis;
          
          // Store mistakes for future reference
          if (analysis.mistakes && analysis.mistakes.length > 0) {
            for (const mistake of analysis.mistakes) {
              try {
                await fetch('http://localhost:8001/store-mistake', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId: sessionId,
                    mistake: mistake,
                    topic: currentTopic || {},
                    studentGoal: studentGoal
                  })
                });
              } catch (err) {
                console.warn('Failed to store mistake:', err);
              }
            }
            
            // Generate mistake explanation slides
            for (const mistakeExplanation of analysis.mistake_explanations || []) {
              await generateNewSlide(
                slides.length,
                'mistake-explanation',
                `Mistake Analysis: ${mistakeExplanation.concept}`
              );
            }
          }
          
          // Generate results slide with analysis
          await generateNewSlide(
            slides.length,
            'quiz-results',
            `Quiz Results: ${score}% on ${currentTopic?.title || 'current topic'}`
          );
          
          // Offer hard questions if all correct
          if (analysis.offer_hard_questions) {
            setTimeout(() => {
              const offerHard = confirm(
                `Excellent! You got ${score}% correct. Would you like to try some harder questions to challenge yourself?`
              );
              if (offerHard) {
                handleTakeHardQuiz();
              }
            }, 2000);
          }
          
          // Show recommendations
          if (analysis.recommendations && analysis.recommendations.length > 0) {
            console.log('Quiz Recommendations:', analysis.recommendations);
            // Could show these in a modal or notification
          }
          
        } else {
          console.warn('Quiz analysis failed, using fallback');
          // Fallback: Generate results slide without analysis
          await generateNewSlide(
            slides.length,
            'quiz-results',
            `Quiz Results: ${score}% on ${currentTopic?.title || 'current topic'}`
          );
        }
      } catch (err) {
        console.error('Error analyzing quiz results:', err);
        // Fallback: Generate results slide
        await generateNewSlide(
          slides.length,
          'quiz-results',
          `Quiz Results: ${score}% on ${currentTopic?.title || 'current topic'}`
        );
      } finally {
        setLoading(false);
      }
      
    } else {
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
    }
  };
  
  const handleTakeHardQuiz = async () => {
    // Generate a harder quiz
    if (!intelligenceEngine) return;
    
    try {
      setLoading(true);
      setLoadingMessage('Generating challenging quiz...');
      
      const currentTopic = intelligenceEngine.enhancedTopics?.[currentTopicIndex];
      if (!currentTopic) return;
      
      // Generate hard quiz
      const quizResult = await intelligenceEngine.generateQuiz(currentTopic, 'hard');
      
      if (quizResult.success && quizResult.quiz) {
        setQuizData(quizResult.quiz.questions);
        setActiveView('quiz');
        setQuizStarted(true);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setQuizScore(null);
        setQuizCompleted(false);
      }
    } catch (err) {
      console.error('Error generating hard quiz:', err);
      setError('Failed to generate hard quiz');
    } finally {
      setLoading(false);
    }
  };

  const calculateQuizScore = () => {
    if (!quizData || quizData.length === 0) return 0;
    
    const correctAnswers = quizData.filter(q => q.userAnswer === q.correctAnswer).length;
    return Math.round((correctAnswers / quizData.length) * 100);
  };

  const handleRestartQuiz = () => {
    setQuizData(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(null);
    setQuizCompleted(false);
    setActiveView(null);
    setQuizStarted(false);
  };

  const handleClosePane = () => {
    setActiveView(null);
    setQuizStarted(false);
    setQuizData(null);
    setQuizCompleted(false);
    setUserQuestion('');
  };

  // =========================================================
  // COMPLETION AND NAVIGATION
  // =========================================================
  
  const generateCompletionSlide = async () => {
    const completionSlide = {
      id: `completion_${Date.now()}`,
      title: 'Learning Session Complete!',
      type: 'completion',
      content: {
        title: 'Congratulations!',
        narrative: `You have completed all ${totalTopics} topics in this learning session. Great work!`,
        keyInsights: [
          `Completed ${topicsCompleted.size} out of ${totalTopics} topics`,
          `Spent approximately ${Math.round((Date.now() - studyStartTimeRef.current) / 60000)} minutes learning`,
          `Mastered key concepts across all topics`,
          `Ready for advanced application and practice`
        ],
        analogies: [{
          domain: "Journey Completion",
          comparison: "Like reaching the summit after a challenging climb",
          lesson: "Consistent effort leads to mastery and achievement"
        }],
        realWorldScenario: {
          situation: "Applying learned concepts to real-world problems",
          application: "Using knowledge in practical scenarios and exams",
          outcome: "Achieving goals through applied understanding"
        },
        interactiveElement: "What would you like to learn next?",
        examRelevance: "Well prepared for exam scenarios and problem-solving",
        commonTraps: ["Forgetting to review periodically", "Not applying concepts in practice"],
        memoryHook: "Learn → Practice → Master → Succeed → Repeat"
      },
      images: [{
        id: `completion_img_${Date.now()}`,
        url: `https://via.placeholder.com/800x500/10b981/ffffff?text=Session+Complete%21`,
        caption: 'Learning Journey Complete',
        alt: 'Completion celebration',
        source: 'completion',
        isPlaceholder: true
      }],
      metadata: {
        generatedAt: new Date().toISOString(),
        isCompletion: true,
        totalTopics: totalTopics,
        topicsCompleted: topicsCompleted.size,
        totalStudyTime: Date.now() - studyStartTimeRef.current
      }
    };
    
    const newSlides = [...slides, completionSlide];
    setSlides(newSlides);
    setCurrentSlideIndex(newSlides.length - 1);
    setCurrentSlideData(completionSlide);
  };

  const handleDownloadPPT = async () => {
    try {
      const response = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalSessionId,
          topic: intelligenceEngine?.enhancedTopics?.[currentTopicIndex]?.title || 'Learning Topic',
          studentGoal: studentGoal,
          mode: 'download',
          includeMisconceptions: misconceptions.length > 0,
          lecturePlan: lecturePlan
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Generated ${data.slides?.length || 0} slides for download!`);
      } else {
        setError("Failed to generate download. Please try again.");
      }
    } catch (error) {
      setError("Failed to generate download. Please try again.");
    }
  };

  const handleRestartSession = () => {
    if (confirm('Are you sure you want to restart the learning session? All progress will be reset.')) {
      if (intelligenceEngine) {
        intelligenceEngine.resetSession();
      }
      setSlides([]);
      setCurrentSlideIndex(0);
      setCurrentTopicIndex(0);
      setTopicsCompleted(new Set());
      setQuizHistory([]);
      setStudentInteractions([]);
      loadOrGenerateFirstSlide();
    }
  };

  // =========================================================
  // EMERGENCY AND FALLBACK FUNCTIONS
  // =========================================================
  
  const createEmergencyLearningSession = () => {
    const emergencySlide = createEmergencySlide('Welcome to Adaptive Learning', 'welcome', '');
    setSlides([emergencySlide]);
    setCurrentSlideData(emergencySlide);
    setCurrentSlideIndex(0);
    setCognitiveLoad('low');
    setTotalTopics(1);
    setQuizData(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setQuizScore(null);
    setQuizCompleted(false);
    setActiveView(null);
    setQuizStarted(false);
  };

  const createEmergencySlide = (title, actionType, context) => {
    const slideId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: slideId,
      title: title || 'Learning Content',
      type: actionType || 'concept_explanation',
      content: {
        title: title || 'Learning Content',
        narrative: 'The intelligent learning system is preparing your personalized educational content. This adaptive system analyzes your learning patterns and goals to provide optimal explanations.',
        keyInsights: [
          'Personalized learning experience',
          'Adaptive content delivery',
          'Intelligent educational analysis',
          'Goal-oriented preparation'
        ],
        analogies: [{
          domain: "Expert Tutor",
          comparison: "Like having a personal expert who adapts to your learning style",
          lesson: "Customized approach yields optimal learning outcomes"
        }],
        realWorldScenario: {
          situation: "Efficient and effective learning preparation",
          application: "Learning at optimal pace with appropriate challenge level",
          outcome: "Achieving learning objectives effectively"
        },
        interactiveElement: 'What would you like to learn or understand better?',
        examRelevance: 'Tailored to your specific preparation needs',
        commonTraps: ['Skipping fundamentals', 'Inconsistent practice', 'Ignoring feedback'],
        memoryHook: 'Adapt → Learn → Practice → Succeed'
      },
      images: [{
        id: `emergency_img_${Date.now()}`,
        url: `https://via.placeholder.com/800x500/3b82f6/ffffff?text=Intelligent+Learning`,
        caption: 'Intelligent Learning System',
        alt: 'Learning system interface',
        source: 'emergency',
        isPlaceholder: true
      }],
      metadata: {
        generatedAt: new Date().toISOString(),
        isEmergency: true,
        source: 'emergency_fallback',
        studentGoal: studentGoal,
        actionType: actionType,
        context: context
      }
    };
  };

  // =========================================================
  // RENDER FUNCTIONS - REORGANIZED
  // =========================================================
  
  const renderSlideContent = () => {
    if (!currentSlideData) {
      return renderLoadingState();
    }

    const slideContent = currentSlideData.content || {};
    const isActionResponse = currentSlideData.metadata?.actionType;
    const isQuizResults = currentSlideData.type === 'quiz-results';
    const hasImages = currentSlideData.images && currentSlideData.images.length > 0;
    const isEmergency = currentSlideData.metadata?.isEmergency;

    return (
      <div className="h-full overflow-y-auto p-6">
        {/* Emergency/Status Banner */}
        {isEmergency && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-300">
                Using enhanced learning system
              </span>
            </div>
          </div>
        )}

        {isActionResponse && !isQuizResults && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-blue-700 dark:text-blue-300">
                Intelligent Response: {isActionResponse.replace('-', ' ')}
              </span>
            </div>
          </div>
        )}

        {isQuizResults && renderQuizResultsHeader()}

        {/* Main Slide Content */}
        {!isQuizResults && (
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {currentSlideData.title}
          </h1>
        )}

        {/* Images Section */}
        {hasImages && renderImageSection(currentSlideData.images)}

        {/* Narrative Section */}
        {slideContent.narrative && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Learning Narrative
            </h2>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {slideContent.narrative}
              </p>
            </div>
          </div>
        )}

        {/* Key Insights */}
        {slideContent.keyInsights && slideContent.keyInsights.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Key Insights
            </h2>
            <ul className="space-y-2">
              {slideContent.keyInsights.map((point, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700 dark:text-gray-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Analogies */}
        {slideContent.analogies && slideContent.analogies.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Learning Analogies
            </h2>
            <div className="space-y-4">
              {slideContent.analogies.map((analogy, index) => (
                <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    </div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">{analogy.domain}</h3>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">{analogy.comparison}</p>
                  <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                    <Lightbulb className="w-4 h-4" />
                    <span className="font-medium">Lesson: {analogy.lesson}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real World Scenario */}
        {slideContent.realWorldScenario && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Real-World Application
            </h2>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Scenario</h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">{slideContent.realWorldScenario.situation}</p>
              
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Application</h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">{slideContent.realWorldScenario.application}</p>
              
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Outcome</h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300">{slideContent.realWorldScenario.outcome}</p>
            </div>
          </div>
        )}

        {/* Interactive Element */}
        {slideContent.interactiveElement && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="flex items-center gap-2 mb-2">
              <Hand className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-semibold text-amber-700 dark:text-amber-300">Think & Engage</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{slideContent.interactiveElement}</p>
          </div>
        )}

        {/* Exam Relevance */}
        {slideContent.examRelevance && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-blue-700 dark:text-blue-300">Exam Relevance</h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{slideContent.examRelevance}</p>
          </div>
        )}

        {/* Common Traps */}
        {slideContent.commonTraps && slideContent.commonTraps.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Common Pitfalls to Avoid
            </h2>
            <div className="space-y-2">
              {slideContent.commonTraps.map((trap, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{trap}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory Hook */}
        {slideContent.memoryHook && (
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg border border-purple-300 dark:border-purple-600">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-purple-700 dark:text-purple-300">Memory Technique</h3>
            </div>
            <p className="text-gray-800 dark:text-gray-200">{slideContent.memoryHook}</p>
          </div>
        )}
      </div>
    );
  };

  const renderQuizResultsHeader = () => {
    return (
      <div className="mb-6 text-center">
        <Trophy className="w-16 h-16 mx-auto text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Quiz Results Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Based on your performance, the intelligent system will adapt future content
        </p>
      </div>
    );
  };

  const renderImageSection = (images) => {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Visual Learning Aids
          </h2>
          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
            {images.length} image{images.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image, index) => (
            <div 
              key={image.id || `img-${index}`} 
              className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 overflow-hidden">
                <img
                  src={image.url}
                  alt={image.alt || `Educational diagram ${index + 1}`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                {image.caption && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {image.caption}
                  </p>
                )}
                {image.source && image.source !== 'placeholder' && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Source: {image.source}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLoadingState = () => {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
          <Brain className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{loadingMessage}</p>
      </div>
    );
  };

  const renderQuizContent = () => {
    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <FileQuestion className="w-16 h-16 mx-auto text-amber-400 mb-4" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Loading intelligent quiz...</p>
          </div>
        </div>
      );
    }

    if (quizCompleted) {
      return renderQuizResults();
    }

    return renderCurrentQuestion();
  };

  const renderCurrentQuestion = () => {
    const currentQuestion = quizData.questions[currentQuestionIndex];
    if (!currentQuestion) return null;
    
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Question {currentQuestionIndex + 1} of {quizData.questions.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Difficulty: {quizDifficulty.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {currentQuestion.question}
            </h3>
            
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctAnswer;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleQuizAnswer(index)}
                    className={`w-full text-left p-4 rounded-lg transition-all border ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${
                        isSelected
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {option.text}
                      </span>
                      {isSelected && (
                        <div className="p-1 rounded bg-blue-100 dark:bg-blue-800">
                          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuizResults = () => {
    const correctAnswers = quizHistory.filter(q => q.isCorrect).length;
    const totalQuestions = quizHistory.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-6 overflow-y-auto flex-1">
          <div className="text-center mb-6">
            <Trophy className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Quiz Completed!
            </h3>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {score}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {correctAnswers} out of {totalQuestions} correct
            </p>
            
            {/* Performance feedback */}
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                {score >= 80 ? 'Excellent! Strong understanding demonstrated.' :
                 score >= 60 ? 'Good! Solid grasp with room for improvement.' :
                 'Keep practicing! Review the concepts and try again.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {quizData.questions.map((question, index) => {
              // Convert number index to letter for comparison
              const userAnswerLetter = question.userAnswer !== null ? ['A', 'B', 'C', 'D'][question.userAnswer] : null;
              
              console.log(`Question ${index}:`, {
                userAnswer: question.userAnswer,
                userAnswerLetter: userAnswerLetter,
                correctAnswer: question.correctAnswer,
                userAnswerType: typeof question.userAnswer,
                correctAnswerType: typeof question.correctAnswer,
                isCorrect: userAnswerLetter === question.correctAnswer
              });
              
              return (
              <div key={index} className={`p-4 rounded-lg border ${
                userAnswerLetter === question.correctAnswer 
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  {userAnswerLetter === question.correctAnswer ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{question.question}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your answer: <span className="font-semibold">{userAnswerLetter || 'Not answered'}</span>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Correct answer: <span className="font-semibold text-green-600 dark:text-green-400">{question.correctAnswer}</span>
                    </p>
                    {question.explanation && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}

          <div className="mt-6">
            <button
              onClick={handleRestartQuiz}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition font-semibold"
            >
              Continue Learning
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const renderAdaptivePanel = () => {
    const loadColor = getLoadColor();
    const currentTopic = intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
    
    return (
      <div className="p-6">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
          Intelligent Learning Panel
        </h3>
        
        {/* Current Topic Info */}
        {currentTopic && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Current Topic</span>
              </div>
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                {currentTopicIndex + 1}/{totalTopics}
              </span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{currentTopic.title}</p>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{currentTopic.estimatedTime || '25-35 min'}</span>
                <span className="mx-1">•</span>
                <span>Difficulty: {currentTopic.difficulty || 'medium'}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Progress</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {topicsCompleted.size} of {totalTopics} topics
            </span>
          </div>
          <div className="h-2 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${totalTopics > 0 ? (topicsCompleted.size / totalTopics) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Misconceptions */}
        {misconceptions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Learning Gaps</span>
              </div>
              <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                {misconceptions.length}
              </span>
            </div>
            <div className="space-y-2">
              {misconceptions.slice(0, 3).map((misconception, index) => (
                <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white">{misconception.concept}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{misconception.type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adaptive Suggestions */}
        {adaptiveSuggestions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Intelligent Suggestions</span>
            </div>
            <div className="space-y-2">
              {adaptiveSuggestions.map((suggestion, index) => (
                <div key={index} className={`p-3 rounded border ${
                  suggestion.priority === 'high' 
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' 
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                }`}>
                  <p className="text-sm text-gray-800 dark:text-gray-300">{suggestion.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cognitive State */}
        <div className={`p-3 rounded border ${loadColor.border} ${loadColor.lightBg}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className={`w-4 h-4 ${loadColor.text}`} />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Cognitive State</span>
            </div>
            <span className={`text-sm font-bold ${loadColor.text}`}>
              {cognitiveLoad.toUpperCase()}
            </span>
          </div>
          <p className={`text-xs ${loadColor.text}`}>
            {cognitiveLoad === 'high' 
              ? "Content simplified for optimal learning" 
              : cognitiveLoad === 'medium' 
                ? "Learning at comfortable pace" 
                : "Ready for challenging content"}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <div className={`h-1.5 flex-1 rounded-full ${cognitiveLoad === 'low' ? 'bg-green-500' : 'bg-green-300'}`}></div>
            <div className={`h-1.5 flex-1 rounded-full ${cognitiveLoad === 'medium' ? 'bg-amber-500' : 'bg-amber-300'}`}></div>
            <div className={`h-1.5 flex-1 rounded-full ${cognitiveLoad === 'high' ? 'bg-red-500' : 'bg-red-300'}`}></div>
          </div>
        </div>
      </div>
    );
  };

  const renderProgressModal = () => {
    if (!showProgressModal || !lecturePlan) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className={`max-w-2xl w-full rounded-xl shadow-2xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'}`}>
          <div className="p-6 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Learning Progress</h3>
              <button
                onClick={() => setShowProgressModal(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                <XIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>
          
          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Overall Progress</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {topicsCompleted.size} of {totalTopics} topics
                </span>
              </div>
              <div className="h-3 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalTopics > 0 ? (topicsCompleted.size / totalTopics) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-3">
              {lecturePlan.impTopics?.map((topic, index) => {
                const isCompleted = topicsCompleted.has(index);
                const isCurrent = index === currentTopicIndex;
                const progress = intelligenceEngine?.topicProgress?.[topic.id];
                
                return (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border cursor-pointer transition ${
                      isCurrent 
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20' 
                        : isCompleted
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                          : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                    onClick={() => jumpToTopic(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCurrent 
                            ? 'bg-blue-500 text-white' 
                            : isCompleted
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{topic.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <span>Importance: {topic.importance}</span>
                            {progress?.quizScore && (
                              <>
                                <span>•</span>
                                <span>Quiz: {progress.quizScore}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            Current
                          </div>
                        )}
                        {isCompleted && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-300 dark:border-gray-700">
            <button
              onClick={() => setShowProgressModal(false)}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition font-semibold"
            >
              Continue Learning
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getLoadColor = () => {
    switch (cognitiveLoad) {
      case 'high':
        return {
          text: "text-red-600 dark:text-red-400",
          bg: "bg-red-500 dark:bg-red-600",
          lightBg: "bg-red-50 dark:bg-red-900",
          border: "border-red-200 dark:border-red-800"
        };
      case 'medium':
        return {
          text: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500 dark:bg-amber-600",
          lightBg: "bg-amber-50 dark:bg-amber-900",
          border: "border-amber-200 dark:border-amber-800"
        };
      case 'low':
      default:
        return {
          text: "text-green-600 dark:text-green-400",
          bg: "bg-green-500 dark:bg-green-600",
          lightBg: "bg-green-50 dark:bg-green-900",
          border: "border-green-200 dark:border-green-800"
        };
    }
  };

  // =========================================================
  // LOADING AND ERROR STATES
  // =========================================================
  
  if (loading && !currentSlideData) {
    return (
      <div className={`h-screen flex items-center justify-center ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'}`}>
        <div className="text-center max-w-md">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <Brain className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-6">
            {loadingMessage}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Preparing your intelligent learning experience...
          </p>
        </div>
      </div>
    );
  }

  if (error && !currentSlideData) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} p-6`}>
        <div className={`text-center max-w-md p-6 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} rounded-xl shadow-lg`}>
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Learning Session Error
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Restart Session
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN RENDER
  // =========================================================
  
  const loadColor = getLoadColor();
  const currentSlideNumber = currentSlideIndex + 1;
  const totalSlides = slides.length;
  
  // Sample questions for ask-questions panel
  const sampleQuestions = [
    "Can you explain this concept with a real-world example?",
    "What are the most common mistakes when learning this?",
    "How does this relate to other concepts I've learned?",
    "What's the most important thing to remember about this?",
    "Can you break this down into simpler steps?"
  ];
  
  // Add topic-specific questions if available
  const currentTopic = intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
  if (currentTopic?.questionSeeds) {
    sampleQuestions.unshift(...currentTopic.questionSeeds.slice(0, 3));
  }

  return (
    <div className={`h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} transition-colors flex flex-col overflow-hidden`}>
      {/* Header */}
      <Header />
      
      {/* Session Info Bar */}
      <div className={`h-12 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex items-center px-6`}>
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Intelligent Learning AI</h1>
          </div>
          
          <div className="flex items-center gap-2 ml-6">
            <div className={`px-3 py-1.5 rounded-md ${loadColor.lightBg} ${loadColor.text} border ${loadColor.border} text-sm font-semibold flex items-center gap-2`}>
              <Brain className="w-4 h-4" />
              {cognitiveLoad.toUpperCase()} Cognitive Load
            </div>
            
            <div className={`px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-sm font-semibold flex items-center gap-2`}>
              <Target className="w-4 h-4" />
              Goal: {studentGoal.toUpperCase()}
            </div>
            
            {quizHistory.length > 0 && (
              <div className={`px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-sm font-semibold flex items-center gap-2`}>
                <BarChart className="w-4 h-4" />
                Quizzes: {quizHistory.length}
              </div>
            )}
            
            {misconceptions.length > 0 && (
              <div className={`px-3 py-1.5 rounded-md bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 text-sm font-semibold flex items-center gap-2`}>
                <AlertOctagon className="w-4 h-4" />
                Gaps: {misconceptions.length}
              </div>
            )}
            
            {/* Progress Button */}
            <button
              onClick={() => setShowProgressModal(true)}
              className={`px-3 py-1.5 rounded-md ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-700 hover:bg-gray-600'} text-gray-700 dark:text-gray-300 border ${theme === 'light' ? 'border-gray-300' : 'border-gray-600'} text-sm font-semibold flex items-center gap-2`}
            >
              <PieChart className="w-4 h-4" />
              Progress: {topicsCompleted.size}/{totalTopics}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRestartSession}
            className={`px-4 py-2 rounded-lg ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'} flex items-center gap-2 text-sm font-semibold transition`}
          >
            <RefreshCw className="w-4 h-4" />
            Restart
          </button>
          
          <button
            onClick={handleDownloadPPT}
            className={`px-4 py-2 rounded-lg ${theme === 'light' ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300' : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border border-blue-700'} flex items-center gap-2 text-sm font-semibold transition`}
          >
            <DownloadIcon className="w-4 h-4" />
            Download PPT
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Slide Area */}
        <div className={`flex-1 flex flex-col min-h-0 relative ${activeView ? 'pr-96' : ''}`}>
          <div className="flex-1 p-6 flex items-center justify-center min-h-0">
            <div className={`w-full h-full rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} shadow-lg flex flex-col border ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} overflow-hidden`}>
              {/* Slide Header */}
              <div className="p-6 border-b border-gray-300 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      SLIDE {currentSlideNumber} OF {Math.max(totalSlides, 1)}
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {currentSlideData?.title || "Loading Content..."}
                    </h1>
                    {currentTopic && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Topic {currentTopicIndex + 1} of {totalTopics}: {currentTopic.title}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {currentSlideData?.images && currentSlideData.images.length > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md text-xs">
                        <ImageIcon className="w-3 h-3" />
                        <span>{currentSlideData.images.length} visual{currentSlideData.images.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {currentSlideData?.metadata?.source && (
                      <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md text-xs">
                        {currentSlideData.metadata.source.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="h-2 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${loadColor.bg} rounded-full transition-all duration-300`}
                    style={{ width: `${(currentSlideNumber / Math.max(totalSlides, 1)) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Slide Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-blue-500 p-6">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                    <p className="font-semibold animate-pulse">AI is generating intelligent content...</p>
                  </div>
                ) : currentSlideData ? (
                  renderSlideContent()
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading content...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className={`h-16 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-t ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex items-center justify-between px-8`}>
            <div className="flex items-center gap-4">
              <button
                onClick={handlePreviousSlide}
                disabled={currentSlideIndex === 0}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                  currentSlideIndex === 0
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-400 dark:border-gray-600'
                    : theme === 'light'
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-400'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className={`px-4 py-2 rounded-lg border ${theme === 'light' ? 'bg-gray-100 border-gray-400' : 'bg-gray-700 border-gray-600'}`}>
                <span className="text-sm text-gray-700 dark:text-gray-300">Slide </span>
                <span className="text-base font-bold text-gray-900 dark:text-white mx-1">{currentSlideNumber}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">of {Math.max(totalSlides, 1)}</span>
              </div>
              
              <button
                onClick={handleNextSlide}
                disabled={loading}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                  theme === 'light' 
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-400' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
                }`}
              >
                {currentSlideIndex >= slides.length - 1 ? 'Next Topic' : 'Next Slide'}
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {/* Topic Navigation */}
              {totalTopics > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => jumpToTopic(Math.max(0, currentTopicIndex - 1))}
                    disabled={currentTopicIndex === 0}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Topic {currentTopicIndex + 1}/{totalTopics}
                  </span>
                  <button
                    onClick={() => jumpToTopic(Math.min(totalTopics - 1, currentTopicIndex + 1))}
                    disabled={currentTopicIndex === totalTopics - 1}
                    className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                  isPlaying 
                    ? 'bg-blue-600 text-white border-blue-700' 
                    : theme === 'light' 
                      ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-400' 
                      : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border-blue-700'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel (when no active view) */}
        {!activeView && (
          <div className={`w-96 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-l ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex flex-col overflow-hidden`}>
            {/* Panel Header */}
            <div className={`flex-shrink-0 ${theme === 'light' ? 'bg-gradient-to-b from-blue-50 to-purple-50' : 'bg-gradient-to-b from-gray-800 to-gray-900'} border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}`}>
              <div className="p-6">
                <div className="relative h-48 w-full mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-40 h-40">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                        <Brain className="w-24 h-24 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    Intelligent Learning Assistant
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-400 mb-2">
                    Your personalized learning companion
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs ${loadColor.lightBg} ${loadColor.text}`}>
                      {cognitiveLoad.toUpperCase()} LOAD
                    </div>
                    <div className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                      {studentGoal.toUpperCase()} GOAL
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-6 overflow-y-auto flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                  Intelligent Actions
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={handleTakeQuiz}
                    className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${
                      theme === 'light' 
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300' 
                        : 'bg-amber-900 hover:bg-amber-800 text-amber-300 border-amber-700'
                    }`}
                  >
                    <FileQuestion className="w-5 h-5" />
                    <span className="text-xs font-semibold">Take Quiz</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {quizDifficulty.toUpperCase()}
                    </span>
                  </button>
                  <button
                    onClick={handleExplainMore}
                    className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${
                      theme === 'light' 
                        ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300' 
                        : 'bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700'
                    }`}
                  >
                    <HelpCircle className="w-5 h-5" />
                    <span className="text-xs font-semibold">Explain More</span>
                  </button>
                  <button
                    onClick={() => setActiveView('askQuestions')}
                    className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${
                      theme === 'light' 
                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300' 
                        : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border-blue-700'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-xs font-semibold">Ask Questions</span>
                  </button>
                  <button
                    onClick={() => setShowProgressModal(true)}
                    className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${
                      theme === 'light' 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-500 hover:opacity-90 border-green-600' 
                        : 'bg-gradient-to-br from-green-600 to-emerald-600 hover:opacity-90 border-green-700'
                    }`}
                  >
                    <BarChart className="w-5 h-5 text-white" />
                    <span className="text-xs font-semibold text-white">View Progress</span>
                  </button>
                </div>

                {/* Adaptive Panel */}
                {renderAdaptivePanel()}
              </div>
            </div>
          </div>
        )}

        {/* Active View Panel (Quiz, Ask Questions, etc.) */}
        {activeView && (
          <div className={`w-[400px] lg:w-[450px] flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-l ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex flex-col overflow-hidden`}>
            {activeView === 'quiz' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-shrink-0 p-6 border-b border-gray-300 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <FileQuestion className="w-5 h-5 text-amber-500" />
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Dynamic Quiz</h3>
                    </div>
                    <button
                      onClick={handleClosePane}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                    >
                      <XIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                  {!quizCompleted && (
                    <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-blue-50 border border-blue-300' : 'bg-blue-900 border border-blue-700'}`}>
                      <p className="text-sm text-gray-800 dark:text-gray-300">
                        Quiz based on covered slides • {quizDifficulty.toUpperCase()} difficulty
                      </p>
                    </div>
                  )}
                </div>
                {renderQuizContent()}
              </div>
            ) : activeView === 'askQuestions' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-shrink-0 p-6 border-b border-gray-300 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Ask Questions</h3>
                    </div>
                    <button
                      onClick={handleClosePane}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                    >
                      <XIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-400 mb-4">
                    Select a question or ask your own:
                  </p>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-6 overflow-y-auto flex-1">
                    <div className="space-y-2">
                      {sampleQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleAskQuestion(question)}
                          className={`w-full text-left p-3 rounded-lg transition border ${
                            theme === 'light' 
                              ? 'hover:bg-blue-50 border-blue-300' 
                              : 'hover:bg-blue-900 border-blue-700'
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-300">{question}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-300 dark:border-gray-700 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-400 mb-2">Or ask your own question:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userQuestion}
                        onChange={(e) => setUserQuestion(e.target.value)}
                        placeholder="Type your question..."
                        className={`flex-1 px-3 py-2 rounded-lg border ${
                          theme === 'light' 
                            ? 'border-gray-400 bg-white' 
                            : 'border-gray-600 bg-gray-700'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                        onKeyPress={(e) => e.key === 'Enter' && handleSubmitQuestion()}
                      />
                      <button
                        onClick={handleSubmitQuestion}
                        disabled={!userQuestion.trim()}
                        className={`px-4 py-2 rounded-lg transition border ${
                          !userQuestion.trim()
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-400 dark:border-gray-600'
                            : 'bg-blue-600 dark:bg-blue-700 text-white hover:opacity-90 border-blue-700 dark:border-blue-800'
                        }`}
                      >
                        Ask
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Help Offer Modal */}
      {showHelpOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-xl shadow-2xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} p-6`}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Need Help?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You've been on this slide for a while. Would you like:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  handleExplainMore();
                  setShowHelpOffer(false);
                }}
                className="w-full p-3 text-left rounded-lg border border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">More detailed explanation</span>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveView('askQuestions');
                  setShowHelpOffer(false);
                }}
                className="w-full p-3 text-left rounded-lg border border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">Ask a specific question</span>
                </div>
              </button>
              <button
                onClick={() => setShowHelpOffer(false)}
                className="w-full p-3 text-left rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <XIcon className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">I'm fine, continue learning</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {renderProgressModal()}

      {/* Error Toast */}
      {error && currentSlideData && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`p-4 rounded-lg shadow-lg ${theme === 'light' ? 'bg-red-50 border border-red-300' : 'bg-red-900/30 border border-red-700'}`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded"
              >
                <XIcon className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// EXPORT WITH SUSPENSE
// =========================================================
export default function StudySessionPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Initializing intelligent learning session...</p>
        </div>
      </div>
    }>
      <StudySessionContent />
    </Suspense>
  );
}
