/**
 * INTELLIGENT LEARNING ENGINE
 * Loads the lecture plan produced by the backend, enriches its topics, and generates
 * slides and quizzes (AI-generated through the Next.js API routes, with local fallbacks).
 */

import { BACKEND_URL } from '@/lib/config';
import { QuizStorage } from '@/app/lib/quiz-storage';

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
      backendUrl: BACKEND_URL,
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
      const response = await fetch(`${this.config.backendUrl}/get-lecture-plan?${query}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) return null;
      const plan = await response.json();
      return plan && Array.isArray(plan.impTopics) ? plan : null;
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

  generateKeyInsights(topic) {
    const insights = [];
    const title = topic.title.toLowerCase();
    const desc = topic.description.toLowerCase();

    // Generate insights based on topic content
    if (desc.includes('synchronization') || desc.includes('concurrent')) {
      insights.push(
        "Critical section coordination prevents race conditions",
        "Semaphores and mutexes provide synchronization mechanisms",
        "Deadlock requires four necessary conditions simultaneously"
      );
    } else if (desc.includes('memory') || desc.includes('storage')) {
      insights.push(
        "Virtual memory allows programs to exceed physical memory limits",
        "Page replacement algorithms optimize memory usage",
        "Memory fragmentation affects allocation efficiency"
      );
    } else if (desc.includes('scheduling') || desc.includes('algorithm')) {
      insights.push(
        "Different scheduling algorithms optimize different metrics",
        "Preemptive scheduling allows higher priority process interruption",
        "Response time differs from turnaround time in scheduling"
      );
    } else {
      // Generic but meaningful insights
      insights.push(
        `Fundamental principles of ${topic.title}`,
        "Key applications and use cases",
        "Important relationships with related concepts",
        "Common implementation approaches"
      );
    }

    return insights.slice(0, 4);
  }

  generateCommonMisconceptions(topic) {
    const misconceptions = [];
    const title = topic.title.toLowerCase();
    const desc = topic.description.toLowerCase();

    if (desc.includes('synchronization') || desc.includes('deadlock')) {
      misconceptions.push(
        "Thinking mutex and semaphore are always interchangeable",
        "Believing deadlock avoidance guarantees no deadlocks",
        "Confusing race condition with deadlock"
      );
    } else if (desc.includes('memory') || desc.includes('virtual')) {
      misconceptions.push(
        "Confusing physical and virtual memory addresses",
        "Thinking all page replacement algorithms are equally efficient",
        "Believing more memory always improves performance"
      );
    } else if (desc.includes('scheduling')) {
      misconceptions.push(
        "Thinking Shortest Job First always gives optimal waiting time",
        "Confusing turnaround time with response time",
        "Believing Round Robin scheduling has no starvation"
      );
    } else {
      misconceptions.push(
        "Overlooking fundamental assumptions",
        "Confusing similar terminology",
        "Misapplying concepts in wrong contexts"
      );
    }

    return misconceptions.slice(0, 3);
  }

  generateRealWorldApplications(topic) {
    const applications = [];
    const title = topic.title.toLowerCase();

    if (title.includes('synchronization') || title.includes('process')) {
      applications.push(
        "Database transaction management systems",
        "Multi-threaded web server request handling",
        "Real-time operating system task coordination"
      );
    } else if (title.includes('memory')) {
      applications.push(
        "Operating system memory allocation",
        "Database buffer pool management",
        "Web browser tab isolation mechanisms"
      );
    } else if (title.includes('scheduling')) {
      applications.push(
        "OS process and thread scheduling",
        "Cloud computing resource allocation",
        "Real-time system task management"
      );
    } else {
      applications.push(
        "System design and architecture",
        "Problem-solving in technical domains",
        "Algorithm implementation and optimization"
      );
    }

    return applications.slice(0, 2);
  }

  generateQuestionSeeds(topic) {
    return [
      `What is the fundamental concept of ${topic.title}?`,
      `How is ${topic.title} applied in practice?`,
      `What are the key differences in approaches to ${topic.title}?`,
      `Why is ${topic.title} important for system design?`,
      `What common mistakes occur when implementing ${topic.title}?`
    ];
  }

  generateAnalogySeeds(topic) {
    const analogies = [];
    const title = topic.title.toLowerCase();

    if (title.includes('synchronization') || title.includes('coordination')) {
      analogies.push({
        domain: "Traffic Control",
        comparison: "Like traffic lights coordinating multiple roads",
        lesson: "Coordination prevents collisions and ensures smooth flow"
      });
    } else if (title.includes('memory') || title.includes('storage')) {
      analogies.push({
        domain: "Warehouse Management",
        comparison: "Like organizing inventory for efficient access",
        lesson: "Proper organization maximizes space and access efficiency"
      });
    } else {
      analogies.push({
        domain: "Building Construction",
        comparison: "Like constructing a building from foundation to roof",
        lesson: "Strong fundamentals support advanced structures"
      });
    }

    return analogies;
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

    const complexIndicators = ['algorithm', 'synchronization', 'architecture',
      'optimization', 'complexity', 'implementation'];

    const words = text.toLowerCase().split(' ');
    const complexCount = words.filter(word =>
      complexIndicators.some(indicator => word.includes(indicator))
    ).length;

    return Math.min(complexCount / 10, 1.0);
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
        return this.generateExplainMoreSlide(topic, context);
      case 'ask-question':
        return this.generateQuestionAnswerSlide(topic, context);
      case 'quiz-results':
      case 'mistake-explanation':
        return this.generateQuizResultsSlide(topic, context);
      case 'simplified-explanation':
        return this.generateSimplifiedSlide(topic, context);
      case 'completion':
        return this.generateCompletionSlide();
      default:
        return this.generateConceptSlide(topic);
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
    let source = 'ai_backend';

    try {
      const aiSlide = await this.requestAiSlide(topicIndex, actionType, context);
      slideContent = aiSlide.content;
      images = aiSlide.images || [];
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

  generateSimplifiedSlide(topic, context) {
    const sentences = (topic.description || '').split(/(?<=[.!?])\s+/).filter(Boolean);
    const heard = context ? ` The teacher just said: "${context.slice(-240)}".` : '';
    return {
      title: `In simple terms: ${topic.title}`,
      narrative: `${sentences.slice(0, 2).join(' ') || `Let us go back to the basics of ${topic.title}.`}${heard}`,
      keyInsights: (topic.keyInsights || []).slice(0, 3),
      analogies: [{ domain: 'Everyday life', comparison: `Think of ${topic.title} as a simple everyday routine: one clear step after another.`, lesson: 'Take it one step at a time.' }],
      realWorldScenario: topic.realWorldApplications?.[0]
        ? { situation: topic.realWorldApplications[0], application: 'See how the idea is used.', outcome: 'It becomes easier to remember.' }
        : null,
      interactiveElement: 'Can you say the main idea in one sentence?',
      examRelevance: topic.examRelevance || '',
      commonTraps: (topic.commonMisconceptions || []).slice(0, 2),
      memoryHook: 'One idea at a time.'
    };
  }

  generateCompletionSlide() {
    const topics = this.enhancedTopics;
    const completed = topics.filter(t => this.topicProgress[t.id]?.completed).length;
    const scores = this.calculateAverageQuizScore();

    return {
      title: 'Lecture Complete',
      narrative: `You have worked through all ${topics.length} topics of this lecture${completed ? ` and mastered ${completed} of them` : ''}${scores ? ` with an average quiz score of ${scores}%` : ''}. Use the topic list to revisit anything that still feels shaky.`,
      keyInsights: topics.slice(0, 6).map(t => `${t.title}: ${t.keyInsights?.[0] || t.description?.slice(0, 120) || 'review this topic'}`),
      analogies: [],
      realWorldScenario: null,
      interactiveElement: 'Which topic would you like to revisit first?',
      examRelevance: `Spend your remaining ${this.studentGoal.toUpperCase()} preparation time on topics where your quiz scores were lowest.`,
      commonTraps: ['Re-reading instead of testing yourself', 'Skipping topics that felt easy once'],
      memoryHook: 'Learn → Quiz → Review → Repeat'
    };
  }

  generateConceptSlide(topic) {
    return {
      title: topic.title,
      narrative: this.createConceptNarrative(topic),
      keyInsights: topic.keyInsights,
      analogies: this.generateEducationalAnalogies(topic),
      realWorldScenario: topic.realWorldApplications[0] ? {
        situation: topic.realWorldApplications[0],
        application: "Applied in practical problem-solving",
        outcome: "Leads to efficient and effective solutions"
      } : null,
      interactiveElement: this.generateInteractiveElement(topic),
      examRelevance: topic.examRelevance,
      commonTraps: topic.commonMisconceptions,
      memoryHook: this.createMemoryHook(topic)
    };
  }

  generateExplainMoreSlide(topic, context) {
    return {
      title: `Deep Dive: ${topic.title}`,
      narrative: `Let's explore ${topic.title} in greater detail. This advanced explanation covers underlying mechanisms, complex applications, and deeper insights for mastery.`,
      keyInsights: [
        "Advanced theoretical foundations",
        "Complex implementation details",
        "Edge cases and special considerations",
        "Integration with related advanced topics"
      ],
      analogies: this.generateAdvancedAnalogies(topic),
      realWorldScenario: null,
      interactiveElement: "Explain this concept in your own words to reinforce understanding",
      examRelevance: "Critical for advanced problem-solving in exams",
      commonTraps: [
        "Overcomplicating the core concept",
        "Missing subtle implementation details",
        "Incomplete understanding of edge cases"
      ],
      memoryHook: "Depth → Understanding → Mastery → Excellence"
    };
  }

  generateQuestionAnswerSlide(topic, question) {
    return {
      title: `Q&A: ${question.substring(0, 60)}${question.length > 60 ? '...' : ''}`,
      narrative: `Answering your question: "${question}"\n\nHere's a detailed explanation with step-by-step reasoning, examples, and verification methods.`,
      keyInsights: [
        "Direct answer to your specific question",
        "Step-by-step reasoning process",
        "Related concepts and connections",
        "Practice and verification methods"
      ],
      analogies: [{
        domain: "Problem Solving",
        comparison: "Like following a detailed recipe with exact measurements",
        lesson: "Precise steps lead to correct outcomes"
      }],
      realWorldScenario: null,
      interactiveElement: "Now try applying this explanation to a similar problem",
      examRelevance: "Directly relevant to similar exam questions",
      commonTraps: [
        "Jumping to conclusions without analysis",
        "Missing hidden assumptions in the question",
        "Incomplete solution verification"
      ],
      memoryHook: "Question → Analysis → Understanding → Application"
    };
  }

  generateQuizResultsSlide(topic, context) {
    return {
      title: `Performance Analysis: ${topic.title}`,
      narrative: `Based on your quiz results, here's an analysis of your performance on ${topic.title}. Let's identify strengths, areas for improvement, and next steps.`,
      keyInsights: [
        "Overall performance assessment",
        "Specific concept strengths",
        "Areas needing more practice",
        "Personalized study recommendations"
      ],
      analogies: [{
        domain: "Sports Training",
        comparison: "Like analyzing game footage to improve performance",
        lesson: "Targeted practice based on analysis yields best results"
      }],
      realWorldScenario: {
        situation: "Similar performance patterns in actual exam preparation",
        application: "Apply these insights to optimize study approach",
        outcome: "Improved efficiency and better results"
      },
      interactiveElement: "Which improvement area will you focus on first?",
      examRelevance: "Direct feedback loop for exam preparation optimization",
      commonTraps: [
        "Ignoring identified weak areas",
        "Not learning from mistakes",
        "Poor time management in practice"
      ],
      memoryHook: "Analyze → Plan → Practice → Improve → Succeed"
    };
  }

  createConceptNarrative(topic) {
    if (topic.description && topic.description.length > 50) {
      return `${topic.description.substring(0, 300)}... This concept is essential for ${this.studentGoal.toUpperCase()} preparation and has wide applications in technical problem-solving.`;
    }

    return `Welcome to learning about ${topic.title}. This is a crucial concept for ${this.studentGoal.toUpperCase()} preparation, covering fundamental principles, practical applications, and important considerations for mastery.`;
  }

  generateEducationalAnalogies(topic) {
    // Use topic-specific analogies if available
    if (topic.analogySeeds && topic.analogySeeds.length > 0) {
      return topic.analogySeeds.slice(0, 2);
    }

    // Generate based on topic content
    const title = topic.title.toLowerCase();

    if (title.includes('synchronization') || title.includes('process')) {
      return [
        {
          domain: "Traffic System",
          comparison: "Like traffic lights coordinating multiple intersections",
          lesson: "Proper coordination prevents collisions and ensures efficiency"
        },
        {
          domain: "Orchestra",
          comparison: "Like musicians following a conductor's cues",
          lesson: "Synchronization creates harmony from individual actions"
        }
      ];
    } else if (title.includes('memory') || title.includes('storage')) {
      return [
        {
          domain: "Library",
          comparison: "Like organizing books for efficient retrieval",
          lesson: "Proper organization maximizes access efficiency"
        },
        {
          domain: "Warehouse",
          comparison: "Like storing inventory with optimal space usage",
          lesson: "Efficient storage management saves space and time"
        }
      ];
    }

    // Default educational analogies
    return [
      {
        domain: "Building Construction",
        comparison: "Like building a strong foundation before adding floors",
        lesson: "Solid fundamentals support advanced learning"
      },
      {
        domain: "Sports Training",
        comparison: "Like practicing basic techniques before complex maneuvers",
        lesson: "Mastery of basics enables advanced performance"
      }
    ];
  }

  generateAdvancedAnalogies(topic) {
    const basicAnalogies = this.generateEducationalAnalogies(topic);

    // Add an advanced analogy
    basicAnalogies.push({
      domain: "Engineering Systems",
      comparison: "Like optimizing a complex system where every component interaction matters",
      lesson: "Advanced understanding requires system-level thinking and attention to detail"
    });

    return basicAnalogies;
  }

  generateInteractiveElement(topic) {
    const questions = [
      `How would you explain ${topic.title} to someone new to this subject?`,
      `What's one practical application of ${topic.title} you find interesting?`,
      `How does ${topic.title} relate to other concepts you've learned?`
    ];

    return questions[Math.floor(Math.random() * questions.length)];
  }

  createMemoryHook(topic) {
    const hooks = [
      `${topic.title}: Understand → Apply → Master`,
      `Remember: ${topic.title} = Foundation + Application`,
      `${topic.title}: Concept → Implementation → Optimization`
    ];

    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  createEmergencySlide(topicIndex, actionType, context) {
    const topic = this.enhancedTopics[topicIndex] || { title: 'Learning Content' };

    return {
      id: `emergency_${Date.now()}`,
      title: topic.title,
      type: actionType,
      content: {
        title: topic.title,
        narrative: 'The learning system is preparing your personalized content. This adaptive educational system tailors explanations to your specific needs and goals.',
        keyInsights: [
          'Personalized learning experience',
          'Adaptive content delivery',
          'Educational intelligence integration',
          'Goal-oriented preparation'
        ],
        analogies: [{
          domain: "Personal Tutor",
          comparison: "Like having an expert tutor who adapts to your learning style",
          lesson: "Customized approach yields optimal learning outcomes"
        }],
        realWorldScenario: {
          situation: "Efficient and effective learning",
          application: "Learning at optimal pace and depth",
          outcome: "Achieving educational objectives effectively"
        },
        interactiveElement: 'What would you like to learn or understand better?',
        examRelevance: 'Tailored to your specific preparation needs',
        commonTraps: ['Skipping fundamentals', 'Inconsistent practice', 'Ignoring feedback'],
        memoryHook: 'Adapt → Learn → Practice → Succeed'
      },
      images: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        isEmergency: true,
        source: 'emergency_fallback',
        studentGoal: this.studentGoal,
        actionType: actionType,
        context: context
      }
    };
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
      return {
        success: false,
        error: error.message,
        quiz: normalizeQuiz(this.generateFallbackQuiz(topic))
      };
    }
  }

  generateLocalQuiz(topic, difficulty) {
    const questions = [];
    const questionTypes = ['conceptual', 'application', 'analysis'];

    for (let i = 0; i < 5; i++) {
      const qType = questionTypes[i % questionTypes.length];
      questions.push(this.createLocalQuestion(topic, qType, difficulty, i));
    }

    return {
      id: `local_quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `${this.studentGoal.toUpperCase()} Quiz: ${topic.title}`,
      topic: topic.title,
      studentGoal: this.studentGoal,
      difficulty: difficulty,
      questions: questions,
      totalQuestions: questions.length,
      estimatedTime: questions.reduce((sum, q) => sum + (q.timeEstimate || 60), 0),
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'local_intelligence',
        topicId: topic.id,
        sessionId: this.sessionId
      }
    };
  }

  createLocalQuestion(topic, type, difficulty, index) {
    const questionId = `q${index + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const baseQuestion = {
      id: questionId,
      difficulty: difficulty,
      type: type,
      conceptsTested: [topic.title],
      timeEstimate: this.getTimeEstimate(type, difficulty),
      topic: topic
    };

    const topicContent = topic.description || topic.title;
    const keyInsights = topic.keyInsights || [];
    const applications = topic.realWorldApplications || [];

    if (type === 'conceptual') {
      return {
        ...baseQuestion,
        text: `Which statement best describes the key concept of ${topic.title}?`,
        question: `Which statement best describes the key concept of ${topic.title}?`,
        options: [
          { id: "A", text: keyInsights[0] || `Understanding the fundamental principles of ${topic.title}`, isCorrect: true },
          { id: "B", text: `Advanced applications beyond basic understanding`, isCorrect: false },
          { id: "C", text: `Historical development only`, isCorrect: false },
          { id: "D", text: `Unrelated theoretical concepts`, isCorrect: false }
        ],
        correctAnswer: "A",
        explanation: `The key concept of ${topic.title} involves ${keyInsights[0] || 'understanding its fundamental principles'}, which is essential for ${this.studentGoal.toUpperCase()} preparation.`,
        misconceptionAnalysis: "Many students confuse basic concepts with advanced applications. Fundamentals are always required.",
        examRelevance: `Tested directly in ${this.studentGoal.toUpperCase()} through definition and basic application questions.`
      };
    } else if (type === 'application') {
      return {
        ...baseQuestion,
        text: `How would you apply ${topic.title} to solve a typical problem?`,
        question: `How would you apply ${topic.title} to solve a typical problem?`,
        options: [
          { id: "A", text: "Use memorized patterns without understanding", isCorrect: false },
          { id: "B", text: "Apply systematic reasoning with proper steps", isCorrect: true },
          { id: "C", text: "Guess based on similar problems", isCorrect: false },
          { id: "D", text: "Skip and try later", isCorrect: false }
        ],
        correctAnswer: "B",
        explanation: `Applying ${topic.title} requires: 1) Understanding the problem, 2) Identifying relevant principles, 3) Applying methodically, 4) Verifying results.`,
        misconceptionAnalysis: "Students often try to memorize patterns instead of understanding application logic.",
        examRelevance: `Application questions constitute significant portion of ${this.studentGoal.toUpperCase()} exams.`
      };
    } else { // analysis
      return {
        ...baseQuestion,
        text: `Which demonstrates deep understanding of ${topic.title}?`,
        question: `Which demonstrates deep understanding of ${topic.title}?`,
        options: [
          { id: "A", text: "Surface-level recognition", isCorrect: false },
          { id: "B", text: "Ability to analyze complex scenarios and draw insights", isCorrect: true },
          { id: "C", text: "Memorizing analysis templates", isCorrect: false },
          { id: "D", text: "Avoiding analysis questions", isCorrect: false }
        ],
        correctAnswer: "B",
        explanation: `Deep understanding of ${topic.title} is shown by analyzing complex scenarios, identifying patterns, drawing insights, and applying concepts creatively.`,
        misconceptionAnalysis: "Many confuse analysis with simple recognition. True analysis requires deeper thinking.",
        examRelevance: `Analysis questions differentiate average from top performers in ${this.studentGoal.toUpperCase()}.`,
        textField: "Please provide a detailed explanation of your answer."
      };
    }
  }

  getTimeEstimate(type, difficulty) {
    const baseTimes = { easy: 45, medium: 75, hard: 120 };
    const typeMultipliers = { conceptual: 1.0, application: 1.2, analysis: 1.5 };

    const base = baseTimes[difficulty] || 60;
    const multiplier = typeMultipliers[type] || 1.0;

    return Math.round(base * multiplier);
  }

  generateFallbackQuiz(topic) {
    const topicTitle = typeof topic === 'string' ? topic : topic.title;

    return {
      id: `fallback_quiz_${Date.now()}`,
      title: `Quiz: ${topicTitle}`,
      topic: topicTitle,
      questions: [
        {
          id: 'fbq1',
          text: `What is important to know about ${topicTitle}?`,
          question: `What is important to know about ${topicTitle}?`,
          options: [
            { id: "A", text: "Both conceptual understanding and practical application", isCorrect: true },
            { id: "B", text: "Only theoretical knowledge", isCorrect: false },
            { id: "C", text: "Only memorization", isCorrect: false },
            { id: "D", text: "Only historical context", isCorrect: false }
          ],
          correctAnswer: "A",
          explanation: `${topicTitle} requires both solid conceptual understanding AND practical application skills for mastery.`,
          difficulty: "medium",
          type: "conceptual",
          textField: "Please provide a detailed explanation of your answer."
        }
      ],
      metadata: {
        isFallback: true,
        generatedAt: new Date().toISOString()
      }
    };
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