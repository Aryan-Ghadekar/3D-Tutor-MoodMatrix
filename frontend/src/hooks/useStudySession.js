import { useState, useEffect, useRef, useCallback } from "react";
import MisconceptionTracker from "@/lib/misconception-tracker";
import SessionStorage from "@/lib/session-storage";
import IntelligenceEngine from "@/lib/intelligenceEngine";
import { QuizStorage } from "@/app/lib/quiz-storage";

export const useStudySession = (searchParams, router) => {
    // =========================================================
    // STATE MANAGEMENT
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

    // Interaction State
    const [studentInteractions, setStudentInteractions] = useState([]);
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

    // Learning Services
    const [misconceptionTracker, setMisconceptionTracker] = useState(null);
    const [sessionStorage, setSessionStorage] = useState(null);
    const [misconceptions, setMisconceptions] = useState([]);
    const [adaptiveSuggestions, setAdaptiveSuggestions] = useState([]);

    // UI State
    const [showHelpOffer, setShowHelpOffer] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState(false);

    // Refs
    const slideTimerRef = useRef(null);
    const interactionCountRef = useRef(0);
    const lastInteractionTimeRef = useRef(Date.now());
    const studyStartTimeRef = useRef(null);
    const currentTopicStartTimeRef = useRef(null);

    // =========================================================
    // INITIALIZATION
    // =========================================================

    useEffect(() => {
        const initializeIntelligentSession = async () => {
            console.log('Starting intelligent study session initialization...');
            studyStartTimeRef.current = Date.now();

            try {
                // 1. Get or create session ID
                const newSessionId = await getOrCreateSessionId();
                setSessionId(newSessionId);

                // 2. Load student goal and preferences
                const { goal, level } = await loadStudentPreferences(searchParams);
                setStudentGoal(goal);
                setKnowledgeLevel(level);

                // 3. Initialize learning services
                await initializeLearningServices(newSessionId, goal);

                // 4. Initialize Intelligence Engine
                const engine = await initializeIntelligenceEngine(newSessionId, goal, level);

                // 5. Load or generate first slide
                await loadOrGenerateFirstSlide(engine, newSessionId, goal, level);

                // 6. Start tracking
                startProgressTracking();

                setLoading(false);
            } catch (err) {
                console.error('Session initialization failed:', err);
                setError(`Failed to initialize: ${err.message}`);
                createEmergencyLearningSession();
                setLoading(false);
            }
        };

        initializeIntelligentSession();

        return () => {
            if (slideTimerRef.current) {
                clearTimeout(slideTimerRef.current);
            }
            saveSessionProgress();
        };
    }, []); // Dependence on searchParams is minimal as we only read it once

    // =========================================================
    // METHODS
    // =========================================================

    const getOrCreateSessionId = async () => {
        if (typeof window !== 'undefined') {
            const existingSession = localStorage.getItem('current_intelligent_session');
            if (existingSession) {
                const sessionData = JSON.parse(existingSession);
                const sessionAge = Date.now() - new Date(sessionData.created).getTime();
                if (sessionAge < 2 * 60 * 60 * 1000) return sessionData.sessionId;
            }
            const newSessionId = `intelligent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('current_intelligent_session', JSON.stringify({
                sessionId: newSessionId,
                created: new Date().toISOString(),
                version: '3.0'
            }));
            return newSessionId;
        }
        return `server_${Date.now()}`;
    };

    const loadStudentPreferences = async (searchParams) => {
        let goal = 'gate';
        let level = 'intermediate';
        const urlGoal = searchParams.get("goal");
        const urlLevel = searchParams.get("level");

        if (typeof window !== 'undefined') {
            const savedGoal = localStorage.getItem('learning_goal');
            const savedLevel = localStorage.getItem('knowledge_level');
            goal = urlGoal || savedGoal || 'gate';
            level = urlLevel || savedLevel || 'intermediate';
            localStorage.setItem('learning_goal', goal);
            localStorage.setItem('knowledge_level', level);
        } else {
            goal = urlGoal || 'gate';
            level = urlLevel || 'intermediate';
        }
        return { goal, level };
    };

    const initializeLearningServices = async (sessionId, goal) => {
        const tracker = new MisconceptionTracker(sessionId);
        tracker.loadFromLocalStorage();
        setMisconceptionTracker(tracker);

        const storage = new SessionStorage();
        setSessionStorage(storage);
        if (!storage.getSession(sessionId)) {
            storage.createNewSession(goal, 'Intelligent Learning Session');
        }
        updateMisconceptionData(tracker);
    };

    const initializeIntelligenceEngine = async (sessionId, goal, level) => {
        setLoadingMessage('Loading intelligent learning engine...');
        try {
            const engine = new IntelligenceEngine(sessionId);
            const analysis = await engine.initialize(goal, { knowledgeLevel: level });
            if (!analysis.success) throw new Error('Intelligence Engine initialization failed');

            setIntelligenceEngine(engine);
            setLecturePlan(engine.lecturePlan);
            setTotalTopics(engine.lecturePlan?.impTopics?.length || 0);
            return engine;
        } catch (error) {
            throw new Error(`Learning system error: ${error.message}`);
        }
    };

    const loadOrGenerateFirstSlide = async (engine, sessionId, goal, knowledgeLevel) => {
        setLoadingMessage('Generating intelligent learning content...');
        const firstTopic = engine.getCurrentTopic();
        if (!firstTopic) throw new Error('No topics available');

        const firstSlide = await generateDynamicSlide('concept_explanation', '', engine, sessionId, goal, knowledgeLevel, 0);
        if (!firstSlide) throw new Error('Failed to generate first slide');

        setSlides([firstSlide]);
        setCurrentSlideData(firstSlide);
        setCurrentSlideIndex(0);
        setCurrentTopicIndex(0);
        currentTopicStartTimeRef.current = Date.now();
    };

    const generateDynamicSlide = async (actionType = 'concept_explanation', userQuestion = '', engineProp = null, sessionIdProp = null, goalProp = null, knowledgeLevelProp = null, topicIndexProp = null) => {
        const activeEngine = engineProp || intelligenceEngine;
        const activeSessionId = sessionIdProp || sessionId;
        const activeGoal = goalProp || studentGoal;
        const topicIndex = topicIndexProp !== null ? topicIndexProp : currentTopicIndex;

        if (!activeEngine) throw new Error('Learning system not initialized');
        setLoading(true);
        setLoadingMessage(`AI is generating ${actionType.replace('-', ' ')}...`);

        try {
            const knowledgeState = QuizStorage.getStudentProfile();
            // Fallback for knowledgeState if undefined? Assuming QuizStorage works.

            const response = await fetch('/api/generate-slide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: activeSessionId,
                    lecturePlan: activeEngine.lecturePlan,
                    goal: activeGoal,
                    knowledgeState: knowledgeState,
                    currentTopicIndex: topicIndex,
                    actionType: actionType,
                    userQuestion: userQuestion,
                    context: ''
                })
            });

            if (!response.ok) throw new Error(`AI generation failed: ${response.status}`);
            const result = await response.json();
            if (!result.success && !result.isFallback) throw new Error(result.error || 'AI generation failed');

            const newSlide = result.slide;

            // Only update state if we are calling this from an event handler (not initialization)
            if (!engineProp) {
                setSlides(prev => [...prev, newSlide]);
                setCurrentSlideIndex(prev => prev + 1); // This might be buggy if multiple calls. using slides.length is safer but slides is stale in closure.
                // Actually, better to rely on `setSlides` functional update but we need to know the index to set current.
                // For now, let's assume we append.
                setCurrentSlideData(newSlide);
                trackStudentInteraction(actionType, { slideId: newSlide.id, topicIndex: topicIndex, userQuestion });
            }

            return newSlide;
        } catch (error) {
            console.error('AI slide generation failed:', error);
            if (!engineProp) setError(`Failed to generate content: ${error.message}`);
            throw error;
        } finally {
            if (!engineProp) setLoading(false);
        }
    };

    // Re-implementing generateNewSlide to match page.jsx logic more closely as it handles history
    const generateNewSlide = async (topicIndex, actionType = null, context = '') => {
        if (!intelligenceEngine) return null;
        setLoading(true);
        setLoadingMessage(actionType ? `Generating ${actionType.replace('-', ' ')}...` : 'Generating learning content...');

        try {
            const slide = await intelligenceEngine.generateSlideContent(topicIndex, actionType, context);
            if (!slide) throw new Error('Failed to generate slide');

            const newSlides = [...slides];
            if (topicIndex >= newSlides.length || actionType) {
                newSlides.push(slide);
                setCurrentSlideIndex(newSlides.length - 1);
            } else {
                newSlides[topicIndex] = slide;
                setCurrentSlideIndex(topicIndex);
            }
            setSlides(newSlides);
            setCurrentSlideData(slide);

            if (actionType) {
                trackStudentInteraction(actionType, { context, slideId: slide.id, topicIndex });
            }
            startSlideTimer();
            return slide;
        } catch (err) {
            console.error('Error generating slide:', err);
            setError(`Failed to generate content: ${err.message}`);
            // Fallback logic could go here
        } finally {
            setLoading(false);
        }
    };

    const trackStudentInteraction = (actionType, data) => {
        const interaction = {
            type: actionType,
            timestamp: Date.now(),
            topicIndex: currentTopicIndex,
            sessionId: sessionId,
            ...data
        };
        setStudentInteractions(prev => [...prev, interaction]);
        if (sessionStorage) sessionStorage.updateSession(sessionId, { interactions: [...studentInteractions, interaction] });
        interactionCountRef.current += 1;
        lastInteractionTimeRef.current = Date.now();
    };

    const startProgressTracking = () => {
        startSlideTimer();
        const loadInterval = setInterval(updateCognitiveLoad, 60000);
        return () => clearInterval(loadInterval);
    };

    const startSlideTimer = () => {
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
        const timerDuration = cognitiveLoad === 'high' ? 240000 : cognitiveLoad === 'low' ? 120000 : 180000;
        slideTimerRef.current = setTimeout(() => {
            if (!showHelpOffer) setShowHelpOffer(true);
        }, timerDuration);
    };

    const updateCognitiveLoad = () => {
        const minutesSinceLastInteraction = (Date.now() - lastInteractionTimeRef.current) / 60000;
        let newLoad = cognitiveLoad;
        if (minutesSinceLastInteraction < 1) newLoad = 'high';
        else if (minutesSinceLastInteraction > 5) newLoad = 'low';
        else newLoad = 'medium';

        if (quizStarted && !quizCompleted) newLoad = 'high';

        if (newLoad !== cognitiveLoad) {
            setCognitiveLoad(newLoad);
            if (sessionStorage && sessionId) sessionStorage.updateCognitiveLoad(sessionId, newLoad);
        }
    };

    const updateMisconceptionData = (tracker) => {
        if (!tracker) return;
        const summary = tracker.getMisconceptionSummary();
        setMisconceptions(tracker.getTopMisconceptions(5));
        setStudentProfile(summary.studentProfile);
        if (intelligenceEngine) {
            setAdaptiveSuggestions(intelligenceEngine.getAdaptiveRecommendations());
        }
    };

    const saveSessionProgress = useCallback(() => {
        if (!sessionId || !intelligenceEngine) return;
        const progress = {
            sessionId, currentTopicIndex, topicsCompleted: Array.from(topicsCompleted),
            currentSlideIndex, totalStudyTime: Date.now() - studyStartTimeRef.current,
            lastSaved: new Date().toISOString()
        };
        if (typeof window !== 'undefined') localStorage.setItem(`session_progress_${sessionId}`, JSON.stringify(progress));
        intelligenceEngine.saveSessionState();
    }, [sessionId, intelligenceEngine, currentTopicIndex, topicsCompleted, currentSlideIndex]);

    // Quiz Handlers
    const handleTakeQuiz = async () => {
        if (!intelligenceEngine) return;
        if (cognitiveLoad === 'high') {
            setError('Cognitive load is high. Take a break first.');
            setShowHelpOffer(true);
            return;
        }
        try {
            setLoading(true);
            const currentTopic = intelligenceEngine.enhancedTopics?.[currentTopicIndex];
            const difficulty = getAdaptiveQuizDifficulty();
            const quizResult = await intelligenceEngine.generateQuiz(currentTopic, difficulty);

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
            setError(`Failed to load quiz: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getAdaptiveQuizDifficulty = () => {
        if (cognitiveLoad === 'high') return 'easy';
        if (cognitiveLoad === 'low') return 'hard';
        return 'medium';
    };

    const handleQuizAnswer = (answerIndex) => {
        setSelectedAnswer(answerIndex);
        if (!quizData || !quizData[currentQuestionIndex]) return;

        const currentQuestion = quizData[currentQuestionIndex];
        const isCorrect = answerIndex === currentQuestion.correctAnswer;

        // Update misconception tracker if wrong answer (real-time feedback)
        if (!isCorrect && misconceptionTracker && sessionId) {
            misconceptionTracker.addMisconception(
                currentQuestion.topic || { id: 'unknown' },
                currentQuestion.misconception || 'Incorrect understanding',
                currentQuestion.explanation || 'Review needed'
            );
            updateMisconceptionData(misconceptionTracker);
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

        // Auto move to next question after delay? usually handled by UI or effect. 
        // But let's leave it manual or UI driven.
    };

    const handleNextQuestion = async () => {
        if (!quizData) return;

        if (currentQuestionIndex >= quizData.length - 1) {
            // Quiz completed
            const correctAnswers = quizData.filter(q => q.userAnswer === q.correctAnswer).length;
            const score = Math.round((correctAnswers / quizData.length) * 100);

            setQuizScore(score);
            setQuizCompleted(true);

            const currentTopic = intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
            const quizId = `quiz_${Date.now()}`;

            // Save history
            const result = {
                timestamp: new Date().toISOString(),
                topicId: currentTopic?.id,
                score,
                totalQuestions: quizData.length,
                difficulty: getAdaptiveQuizDifficulty()
            };
            setQuizHistory(prev => [...prev, result]);

            // Update Engine
            if (intelligenceEngine && currentTopic) {
                intelligenceEngine.updateTopicProgress(currentTopic.id, {
                    quizAttempted: true, quizScore: score
                });
            }

            // Generate results slide or analysis
            try {
                // Simplified analysis call or just show local result
                await generateNewSlide(currentTopicIndex, 'quiz-results', `Quiz Score: ${score}%`);
            } catch (e) { console.error(e); }

        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
        }
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

    const createEmergencyLearningSession = () => {
        // Fallback implementation
        setSlides([{ title: 'Emergency Session', id: 'emergency', content: { title: 'Emergency Session' }, type: 'concept_explanation' }]);
        setCurrentSlideIndex(0);
        setLoading(false);
    };

    // Navigation
    const handleNextSlide = async () => {
        if (loading) return;
        if (currentSlideIndex >= slides.length - 1) {
            const nextTopicIndex = currentTopicIndex + 1;
            if (nextTopicIndex < totalTopics) {
                const updatedCompleted = new Set(topicsCompleted);
                updatedCompleted.add(currentTopicIndex);
                setTopicsCompleted(updatedCompleted);
                if (intelligenceEngine) {
                    const currentTopic = intelligenceEngine.enhancedTopics?.[currentTopicIndex];
                    if (currentTopic) intelligenceEngine.updateTopicProgress(currentTopic.id, { completed: true });
                }
                setCurrentTopicIndex(nextTopicIndex);
                currentTopicStartTimeRef.current = Date.now();
                await generateNewSlide(nextTopicIndex);
            } else {
                // Completion logic
                await generateNewSlide(currentTopicIndex, 'completion'); // Mock
            }
        } else {
            const nextIndex = currentSlideIndex + 1;
            setCurrentSlideIndex(nextIndex);
            setCurrentSlideData(slides[nextIndex]);
        }
        setActiveView(null);
    };

    const handlePreviousSlide = () => {
        if (currentSlideIndex > 0) {
            setCurrentSlideIndex(prev => prev - 1);
            setCurrentSlideData(slides[currentSlideIndex - 1]);
            setActiveView(null);
        }
    };

    const jumpToTopic = async (topicIndex) => {
        if (topicIndex < 0 || topicIndex >= totalTopics) return;
        setLoading(true);
        await generateNewSlide(topicIndex, 'topic-jump', `Jumped to topic ${topicIndex + 1}`);
        setCurrentTopicIndex(topicIndex);
        currentTopicStartTimeRef.current = Date.now();
        setLoading(false);
        setShowProgressModal(false);
    };

    // Other Actions
    const handleExplainMore = async () => {
        await generateNewSlide(currentTopicIndex, 'explain-more', 'Detailed explanation');
        setActiveView(null);
    };

    const handleAskQuestion = async (question) => {
        await generateNewSlide(currentTopicIndex, 'ask-question', question);
        setUserQuestion('');
        setActiveView(null);
    };

    // Expose everything needed by UI
    return {
        // State
        sessionId, loading, loadingMessage, error,
        lecturePlan, totalTopics, currentTopicIndex, topicsCompleted,
        studentGoal, knowledgeLevel, cognitiveLoad,
        slides, currentSlideIndex, currentSlideData,
        quizStarted, quizData, quizCompleted, quizScore, currentQuestionIndex, selectedAnswer,
        activeView, userQuestion, showHelpOffer, showProgressModal,
        misconceptions, adaptiveSuggestions, quizHistory,
        intelligenceEngine,

        // Setters (if needed directly)
        setActiveView, setShowProgressModal, setShowHelpOffer, setUserQuestion,
        setSelectedAnswer, setQuizData,
        setQuizScore, setQuizCompleted, setCurrentQuestionIndex,

        // Actions
        handleNextSlide, handlePreviousSlide, jumpToTopic,
        handleTakeQuiz, handleQuizAnswer, handleSubmitAnswer, handleNextQuestion, handleRestartQuiz, handleClosePane, getAdaptiveQuizDifficulty,
        handleExplainMore, handleAskQuestion,
        generateDynamicSlide, generateNewSlide
    };
};
