/**
 * INTELLIGENT LEARNING ENGINE
 * Loads the lecture plan produced by the backend, enriches its topics, and generates
 * slides and quizzes (AI-generated through the Next.js API routes, with local fallbacks).
 */

import { QuizStorage } from '@/app/lib/quiz-storage';
import * as offline from '@/lib/offlineContent';

export const NO_LECTURE_ERROR = 'No lecture found. Upload a lecture first so the tutor has something to teach.';

const OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Fisher-Yates; Array.sort(() => Math.random() - 0.5) is biased.
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Make any quiz source (AI backend, route templates, local templates) use the same shape:
 * options get ids A, B, C... in random order and `correctAnswer` is the id of the correct option.
 */
export function normalizeQuiz(quiz) {
  const questions = (quiz.questions || [])
    .map((q, index) => {
      const rawOptions = (q.options || []).filter(o => o && (o.text || typeof o === 'string'));
      const seen = new Set();
      const options = rawOptions
        .map(o => (typeof o === 'string' ? { text: o } : o))
        // templates can repeat a distractor; a correct option always wins over a duplicate
        .sort((a, b) => Number(!!b.isCorrect) - Number(!!a.isCorrect))
        .filter(o => {
          const key = String(o.text).trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      let correctIndex = options.findIndex(o => o.isCorrect);
      if (correctIndex === -1 && q.correctAnswer !== undefined) {
        // correctAnswer may be an id ("B"), an option id from the source, or a numeric index
        correctIndex = options.findIndex(o => o.id !== undefined && String(o.id) === String(q.correctAnswer));
        if (correctIndex === -1 && /^\d+$/.test(String(q.correctAnswer))) correctIndex = Number(q.correctAnswer);
        if (correctIndex === -1 && /^[A-Fa-f]$/.test(String(q.correctAnswer))) correctIndex = OPTION_IDS.indexOf(String(q.correctAnswer).toUpperCase());
      }
      if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return null;

      const tagged = options.map((o, i) => ({ text: o.text, isCorrect: i === correctIndex }));
      const shuffled = shuffle(tagged).map((o, i) => ({ id: OPTION_IDS[i], text: o.text, isCorrect: o.isCorrect }));
      const text = q.text || q.question || `Question ${index + 1}`;

      return {
        ...q,
        id: q.id ?? `q${index + 1}`,
        text,
        question: text,
        options: shuffled,
        correctAnswer: shuffled.find(o => o.isCorrect).id,
      };
    })
    .filter(Boolean);

  return { ...quiz, questions, totalQuestions: questions.length };
}

// =========================================================
// INTELLIGENCE ENGINE CLASS
// =========================================================
export default class IntelligenceEngine {
  /**
   * @param {string} sessionId study-session id (not the lecture's)
   * @param {object} config { lectureSessionId, lectureId, maxTopics, ... }
   */
  constructor(sessionId, config = {}) {
    this.sessionId = sessionId;
    this.config = {
      maxTopics: 20,
      defaultGoal: 'gate',
      lectureSessionId: null,
      ...config
    };

    // Core state
    this.lecturePlan = null;
    this.studentGoal = null;
    this.knowledgeLevel = 'intermediate';
    this.currentTopicIndex = 0;
    this.completedTopics = new Set();
    this.misconceptions = [];
    this.learningHistory = [];
    this.quizHistory = [];

    // Enhanced topic data
    this.enhancedTopics = [];
    this.topicProgress = {};
    this.adaptiveSettings = {
      difficulty: 'medium',
      pace: 'moderate',
      teachingStyle: 'balanced'
    };

    // Services
    this.sessionStorage = this.initializeSessionStorage();
  }

  // =========================================================
  // INITIALIZATION
  // =========================================================

  async initialize(goal = null, knowledgeTestResults = null) {
    try {
      this.studentGoal = goal || await this.loadStudentGoal() || this.config.defaultGoal;

      if (knowledgeTestResults) {
        this.knowledgeLevel = knowledgeTestResults.knowledgeLevel || 'intermediate';
        this.misconceptions = knowledgeTestResults.misconceptions || [];
      }

      await this.loadRealLecturePlan();

      if (!this.lecturePlan || !this.lecturePlan.impTopics || this.lecturePlan.impTopics.length === 0) {
        return this.createEmergencyAnalysis(NO_LECTURE_ERROR);
      }

      await this.enhanceTopicsWithIntelligence();
      this.initializeTopicProgress();
      this.generateAdaptiveSettings();
      await this.saveSessionState();

      return this.getInitialAnalysis();

    } catch (error) {
      console.error('IntelligenceEngine initialization failed:', error);
      return this.createEmergencyAnalysis(error.message);
    }
  }

  // =========================================================
  // LECTURE PLAN MANAGEMENT
  // =========================================================

  async fetchPlanFromBackend(query) {
    try {
      const response = await fetch(`/api/get-lecture-plan?${query}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.lecturePlan && Array.isArray(data.lecturePlan.impTopics) ? data.lecturePlan : null;
    } catch (error) {
      console.warn('Could not reach the lecture service:', error.message);
      return null;
    }
  }

  readStoredPlan() {
    if (typeof window === 'undefined') return null;
    try {
      const wantedId = this.config.lectureSessionId;
      const lectureData = JSON.parse(localStorage.getItem('lectureData') || 'null');
      if (lectureData?.lecturePlan && (!wantedId || lectureData.sessionId === wantedId || lectureData.lecturePlan.sessionId === wantedId)) {
        return lectureData.lecturePlan;
      }
      if (!wantedId) return JSON.parse(localStorage.getItem('current_lecture_plan') || 'null');
    } catch (e) {
      console.warn('Failed to parse stored lecture plan:', e);
    }
    return null;
  }

  async loadRealLecturePlan() {
    if (typeof window !== 'undefined' && localStorage.getItem('force_lecture_plan_refresh') === 'true') {
      localStorage.removeItem('current_lecture_plan');
      localStorage.removeItem('force_lecture_plan_refresh');
    }

    const wantedId = this.config.lectureSessionId;
    let plan = this.readStoredPlan();

    if (!plan && wantedId) plan = await this.fetchPlanFromBackend(`sessionId=${encodeURIComponent(wantedId)}`);
    if (!plan) plan = await this.fetchPlanFromBackend('latest=true');
    if (!plan && typeof window !== 'undefined') {
      try {
        plan = JSON.parse(localStorage.getItem('current_lecture_plan') || 'null');
      } catch { /* ignore corrupt cache */ }
    }

    if (plan) {
      this.lecturePlan = this.cleanAndValidateLecturePlan(plan);
      return true;
    }
    return false;
  }

  cleanAndValidateLecturePlan(plan) {
    if (!plan || typeof plan !== 'object') return null;
    if (!Array.isArray(plan.impTopics)) plan.impTopics = [];

    const garbageStart = /^(fig(ure)?\.?|table|activity|exercise|question|answer|solution|blank)\b|cid:/i;

    plan.impTopics = plan.impTopics
      .map((topic, index) => {
        if (!topic || typeof topic !== 'object') return null;
        const list = (a, b) => (Array.isArray(topic[a]) ? topic[a] : Array.isArray(topic[b]) ? topic[b] : []);

        return {
          id: topic.id || `topic-${index + 1}`,
          title: this.cleanTopicTitle(topic.title || topic.name || `Topic ${index + 1}`),
          description: topic.description || topic.text || topic.full_text || topic.full_content || '',
          importance: topic.importance || 'medium',
          weightage: typeof topic.weightage === 'number' ? topic.weightage : 50,
          difficulty: topic.difficulty || 'medium',
          keyInsights: list('keyInsights', 'key_insights'),
          commonMisconceptions: list('commonMisconceptions', 'common_misconceptions'),
          realWorldApplications: list('realWorldApplications', 'real_world_applications'),
          prerequisites: list('prerequisites', 'prerequisites'),
          estimatedTime: topic.estimated_time || topic.estimatedTime || '25-35 minutes',
          educationalValue: topic.educational_value || topic.educationalValue || {},
        };
      })
      .filter(topic => topic && topic.title.length > 3 && !garbageStart.test(topic.title))
      .slice(0, this.config.maxTopics);

    if (!plan.metadata) plan.metadata = {};
    plan.metadata.cleanedAt = new Date().toISOString();
    plan.metadata.totalValidTopics = plan.impTopics.length;
    return plan;
  }

  cleanTopicTitle(title) {
    if (!title || typeof title !== 'string') return 'Learning Topic';

    let clean = title
      .replace(/\(cid:\d+\)/g, '')
      .replace(/^\s*[•\-*]\s*/, '')
      .replace(/^(Chapter|Section|Topic|Unit|Module)\s*\d+[\.\d]*\s*[:–-]\s*/i, '')
      .replace(/^\d+[\.\)]\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Drop dangling connectors left over from truncated text ("... of the")
    const connectors = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'with', 'of', 'in', 'on', 'at', 'to']);
    let words = clean.split(' ');
    while (words.length > 1 && connectors.has(words[words.length - 1].toLowerCase().replace(/[.,;:]$/, ''))) {
      words.pop();
    }
    if (words.length > 12) words = [...words.slice(0, 10), '...'];
    clean = words.join(' ');

    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Important Concept';
  }

  // =========================================================
  // TOPIC ENHANCEMENT AND INTELLIGENCE
  // =========================================================

  async enhanceTopicsWithIntelligence() {
    console.log('Enhancing topics with educational intelligence...');

    this.enhancedTopics = await Promise.all(
      this.lecturePlan.impTopics.map(async (topic, index) => {
        const enhanced = { ...topic };

        // Add educational intelligence
        enhanced.educationalMetadata = {
          enhancementLevel: 'intelligent',
          enhancedAt: new Date().toISOString(),
          studentGoal: this.studentGoal,
          knowledgeLevel: this.knowledgeLevel
        };

        // Generate missing educational content
        if (!enhanced.keyInsights || enhanced.keyInsights.length === 0) {
          enhanced.keyInsights = this.generateKeyInsights(topic);
        }

        if (!enhanced.commonMisconceptions || enhanced.commonMisconceptions.length === 0) {
          enhanced.commonMisconceptions = this.generateCommonMisconceptions(topic);
        }

        if (!enhanced.realWorldApplications || enhanced.realWorldApplications.length === 0) {
          enhanced.realWorldApplications = this.generateRealWorldApplications(topic);
        }

        // Generate question seeds for quizzes
        enhanced.questionSeeds = this.generateQuestionSeeds(topic);

        // Generate analogy seeds
        enhanced.analogySeeds = this.generateAnalogySeeds(topic);

        // Determine exam relevance
        enhanced.examRelevance = this.determineExamRelevance(topic);

        // Calculate learning metrics
        enhanced.learningMetrics = this.calculateLearningMetrics(topic);

        // Add progress tracking
        enhanced.progress = {
          started: false,
          completed: false,
          timeSpent: 0,
          quizScore: null,
          misconceptionsIdentified: []
        };

        return enhanced;
      })
    );

    console.log(`Enhanced ${this.enhancedTopics.length} topics with educational intelligence`);
  }

  // Statements come from the lecture's own text. Nothing is invented: missing misconceptions / applications /
  // analogies stay empty and the UI simply hides those sections.
  generateKeyInsights(topic) {
    return offline.statementsFrom(topic).slice(0, 4);
  }

  generateCommonMisconceptions() {
    return [];
  }

  generateRealWorldApplications() {
    return [];
  }

  generateQuestionSeeds(topic) {
    return [
      `What is the main idea of ${topic.title}?`,
      `How is ${topic.title} used or applied?`,
      `What are the key terms in ${topic.title}?`,
      `Why does ${topic.title} matter?`,
      `What mistakes do people make with ${topic.title}?`
    ];
  }

  generateAnalogySeeds() {
    return [];
  }

  determineExamRelevance(topic) {
    const goal = this.studentGoal.toUpperCase();

    if (goal === "GATE") {
      return `High weightage in GATE (approx ${topic.weightage}% importance)`;
    } else if (goal === "JEE") {
      return "Conceptual understanding tested through complex problems";
    } else if (goal === "NEET") {
      return "Factual recall and application in medical contexts";
    } else {
      return `Important for ${goal} preparation and application`;
    }
  }

  calculateLearningMetrics(topic) {
    const desc = topic.description || '';
    const wordCount = desc.split(' ').length;

    return {
      estimatedStudyTime: topic.estimatedTime || this.estimateStudyTime(wordCount),
      complexity: this.calculateComplexity(desc),
      prerequisiteCount: topic.prerequisites ? topic.prerequisites.length : 0,
      conceptDensity: Math.min(wordCount / 100, 1.0)
    };
  }

  estimateStudyTime(wordCount) {
    if (wordCount < 100) return "15-20 minutes";
    if (wordCount < 300) return "25-35 minutes";
    if (wordCount < 500) return "40-50 minutes";
    return "55-65 minutes";
  }

  calculateComplexity(text) {
    if (!text) return 0.5;
    const words = text.split(/\s+/).filter(Boolean);
    const long = words.filter(word => word.length >= 9).length;
    return Math.min(long / Math.max(words.length, 1) * 4, 1.0);
  }

  // =========================================================
  // PROGRESS TRACKING
  // =========================================================

  initializeTopicProgress() {
    this.topicProgress = {};
    this.enhancedTopics.forEach(topic => {
      this.topicProgress[topic.id] = {
        started: false,
        completed: false,
        slidesViewed: 0,
        timeSpent: 0,
        quizAttempted: false,
        quizScore: null,
        misconceptionsIdentified: [],
        lastAccessed: null
      };
    });
  }

  updateTopicProgress(topicId, updates) {
    if (!this.topicProgress[topicId]) {
      this.topicProgress[topicId] = {
        started: false,
        completed: false,
        slidesViewed: 0,
        timeSpent: 0,
        quizAttempted: false,
        quizScore: null,
        misconceptionsIdentified: [],
        lastAccessed: new Date().toISOString()
      };
    }

    this.topicProgress[topicId] = {
      ...this.topicProgress[topicId],
      ...updates,
      lastAccessed: new Date().toISOString()
    };

    // Check if topic is completed
    if (updates.quizScore !== undefined && updates.quizScore >= 70) {
      this.topicProgress[topicId].completed = true;
      this.completedTopics.add(topicId);
    }

    // Save progress
    this.saveProgress();
  }

  getCurrentTopic() {
    if (!this.enhancedTopics.length) return null;

    // Find first incomplete topic
    for (let i = 0; i < this.enhancedTopics.length; i++) {
      const topic = this.enhancedTopics[i];
      const progress = this.topicProgress[topic.id];

      if (!progress || !progress.completed) {
        this.currentTopicIndex = i;
        return topic;
      }
    }

    // All topics completed, return last one
    this.currentTopicIndex = this.enhancedTopics.length - 1;
    return this.enhancedTopics[this.currentTopicIndex];
  }

  getNextTopic() {
    if (!this.enhancedTopics.length) return null;

    const nextIndex = this.currentTopicIndex + 1;
    if (nextIndex < this.enhancedTopics.length) {
      this.currentTopicIndex = nextIndex;
      return this.enhancedTopics[nextIndex];
    }

    return null; // No more topics
  }

  // =========================================================
  // ADAPTIVE LEARNING
  // =========================================================

  generateAdaptiveSettings() {
    // Base settings on student goal
    const goalSettings = {
      'gate': { difficulty: 'medium', pace: 'moderate', teachingStyle: 'problem_solving' },
      'jee': { difficulty: 'hard', pace: 'slow', teachingStyle: 'conceptual_depth' },
      'neet': { difficulty: 'medium', pace: 'fast', teachingStyle: 'visual_memory' },
      'semester': { difficulty: 'medium', pace: 'moderate', teachingStyle: 'comprehensive' }
    };

    this.adaptiveSettings = { ...(goalSettings[this.studentGoal] || goalSettings.gate) };

    // Adjust based on knowledge level
    if (this.knowledgeLevel === 'beginner') {
      this.adaptiveSettings.difficulty = 'easy';
      this.adaptiveSettings.pace = 'slow';
    } else if (this.knowledgeLevel === 'advanced') {
      this.adaptiveSettings.difficulty = 'hard';
      this.adaptiveSettings.pace = 'fast';
    }
  }

  getAdaptiveRecommendations() {
    const recommendations = [];

    // Based on progress
    const completedCount = this.completedTopics.size;
    const totalCount = this.enhancedTopics.length;

    if (completedCount === 0) {
      recommendations.push({
        type: 'start',
        priority: 'high',
        message: 'Start with the first topic to begin your learning journey',
        action: 'Begin with foundational concepts'
      });
    } else if (completedCount < totalCount / 2) {
      recommendations.push({
        type: 'continue',
        priority: 'medium',
        message: `You've completed ${completedCount} of ${totalCount} topics. Keep going!`,
        action: 'Continue to next topic'
      });
    } else {
      recommendations.push({
        type: 'review',
        priority: 'low',
        message: `Great progress! ${completedCount} topics completed. Consider reviewing weak areas.`,
        action: 'Review completed topics'
      });
    }

    // Based on misconceptions
    if (this.misconceptions.length > 0) {
      recommendations.push({
        type: 'misconception',
        priority: 'high',
        message: `${this.misconceptions.length} misconception(s) identified. Focus on clarifying these.`,
        action: 'Review common misconceptions'
      });
    }

    return recommendations;
  }

  // =========================================================
  // SLIDE GENERATION
  // =========================================================

  buildKnowledgeState() {
    const profile = QuizStorage.getStudentProfile();
    const engineMisconceptions = (this.misconceptions || []).map(m => ({
      concept: m.concept || m.topic || 'general',
      type: m.type || 'knowledge_gap',
      description: m.description || m.misconception || m.question || ''
    }));

    return {
      knowledgeLevel: this.knowledgeLevel,
      averageScore: profile.averageScore || 0,
      weakTopics: profile.weakTopics || [],
      misconceptions: engineMisconceptions,
      topicsCompleted: Array.from(this.completedTopics),
      recentQuizzes: this.quizHistory.slice(-5)
    };
  }

  async requestAiSlide(topicIndex, actionType, context) {
    const response = await fetch('/api/generate-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        lecturePlan: this.lecturePlan,
        goal: this.studentGoal,
        knowledgeState: this.buildKnowledgeState(),
        currentTopicIndex: topicIndex,
        actionType,
        userQuestion: actionType === 'ask-question' ? context : null,
        context: actionType === 'ask-question' ? '' : context
      }),
      signal: AbortSignal.timeout(75000)
    });

    if (!response.ok) throw new Error(`AI slide request failed (${response.status})`);
    const data = await response.json();
    if (!data.success || !data.slide?.content) throw new Error(data.error || 'AI returned no slide');
    return data.slide;
  }

  generateLocalSlideContent(topic, actionType, context) {
    switch (actionType) {
      case 'explain-more':
        return offline.explainMoreSlide(topic);
      case 'ask-question':
        return offline.questionSlide(topic, context, this.enhancedTopics);
      case 'quiz-results':
      case 'mistake-explanation':
        return offline.quizResultsSlide(topic, context);
      case 'simplified-explanation':
        return offline.simplifiedSlide(topic, context);
      case 'completion':
        return offline.completionSlide({
          topics: this.enhancedTopics,
          completed: this.enhancedTopics.filter(t => this.topicProgress[t.id]?.completed).length,
          averageScore: this.calculateAverageQuizScore(),
          goal: this.studentGoal
        });
      default:
        return offline.conceptSlide(topic, this.studentGoal);
    }
  }

  /**
   * Generate a slide for `topicIndex`. Uses the AI backend and falls back to local content
   * when the AI is unavailable.
   */
  async generateSlideContent(topicIndex, actionType = 'concept_explanation', context = '') {
    actionType = actionType || 'concept_explanation';
    context = context || '';

    const topic = this.enhancedTopics[topicIndex];
    if (!topic) {
      throw new Error(`Topic at index ${topicIndex} not found`);
    }

    this.currentTopicIndex = topicIndex;
    this.updateTopicProgress(topic.id, {
      started: true,
      slidesViewed: (this.topicProgress[topic.id]?.slidesViewed || 0) + 1
    });

    let slideContent;
    let images = [];
    let sources = [];
    let source = 'ai_backend';

    try {
      const aiSlide = await this.requestAiSlide(topicIndex, actionType, context);
      slideContent = aiSlide.content;
      images = aiSlide.images || [];
      sources = aiSlide.metadata?.sources || [];
    } catch (error) {
      console.warn('AI slide generation unavailable, using local content:', error.message);
      slideContent = this.generateLocalSlideContent(topic, actionType, context);
      source = 'local_fallback';
    }

    const slide = {
      id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      title: slideContent.title || topic.title,
      type: actionType,
      content: slideContent,
      images,
      metadata: {
        generatedAt: new Date().toISOString(),
        topicId: topic.id,
        topicIndex,
        studentGoal: this.studentGoal,
        knowledgeLevel: this.knowledgeLevel,
        actionType,
        context,
        adaptiveSettings: this.adaptiveSettings,
        sources,
        source
      }
    };

    this.learningHistory.push({
      timestamp: new Date().toISOString(),
      slideId: slide.id,
      topicId: topic.id,
      actionType,
      slideTitle: slide.title
    });

    return slide;
  }

  // =========================================================
  // QUIZ GENERATION
  // =========================================================

  async generateQuiz(topic, difficulty = 'medium', recentContext = '') {
    console.log(`Generating quiz for: ${topic.title}, difficulty: ${difficulty}`);

    try {
      const topicData = typeof topic === 'string'
        ? this.enhancedTopics.find(t => t.title === topic) || this.enhancedTopics[0]
        : topic;

      if (!topicData) {
        throw new Error('Topic not found for quiz generation');
      }

      // Prepare quiz request
      const quizData = {
        topic: topicData,
        difficulty: difficulty,
        studentGoal: this.studentGoal,
        numberOfQuestions: 5,
        sessionId: this.sessionId,
        misconceptions: this.misconceptions,
        previousPerformance: this.getPreviousPerformance(),
        cognitiveLoad: this.estimateCognitiveLoad(),
        recentContext,
        lecturePlan: { topic: this.lecturePlan?.topic, impTopics: this.lecturePlan?.impTopics?.map(t => ({ id: t.id, title: t.title })) }
      };

      // Try the AI-backed route first, fall back to local templates
      let quiz;
      try {
        const response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quizData),
          signal: AbortSignal.timeout(75000)
        });

        const data = response.ok ? await response.json() : null;
        if (!data?.success || !data.quiz) {
          throw new Error(`Quiz service unavailable (${response.status})`);
        }
        quiz = normalizeQuiz(data.quiz);
        if (quiz.questions.length === 0) throw new Error('Quiz service returned no usable questions');
      } catch (backendError) {
        console.warn('Quiz service failed, generating locally:', backendError.message);
        quiz = normalizeQuiz(this.generateLocalQuiz(topicData, difficulty));
      }

      // Track quiz generation
      this.quizHistory.push({
        timestamp: new Date().toISOString(),
        topicId: topicData.id,
        topicTitle: topicData.title,
        difficulty: difficulty,
        quizId: quiz.id
      });

      console.log(`Quiz generated: ${quiz.title} (${quiz.questions.length} questions)`);
      return { success: true, quiz: quiz };

    } catch (error) {
      console.error('Quiz generation failed:', error);
      return { success: false, error: error.message, quiz: null };
    }
  }

  generateLocalQuiz(topic, difficulty) {
    const quiz = offline.buildLocalQuiz({
      topic,
      topics: this.enhancedTopics,
      difficulty,
      goal: this.studentGoal,
      sessionId: this.sessionId
    });
    if (!quiz) throw new Error('This topic has no text to build a quiz from.');
    return quiz;
  }

  // =========================================================
  // UTILITY FUNCTIONS
  // =========================================================

  async loadStudentGoal() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('learning_goal') || this.config.defaultGoal;
    }
    return this.config.defaultGoal;
  }

  getPreviousPerformance() {
    const completedQuizzes = this.quizHistory.filter(q =>
      this.topicProgress[q.topicId]?.quizScore !== undefined
    );

    if (completedQuizzes.length === 0) {
      return { averageScore: 0, totalQuizzes: 0 };
    }

    const totalScore = completedQuizzes.reduce((sum, quiz) => {
      const score = this.topicProgress[quiz.topicId]?.quizScore || 0;
      return sum + score;
    }, 0);

    return {
      averageScore: Math.round(totalScore / completedQuizzes.length),
      totalQuizzes: completedQuizzes.length,
      lastQuizDate: completedQuizzes[0]?.timestamp
    };
  }

  estimateCognitiveLoad() {
    const recentInteractions = this.learningHistory.slice(-3);
    if (recentInteractions.length < 2) return 'medium';

    // Simple heuristic: if many recent interactions, cognitive load might be high
    const recentTime = new Date(recentInteractions[0].timestamp).getTime();
    const now = Date.now();
    const minutesSinceLast = (now - recentTime) / (1000 * 60);

    if (minutesSinceLast < 2) return 'high';
    if (minutesSinceLast > 10) return 'low';
    return 'medium';
  }

  getInitialAnalysis() {
    return {
      success: true,
      lecturePlan: this.lecturePlan,
      enhancedTopics: this.enhancedTopics,
      studentGoal: this.studentGoal,
      knowledgeLevel: this.knowledgeLevel,
      adaptiveSettings: this.adaptiveSettings,
      totalTopics: this.enhancedTopics.length,
      recommendations: this.getAdaptiveRecommendations(),
      metadata: {
        generatedAt: new Date().toISOString(),
        sessionId: this.sessionId,
        version: '3.0'
      }
    };
  }

  createEmergencyAnalysis(message = 'Learning system initialization failed. Please try again.') {
    return {
      success: false,
      lecturePlan: null,
      enhancedTopics: [],
      studentGoal: this.studentGoal,
      knowledgeLevel: 'unknown',
      adaptiveSettings: { difficulty: 'medium', pace: 'slow', teachingStyle: 'balanced' },
      totalTopics: 0,
      recommendations: [{
        type: 'emergency',
        priority: 'high',
        message,
        action: 'Restart learning session'
      }],
      isEmergency: true,
      error: message,
      metadata: {
        generatedAt: new Date().toISOString(),
        sessionId: this.sessionId,
        version: 'emergency'
      }
    };
  }

  // =========================================================
  // STORAGE AND PERSISTENCE
  // =========================================================

  initializeSessionStorage() {
    // Simple in-memory storage for now
    // Can be enhanced with localStorage or IndexedDB
    return {
      getSession: (sessionId) => {
        if (typeof window !== 'undefined') {
          const data = localStorage.getItem(`session_${sessionId}`);
          return data ? JSON.parse(data) : null;
        }
        return null;
      },
      updateSession: (sessionId, data) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`session_${sessionId}`, JSON.stringify(data));
        }
      },
      createNewSession: (goal, topic) => {
        const sessionData = {
          goal: goal,
          topic: topic,
          created: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem(`session_${this.sessionId}`, JSON.stringify(sessionData));
        }
        return sessionData;
      }
    };
  }

  async saveSessionState() {
    const state = {
      sessionId: this.sessionId,
      lecturePlan: this.lecturePlan,
      enhancedTopics: this.enhancedTopics,
      studentGoal: this.studentGoal,
      knowledgeLevel: this.knowledgeLevel,
      currentTopicIndex: this.currentTopicIndex,
      completedTopics: Array.from(this.completedTopics),
      topicProgress: this.topicProgress,
      misconceptions: this.misconceptions,
      learningHistory: this.learningHistory.slice(-50), // Keep last 50 entries
      quizHistory: this.quizHistory.slice(-20), // Keep last 20 quizzes
      adaptiveSettings: this.adaptiveSettings,
      savedAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`intelligence_engine_state_${this.sessionId}`, JSON.stringify(state));
        localStorage.setItem('current_lecture_plan', JSON.stringify(this.lecturePlan));
      } catch (e) {
        console.warn('Failed to save state to localStorage:', e);
      }
    }
  }

  async loadSessionState() {
    if (typeof window !== 'undefined') {
      try {
        const state = localStorage.getItem(`intelligence_engine_state_${this.sessionId}`);
        if (state) {
          const parsed = JSON.parse(state);

          // Restore state
          this.lecturePlan = parsed.lecturePlan;
          this.enhancedTopics = parsed.enhancedTopics || [];
          this.studentGoal = parsed.studentGoal;
          this.knowledgeLevel = parsed.knowledgeLevel;
          this.currentTopicIndex = parsed.currentTopicIndex || 0;
          this.completedTopics = new Set(parsed.completedTopics || []);
          this.topicProgress = parsed.topicProgress || {};
          this.misconceptions = parsed.misconceptions || [];
          this.learningHistory = parsed.learningHistory || [];
          this.quizHistory = parsed.quizHistory || [];
          this.adaptiveSettings = parsed.adaptiveSettings || {};

          console.log('Loaded saved session state');
          return true;
        }
      } catch (e) {
        console.warn('Failed to load session state:', e);
      }
    }
    return false;
  }

  saveProgress() {
    // Simple progress saving
    const progress = {
      topicProgress: this.topicProgress,
      completedTopics: Array.from(this.completedTopics),
      lastSaved: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(`learning_progress_${this.sessionId}`, JSON.stringify(progress));
    }
  }

  // =========================================================
  // PUBLIC API
  // =========================================================

  getLearningSummary() {
    const completedCount = this.completedTopics.size;
    const totalCount = this.enhancedTopics.length;
    const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      sessionId: this.sessionId,
      studentGoal: this.studentGoal,
      totalTopics: totalCount,
      completedTopics: completedCount,
      progressPercentage: progressPercentage,
      currentTopic: this.getCurrentTopic(),
      nextTopic: this.getNextTopic(),
      adaptiveSettings: this.adaptiveSettings,
      recommendations: this.getAdaptiveRecommendations(),
      learningMetrics: {
        totalStudyTime: Object.values(this.topicProgress).reduce((sum, p) => sum + (p.timeSpent || 0), 0),
        averageQuizScore: this.calculateAverageQuizScore(),
        misconceptionsIdentified: this.misconceptions.length
      },
      lastUpdated: new Date().toISOString()
    };
  }

  calculateAverageQuizScore() {
    const scores = Object.values(this.topicProgress)
      .filter(p => p.quizScore !== null && p.quizScore !== undefined)
      .map(p => p.quizScore);

    if (scores.length === 0) return 0;

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  addMisconception(misconception) {
    this.misconceptions.push({
      ...misconception,
      timestamp: new Date().toISOString(),
      topicId: misconception.topicId || this.enhancedTopics[this.currentTopicIndex]?.id,
      corrected: false
    });

    // Update topic progress
    if (misconception.topicId && this.topicProgress[misconception.topicId]) {
      if (!this.topicProgress[misconception.topicId].misconceptionsIdentified) {
        this.topicProgress[misconception.topicId].misconceptionsIdentified = [];
      }
      this.topicProgress[misconception.topicId].misconceptionsIdentified.push(misconception);
    }

    this.saveProgress();
  }

  getTopMisconceptions(limit = 5) {
    return this.misconceptions
      .filter(m => !m.corrected)
      .slice(0, limit);
  }

  markMisconceptionCorrected(misconceptionId) {
    const misconception = this.misconceptions.find(m => m.id === misconceptionId);
    if (misconception) {
      misconception.corrected = true;
      misconception.correctedAt = new Date().toISOString();
      this.saveProgress();
    }
  }

  // =========================================================
  // CLEANUP AND RESET
  // =========================================================

  resetSession() {
    this.currentTopicIndex = 0;
    this.completedTopics.clear();
    this.topicProgress = {};
    this.misconceptions = [];
    this.learningHistory = [];
    this.quizHistory = [];

    // Re-initialize topic progress
    this.initializeTopicProgress();

    console.log('Session reset');
  }

  clearData() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`intelligence_engine_state_${this.sessionId}`);
      localStorage.removeItem(`learning_progress_${this.sessionId}`);
      localStorage.removeItem('current_lecture_plan');
    }

    console.log('All session data cleared');
  }
}

// Export utility functions
export { IntelligenceEngine };