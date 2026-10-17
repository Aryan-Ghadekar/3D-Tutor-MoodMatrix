import { useState, useEffect, useRef, useCallback } from "react";
import MisconceptionTracker from "@/lib/misconception-tracker";
import SessionStorage from "@/lib/session-storage";
import IntelligenceEngine from "@/lib/intelligenceEngine";
import { QuizStorage } from "@/app/lib/quiz-storage";
import { levelFor } from "@/lib/cognitive/fusion";

const SESSION_KEY = 'current_intelligent_session';
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const LOAD_CHECK_INTERVAL_MS = 30 * 1000;
const RECENT_WINDOW_MS = 3 * 60 * 1000;
const HELP_COOLDOWN_MS = 10 * 60 * 1000;

const safeStorage = {
    get(key) {
        try { return typeof window !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
    },
    set(key, value) {
        try { if (typeof window !== 'undefined') localStorage.setItem(key, value); } catch { /* storage full or blocked */ }
    },
    remove(key) {
        try { if (typeof window !== 'undefined') localStorage.removeItem(key); } catch { /* ignore */ }
    },
};

export const useStudySession = (searchParams) => {
    // =========================================================
    // STATE
    // =========================================================
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Initializing intelligent learning...');
    const [error, setError] = useState(null);
    const [fatalError, setFatalError] = useState(null);

    const [lecturePlan, setLecturePlan] = useState(null);
    const [intelligenceEngine, setIntelligenceEngine] = useState(null);
    const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
    const [topicsCompleted, setTopicsCompleted] = useState(new Set());
    const [totalTopics, setTotalTopics] = useState(0);

    const [studentGoal, setStudentGoal] = useState('gate');
    const [knowledgeLevel, setKnowledgeLevel] = useState('intermediate');
    const [cognitiveLoad, setCognitiveLoad] = useState('medium');
    const [loadScore, setLoadScore] = useState(35);          // 0-100, camera-fused when the sensor is on
    const [behaviorScore, setBehaviorScore] = useState(35);  // 0-100, from quiz results and help requests only
    const [quizReviews, setQuizReviews] = useState([]);      // per-quiz question review, used by the notes
    const [lastGeneratedSlideId, setLastGeneratedSlideId] = useState(null);

    const [slides, setSlides] = useState([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [currentSlideData, setCurrentSlideData] = useState(null);

    const [activeView, setActiveView] = useState(null);
    const [userQuestion, setUserQuestion] = useState("");

    const [quizStarted, setQuizStarted] = useState(false);
    const [quizData, setQuizData] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [quizScore, setQuizScore] = useState(null);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [quizHistory, setQuizHistory] = useState([]);

    const [misconceptionTracker, setMisconceptionTracker] = useState(null);
    const [misconceptions, setMisconceptions] = useState([]);
    const [adaptiveSuggestions, setAdaptiveSuggestions] = useState([]);

    const [showHelpOffer, setShowHelpOffer] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState(false);

    // =========================================================
    // REFS (values read from timers / async callbacks / unmount)
    // =========================================================
    const initStartedRef = useRef(false);
    const engineRef = useRef(null);
    const trackerRef = useRef(null);
    const storageRef = useRef(null);
    const sessionIdRef = useRef(null);
    const slidesRef = useRef([]);
    const loadRef = useRef('medium');
    const loadScoreRef = useRef(35);
    const externalLoadRef = useRef(null);     // { score, level } from the camera sensor, or null
    const slideTimerRef = useRef(null);
    const loadIntervalRef = useRef(null);
    const interactionTimesRef = useRef([]);
    const interactionsRef = useRef([]);
    const lastQuizRef = useRef(null);         // { score, at }
    const lastHelpOfferRef = useRef(0);
    const quizActiveRef = useRef(false);
    const studyStartTimeRef = useRef(null);
    const progressRef = useRef({});

    progressRef.current = { sessionId, currentTopicIndex, topicsCompleted, currentSlideIndex };
    quizActiveRef.current = quizStarted && !quizCompleted;

    // =========================================================
    // COGNITIVE LOAD (behavioural heuristic, no sensors)
    // =========================================================
    const evaluateLoad = useCallback(() => {
        const now = Date.now();
        // Only signs of struggling count: wrong quiz answers and repeated requests for more help
        const recentStruggles = interactionTimesRef.current.filter(i => i.struggle && now - i.at < RECENT_WINDOW_MS).length;
        const lastQuiz = lastQuizRef.current;
        const recentQuiz = lastQuiz && now - lastQuiz.at < HELP_COOLDOWN_MS ? lastQuiz : null;

        let behavior = 35 + Math.min(recentStruggles, 4) * 12;
        if (recentQuiz) behavior += recentQuiz.score < 50 ? 35 : recentQuiz.score >= 85 ? -15 : 0;
        behavior = Math.max(5, Math.min(95, behavior));
        setBehaviorScore(behavior);

        // With the camera on, the fused (emotion + posture + behaviour) reading drives the level
        const external = externalLoadRef.current;
        const score = Math.round(external ? external.score : behavior);
        const next = external ? external.level : levelFor(behavior);

        if (Math.abs(score - loadScoreRef.current) >= 2) {
            loadScoreRef.current = score;
            setLoadScore(score);
        }

        if (next !== loadRef.current) {
            const previous = loadRef.current;
            loadRef.current = next;
            setCognitiveLoad(next);
            if (storageRef.current && sessionIdRef.current) storageRef.current.updateCognitiveLoad(sessionIdRef.current, next);
            // Offer help when the student starts struggling, but not more often than the cooldown
            if (next === 'high' && previous !== 'high' && !quizActiveRef.current && now - lastHelpOfferRef.current > HELP_COOLDOWN_MS) {
                lastHelpOfferRef.current = now;
                setShowHelpOffer(true);
            }
        }
    }, []);

    /** Called with the camera sensor's fused reading ({score, level}) or null when the camera is off. */
    const setExternalLoad = useCallback((reading) => {
        externalLoadRef.current = reading && typeof reading.score === 'number' ? reading : null;
        evaluateLoad();
    }, [evaluateLoad]);

    const trackStudentInteraction = useCallback((actionType, data = {}) => {
        const interaction = {
            type: actionType,
            timestamp: Date.now(),
            topicIndex: progressRef.current.currentTopicIndex,
            sessionId: sessionIdRef.current,
            ...data
        };
        interactionsRef.current = [...interactionsRef.current, interaction].slice(-200);
        const struggle = actionType === 'explain-more' || actionType === 'ask-question' ||
            (actionType === 'quiz-answer' && data.correct === false);
        interactionTimesRef.current = [...interactionTimesRef.current, { at: interaction.timestamp, struggle }].slice(-50);
        if (storageRef.current && sessionIdRef.current) {
            storageRef.current.updateSession(sessionIdRef.current, { interactions: interactionsRef.current });
        }
        evaluateLoad();
    }, [evaluateLoad]);

    const startSlideTimer = useCallback(() => {
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
        const duration = loadRef.current === 'high' ? 4 * 60 * 1000 : loadRef.current === 'low' ? 2 * 60 * 1000 : 3 * 60 * 1000;
        slideTimerRef.current = setTimeout(() => {
            if (Date.now() - lastHelpOfferRef.current > HELP_COOLDOWN_MS && !quizActiveRef.current) {
                lastHelpOfferRef.current = Date.now();
                setShowHelpOffer(true);
            }
        }, duration);
    }, []);

    // =========================================================
    // SLIDE MANAGEMENT
    // =========================================================
    const commitSlides = (next) => {
        slidesRef.current = next;
        setSlides(next);
    };

    const showSlide = (index) => {
        const slide = slidesRef.current[index];
        if (!slide) return;
        setCurrentSlideIndex(index);
        setCurrentSlideData(slide);
        const topicIndex = slide.metadata?.topicIndex;
        if (typeof topicIndex === 'number') setCurrentTopicIndex(topicIndex);
        setActiveView(null);
        startSlideTimer();
    };

    const findConceptSlide = (topicIndex) =>
        slidesRef.current.findIndex(s => s.metadata?.topicIndex === topicIndex && s.type === 'concept_explanation');

    /** Highest topic index that already has its main slide (the student may have navigated back since). */
    const furthestTopicWithSlide = (deck = slidesRef.current) =>
        deck.reduce((max, s) => (s.type === 'concept_explanation' && typeof s.metadata?.topicIndex === 'number'
            ? Math.max(max, s.metadata.topicIndex) : max), -1);

    /** Generate a slide for a topic and append it to the deck. Returns the slide, or null on failure. */
    const addSlide = async (topicIndex, actionType = 'concept_explanation', context = '') => {
        const engine = engineRef.current;
        if (!engine) return null;

        setLoading(true);
        setLoadingMessage(
            actionType === 'concept_explanation' ? 'Preparing the next topic...' : `Generating ${actionType.replace(/[-_]/g, ' ')}...`
        );

        try {
            const slide = await engine.generateSlideContent(topicIndex, actionType, context);
            const next = [...slidesRef.current, slide];
            commitSlides(next);
            setCurrentSlideIndex(next.length - 1);
            setCurrentSlideData(slide);
            setCurrentTopicIndex(topicIndex);
            startSlideTimer();
            setLastGeneratedSlideId(slide.id);
            if (actionType !== 'concept_explanation') {
                trackStudentInteraction(actionType, { slideId: slide.id, topicIndex, context });
            }
            return slide;
        } catch (err) {
            console.error('Error generating slide:', err);
            setError(`Failed to generate content: ${err.message}`);
            return null;
        } finally {
            setLoading(false);
        }
    };

    // =========================================================
    // INITIALIZATION
    // =========================================================
    useEffect(() => {
        if (initStartedRef.current) return; // React strict mode runs effects twice in development
        initStartedRef.current = true;
        studyStartTimeRef.current = Date.now();

        const lectureSessionId = searchParams.get('sessionId');

        const getOrCreateSessionId = () => {
            try {
                const existing = JSON.parse(safeStorage.get(SESSION_KEY) || 'null');
                const fresh = existing && Date.now() - new Date(existing.created).getTime() < SESSION_MAX_AGE_MS;
                // A different lecture always starts a new study session
                if (fresh && (existing.lectureSessionId || null) === (lectureSessionId || null)) return existing.sessionId;
            } catch { /* corrupt entry: start a new session */ }

            const id = `intelligent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            safeStorage.set(SESSION_KEY, JSON.stringify({
                sessionId: id,
                created: new Date().toISOString(),
                lectureSessionId: lectureSessionId || null,
                version: '3.1'
            }));
            return id;
        };

        const initialize = async () => {
            try {
                const newSessionId = getOrCreateSessionId();
                sessionIdRef.current = newSessionId;
                setSessionId(newSessionId);

                // Student preferences: URL > saved > profile derived from the knowledge test
                const profile = QuizStorage.getStudentProfile();
                const goal = searchParams.get('goal') || safeStorage.get('learning_goal') || 'gate';
                const level = searchParams.get('level') || safeStorage.get('knowledge_level') || profile.knowledgeLevel || 'intermediate';
                safeStorage.set('learning_goal', goal);
                safeStorage.set('knowledge_level', level);
                setStudentGoal(goal);
                setKnowledgeLevel(level);

                // Learning services
                const tracker = new MisconceptionTracker(newSessionId);
                tracker.loadFromLocalStorage();
                trackerRef.current = tracker;
                setMisconceptionTracker(tracker);

                const storage = new SessionStorage();
                storageRef.current = storage;
                if (!storage.getSession(newSessionId)) storage.createNewSession(goal, 'Intelligent Learning Session');

                // Intelligence engine
                setLoadingMessage('Loading your lecture...');
                const engine = new IntelligenceEngine(newSessionId, { lectureSessionId });
                const analysis = await engine.initialize(goal, {
                    knowledgeLevel: level,
                    misconceptions: profile.misconceptions || []
                });
                if (!analysis.success) throw new Error(analysis.error || 'Could not start the learning session');

                engineRef.current = engine;
                setIntelligenceEngine(engine);
                setLecturePlan(engine.lecturePlan);
                setTotalTopics(engine.enhancedTopics.length);
                refreshMisconceptions(tracker, engine);

                // First slide
                setLoadingMessage('Generating your first slide...');
                const firstSlide = await engine.generateSlideContent(0);
                commitSlides([firstSlide]);
                setCurrentSlideData(firstSlide);
                setCurrentSlideIndex(0);
                setCurrentTopicIndex(0);

                loadIntervalRef.current = setInterval(evaluateLoad, LOAD_CHECK_INTERVAL_MS);
                startSlideTimer();
                setLoading(false);
            } catch (err) {
                console.error('Session initialization failed:', err);
                setFatalError(err.message);
                setLoading(false);
            }
        };

        initialize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Clean up timers and persist progress when leaving the page
    useEffect(() => {
        return () => {
            if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
            if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
            const { sessionId: id, currentTopicIndex: topic, topicsCompleted: done, currentSlideIndex: slide } = progressRef.current;
            if (!id || !engineRef.current) return;
            safeStorage.set(`session_progress_${id}`, JSON.stringify({
                sessionId: id,
                currentTopicIndex: topic,
                topicsCompleted: Array.from(done),
                currentSlideIndex: slide,
                totalStudyTime: Date.now() - (studyStartTimeRef.current || Date.now()),
                lastSaved: new Date().toISOString()
            }));
            engineRef.current.saveSessionState();
        };
    }, []);

    const refreshMisconceptions = (tracker, engine) => {
        if (tracker) setMisconceptions(tracker.getTopMisconceptions(5));
        if (engine) setAdaptiveSuggestions(engine.getAdaptiveRecommendations());
    };

    // =========================================================
    // NAVIGATION
    // =========================================================
    const markTopicCompleted = (topicIndex) => {
        setTopicsCompleted(prev => new Set(prev).add(topicIndex));
        const topic = engineRef.current?.enhancedTopics?.[topicIndex];
        if (topic) engineRef.current.updateTopicProgress(topic.id, { completed: true });
    };

    const handleNextSlide = async () => {
        if (loading) return;
        trackStudentInteraction('next-slide');

        if (currentSlideIndex < slides.length - 1) {
            showSlide(currentSlideIndex + 1);
            return;
        }

        if (currentSlideData?.type === 'completion') return;

        markTopicCompleted(currentTopicIndex);
        const nextTopic = furthestTopicWithSlide() + 1;

        if (nextTopic < totalTopics) {
            await addSlide(nextTopic);
        } else {
            await addSlide(currentTopicIndex, 'completion');
        }
        setActiveView(null);
    };

    const handlePreviousSlide = () => {
        if (currentSlideIndex > 0) {
            trackStudentInteraction('previous-slide');
            showSlide(currentSlideIndex - 1);
        }
    };

    const jumpToTopic = async (topicIndex) => {
        if (loading || topicIndex < 0 || topicIndex >= totalTopics) return;
        trackStudentInteraction('topic-jump', { topicIndex });
        setShowProgressModal(false);

        const existing = findConceptSlide(topicIndex);
        if (existing !== -1) showSlide(existing);
        else await addSlide(topicIndex);
    };

    const isLastTopic = furthestTopicWithSlide(slides) >= totalTopics - 1;
    const atEnd = currentSlideIndex >= slides.length - 1;
    const canGoNext = !loading && !(atEnd && currentSlideData?.type === 'completion');
    const nextLabel = !atEnd ? 'Next Slide' : isLastTopic ? 'Finish Lecture' : 'Next Topic';

    // =========================================================
    // QUIZ
    // =========================================================
    const getAdaptiveQuizDifficulty = () => {
        if (cognitiveLoad === 'high') return 'easy';
        if (cognitiveLoad === 'low') return 'hard';
        return 'medium';
    };

    // `recentContext` is text (e.g. the teacher's last minutes of audio). Click handlers pass an event, which is ignored.
    const handleTakeQuiz = async (recentContext) => {
        const engine = engineRef.current;
        if (!engine || loading) return;
        const extraContext = typeof recentContext === 'string' ? recentContext : '';

        setShowHelpOffer(false);
        setLoading(true);
        setLoadingMessage('Preparing your quiz...');
        try {
            const topic = engine.enhancedTopics[currentTopicIndex];
            const result = await engine.generateQuiz(topic, getAdaptiveQuizDifficulty(), extraContext);
            const questions = result.quiz?.questions || [];

            if (questions.length === 0) {
                setError('Could not generate quiz questions. Please try again.');
                return;
            }

            trackStudentInteraction('quiz-start');
            setQuizData(questions);
            setActiveView('quiz');
            setQuizStarted(true);
            setCurrentQuestionIndex(0);
            setSelectedAnswer(null);
            setQuizScore(null);
            setQuizCompleted(false);
        } catch (err) {
            setError(`Failed to load quiz: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleQuizAnswer = (optionId) => {
        setSelectedAnswer(optionId);
    };

    const handleSubmitAnswer = () => {
        if (!selectedAnswer || !quizData) return;
        const question = quizData[currentQuestionIndex];
        if (!question || question.userAnswer) return;

        const updated = [...quizData];
        updated[currentQuestionIndex] = { ...question, userAnswer: selectedAnswer, answeredAt: new Date().toISOString() };
        setQuizData(updated);
        trackStudentInteraction('quiz-answer', { correct: selectedAnswer === question.correctAnswer });

        if (selectedAnswer !== question.correctAnswer) {
            const topic = engineRef.current?.enhancedTopics?.[currentTopicIndex];
            const misconception = {
                concept: topic?.title || question.conceptsTested?.[0] || 'General',
                type: 'knowledge_gap',
                description: question.misconception || `Answered incorrectly: ${question.text}`,
                severity: 'medium',
                evidence: question.text,
                topicId: topic?.id
            };
            trackerRef.current?.addOrUpdateMisconception(misconception, `quiz_${currentTopicIndex}`);
            trackerRef.current?.saveToLocalStorage();
            engineRef.current?.addMisconception(misconception);
            refreshMisconceptions(trackerRef.current, engineRef.current);
        }
    };

    const handleNextQuestion = async () => {
        if (!quizData) return;

        if (currentQuestionIndex < quizData.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            return;
        }

        // Quiz finished
        const correct = quizData.filter(q => q.userAnswer === q.correctAnswer).length;
        const score = Math.round((correct / quizData.length) * 100);
        const missed = quizData.filter(q => q.userAnswer !== q.correctAnswer);
        const topic = engineRef.current?.enhancedTopics?.[currentTopicIndex];

        setQuizScore(score);
        setQuizCompleted(true);
        setQuizHistory(prev => [...prev, {
            timestamp: new Date().toISOString(),
            topicId: topic?.id,
            score,
            totalQuestions: quizData.length,
            difficulty: getAdaptiveQuizDifficulty()
        }]);
        lastQuizRef.current = { score, at: Date.now() };
        setQuizReviews(prev => [...prev, {
            topicIndex: currentTopicIndex,
            topicTitle: topic?.title || 'Topic',
            score,
            items: quizData.map(q => ({
                question: q.text,
                correct: q.userAnswer === q.correctAnswer,
                yourAnswer: q.options.find(o => o.id === q.userAnswer)?.text,
                correctAnswer: q.options.find(o => o.id === q.correctAnswer)?.text,
                explanation: q.explanation
            }))
        }]);

        if (topic) engineRef.current.updateTopicProgress(topic.id, { quizAttempted: true, quizScore: score });
        if (score >= 70) markTopicCompleted(currentTopicIndex);

        // Feed the result back into the student profile used for future slides and quizzes
        QuizStorage.saveQuizResults({
            source: 'topic_quiz',
            topicId: topic?.id,
            score,
            correct,
            total: quizData.length,
            weak_topics: score < 70 && topic ? [topic.title] : [],
            misconceptions: missed.map(q => ({
                topic: topic?.title || 'General',
                misconception: q.misconception || q.text,
                explanation: q.explanation || ''
            }))
        });
        const updatedProfile = QuizStorage.getStudentProfile();
        setKnowledgeLevel(updatedProfile.knowledgeLevel);
        safeStorage.set('knowledge_level', updatedProfile.knowledgeLevel);
        if (engineRef.current) engineRef.current.knowledgeLevel = updatedProfile.knowledgeLevel;

        evaluateLoad();
        refreshMisconceptions(trackerRef.current, engineRef.current);

        const missedSummary = missed.length ? ` Missed questions: ${missed.map(q => q.text).join(' | ').slice(0, 400)}` : '';
        await addSlide(currentTopicIndex, 'quiz-results', `Quiz score: ${score}% (${correct}/${quizData.length}).${missedSummary}`);
    };

    const resetQuizState = () => {
        setQuizData(null);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setQuizScore(null);
        setQuizCompleted(false);
        setQuizStarted(false);
    };

    const handleRestartQuiz = () => {
        resetQuizState();
        setActiveView(null);
    };

    const handleClosePane = () => {
        resetQuizState();
        setActiveView(null);
        setUserQuestion('');
    };

    // =========================================================
    // OTHER ACTIONS
    // =========================================================
    const handleExplainMore = async () => {
        setShowHelpOffer(false);
        await addSlide(currentTopicIndex, 'explain-more', 'Detailed explanation');
        setActiveView(null);
    };

    /** Re-explain the current topic in simpler words (used for overloaded students and by the avatar). */
    const handleSimplifiedExplanation = async (context) => {
        setShowHelpOffer(false);
        setActiveView(null);
        return addSlide(currentTopicIndex, 'simplified-explanation', typeof context === 'string' ? context : '');
    };

    const getNotesData = () => ({
        lectureTitle: lecturePlan?.topic,
        instructor: lecturePlan?.instructor,
        goal: studentGoal,
        knowledgeLevel,
        topics: engineRef.current?.enhancedTopics || [],
        slides: slidesRef.current,
        quizReviews,
        quizHistory,
        misconceptions: trackerRef.current?.getTopMisconceptions(10) || []
    });

    const handleAskQuestion = async (question) => {
        const text = (question || '').trim();
        if (!text) return;
        setShowHelpOffer(false);
        setUserQuestion('');
        setActiveView(null);
        await addSlide(currentTopicIndex, 'ask-question', text);
    };

    const handleRestartSession = () => {
        const id = sessionIdRef.current;
        safeStorage.remove(SESSION_KEY);
        if (id) {
            ['session_progress_', 'intelligence_engine_state_', 'learning_progress_', 'session_'].forEach(prefix => safeStorage.remove(`${prefix}${id}`));
        }
        progressRef.current = {};
        window.location.reload();
    };

    const dismissError = () => setError(null);

    return {
        // State
        sessionId, loading, loadingMessage, error, fatalError,
        lecturePlan, totalTopics, currentTopicIndex, topicsCompleted,
        studentGoal, knowledgeLevel, cognitiveLoad, loadScore, behaviorScore, lastGeneratedSlideId,
        slides, currentSlideIndex, currentSlideData,
        quizStarted, quizData, quizCompleted, quizScore, currentQuestionIndex, selectedAnswer,
        activeView, userQuestion, showHelpOffer, showProgressModal,
        misconceptions, adaptiveSuggestions, quizHistory,
        intelligenceEngine, misconceptionTracker,
        canGoNext, nextLabel,

        // Setters
        setActiveView, setShowProgressModal, setShowHelpOffer, setUserQuestion,

        // Actions
        handleNextSlide, handlePreviousSlide, jumpToTopic,
        handleTakeQuiz, handleQuizAnswer, handleSubmitAnswer, handleNextQuestion, handleRestartQuiz, handleClosePane,
        getAdaptiveQuizDifficulty,
        handleExplainMore, handleAskQuestion, handleSimplifiedExplanation, handleRestartSession, dismissError,
        setExternalLoad, getNotesData
    };
};
