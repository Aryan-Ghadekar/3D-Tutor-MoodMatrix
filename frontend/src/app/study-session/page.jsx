"use client";

import { useTheme } from "../theme-provider";
import { cognitiveAPI, quizAPI, helpAPI } from '@/lib/api';
import {
  ChevronLeft, ChevronRight, Play, Pause, Volume2, Maximize2, Settings,
  Share2,
  RotateCcw, Brain, HelpCircle, MessageCircle, Zap, Download, Mic,
  FileQuestion,
  AlertCircle, Send, Check, X as XIcon, TrendingUp, RefreshCw, Clock,
  User,
  ChevronDown, Sparkles, Activity, Target, TrendingDown, Lightbulb, Award,
  BarChart3, Trophy, Star, Eye, Ear, Hand, BrainCircuit, Cpu, GitBranch,
  Layers, Network, ZapOff, BookOpen, Video, Headphones, Type,
  AlertTriangle,
  ThumbsUp, Rocket, GraduationCap, Target as TargetIcon, Sparkle as
  SparkleIcon,
  Shield, ShieldCheck, Timer, Repeat, GitCompare, PieChart, Coffee, Moon,
  Sunrise, Battery, BatteryCharging, BatteryFull, BatteryLow,
  ThermometerSun,
  ThermometerSnowflake, Brain as BrainIcon, Heart, HeartPulse, EyeOff,
  Focus,
  GitPullRequest, GitCommit, GitMerge, Sigma, Percent, Target as
  Crosshair,
  RotateCw as RotateCwIcon, PauseCircle, PlayCircle, SkipBack,
  SkipForward,
  FastForward, Rewind, MicOff, VolumeX, Wifi, WifiOff, Cloud, CloudOff,
  DownloadCloud, UploadCloud, Database, HardDrive, MemoryStick, Cctv,
  Coffee as CoffeeIcon, Bed, BatteryMedium, AlertOctagon, Smile, Frown,
  Meh,
  CloudRain, Sun, CloudSun, Wind, Thermometer, ClipboardCheck, ClipboardX,
  TestTube, Beaker, Search, Filter, GitGraph, Layers2, CircuitBoard,
  Cpu as CpuIcon, DatabaseZap, BrainCog, UserCheck, UserX, Scale, GitFork,
  ArrowLeftRight, RefreshCcw as RefreshCcwIcon, Rotate3d, TestTube2,
  Microscope, Stethoscope, HeartBeat, ActivitySquare, Brain as
  BrainActivity
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

export default function StudySessionPage() {
  const { theme } = useTheme();

  // ========== CORE STATES ==========
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [activeView, setActiveView] = useState(null);
  const [avatarQuestion, setAvatarQuestion] = useState("");
  const [userQuestion, setUserQuestion] = useState("");

  // ========== COGNITIVE LOAD STATES ==========
  const [cognitiveLoad, setCognitiveLoad] = useState(0.45);
  const [loadHistory, setLoadHistory] = useState([]);

  // ========== MISTAKE AWARENESS SYSTEM ==========
  const [learningInsights, setLearningInsights] = useState([]);
  const [showMistakeInsight, setShowMistakeInsight] = useState(false);
  const [currentInsight, setCurrentInsight] = useState(null);

  // ========== MISCONCEPTION TRACKING ==========
  const [misconceptions, setMisconceptions] = useState([]);
  const [conceptsMastered, setConceptsMastered] = useState([]);

  // ========== INTERVENTION STATES ==========
  const [showIntervention, setShowIntervention] = useState(false);
  const [currentIntervention, setCurrentIntervention] = useState(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakTimer, setBreakTimer] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);

  // ========== APPROACH TRACKING STATES ==========
  const [freshWrongCount, setFreshWrongCount] = useState(0);
  const [freshWrongConcepts, setFreshWrongConcepts] = useState([]);
  const [tiredCorrectCount, setTiredCorrectCount] = useState(0);
  const [tiredWrongCount, setTiredWrongCount] = useState(0);
  const [postBreakTests, setPostBreakTests] = useState([]);

  // ========== DIAGNOSTIC TESTING STATES ==========
  const [diagnosticState, setDiagnosticState] = useState({
    active: false,
    type: null,
    originalQuestion: null,
    concept: null,
    preBreakAnswer: null,
    postBreakQuestion: null,
    result: null
  });

  // ========== ACHIEVEMENT SYSTEM ==========
  const [achievements, setAchievements] = useState([
    { id: "first_mistake", name: "Learning Started", description: "Made first mistake and learned from it", icon: "🎯", earned: false, progress: 0 },
    { id: "quick_learner", name: "Fast Learner", description: "Corrected 3 mistakes in a row", icon: "⚡", earned: false, progress: 0 },
    { id: "persistence", name: "Never Give Up", description: "Attempted quiz 3 times on same concept", icon: "🛡️", earned: false, progress: 0 },
    { id: "concept_master", name: "Concept Master", description: "Mastered 5 different concepts", icon: "🏆", earned: false, progress: 0 },
    { id: "load_manager", name: "Zen Master", description: "Maintained optimal cognitive load for 10 minutes", icon: "🧘", earned: false, progress: 0 },
    { id: "style_adapt", name: "Adaptive Learner", description: "Used 3 different learning styles", icon: "🎭", earned: false, progress: 0 },
    { id: "question_expert", name: "Socrates", description: "Asked 10 intelligent questions", icon: "💭", earned: false, progress: 0 },
    { id: "multimodal", name: "360° Learner", description: "Used all learning modes", icon: "🔄", earned: false, progress: 0 },
    { id: "misconception_detective", name: "Misconception Detective", description: "Identified and corrected 3 misconceptions", icon: "🔍", earned: false, progress: 0 },
    { id: "fatigue_manager", name: "Fatigue Manager", description: "Successfully managed fatigue 5 times", icon: "⚡", earned: false, progress: 0 }
  ]);

  const [showAchievement, setShowAchievement] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);

  // ========== PREDICTIVE RECOMMENDATIONS ==========
  const [predictions, setPredictions] = useState({
    nextBestTopic: "Convolutional Neural Networks",
    estimatedMasteryTime: "45 minutes",
    prerequisiteCheck: ["Neural Networks Basics", "Activation Functions"],
    suggestedResources: [
      { type: "video", title: "CNN Visual Guide", duration: "8 min" },
      { type: "interactive", title: "CNN Layer Builder", duration: "15 min" },
      { type: "quiz", title: "CNN Quick Check", questions: 5 }
    ],
    optimalLearningPath: ["CNN Basics", "Pooling Layers", "Real Applications"],
    confidenceScore: 0.85
  });

  // ========== DYNAMIC CONTENT GENERATION ==========
  const [explanationStyles, setExplanationStyles] = useState([
    { id: "visual", name: "Visual", icon: <Eye className="w-4 h-4" />, description: "Diagrams & flowcharts", used: true },
    { id: "analogy", name: "Analogy", icon: <GitCompare className="w-4 h-4" />, description: "Real-world comparisons", used: false },
    { id: "technical", name: "Technical", icon: <Cpu className="w-4 h-4" />, description: "Detailed specifications", used: true },
    { id: "story", name: "Story", icon: <BookOpen className="w-4 h-4" />, description: "Narrative approach", used: false },
    { id: "interactive", name: "Interactive", icon: <Hand className="w-4 h-4" />, description: "Hands-on simulation", used: false }
  ]);

  const [currentStyle, setCurrentStyle] = useState("visual");

  // ========== MULTIMODAL LEARNING ==========
  const [learningModes, setLearningModes] = useState([
    { id: "text", name: "Text", icon: <Type className="w-5 h-5" />, active: true },
    { id: "visual", name: "Visual", icon: <Eye className="w-5 h-5" />, active: true },
    { id: "audio", name: "Audio", icon: <Headphones className="w-5 h-5" />, active: false },
    { id: "interactive", name: "Interactive", icon: <Hand className="w-5 h-5" />, active: false },
    { id: "video", name: "Video", icon: <Video className="w-5 h-5" />, active: false }
  ]);

  // ========== SOCRATIC QUESTIONING ==========
  const [socraticMode, setSocraticMode] = useState({
    active: false,
    currentDepth: 0,
    maxDepth: 3,
    questions: [],
    scaffolding: true
  });

  // ========== REAL-TIME CONCEPT SIMPLIFICATION (ELI5 Mode) ==========
  const [eli5Mode, setEli5Mode] = useState({
    active: false,
    level: 3,
    originalContent: "",
    simplifiedContent: "",
    analogiesUsed: []
  });

  // ========== LEARNING STYLE ADAPTATION ==========
  const [learningStyle, setLearningStyle] = useState({
    detected: "visual",
    confidence: 0.75,
    preferences: {
      visual: 0.9,
      auditory: 0.4,
      kinesthetic: 0.6,
      reading: 0.8
    },
    adaptationActive: true
  });

  // ========== QUIZ STATES ==========
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizScore, setQuizScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // ========== SESSION TRACKING ==========
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const userId = 1;

  // ========== LEARNING DATA ==========
  const [learningData, setLearningData] = useState({
    mistakes: [],
    questionsAsked: [],
    quizAttempts: 0,
    totalTime: 0,
    breaksTaken: 0,
    fatigueErrors: 0,
    confirmedMisconceptions: 0,
    conceptsMastered: []
  });

  // ========== HELP OFFER SYSTEM ==========
  const [showHelpOffer, setShowHelpOffer] = useState(false);
  const [lastHelpOfferTime, setLastHelpOfferTime] = useState(0);

  // ========== QUESTION BANK (10 Questions with variations) ==========
  const [allQuestions] = useState([
    // EASY
    {
      id: 1,
      question: "What is the primary function of an activation function in neural networks?",
      options: ["Introduce non-linearity", "Reduce parameters", "Increase speed", "Store memory"],
      correct: 0,
      difficulty: "easy",
      concept: "activation_functions",
      explanation: "Activation functions introduce non-linearity, allowing neural networks to learn complex patterns.",
      explanationStyles: {
        visual: "Think of activation functions as decision gates in a flowchart",
        analogy: "Like water filters that only allow certain patterns through",
        technical: "Mathematical functions that determine neuron output",
        story: "Imagine each neuron as a team member who says 'yes' or 'no' to pass information"
      },
      variations: [
        "Why do neural networks need activation functions?",
        "What would happen without activation functions in neural networks?"
      ]
    },
    {
      id: 2,
      question: "What type of problem are neural networks particularly good at solving?",
      options: ["Non-linear, complex problems", "Simple arithmetic", "Linear regression only", "Database queries"],
      correct: 0,
      difficulty: "easy",
      concept: "neural_networks_basics",
      explanation: "Neural networks excel at complex non-linear problems due to their layered structure.",
      explanationStyles: {
        visual: "Like a multi-layer filter that catches complex patterns",
        analogy: "Similar to how our brain recognizes faces - not simple rules",
        technical: "Multi-layer perceptrons can approximate any continuous function",
        story: "A team where each member spots different patterns, combining to solve complex puzzles"
      },
      variations: [
        "Which type of problems are best suited for neural networks?",
        "What makes neural networks different from traditional algorithms?"
      ]
    },
    {
      id: 3,
      question: "What are the basic building blocks of neural networks?",
      options: ["Neurons", "Algorithms", "Databases", "Functions"],
      correct: 0,
      difficulty: "easy",
      concept: "neural_networks_basics",
      explanation: "Neurons are the basic processing units that mimic biological neurons.",
      explanationStyles: {
        visual: "Like tiny decision-making units connected in a network",
        analogy: "Similar to workers in a factory assembly line",
        technical: "Computational units with weights, biases, and activation functions",
        story: "Imagine a city where each citizen (neuron) processes information and talks to neighbors"
      },
      variations: [
        "What are the fundamental units of a neural network?",
        "Neural networks are composed of interconnected what?"
      ]
    },
    // MEDIUM
    {
      id: 4,
      question: "Which decade saw the first conceptualization of neural networks?",
      options: ["1940s", "1960s", "1980s", "2000s"],
      correct: 0,
      difficulty: "medium",
      concept: "neural_history",
      explanation: "Neural networks were first conceptualized in the 1940s with the McCulloch-Pitts neuron model.",
      explanationStyles: {
        visual: "Timeline showing 1943 as the birth year",
        analogy: "Like the invention of the wheel for AI",
        technical: "McCulloch and Pitts proposed the first mathematical model of a neuron",
        story: "During WWII, scientists dreamed of creating artificial brains"
      },
      variations: [
        "When were neural networks first proposed?",
        "In which decade did neural network research begin?"
      ]
    },
    {
      id: 5,
      question: "What is backpropagation primarily used for in neural networks?",
      options: ["Weight adjustment during training", "Data preprocessing", "Model deployment", "Feature extraction"],
      correct: 0,
      difficulty: "medium",
      concept: "backpropagation",
      explanation: "Backpropagation adjusts weights by calculating gradient of loss function.",
      explanationStyles: {
        visual: "Error flowing backward through network layers",
        analogy: "Like a teacher correcting homework and explaining mistakes backward",
        technical: "Gradient descent algorithm applied to neural network weights",
        story: "The network learns from its mistakes by tracing them back to their source"
      },
      variations: [
        "What is the purpose of backpropagation?",
        "Which process helps neural networks learn from mistakes?"
      ]
    },
    {
      id: 6,
      question: "What does 'deep' in deep learning refer to?",
      options: ["Multiple hidden layers", "Complex mathematics", "Large datasets", "Powerful computers"],
      correct: 0,
      difficulty: "medium",
      concept: "deep_learning",
      explanation: "'Deep' refers to neural networks with many hidden layers between input and output.",
      explanationStyles: {
        visual: "Stacked layers like a multi-story building",
        analogy: "Like a management hierarchy with many levels",
        technical: "Neural networks with >3 hidden layers",
        story: "A deep organization where information gets refined at each level"
      },
      variations: [
        "What makes a neural network 'deep'?",
        "How is deep learning different from shallow learning?"
      ]
    },
    {
      id: 7,
      question: "Which activation function is commonly used in output layer for binary classification?",
      options: ["Sigmoid", "ReLU", "Tanh", "Linear"],
      correct: 0,
      difficulty: "medium",
      concept: "activation_functions",
      explanation: "Sigmoid outputs values between 0 and 1, ideal for probability in binary classification.",
      explanationStyles: {
        visual: "S-shaped curve mapping to probabilities",
        analogy: "Like a dimmer switch that gives varying levels of certainty",
        technical: "σ(x) = 1/(1 + e^(-x)) produces probability outputs",
        story: "The network's way of saying 'how sure I am' from 0% to 100%"
      },
      variations: [
        "Which function is best for probability outputs?",
        "What activation function gives values between 0 and 1?"
      ]
    },
    // HARD
    {
      id: 8,
      question: "What problem does the vanishing gradient affect in deep networks?",
      options: ["Early layers learn very slowly", "Overfitting to training data", "Memory consumption increases", "Training speed decreases"],
      correct: 0,
      difficulty: "hard",
      concept: "training_problems",
      explanation: "Vanishing gradient causes early layers to learn slowly as gradients become extremely small.",
      explanationStyles: {
        visual: "Signal fading as it travels through many layers",
        analogy: "Like a whisper getting lost in a long hallway",
        technical: "Gradient magnitude decreases exponentially with backpropagation depth",
        story: "Frontline workers not getting feedback from the final result"
      },
      variations: [
        "What happens in vanishing gradient problem?",
        "Why do deep networks sometimes learn slowly?"
      ]
    },
    {
      id: 9,
      question: "What is the purpose of dropout in neural networks?",
      options: ["Prevent overfitting", "Increase training speed", "Reduce memory usage", "Simplify architecture"],
      correct: 0,
      difficulty: "hard",
      concept: "regularization",
      explanation: "Dropout randomly ignores neurons during training to prevent overfitting.",
      explanationStyles: {
        visual: "Random neurons temporarily removed during training",
        analogy: "Like cross-training employees so no single person becomes critical",
        technical: "Stochastic regularization technique that prevents co-adaptation",
        story: "Training the team to be resilient even when some members are absent"
      },
      variations: [
        "How does dropout help neural networks?",
        "What problem does dropout regularization solve?"
      ]
    },
    {
      id: 10,
      question: "What does batch normalization help with in deep learning?",
      options: ["Stabilizing and accelerating training", "Reducing model size", "Increasing accuracy directly", "Simplifying hyperparameters"],
      correct: 0,
      difficulty: "hard",
      concept: "optimization",
      explanation: "Batch normalization stabilizes training by normalizing layer inputs.",
      explanationStyles: {
        visual: "Data distribution kept consistent across layers",
        analogy: "Like maintaining consistent temperature in a factory",
        technical: "Normalizes mean and variance of each mini-batch",
        story: "Keeping the work environment stable so each department performs optimally"
      },
      variations: [
        "What is the benefit of batch normalization?",
        "How does batch normalization improve training?"
      ]
    }
  ]);

  const [adaptiveQuestions, setAdaptiveQuestions] = useState([]);
  const totalSlides = 9;
  const breakTimerRef = useRef(null);
  const confidenceLevel = useRef(0.7);

  // ========== SIMULATED COGNITIVE LOAD UPDATES ==========
  useEffect(() => {
    const interval = setInterval(() => {
      const change = (Math.random() - 0.5) * 0.08;
      setCognitiveLoad(prev => {
        const newLoad = Math.max(0.1, Math.min(0.95, prev + change));
        setLoadHistory(prevHistory => {
          const newHistory = [...prevHistory, { timestamp: Date.now(), load: newLoad }];
          return newHistory.slice(-20);
        });
        return newLoad;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ========== HELPER FUNCTIONS ==========
  const findSimilarQuestion = (concept, excludeId = null) => {
    const questions = allQuestions.filter(q => q.concept === concept && q.id !== excludeId);
    if (questions.length > 0) {
      return { ...questions[0], isDiagnostic: true };
    }
    const questionWithVariations = allQuestions.find(q => q.concept === concept);
    if (questionWithVariations && questionWithVariations.variations) {
      const variationIndex = Math.floor(Math.random() * questionWithVariations.variations.length);
      return {
        ...questionWithVariations,
        id: questionWithVariations.id * 100,
        question: questionWithVariations.variations[variationIndex],
        isDiagnostic: true
      };
    }
    return null;
  };

  const isTired = cognitiveLoad > 0.7;
  const isFresh = cognitiveLoad < 0.4;

  // ========== MISTAKE AWARENESS SYSTEM ==========
  const showLearningInsight = useCallback((insight) => {
    // It will only show if actually learned (concept mastered or corrected misconception)
    if (insight.type === 'concept_mastered' || (insight.type === 'mistake_identified' && learningData.mistakes.length > 0)) {
      setCurrentInsight(insight);
      setShowMistakeInsight(true);
      setTimeout(() => {
        setShowMistakeInsight(false);
      }, 5000);
      setLearningInsights(prev => [insight, ...prev.slice(0, 4)]);
    }
  }, [learningData.mistakes]);

  // ========== ACHIEVEMENT SYSTEM ==========
  const checkAndUnlockAchievements = useCallback(() => {
    const newAchievements = [...achievements];
    let unlocked = null;
    
    // First mistake AND actually learned from it (has explanation shown)
    if (learningData.mistakes.length >= 1 && !achievements[0].earned && showExplanation) {
      newAchievements[0].earned = true;
      newAchievements[0].progress = 100;
      unlocked = newAchievements[0];
    }

    const recentMistakes = learningData.mistakes.filter(m => Date.now() - m.timestamp < 300000);
    const recentCorrect = learningData.mistakes.length - recentMistakes.length;
    
    if (recentCorrect >= 3 && !achievements[1].earned) {
      newAchievements[1].earned = true;
      newAchievements[1].progress = 100;
      unlocked = newAchievements[1];
    }

    if (learningData.quizAttempts >= 3 && !achievements[2].earned) {
      newAchievements[2].earned = true;
      newAchievements[2].progress = 100;
      unlocked = newAchievements[2];
    }

    const uniqueConcepts = [...new Set(learningData.conceptsMastered)];
    if (uniqueConcepts.length >= 5 && !achievements[3].earned) {
      newAchievements[3].earned = true;
      newAchievements[3].progress = 100;
      unlocked = newAchievements[3];
    }

    if (misconceptions.length >= 3 && !achievements[8].earned) {
      newAchievements[8].earned = true;
      newAchievements[8].progress = 100;
      unlocked = newAchievements[8];
    }

    if (postBreakTests.filter(t => t.result === 'fatigue').length >= 5 && !achievements[9].earned) {
      newAchievements[9].earned = true;
      newAchievements[9].progress = 100;
      unlocked = newAchievements[9];
    }

    if (unlocked) {
      setAchievements(newAchievements);
      setNewAchievement(unlocked);
      setShowAchievement(true);
      setTimeout(() => {
        setShowAchievement(false);
      }, 4000);
    }
  }, [achievements, learningData, misconceptions, postBreakTests, showExplanation]);

  // ========== SCENARIO 1: Fresh + Confident + Wrong = MISCONCEPTION ==========
  const handleApproach1 = useCallback((question, isCorrect) => {
    if (isFresh && !isCorrect && confidenceLevel.current > 0.6) {
      console.log("🎯 APPROACH 1: Fresh + Confident + Wrong = MISCONCEPTION");
      setFreshWrongCount(prev => prev + 1);
      setFreshWrongConcepts(prev => {
        if (!prev.includes(question.concept)) {
          return [...prev, question.concept];
        }
        return prev;
      });
      
      setMisconceptions(prev => {
        const existing = prev.find(m => m.concept === question.concept);
        if (existing) {
          return prev.map(m =>
            m.concept === question.concept
              ? { ...m, count: m.count + 1, lastSeen: Date.now() }
              : m
          );
        }
        return [...prev, {
          concept: question.concept,
          questionId: question.id,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: 1,
          confirmed: true,
          type: 'fresh_confident_wrong'
        }];
      });

      setCurrentIntervention({
        type: "APPROACH_1",
        title: "🧠 Concept Clarification Needed",
        message: `You seem confident but got this wrong about "${question.concept.replace(/_/g, ' ')}". This suggests a misconception that needs clarification.`,
        actions: [
          {
            label: "Explain Now",
            action: () => {
              setShowExplanation(true);
              setShowIntervention(false);
            }
          },
          {
            label: "Practice Similar Question",
            action: () => {
              const similarQuestion = findSimilarQuestion(question.concept, question.id);
              if (similarQuestion) {
                setAdaptiveQuestions(prev => [...prev, similarQuestion]);
                setCurrentQuestionIndex(prev.length);
              }
              setShowIntervention(false);
            }
          }
        ],
        concept: question.concept,
        immediateAction: true
      });
      setShowIntervention(true);
      return true;
    }
    return false;
  }, [isFresh]);

  // ========== SCENARIO 2.1: Tired + Correct = Light Revision/Suggest Break ==========
  const handleApproach2_1 = useCallback((question, isCorrect) => {
    if (isTired && isCorrect) {
      console.log("⚡ APPROACH 2.1: Tired + Correct = Light Revision/Break Suggested");
      setTiredCorrectCount(prev => prev + 1);
      
      if (tiredCorrectCount >= 1) {
        setCurrentIntervention({
          type: "APPROACH_2_1",
          title: "⚡ Good Work Under Fatigue",
          message: "You're answering correctly despite being tired. However, learning retention may be lower. Consider lighter revision or a short break.",
          actions: [
            {
              label: "Switch to Light Revision",
              action: () => {
                const easyQuestions = allQuestions.filter(q => q.difficulty === "easy");
                setAdaptiveQuestions(easyQuestions.slice(0, 3));
                setCurrentQuestionIndex(0);
                setShowIntervention(false);
              }
            },
            {
              label: "Take Short Break",
              action: () => startBreak(90)
            },
            {
              label: "Continue as Is",
              action: () => {
                setShowIntervention(false);
                setCognitiveLoad(prev => Math.max(0.3, prev - 0.1));
              }
            }
          ],
          retentionWarning: true,
          concept: question.concept
        });
        setShowIntervention(true);
        return true;
      }
    }
    return false;
  }, [isTired, tiredCorrectCount]);

  // ========== SCENARIO 2.2: Tired + Wrong -> Diagnostic Break -> Test ==========
  const handleApproach2_2 = useCallback((question, isCorrect, userAnswerIndex) => {
    if (isTired && !isCorrect) {
      console.log("🔍 APPROACH 2.2: Tired + Wrong = Diagnostic Break → Test");
      setTiredWrongCount(prev => prev + 1);
      
      setDiagnosticState({
        active: true,
        type: 'fatigue_vs_misconception',
        originalQuestion: question,
        concept: question.concept,
        preBreakAnswer: userAnswerIndex,
        postBreakQuestion: null,
        result: null
      });

      setCurrentIntervention({
        type: "APPROACH_2_2",
        title: "🔍 Diagnostic Break Needed",
        message: "You're tired and answered wrong. Let's take a break, then test if it was fatigue or a real misunderstanding.",
        actions: [
          {
            label: "Take 2-min Diagnostic Break",
            action: () => {
              startBreak(120);
              setTimeout(() => {
                conductPostBreakTest(question);
              }, 125000);
            }
          }
        ],
        forceBreak: true,
        isDiagnostic: true,
        concept: question.concept
      });
      setShowIntervention(true);
      return true;
    }
    return false;
  }, [isTired]);

  // ========== NEW APPROACH: Low Load + Wrong = Explain More ==========
  const handleApproachLowLoadWrong = useCallback((question, isCorrect) => {
    if (cognitiveLoad < 0.4 && !isCorrect) {
      console.log("💡 APPROACH: Low Load + Wrong = Trigger Explain More");
      
      // Trigger Explain More view automatically
      setCurrentIntervention({
        type: "LOW_LOAD_WRONG",
        title: "💡 Need Clarification",
        message: `You're fresh but got this wrong. Let me explain "${question.concept.replace(/_/g, ' ')}" in a different way.`,
        actions: [
          {
            label: "Show Detailed Explanation",
            action: () => {
              setActiveView('explainMore');
              setShowIntervention(false);
              setShowExplanation(true);
            }
          },
          {
            label: "Try Similar Question",
            action: () => {
              const similarQuestion = findSimilarQuestion(question.concept, question.id);
              if (similarQuestion) {
                setAdaptiveQuestions(prev => [...prev, similarQuestion]);
                setCurrentQuestionIndex(prev.length);
              }
              setShowIntervention(false);
            }
          }
        ],
        concept: question.concept,
        immediateAction: true
      });
      setShowIntervention(true);
      return true;
    }
    return false;
  }, [cognitiveLoad]);

  // ========== CONDUCT POST-BREAK TEST ==========
  const conductPostBreakTest = useCallback((originalQuestion) => {
    const similarQuestion = findSimilarQuestion(originalQuestion.concept, originalQuestion.id);
    
    if (!similarQuestion) {
      const retryQuestion = { ...originalQuestion, isRetry: true };
      setDiagnosticState(prev => ({ ...prev, postBreakQuestion: retryQuestion }));
      setCurrentIntervention({
        type: "POST_BREAK_TEST",
        title: "🧪 Post-Break Diagnostic Test",
        message: `Now that you're rested, let's test "${originalQuestion.concept.replace(/_/g, ' ')}" again to see if it was fatigue or misunderstanding.`,
        question: retryQuestion,
        isTest: true,
        actions: [
          {
            label: "Start Diagnostic Test",
            action: () => {
              setShowIntervention(false);
              const newQuestions = [...adaptiveQuestions, retryQuestion];
              setAdaptiveQuestions(newQuestions);
              setCurrentQuestionIndex(newQuestions.length - 1);
            }
          }
        ]
      });
    } else {
      setDiagnosticState(prev => ({ ...prev, postBreakQuestion: similarQuestion }));
      setCurrentIntervention({
        type: "POST_BREAK_TEST",
        title: "🧪 Post-Break Diagnostic Test",
        message: `Now that you're rested, let's test your understanding of "${originalQuestion.concept.replace(/_/g, ' ')}" with a similar question.`,
        question: similarQuestion,
        isTest: true,
        actions: [
          {
            label: "Start Diagnostic Test",
            action: () => {
              setShowIntervention(false);
              const newQuestions = [...adaptiveQuestions, similarQuestion];
              setAdaptiveQuestions(newQuestions);
              setCurrentQuestionIndex(newQuestions.length - 1);
            }
          }
        ]
      });
    }
    setShowIntervention(true);
  }, [adaptiveQuestions]);

  // ========== HANDLE POST-BREAK TEST RESULT ==========
  const handlePostBreakTestResult = useCallback((question, isCorrect) => {
    if (!diagnosticState.active) return;
    
    console.log(`📊 POST-BREAK TEST RESULT: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
    
    if (isCorrect) {
      setDiagnosticState(prev => ({ ...prev, result: 'fatigue_confirmed' }));
      setLearningData(prev => ({
        ...prev,
        fatigueErrors: prev.fatigueErrors + 1
      }));

      setCurrentIntervention({
        type: "FATIGUE_CONFIRMED",
        title: "✅ Fatigue Error Confirmed",
        message: "Good! After rest, you got it right. The previous error was due to fatigue, not misunderstanding.",
        actions: [
          {
            label: "Continue Learning",
            action: () => {
              setShowIntervention(false);
              setDiagnosticState({ active: false, type: null, result: null });
            }
          },
          {
            label: "Review Anyway",
            action: () => {
              setShowIntervention(false);
              setShowExplanation(true);
              setDiagnosticState({ active: false, type: null, result: null });
            }
          }
        ]
      });
    } else {
      setDiagnosticState(prev => ({ ...prev, result: 'misconception_confirmed' }));
      setLearningData(prev => ({
        ...prev,
        confirmedMisconceptions: prev.confirmedMisconceptions + 1
      }));

      setMisconceptions(prev => {
        const existing = prev.find(m => m.concept === question.concept);
        if (existing) {
          return prev.map(m =>
            m.concept === question.concept
              ? {
                ...m,
                count: m.count + 1,
                lastSeen: Date.now(),
                confirmedPostBreak: true,
                diagnosticConfirmed: true
              }
              : m
          );
        }
        return [...prev, {
          concept: question.concept,
          questionId: question.id,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: 1,
          confirmed: true,
          confirmedPostBreak: true,
          diagnosticConfirmed: true,
          type: 'post_break_confirmed'
        }];
      });

      setCurrentIntervention({
        type: "MISCONCEPTION_CONFIRMED",
        title: "🧠 Misconception Confirmed",
        message: "Even after rest, this is still difficult. This confirms a genuine misunderstanding that needs proper explanation.",
        actions: [
          {
            label: "Explain Now",
            action: () => {
              setShowIntervention(false);
              setShowExplanation(true);
              setDiagnosticState({ active: false, type: null, result: null });
            }
          },
          {
            label: "More Practice",
            action: () => {
              const similarQuestions = allQuestions
                .filter(q => q.concept === question.concept && q.id !== question.id)
                .slice(0, 2);
              if (similarQuestions.length > 0) {
                setAdaptiveQuestions(prev => [...prev, ...similarQuestions]);
                setCurrentQuestionIndex(prev.length);
              }
              setShowIntervention(false);
              setDiagnosticState({ active: false, type: null, result: null });
            }
          }
        ],
        concept: question.concept,
        immediateTeaching: true
      });
    }

    setPostBreakTests(prev => [...prev, {
      concept: question.concept,
      timestamp: Date.now(),
      result: isCorrect ? 'fatigue' : 'misconception',
      loadBefore: cognitiveLoad,
      loadAfter: Math.max(0.3, cognitiveLoad - 0.2)
    }]);
    setShowIntervention(true);
  }, [diagnosticState, cognitiveLoad]);

  // ========== SCENARIO 2.3: Tired + Wrong + Misconception History = Break → Teach ==========
  const handleApproach2_3 = useCallback((question, isCorrect) => {
    const hasMisconceptionHistory = misconceptions.some(m =>
      m.concept === question.concept && m.count > 0
    );

    if (isTired && !isCorrect && hasMisconceptionHistory) {
      console.log("🎓 APPROACH 2.3: Tired + Wrong + History = Break → Teach");
      
      setCurrentIntervention({
        type: "APPROACH_2_3",
        title: "🎓 Known Difficulty Area",
        message: `You've struggled with "${question.concept.replace(/_/g, ' ')}" before and now you're tired. Let's rest first, then properly clarify this concept.`,
        actions: [
          {
            label: "Break Then Learn",
            action: () => {
              startBreak(120);
              setTimeout(() => {
                setCurrentIntervention({
                  type: "POST_BREAK_TEACH",
                  title: "📚 Time to Clarify",
                  message: `Now that you're rested, let's properly understand "${question.concept.replace(/_/g, ' ')}".`,
                  actions: [
                    {
                      label: "Start Learning",
                      action: () => {
                        setShowIntervention(false);
                        setShowExplanation(true);
                      }
                    }
                  ],
                  concept: question.concept
                });
                setShowIntervention(true);
              }, 125000);
            }
          }
        ],
        concept: question.concept,
        knownDifficulty: true
      });
      setShowIntervention(true);
      return true;
    }
    return false;
  }, [isTired, misconceptions]);

  // ========== BREAK SYSTEM ==========
  const startBreak = (seconds) => {
    setIsOnBreak(true);
    setShowBreakModal(true);
    setShowIntervention(false);
    setBreakTimer(seconds);
    setLearningData(prev => ({
      ...prev,
      breaksTaken: prev.breaksTaken + 1
    }));

    breakTimerRef.current = setInterval(() => {
      setBreakTimer(prev => {
        if (prev <= 1) {
          clearInterval(breakTimerRef.current);
          endBreak();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endBreak = () => {
    setIsOnBreak(false);
    setShowBreakModal(false);
    clearInterval(breakTimerRef.current);
    setCognitiveLoad(prev => Math.max(0.2, prev - 0.25));
    
    setCurrentIntervention({
      type: "POST_BREAK_REFRESH",
      title: "🔄 Break Complete!",
      message: "You should feel refreshed. Your cognitive load has reduced.",
      actions: [
        {
          label: "Continue Learning",
          action: () => setShowIntervention(false)
        }
      ]
    });
    setShowIntervention(true);
  };

  // ========== ADAPTIVE QUESTION GENERATION ==========
  const getAdaptiveQuestionsOld = useCallback(() => {
    const recentMistakes = learningData.mistakes.filter(
      m => Date.now() - m.timestamp < 300000
    );

    let filteredQuestions = [...allQuestions];

    if (learningStyle.adaptationActive) {
      const stylePref = learningStyle.detected;
      if (stylePref === "visual") {
        filteredQuestions = filteredQuestions.filter(q =>
          q.concept === "neural_networks_basics" ||
          q.concept === "activation_functions"
        );
      } else if (stylePref === "kinesthetic") {
        filteredQuestions = filteredQuestions.filter(q =>
          q.difficulty === "medium" || q.difficulty === "hard"
        );
      }
    }

    if (cognitiveLoad > 0.8) {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty === "easy");
    } else if (recentMistakes.length > 0) {
      const weakConcepts = [...new Set(recentMistakes.map(m => m.concept))];
      filteredQuestions = filteredQuestions.filter(q =>
        weakConcepts.some(concept => q.concept === concept)
      );

      // It only shows insight if we're actually adapting questions
      if (weakConcepts.length > 0 && filteredQuestions.length > 0) {
        showLearningInsight({
          type: "mistake_based",
          title: "🎯 Focusing on Weak Areas",
          message: `Based on your recent mistakes in ${weakConcepts.join(", ")}, we're adapting questions to help you improve.`,
          concept: weakConcepts[0]
        });
      }
    } else if (cognitiveLoad > 0.6) {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty !== "hard");
    }

    if (eli5Mode.active) {
      filteredQuestions = filteredQuestions.filter(q =>
        q.difficulty === "easy" || q.difficulty === "medium"
      );
    }

    const questionCount = Math.max(5, Math.min(10, Math.ceil(12 - cognitiveLoad * 8)));

    if (filteredQuestions.length === 0) {
      filteredQuestions = allQuestions.slice(0, questionCount);
    }

    return filteredQuestions.slice(0, questionCount);
  }, [cognitiveLoad, learningData.mistakes, learningStyle, eli5Mode, showLearningInsight]);

  // ========== ADAPTIVE QUESTION GENERATION ==========
  const getAdaptiveQuestionsNew = useCallback(() => {
    let filteredQuestions = [...allQuestions];

    if (isTired) {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty !== "hard");
      return filteredQuestions.slice(0, 5);
    }

    if (isFresh && freshWrongConcepts.length > 0) {
      filteredQuestions = filteredQuestions.filter(q =>
        freshWrongConcepts.includes(q.concept)
      );
    }

    if (isOnBreak || cognitiveLoad < 0.3) {
      filteredQuestions = filteredQuestions.filter(q =>
        q.difficulty === "easy" || q.difficulty === "medium"
      );
    }

    return filteredQuestions.slice(0, 7);
  }, [isTired, isFresh, freshWrongConcepts, isOnBreak, cognitiveLoad]);

  // ========== ADAPTIVE QUESTION GENERATION ==========
  const getAdaptiveQuestions = useCallback(() => {
    const oldQuestions = getAdaptiveQuestionsOld();
    const newQuestions = getAdaptiveQuestionsNew();
    const combinedQuestions = [...new Set([...oldQuestions, ...newQuestions])];

    if (isTired) {
      return combinedQuestions.filter(q => q.difficulty !== "hard").slice(0, 6);
    }

    if (isFresh && freshWrongConcepts.length > 0) {
      const focusedQuestions = combinedQuestions.filter(q =>
        freshWrongConcepts.includes(q.concept)
      );
      return focusedQuestions.length > 0 ? focusedQuestions.slice(0, 8) : combinedQuestions.slice(0, 8);
    }

    return combinedQuestions.slice(0, 10);
  }, [getAdaptiveQuestionsOld, getAdaptiveQuestionsNew, isTired, isFresh, freshWrongConcepts]);

  // ========== PREDICTIVE RECOMMENDATIONS ==========
  const updatePredictions = useCallback(() => {
    const recentMistakes = learningData.mistakes.filter(
      m => Date.now() - m.timestamp < 300000
    );
    const masteredConcepts = [...new Set(learningData.conceptsMastered)];

    let nextTopic = "Convolutional Neural Networks";
    let masteryTime = "45 minutes";
    let confidence = 0.85;

    if (recentMistakes.length > 0) {
      const weakConcept = recentMistakes[0].concept;
      if (weakConcept === "backpropagation") {
        nextTopic = "Gradient Descent Optimization";
        masteryTime = "30 minutes";
        confidence = 0.9;
      } else if (weakConcept === "activation_functions") {
        nextTopic = "Common Activation Functions Comparison";
        masteryTime = "25 minutes";
        confidence = 0.88;
      }
    }

    if (masteredConcepts.length >= 3) {
      nextTopic = "Advanced: Transformer Networks";
      masteryTime = "60 minutes";
      confidence = 0.75;
    }

    if (cognitiveLoad > 0.8) {
      nextTopic = "Review: Neural Network Fundamentals";
      masteryTime = "20 minutes";
      confidence = 0.95;
    }

    setPredictions(prev => ({
      ...prev,
      nextBestTopic: nextTopic,
      estimatedMasteryTime: masteryTime,
      confidenceScore: confidence
    }));
  }, [cognitiveLoad, learningData]);

  // ========== DYNAMIC CONTENT GENERATION ==========
  const generateExplanation = useCallback((question, style = null) => {
    const useStyle = style || currentStyle;
    const baseExplanation = question.explanation;

    if (eli5Mode.active && eli5Mode.level <= 2) {
      return `Think of it like this: ${question.explanationStyles.analogy || baseExplanation}`;
    }

    return question.explanationStyles[useStyle] || baseExplanation;
  }, [currentStyle, eli5Mode]);

  // ========== MULTIMODAL LEARNING ==========
  const toggleLearningMode = useCallback((modeId) => {
    setLearningModes(prev =>
      prev.map(mode =>
        mode.id === modeId
          ? { ...mode, active: !mode.active }
          : mode
      )
    );

    const activatedModes = learningModes.filter(m => m.active).length + 1;
    if (activatedModes >= 3) {
      const newAchievement = achievements.find(a => a.id === "multimodal");
      if (newAchievement && !newAchievement.earned) {
        setAchievements(prev =>
          prev.map(ach =>
            ach.id === "multimodal"
              ? { ...ach, earned: true, progress: 100 }
              : ach
          )
        );
        setNewAchievement(newAchievement);
        setShowAchievement(true);
        setTimeout(() => setShowAchievement(false), 4000);
      }
    }
  }, [learningModes, achievements]);

  // ========== SOCRATIC QUESTIONING ==========
  const askSocraticQuestion = useCallback((concept) => {
    const questions = {
      activation_functions: [
        "Why do you think we need activation functions?",
        "What would happen if all neurons used linear activation?",
        "How do different activation functions affect learning?",
        "Can you think of a real-world analogy for activation functions?"
      ],
      backpropagation: [
        "Why is backpropagation called 'backward' propagation?",
        "What problem does backpropagation solve?",
        "How does backpropagation relate to learning from mistakes?",
        "What would happen without backpropagation?"
      ]
    };

    const conceptQuestions = questions[concept] || [
      "What's the main idea here?",
      "How does this connect to what you already know?",
      "Why is this important?",
      "Can you explain this in your own words?"
    ];

    setSocraticMode(prev => ({
      ...prev,
      active: true,
      questions: conceptQuestions,
      currentDepth: 0
    }));
  }, []);

  // ========== REAL-TIME CONCEPT SIMPLIFICATION ==========
  const toggleELI5Mode = useCallback(() => {
    setEli5Mode(prev => {
      const newActive = !prev.active;
      const newLevel = newActive ? 2 : 3;

      if (newActive) {
        showLearningInsight({
          type: "simplification",
          title: "🧠 Simplified Mode Activated",
          message: "Explanations will now be super simple with real-world analogies.",
          concept: "all"
        });
      }

      return {
        ...prev,
        active: newActive,
        level: newLevel
      };
    });
  }, [showLearningInsight]);

  // ========== LEARNING STYLE ADAPTATION ==========
  const detectLearningStyle = useCallback(() => {
    const modes = learningModes.filter(m => m.active);
    const visualUsed = modes.some(m => m.id === "visual");
    const audioUsed = modes.some(m => m.id === "audio");
    const interactiveUsed = modes.some(m => m.id === "interactive");
    const readingUsed = modes.some(m => m.id === "text");

    let detectedStyle = "visual";
    let confidence = 0.75;

    if (interactiveUsed && !visualUsed && !audioUsed) {
      detectedStyle = "kinesthetic";
      confidence = 0.8;
    } else if (audioUsed && !visualUsed && !interactiveUsed) {
      detectedStyle = "auditory";
      confidence = 0.7;
    } else if (readingUsed && !visualUsed && !audioUsed) {
      detectedStyle = "reading";
      confidence = 0.85;
    }

    setLearningStyle(prev => ({
      ...prev,
      detected: detectedStyle,
      confidence: confidence,
      preferences: {
        visual: visualUsed ? 0.9 : 0.3,
        auditory: audioUsed ? 0.8 : 0.4,
        kinesthetic: interactiveUsed ? 0.9 : 0.5,
        reading: readingUsed ? 0.9 : 0.6
      }
    }));
  }, [learningModes]);

  // ========== SMART SUGGESTIONS ==========
  const getSmartSuggestion = useCallback(() => {
    const recentMistakes = learningData.mistakes.filter(
      m => Date.now() - m.timestamp < 300000
    );

    if (recentMistakes.length >= 2) {
      const concepts = [...new Set(recentMistakes.map(m => m.concept))];
      const conceptStr = concepts.length > 0 ? concepts.join(", ") : 'these concepts';
      
      let suggestedStyle = "analogy";
      if (learningStyle.detected === "visual") suggestedStyle = "visual";
      if (learningStyle.detected === "kinesthetic") suggestedStyle = "story";

      return {
        type: 'explanation',
        reason: `${recentMistakes.length} recent mistakes in ${conceptStr}`,
        message: `Let me explain ${conceptStr} using ${suggestedStyle} approach`,
        priority: 'high',
        suggestedStyle: suggestedStyle
      };
    }

    if (cognitiveLoad > 0.75) {
      return {
        type: 'quiz',
        reason: 'High cognitive load detected',
        message: 'Try a simplified quiz with easier questions',
        priority: 'high',
        simplified: true
      };
    }

    const recentBasicQuestions = learningData.questionsAsked.filter(
      q => q.isBasic && Date.now() - q.timestamp < 300000
    );

    if (recentBasicQuestions.length > 1) {
      return {
        type: 'socratic',
        reason: `${recentBasicQuestions.length} basic questions asked`,
        message: 'Let me guide you with thought-provoking questions',
        priority: 'medium',
        method: 'guided_discovery'
      };
    }

    if (learningData.conceptsMastered.length >= 2 && cognitiveLoad < 0.6) {
      return {
        type: 'advance',
        reason: 'Mastered foundational concepts',
        message: `Ready for: ${predictions.nextBestTopic}`,
        priority: 'medium',
        topic: predictions.nextBestTopic
      };
    }

    return {
      type: learningStyle.detected === 'visual' ? 'visual_explanation' : 'quiz',
      reason: 'Optimal learning state',
      message: `Based on your ${learningStyle.detected} learning style`,
      priority: 'low',
      personalized: true
    };
  }, [cognitiveLoad, learningData, learningStyle, predictions]);

  // ========== MAIN ANSWER HANDLER ==========
  const handleAnswerSelect = async (questionIndex, optionIndex) => {
    if (!adaptiveQuestions[questionIndex]) return;

    const question = adaptiveQuestions[questionIndex];
    const isCorrect = optionIndex === question.correct;

    confidenceLevel.current = isCorrect ?
      Math.min(1, confidenceLevel.current + 0.1) :
      Math.max(0.3, confidenceLevel.current - 0.15);

    if (question.isDiagnostic || question.isRetry) {
      handlePostBreakTestResult(question, isCorrect);
      if (isCorrect) {
        setQuizScore(prev => prev + 1);
      }
      const newAnswers = [...userAnswers];
      newAnswers[questionIndex] = optionIndex;
      setUserAnswers(newAnswers);
      return;
    }

    if (!handleApproach1(question, isCorrect)) {
      if (!handleApproach2_1(question, isCorrect)) {
        if (!handleApproach2_3(question, isCorrect)) {
          if (!handleApproachLowLoadWrong(question, isCorrect)) {
            handleApproach2_2(question, isCorrect, optionIndex);
          }
        }
      }
    }

    if (isCorrect) {
      setQuizScore(prev => prev + 1);
      if (!learningData.conceptsMastered.includes(question.concept)) {
        setLearningData(prev => ({
          ...prev,
          conceptsMastered: [...prev.conceptsMastered, question.concept]
        }));
        showLearningInsight({
          type: "concept_mastered",
          title: "✅ Concept Mastered!",
          message: `Great job! You've mastered "${question.concept.replace('_', ' ')}".`,
          concept: question.concept
        });
      }
    } else {
      showLearningInsight({
        type: "mistake_identified",
        title: "📝 Mistake Recorded",
        message: `We've noted your difficulty with "${question.concept.replace('_', ' ')}". Question #${question.id} will help reinforce this.`,
        concept: question.concept,
        questionId: question.id,
        difficulty: question.difficulty
      });
    }

    let loadChange = 0;
    if (isCorrect) {
      loadChange = question.difficulty === 'hard' ? -0.15 :
        question.difficulty === 'medium' ? -0.1 : -0.08;
    } else {
      loadChange = question.difficulty === 'easy' ? 0.2 :
        question.difficulty === 'medium' ? 0.15 : 0.1;
    }

    setCognitiveLoad(prev => {
      const newLoad = Math.min(0.95, Math.max(0.2, prev + loadChange));
      return newLoad;
    });

    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = optionIndex;
    setUserAnswers(newAnswers);

    setLearningData(prev => ({
      ...prev,
      mistakes: isCorrect ? prev.mistakes : [...prev.mistakes, {
        concept: question.concept,
        difficulty: question.difficulty,
        timestamp: Date.now(),
        load: cognitiveLoad,
        questionId: question.id,
        userAnswer: optionIndex,
        correctAnswer: question.correct,
        approach: getCurrentApproach(isCorrect)
      }]
    }));

    cognitiveAPI.recordLoad({
      userId,
      sessionId,
      loadValue: Math.round(cognitiveLoad * 100),
      activityData: {
        questionAnswered: true,
        correct: isCorrect,
        difficulty: question.difficulty,
        concept: question.concept,
        questionId: question.id,
        learningStyle: learningStyle.detected,
        eli5Mode: eli5Mode.active,
        approachUsed: getCurrentApproach(isCorrect),
        confidence: Math.round(confidenceLevel.current * 100)
      }
    });

    checkAndUnlockAchievements();

    if (!showIntervention) {
      setShowExplanation(true);
    }
  };

  const getCurrentApproach = (isCorrect) => {
    if (isFresh && !isCorrect && confidenceLevel.current > 0.6) return "APPROACH_1";
    if (cognitiveLoad < 0.4 && !isCorrect) return "LOW_LOAD_WRONG";
    if (isTired && isCorrect) return "APPROACH_2_1";
    if (isTired && !isCorrect) {
      const hasHistory = misconceptions.some(m => m.concept === adaptiveQuestions[currentQuestionIndex]?.concept);
      return hasHistory ? "APPROACH_2_3" : "APPROACH_2_2";
    }
    return "NO_SPECIAL_APPROACH";
  };

  // ========== INITIALIZE QUESTIONS ==========
  useEffect(() => {
    setAdaptiveQuestions(getAdaptiveQuestions());
  }, [getAdaptiveQuestions]);

  // ========== UPDATE PREDICTIONS ==========
  useEffect(() => {
    updatePredictions();
    const interval = setInterval(updatePredictions, 30000);
    return () => clearInterval(interval);
  }, [updatePredictions]);

  // ========== UPDATE LEARNING STYLE ==========
  useEffect(() => {
    detectLearningStyle();
  }, [learningModes, detectLearningStyle]);

  // ========== AUTO-HELP OFFER TRIGGER ==========
  useEffect(() => {
    const checkForHelpOffer = () => {
      const now = Date.now();
      const suggestion = getSmartSuggestion();
      const shouldShowHelp =
        (suggestion.priority === 'high' && cognitiveLoad > 0.7) ||
        (suggestion.priority === 'medium' && cognitiveLoad > 0.65 && (now - lastHelpOfferTime) > 180000) ||
        (now - lastHelpOfferTime > 300000);

      if (shouldShowHelp && !showHelpOffer && activeView === null) {
        setShowHelpOffer(true);
        setLastHelpOfferTime(now);
        helpAPI.recordOfferShown({
          userId,
          sessionId,
          triggerType: 'intelligent_suggestion',
          loadValue: Math.round(cognitiveLoad * 100),
          suggestion: suggestion
        });
      }
    };

    const interval = setInterval(checkForHelpOffer, 15000);
    return () => clearInterval(interval);
  }, [cognitiveLoad, learningData, showHelpOffer, activeView, lastHelpOfferTime, getSmartSuggestion]);

  // ========== HANDLER FUNCTIONS ==========
  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handleTakeQuiz = async () => {
    const freshQuestions = getAdaptiveQuestions();
    setAdaptiveQuestions(freshQuestions);
    if (freshQuestions.length === 0) return;

    await helpAPI.recordOfferShown({
      userId,
      sessionId,
      triggerType: 'user_selected_quiz',
      loadValue: Math.round(cognitiveLoad * 100)
    });

    setLearningData(prev => ({
      ...prev,
      quizAttempts: prev.quizAttempts + 1
    }));

    setActiveView('quiz');
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizScore(0);
    setShowResult(false);
    setShowExplanation(false);
  };

  const handleAskAvatar = async () => {
    await helpAPI.recordOfferShown({
      userId,
      sessionId,
      triggerType: 'avatar_selected',
      loadValue: Math.round(cognitiveLoad * 100)
    });
    setActiveView('askAvatar');
  };

  const handleAskQuestions = async () => {
    await helpAPI.recordOfferShown({
      userId,
      sessionId,
      triggerType: 'qa_selected',
      loadValue: Math.round(cognitiveLoad * 100)
    });
    setActiveView('askQuestions');
  };

  const handleExplainMore = () => {
    setActiveView('explainMore');
  };

  const handleSampleQuestion = async (question) => {
    const isBasic = question.toLowerCase().includes('what is') ||
      question.toLowerCase().includes('define') ||
      question.toLowerCase().includes('simple');

    setLearningData(prev => ({
      ...prev,
      questionsAsked: [
        ...prev.questionsAsked,
        {
          question,
          isBasic,
          timestamp: Date.now(),
          loadAtQuestion: cognitiveLoad
        }
      ]
    }));

    if (isBasic && cognitiveLoad > 0.7) {
      setCognitiveLoad(prev => Math.min(0.95, prev + 0.05));
    }

    console.log("Question asked:", question);
    setActiveView(null);
  };

  const handleNextQuestion = () => {
    setShowExplanation(false);
    if (currentQuestionIndex < adaptiveQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setShowResult(true);
      setQuizStarted(false);
      quizAPI.submitQuiz({
        userId,
        sessionId,
        topic: "neural_networks",
        questionCount: adaptiveQuestions.length,
        correctAnswers: quizScore,
        loadBefore: Math.round(cognitiveLoad * 100),
        loadAfter: Math.round(cognitiveLoad * 100),
        approachesUsed: {
          approach1: freshWrongCount,
          approach2_1: tiredCorrectCount,
          approach2_2: tiredWrongCount,
          approach2_3: misconceptions.filter(m => m.type === 'post_break_confirmed').length,
          postBreakTests: postBreakTests.length,
          fatigueConfirmed: postBreakTests.filter(t => t.result === 'fatigue').length,
          misconceptionConfirmed: postBreakTests.filter(t => t.result === 'misconception').length
        }
      });
    }
  };

  const handleClosePane = () => {
    setActiveView(null);
    setQuizStarted(false);
    setShowResult(false);
    setShowExplanation(false);
    setShowIntervention(false);
  };

  const handleRetryQuiz = () => {
    const freshQuestions = getAdaptiveQuestions();
    setAdaptiveQuestions(freshQuestions);
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizScore(0);
    setShowResult(false);
    setShowExplanation(false);
  };

  const handleSubmitAvatarQuestion = () => {
    if (avatarQuestion.trim()) {
      console.log("Avatar question:", avatarQuestion);
      setAvatarQuestion("");
      setActiveView(null);
    }
  };

  const handleSubmitUserQuestion = () => {
    if (userQuestion.trim()) {
      console.log("User question:", userQuestion);
      setUserQuestion("");
      setActiveView(null);
    }
  };

  const getLoadColor = (load) => {
    if (load > 0.7) return { 
      text: "text-red-600 dark:text-red-400", 
      bg: "bg-red-500 dark:bg-red-600", 
      lightBg: "bg-red-50 dark:bg-red-900", 
      border: "border-red-200 dark:border-red-800" 
    };
    if (load > 0.4) return { 
      text: "text-amber-600 dark:text-amber-400", 
      bg: "bg-amber-500 dark:bg-amber-600", 
      lightBg: "bg-amber-50 dark:bg-amber-900", 
      border: "border-amber-200 dark:border-amber-800" 
    };
    return { 
      text: "text-green-600 dark:text-green-400", 
      bg: "bg-green-500 dark:bg-green-600", 
      lightBg: "bg-green-50 dark:bg-green-900", 
      border: "border-green-200 dark:border-green-800" 
    };
  };

  const loadColor = getLoadColor(cognitiveLoad);
  const suggestion = getSmartSuggestion();
  const currentQuestion = adaptiveQuestions[currentQuestionIndex];

  const sampleQuestions = [
    "How do neurons process information in a neural network?",
    "What makes neural networks different from traditional algorithms?",
    "Why are multiple layers important in deep learning?",
    "How does a neural network learn from mistakes?",
    "What's the role of weights and biases in neurons?",
    "How does gradient descent optimization work?",
    "What are the types of neural networks?",
    "How do convolutional neural networks process images?"
  ];

  return (
    <div className={`h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} transition-colors flex flex-col overflow-hidden`}>

      {/* ========== LEARNING INSIGHT NOTIFICATION ========== */}
      {showMistakeInsight && currentInsight && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-2xl max-w-sm border-l-4 ${
            currentInsight.type === 'mistake_identified'
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900 dark:border-amber-700'
              : currentInsight.type === 'concept_mastered'
              ? 'border-green-500 bg-green-50 dark:bg-green-900 dark:border-green-700'
              : 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-700'
          }`}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  currentInsight.type === 'mistake_identified'
                    ? 'bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                    : currentInsight.type === 'concept_mastered'
                    ? 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300'
                    : 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                }`}>
                  {currentInsight.type === 'mistake_identified' ? '🎯' :
                   currentInsight.type === 'concept_mastered' ? '✅' : '💡'}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                    {currentInsight.title}
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                    {currentInsight.message}
                  </p>
                  {currentInsight.questionId && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>Question #{currentInsight.questionId} added to reinforcement set</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowMistakeInsight(false)}
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded"
                >
                  <XIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== ACHIEVEMENT UNLOCKED NOTIFICATION ========== */}
      {showAchievement && newAchievement && (
        <div className="fixed top-20 right-4 z-50 animate-bounce-in">
          <div className="rounded-xl shadow-2xl max-w-sm bg-gradient-to-r from-purple-500 to-pink-500 p-0.5">
            <div className="rounded-[10px] bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <SparkleIcon className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">ACHIEVEMENT UNLOCKED!</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm mt-1">
                    {newAchievement.name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {newAchievement.description}
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <span>🎉 Keep going!</span>
                <button
                  onClick={() => setActiveView('achievements')}
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  View all
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== INTERVENTION MODALS ========== */}
      {showIntervention && currentIntervention && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full transform transition-all ${theme === 'light' ? 'bg-white' : 'bg-gray-800'}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-full ${
                    currentIntervention.type === 'APPROACH_1' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' :
                    currentIntervention.type === 'APPROACH_2_1' ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400' :
                    currentIntervention.type === 'APPROACH_2_2' ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' :
                    currentIntervention.type === 'APPROACH_2_3' ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400' :
                    currentIntervention.type === 'POST_BREAK_TEST' ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' :
                    currentIntervention.type === 'FATIGUE_CONFIRMED' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400' :
                    currentIntervention.type === 'MISCONCEPTION_CONFIRMED' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' :
                    currentIntervention.type === 'LOW_LOAD_WRONG' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {currentIntervention.type === 'APPROACH_1' ? <Brain className="w-5 h-5" /> :
                     currentIntervention.type === 'APPROACH_2_1' ? <Zap className="w-5 h-5" /> :
                     currentIntervention.type === 'APPROACH_2_2' ? <TestTube className="w-5 h-5" /> :
                     currentIntervention.type === 'APPROACH_2_3' ? <GraduationCap className="w-5 h-5" /> :
                     currentIntervention.type === 'POST_BREAK_TEST' ? <ClipboardCheck className="w-5 h-5" /> :
                     currentIntervention.type === 'FATIGUE_CONFIRMED' ? <Check className="w-5 h-5" /> :
                     currentIntervention.type === 'MISCONCEPTION_CONFIRMED' ? <AlertCircle className="w-5 h-5" /> :
                     currentIntervention.type === 'LOW_LOAD_WRONG' ? <HelpCircle className="w-5 h-5" /> :
                     <HelpCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {currentIntervention.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${loadColor.bg}`}></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Load: {Math.round(cognitiveLoad * 100)}% • Confidence: {Math.round(confidenceLevel.current * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
                {!currentIntervention.forceBreak && (
                  <button
                    onClick={() => setShowIntervention(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className={`mb-6 p-4 rounded-lg border ${
                currentIntervention.type === 'APPROACH_1' ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800' :
                currentIntervention.type === 'APPROACH_2_1' ? 'bg-amber-50 dark:bg-amber-900/50 border-amber-200 dark:border-amber-800' :
                currentIntervention.type === 'APPROACH_2_2' ? 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800' :
                currentIntervention.type === 'APPROACH_2_3' ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-200 dark:border-purple-800' :
                currentIntervention.type === 'POST_BREAK_TEST' ? 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800' :
                currentIntervention.type === 'FATIGUE_CONFIRMED' ? 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800' :
                currentIntervention.type === 'MISCONCEPTION_CONFIRMED' ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800' :
                currentIntervention.type === 'LOW_LOAD_WRONG' ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800' :
                'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
              }`}>
                <p className="text-gray-800 dark:text-gray-300">
                  {currentIntervention.message}
                </p>
                {currentIntervention.retentionWarning && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Retention may be lower when learning while tired
                  </p>
                )}
                {currentIntervention.isDiagnostic && (
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-2 flex items-center gap-1">
                    <TestTube2 className="w-4 h-4" />
                    This is a diagnostic test to distinguish fatigue from misunderstanding
                  </p>
                )}
                {currentIntervention.type === 'LOW_LOAD_WRONG' && (
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-2 flex items-center gap-1">
                    <HelpCircle className="w-4 h-4" />
                    Let me explain this concept in a different way
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {currentIntervention.actions?.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                      index === 0
                        ? currentIntervention.type === 'APPROACH_1' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' :
                          currentIntervention.type === 'APPROACH_2_1' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' :
                          currentIntervention.type === 'APPROACH_2_2' ? 'border-red-500 bg-red-50 dark:bg-red-900/30' :
                          currentIntervention.type === 'APPROACH_2_3' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' :
                          currentIntervention.type === 'POST_BREAK_TEST' ? 'border-green-500 bg-green-50 dark:bg-green-900/30' :
                          currentIntervention.type === 'FATIGUE_CONFIRMED' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' :
                          currentIntervention.type === 'MISCONCEPTION_CONFIRMED' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' :
                          currentIntervention.type === 'LOW_LOAD_WRONG' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' :
                          'border-gray-500 bg-gray-50 dark:bg-gray-700'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {action.label}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== BREAK MODAL ========== */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl max-w-md w-full bg-gradient-to-br from-blue-900 to-purple-900 p-0.5">
            <div className="rounded-[15px] bg-gray-900 p-8">
              <div className="text-center">
                <div className="animate-pulse mb-6">
                  <Coffee className="w-16 h-16 mx-auto text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {diagnosticState.active ? "🔍 Diagnostic Break" : "☕ Take a Break"}
                </h2>
                <div className="text-5xl font-bold text-white my-8">
                  {Math.floor(breakTimer / 60)}:{String(breakTimer % 60).padStart(2, '0')}
                </div>
                <p className="text-gray-300 mb-6">
                  {diagnosticState.active
                    ? "Resting before diagnostic test to distinguish fatigue from misunderstanding..."
                    : "Step away from the screen. Your brain will thank you!"}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="text-center p-3 rounded-lg bg-gray-800">
                    <EyeOff className="w-6 h-6 mx-auto text-green-400 mb-2" />
                    <div className="text-sm text-gray-300">Rest your eyes</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-800">
                    <Wind className="w-6 h-6 mx-auto text-blue-400 mb-2" />
                    <div className="text-sm text-gray-300">Deep breaths</div>
                  </div>
                </div>
                <button
                  onClick={endBreak}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 transition font-semibold"
                >
                  End Break Early
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== SMART HELP OFFER MODAL ========== */}
      {showHelpOffer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full transform transition-all ${theme === 'light' ? 'bg-white' : 'bg-gray-800'}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-full ${loadColor.lightBg}`}>
                    <Brain className={`w-5 h-5 ${loadColor.text}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {suggestion.priority === 'high' ? '🚨 ' : '💡 '}
                      Learning Support
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${loadColor.bg}`}></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Cognitive load: {Math.round(cognitiveLoad * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelpOffer(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className={`mb-6 p-4 rounded-lg ${
                suggestion.type === 'quiz'
                  ? 'bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700'
                  : suggestion.type === 'explanation'
                  ? 'bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700'
                  : 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700'
              }`}>
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded ${
                    suggestion.type === 'quiz'
                      ? 'bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                      : suggestion.type === 'explanation'
                      ? 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300'
                      : 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                  }`}>
                    {suggestion.type === 'quiz' ? (
                      <FileQuestion className="w-4 h-4" />
                    ) : suggestion.type === 'explanation' ? (
                      <HelpCircle className="w-4 h-4" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-gray-800 dark:text-gray-300 font-medium">
                      {suggestion.message}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      📊 {suggestion.reason}
                      {learningData.mistakes.length > 0 && (
                        <span className="ml-2">
                          • {learningData.mistakes.length} recent {learningData.mistakes.length === 1 ? 'mistake' : 'mistakes'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowHelpOffer(false);
                    handleTakeQuiz();
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl text-left transition-all border-2 ${
                    suggestion.type === 'quiz'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900 shadow-md'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      suggestion.type === 'quiz'
                        ? 'bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <FileQuestion className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        Quick Quiz
                        {suggestion.type === 'quiz' && (
                          <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">
                            Suggested
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {learningData.mistakes.length > 0
                          ? `Focus on weak areas`
                          : 'Test your understanding'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => {
                    setShowHelpOffer(false);
                    handleExplainMore();
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl text-left transition-all border-2 ${
                    suggestion.type === 'explanation'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900 shadow-md'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      suggestion.type === 'explanation'
                        ? 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        Different Explanation
                        {suggestion.type === 'explanation' && (
                          <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                            Suggested
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        See concepts explained another way
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => {
                    setShowHelpOffer(false);
                    handleAskQuestions();
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl text-left transition-all border-2 ${
                    suggestion.type === 'qa'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 shadow-md'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      suggestion.type === 'qa'
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        Ask Questions
                        {suggestion.type === 'qa' && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                            Suggested
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Get clarification on specific points
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button
                  onClick={() => setShowHelpOffer(false)}
                  className="w-full p-3.5 text-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
                >
                  Continue without help
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className={`h-12 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex items-center px-6`}>
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">MoodMatrix AI</h1>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <div className={`px-3 py-1.5 rounded-md ${loadColor.lightBg} ${loadColor.text} border ${loadColor.border} text-sm font-semibold flex items-center gap-2`}>
              <Brain className="w-4 h-4" />
              {cognitiveLoad > 0.7 ? "High" : cognitiveLoad > 0.4 ? "Moderate" : "Low"} Cognitive Load
              <span className="text-xs">({Math.round(cognitiveLoad * 100)}%)</span>
            </div>
            <div className={`px-3 py-1.5 rounded-md ${
              learningStyle.detected === 'visual' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700' :
              learningStyle.detected === 'auditory' ? 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700' :
              learningStyle.detected === 'kinesthetic' ? 'bg-purple-50 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700' :
              'bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700'
            } text-sm font-semibold flex items-center gap-2`}>
              {learningStyle.detected === 'visual' ? <Eye className="w-4 h-4" /> :
               learningStyle.detected === 'auditory' ? <Headphones className="w-4 h-4" /> :
               learningStyle.detected === 'kinesthetic' ? <Hand className="w-4 h-4" /> :
               <BookOpen className="w-4 h-4" />}
              {learningStyle.detected.charAt(0).toUpperCase() + learningStyle.detected.slice(1)} Learner
            </div>
            {isTired && (
              <div className="px-3 py-1.5 rounded-md bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 text-sm font-semibold flex items-center gap-2">
                <Coffee className="w-4 h-4" />
                Tired
              </div>
            )}
            {freshWrongCount > 0 && (
              <div className="px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4" />
                {freshWrongCount} misconceptions
              </div>
            )}
            {postBreakTests.length > 0 && (
              <div className="px-3 py-1.5 rounded-md bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700 text-sm font-semibold flex items-center gap-2">
                <TestTube2 className="w-4 h-4" />
                {postBreakTests.length} diagnostics
              </div>
            )}
            <button
              onClick={() => setShowHelpOffer(true)}
              className={`text-sm px-3 py-1.5 rounded ${theme === 'light' ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300' : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border border-blue-700'} flex items-center gap-1.5 font-medium transition`}
            >
              <HelpCircle className="w-4 h-4" />
              Smart Help
            </button>
            <button
              onClick={toggleELI5Mode}
              className={`text-sm px-3 py-1.5 rounded flex items-center gap-1.5 font-medium transition ${
                eli5Mode.active
                  ? 'bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                  : theme === 'light'
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              {eli5Mode.active ? "Simple Mode" : "ELI5 Mode"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('achievements')}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition border border-gray-300 dark:border-gray-600"
          >
            <Trophy className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {achievements.filter(a => a.earned).length}
            </span>
          </button>
          <button className={`px-4 py-2 rounded-lg ${theme === 'light' ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300' : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border border-blue-700'} flex items-center gap-2 text-sm font-semibold transition`}>
            <Download className="w-4 h-4" />
            Download PPT
          </button>
          <button className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100 border border-gray-300' : 'hover:bg-gray-700 border border-gray-600'} transition`}>
            <Share2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          <button className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100 border border-gray-300' : 'hover:bg-gray-700 border border-gray-600'} transition`}>
            <Settings className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* ========== ACHIEVEMENTS VIEW ========== */}
      {activeView === 'achievements' && (
        <div className="absolute inset-0 z-30 bg-white dark:bg-gray-900 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-yellow-500" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Achievements</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {achievements.filter(a => a.earned).length} of {achievements.length} unlocked
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveView(null)}
                className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
              >
                <XIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {achievements.map((achievement, index) => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-xl border transition-all ${
                    achievement.earned
                      ? 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900 dark:to-amber-900 border-yellow-300 dark:border-yellow-700'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${
                      achievement.earned
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        : 'bg-gray-300 dark:bg-gray-700'
                    }`}>
                      <span className="text-xl">{achievement.icon}</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm ${
                        achievement.earned ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {achievement.name}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className={achievement.earned ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-500"}>
                        {achievement.earned ? "UNLOCKED" : "LOCKED"}
                      </span>
                      <span className="font-semibold">{achievement.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          achievement.earned
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                            : 'bg-gray-400 dark:bg-gray-600'
                        }`}
                        style={{ width: `${achievement.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Learning Insights History */}
            <div className="mt-12">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-500" />
                Recent Learning Insights
              </h3>
              <div className="space-y-3">
                {learningInsights.length > 0 ? (
                  learningInsights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${
                        insight.type === 'mistake_identified'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900 dark:border-amber-700'
                          : insight.type === 'concept_mastered'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900 dark:border-green-700'
                          : 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {insight.title}
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {insight.message}
                          </p>
                          {insight.questionId && (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Target className="w-3 h-3" />
                              <span>Question #{insight.questionId}</span>
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              <span>{insight.difficulty?.toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {insight.concept?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Your learning insights will appear here</p>
                    <p className="text-sm mt-1">As you learn, we'll track patterns and provide insights</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* PPT AREA */}
        <div className={`flex-1 flex flex-col min-h-0 relative ${activeView === 'quiz' ? 'pr-96' : ''}`}>

          {/* Quiz Overlay */}
          {activeView === 'quiz' && quizStarted && !showResult && (
            <div className="absolute inset-0 z-20 bg-white dark:bg-gray-900 p-6 overflow-auto">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileQuestion className="w-7 h-7 text-amber-500" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Adaptive Quiz {currentQuestionIndex + 1}/{adaptiveQuestions.length}
                      </h2>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          Load: <span className="font-bold">{Math.round(cognitiveLoad * 100)}%</span>
                          {isTired && <span className="ml-2 text-red-600 dark:text-red-400">(Tired)</span>}
                          {isFresh && <span className="ml-2 text-green-600 dark:text-green-400">(Fresh)</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            Score: {quizScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleClosePane}
                    className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                  >
                    <XIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>

                {currentQuestion ? (
                  <div className={`p-6 rounded-xl ${theme === 'light' ? 'bg-gray-50 border border-gray-300' : 'bg-gray-800 border border-gray-700'}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`px-3 py-1.5 rounded text-sm font-bold ${
                        currentQuestion.difficulty === 'easy'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700'
                          : currentQuestion.difficulty === 'medium'
                          ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700'
                      }`}>
                        {currentQuestion.difficulty.toUpperCase()} LEVEL
                      </div>
                      {currentQuestion.isDiagnostic && (
                        <div className="px-3 py-1.5 rounded text-sm font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700">
                          🧪 Diagnostic Test
                        </div>
                      )}
                      {freshWrongConcepts.includes(currentQuestion.concept) && (
                        <div className="px-3 py-1.5 rounded text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                          Needs Clarification
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                      {currentQuestion.question}
                    </h3>

                    <div className="space-y-3">
                      {currentQuestion.options.map((option, optIndex) => (
                        <button
                          key={optIndex}
                          onClick={() => handleAnswerSelect(currentQuestionIndex, optIndex)}
                          disabled={userAnswers[currentQuestionIndex] !== undefined}
                          className={`w-full p-4 rounded-lg text-left transition border ${
                            userAnswers[currentQuestionIndex] === optIndex
                              ? optIndex === currentQuestion.correct
                                ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500 dark:border-green-600'
                                : 'bg-red-100 dark:bg-red-900 border-2 border-red-500 dark:border-red-600'
                              : `${theme === 'light' ? 'hover:bg-gray-100 border-gray-300' : 'hover:bg-gray-700 border-gray-600'}`
                          } ${userAnswers[currentQuestionIndex] !== undefined ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              userAnswers[currentQuestionIndex] === optIndex
                                ? optIndex === currentQuestion.correct
                                  ? 'border-green-500 bg-green-500 dark:border-green-600 dark:bg-green-600'
                                  : 'border-red-500 bg-red-500 dark:border-red-600 dark:bg-red-600'
                                : 'border-gray-400 dark:border-gray-500'
                            }`}>
                              {userAnswers[currentQuestionIndex] === optIndex && (
                                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{option}</span>
                            {userAnswers[currentQuestionIndex] === optIndex && (
                              optIndex === currentQuestion.correct ? (
                                <Check className="w-5 h-5 text-green-600 dark:text-green-400 ml-auto" />
                              ) : (
                                <XIcon className="w-5 h-5 text-red-600 dark:text-red-400 ml-auto" />
                              )
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {showExplanation && !showIntervention && (
                      <div className={`mt-6 p-4 rounded-lg ${theme === 'light' ? 'bg-blue-100 border border-blue-300' : 'bg-blue-900 border border-blue-700'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Explanation</span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-300">
                          {generateExplanation(currentQuestion)}
                        </p>
                      </div>
                    )}

                    <div className="mt-8 flex items-center justify-between">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Question {currentQuestionIndex + 1} of {adaptiveQuestions.length}
                        {currentQuestion.isDiagnostic && (
                          <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                            • This is a diagnostic question
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleNextQuestion}
                        disabled={userAnswers[currentQuestionIndex] === undefined}
                        className={`px-6 py-3 rounded-lg font-semibold transition ${
                          userAnswers[currentQuestionIndex] === undefined
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed border border-gray-400 dark:border-gray-600'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 border border-blue-700 dark:border-blue-800'
                        }`}
                      >
                        {currentQuestionIndex === adaptiveQuestions.length - 1 ? 'See Results' : 'Next Question'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-8 text-center rounded-xl ${theme === 'light' ? 'bg-gray-100 border border-gray-300' : 'bg-gray-800 border border-gray-700'}`}>
                    <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Loading questions...
                    </h3>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quiz Results */}
          {activeView === 'quiz' && showResult && (
            <div className="absolute inset-0 z-20 bg-white dark:bg-gray-900 p-6 overflow-auto">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <FileQuestion className="w-7 h-7 text-green-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quiz Completed!</h2>
                  </div>
                  <button
                    onClick={handleClosePane}
                    className="p-2.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                  >
                    <XIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>

                <div className={`p-8 rounded-xl border ${theme === 'light' ? 'bg-gradient-to-br from-green-50 to-blue-50 border-gray-300' : 'bg-gradient-to-br from-green-900 to-blue-900 border border-gray-700'}`}>
                  <div className="text-center mb-8">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                      {quizScore}/{adaptiveQuestions.length}
                    </div>
                    <div className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                      {quizScore === adaptiveQuestions.length ? "Perfect! 🎯" :
                       quizScore >= adaptiveQuestions.length * 0.7 ? "Great Job! 👍" :
                       "Keep Practicing! 📚"}
                    </div>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${loadColor.border} ${loadColor.lightBg} ${loadColor.text}`}>
                      <Brain className="w-4 h-4" />
                      Updated Cognitive Load: {Math.round(cognitiveLoad * 100)}%
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-6 mb-8">
                    <button
                      onClick={handleRetryQuiz}
                      className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:opacity-90 transition flex items-center gap-2 font-medium border border-gray-400 dark:border-gray-600"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Quiz
                    </button>
                    <button
                      onClick={handleClosePane}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition font-medium border border-blue-700 dark:border-blue-800"
                    >
                      Continue Learning
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Normal PPT View */}
          <div className={`flex-1 p-6 flex items-center justify-center ${activeView === 'quiz' ? 'blur-sm' : ''}`}>
            <div className={`w-full h-full rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} shadow-lg p-8 flex flex-col border ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}`}>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      SLIDE {currentSlide} OF {totalSlides}
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      What are Neural Networks?
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100 border border-gray-300' : 'hover:bg-gray-700 border border-gray-600'}`}>
                      <RotateCcw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                    <button className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100 border border-gray-300' : 'hover:bg-gray-700 border border-gray-600'}`}>
                      <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${loadColor.bg} rounded-full transition-all duration-300`}
                    style={{ width: `${(currentSlide / totalSlides) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="space-y-6">
                  <p className="text-base text-gray-800 dark:text-gray-300 leading-relaxed">
                    Neural networks are computational models inspired by the human brain.
                    They consist of interconnected nodes called neurons that process data
                    to learn patterns and make decisions without explicit programming.
                  </p>

                  <div className={`p-5 rounded-lg border ${theme === 'light' ? 'bg-blue-50 border-blue-300' : 'bg-blue-900 border-blue-700'}`}>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-500" />
                      Key Benefits
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { title: "Handles Complexity", desc: "Solves non-linear problems efficiently" },
                        { title: "Adaptive Learning", desc: "Learns patterns autonomously" },
                        { title: "AI Applications", desc: "Image recognition, NLP, and more" },
                        { title: "Scalability", desc: "Parallel processing capabilities" }
                      ].map((item, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-1.5"></div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                            <p className="text-xs text-gray-700 dark:text-gray-400 mt-1">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {currentSlide === 4 && (
                    <div className={`p-4 rounded-lg border-l-4 ${theme === 'light' ? 'bg-green-50 border-green-500' : 'bg-green-900 border-green-500'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <HelpCircle className="w-5 h-5 text-green-600" />
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                          Clarification Slide (Generated)
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        Understanding Backpropagation
                      </h3>
                      <p className="text-xs text-gray-800 dark:text-gray-300">
                        Algorithm for training neural networks by calculating gradient of loss function.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className={`h-16 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-t ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex items-center justify-between px-8`}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentSlide(Math.max(1, currentSlide - 1))}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className={`px-4 py-2 rounded-lg border ${theme === 'light' ? 'bg-gray-100 border-gray-400' : 'bg-gray-700 border-gray-600'}`}>
                <span className="text-sm text-gray-700 dark:text-gray-300">Slide </span>
                <span className="text-base font-bold text-gray-900 dark:text-white mx-1">{currentSlide}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">of {totalSlides}</span>
              </div>
              <button
                onClick={() => setCurrentSlide(Math.min(totalSlides, currentSlide + 1))}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'}`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${isPlaying ? 'bg-blue-600 text-white border-blue-700' : theme === 'light' ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-400' : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border-blue-700'}`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button className={`p-2.5 rounded-lg border ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 border-gray-400' : 'bg-gray-700 hover:bg-gray-600 border-gray-600'}`}>
                <Volume2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`w-96 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-l ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex flex-col overflow-hidden`}>
          {/* Professor Avatar */}
          <div className={`flex-shrink-0 ${theme === 'light' ? 'bg-gradient-to-b from-blue-50 to-purple-50' : 'bg-gradient-to-b from-gray-800 to-gray-900'} border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} relative`}>
            <div className="p-6">
              <div className="relative h-48 w-full mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-40 h-40">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                      <User className="w-24 h-24 text-white" />
                    </div>
                    <img
                      src="/3D_avatar_professor.jpg"
                      alt="Professor Avatar"
                      className="absolute inset-0 w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={handlePlayPause}
                  className={`absolute bottom-0 right-0 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-110 border-2 border-white dark:border-gray-800 ${
                    isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Professor Assistant
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-400 mb-2">
                  Your AI Learning Companion
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-400">
                    {isPlaying ? "Active • Speaking" : "Paused"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeView === null ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 overflow-y-auto">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={handleTakeQuiz}
                      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light' ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-900 hover:bg-amber-800 text-amber-300 border-amber-700'}`}
                    >
                      <FileQuestion className="w-5 h-5" />
                      <span className="text-xs font-semibold">Take Quiz</span>
                    </button>
                    <button
                      onClick={handleExplainMore}
                      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light' ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300' : 'bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700'}`}
                    >
                      <HelpCircle className="w-5 h-5" />
                      <span className="text-xs font-semibold">Explain More</span>
                    </button>
                    <button
                      onClick={handleAskQuestions}
                      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light' ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300' : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border-blue-700'}`}
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-xs font-semibold">Ask Questions</span>
                    </button>
                    <button
                      onClick={handleAskAvatar}
                      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light' ? 'bg-gradient-to-br from-purple-500 to-pink-500 hover:opacity-90 border-purple-600' : 'bg-gradient-to-br from-purple-600 to-pink-600 hover:opacity-90 border-purple-700'}`}
                    >
                      <Mic className="w-5 h-5 text-white" />
                      <span className="text-xs font-semibold text-white">Ask Avatar</span>
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border ${loadColor.border} ${loadColor.lightBg} mb-6`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Brain className={`w-5 h-5 ${loadColor.text}`} />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Cognitive Load</span>
                      </div>
                      <span className={`text-sm font-bold ${loadColor.text}`}>
                        {cognitiveLoad > 0.7 ? "High" : cognitiveLoad > 0.4 ? "Moderate" : "Low"}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full ${loadColor.bg} rounded-full`}
                        style={{ width: `${cognitiveLoad * 100}%` }}
                      ></div>
                    </div>
                    <p className={`text-xs ${loadColor.text}`}>
                      {cognitiveLoad > 0.7 ? "High load detected. Try taking a quiz to reinforce learning." :
                       cognitiveLoad > 0.4 ? "Moderate load. You're learning well!" :
                       "Optimal learning state. Keep going!"}
                    </p>
                    {learningData.mistakes.length > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        📊 {learningData.mistakes.length} recent {learningData.mistakes.length === 1 ? 'mistake' : 'mistakes'} recorded
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : activeView === 'askAvatar' ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0 p-6 border-b border-gray-300 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-purple-500" />
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Ask Avatar</h3>
                    </div>
                    <button
                      onClick={handleClosePane}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                    >
                      <XIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-purple-50 border border-purple-300' : 'bg-purple-900 border border-purple-700'}`}>
                    <p className="text-sm text-gray-800 dark:text-gray-300">
                      Ask the professor anything about neural networks or this lecture!
                    </p>
                  </div>
                </div>
                <div className="flex-1 p-6 flex flex-col overflow-hidden">
                  <textarea
                    value={avatarQuestion}
                    onChange={(e) => setAvatarQuestion(e.target.value)}
                    placeholder="Type your question here..."
                    rows="4"
                    className={`flex-shrink-0 w-full p-3 rounded-lg border ${theme === 'light' ? 'border-gray-400 bg-white' : 'border-gray-600 bg-gray-700'} focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none`}
                  />
                  <button
                    onClick={handleSubmitAvatarQuestion}
                    disabled={!avatarQuestion.trim()}
                    className={`mt-4 py-2.5 w-full rounded-lg font-semibold transition border ${
                      !avatarQuestion.trim()
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-400 dark:border-gray-600'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 border-purple-600 dark:border-purple-700'
                    }`}
                  >
                    Ask Professor
                  </button>
                </div>
              </div>
            ) : activeView === 'askQuestions' ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                    Based on your current understanding:
                  </p>
                </div>
                <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
                  <div className="flex-1 overflow-y-auto mb-4">
                    <div className="space-y-2">
                      {sampleQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSampleQuestion(question)}
                          className={`w-full text-left p-3 rounded-lg transition border ${theme === 'light' ? 'hover:bg-blue-50 border-blue-300' : 'hover:bg-blue-900 border-blue-700'}`}
                        >
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-300">{question}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 pt-4 border-t border-gray-300 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-400 mb-2">Or ask your own question:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userQuestion}
                        onChange={(e) => setUserQuestion(e.target.value)}
                        placeholder="Type your question..."
                        className={`flex-1 px-3 py-2 rounded-lg border ${theme === 'light' ? 'border-gray-400 bg-white' : 'border-gray-600 bg-gray-700'} focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                      />
                      <button
                        onClick={handleSubmitUserQuestion}
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
            ) : activeView === 'explainMore' ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0 p-6 border-b border-gray-300 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-purple-500" />
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Explain More</h3>
                    </div>
                    <button
                      onClick={handleClosePane}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                    >
                      <XIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-purple-50 border border-purple-300' : 'bg-purple-900 border border-purple-700'}`}>
                    <p className="text-sm text-gray-800 dark:text-gray-300">
                      Generating additional explanation slides based on your cognitive load...
                    </p>
                  </div>
                </div>
                <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden">
                  <div className="text-center">
                    <div className="animate-pulse mb-4">
                      <Sparkles className="w-12 h-12 mx-auto text-purple-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Creating clarification slides...</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">This will be added to your presentation</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}