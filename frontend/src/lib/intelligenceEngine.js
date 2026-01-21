/**
 * COMPLETE REGENERATED VERSION - INTELLIGENT LEARNING ENGINE
 * Uses REAL lecture plan data with intelligent enhancements
 */

// =========================================================
// DEPENDENCIES AND IMPORTS
// =========================================================
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001";

// =========================================================
// INTELLIGENCE ENGINE CLASS
// =========================================================
export default class IntelligenceEngine {
  constructor(sessionId, config = {}) {
    this.sessionId = sessionId;
    this.config = {
      backendUrl: BACKEND_URL,
      maxTopics: 6,
      defaultGoal: 'gate',
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
    this.imageGenerator = this.initializeImageGenerator();
    
    console.log(`IntelligenceEngine initialized for session: ${sessionId}`);
  }

  // =========================================================
  // INITIALIZATION
  // =========================================================
  
  async initialize(goal = null, knowledgeTestResults = null) {
    console.log('Initializing IntelligenceEngine v3.0...');
    
    try {
      // Set student goal
      this.studentGoal = goal || await this.loadStudentGoal() || this.config.defaultGoal;
      
      // Load knowledge test results if provided
      if (knowledgeTestResults) {
        this.knowledgeLevel = knowledgeTestResults.knowledgeLevel || 'intermediate';
        this.misconceptions = knowledgeTestResults.misconceptions || [];
      }
      
      // Load REAL lecture plan from backend
      await this.loadRealLecturePlan();
      
      // If no real plan exists, create educational mock (not generic!)
      if (!this.lecturePlan || !this.lecturePlan.impTopics || this.lecturePlan.impTopics.length === 0) {
        console.log('No real lecture plan found, creating educational mock');
        this.lecturePlan = await this.createEducationalMockPlan();
      }
      
      // Enhance topics with educational intelligence
      await this.enhanceTopicsWithIntelligence();
      
      // Initialize topic progress tracking
      this.initializeTopicProgress();
      
      // Generate adaptive settings
      this.generateAdaptiveSettings();
      
      // Save initial state
      await this.saveSessionState();
      
      console.log('IntelligenceEngine initialized:', {
        topics: this.lecturePlan.impTopics.length,
        enhancedTopics: this.enhancedTopics.length,
        studentGoal: this.studentGoal,
        knowledgeLevel: this.knowledgeLevel,
        adaptiveSettings: this.adaptiveSettings
      });
      
      return this.getInitialAnalysis();
      
    } catch (error) {
      console.error('IntelligenceEngine initialization failed:', error);
      return this.createEmergencyAnalysis();
    }
  }

  // =========================================================
  // LECTURE PLAN MANAGEMENT
  // =========================================================
  
  async loadRealLecturePlan() {
    console.log('Loading REAL lecture plan from backend...');
    
    try {
      // Try to get lecture plan by session ID
      let lecturePlan = null;
      
      // First try: Get by session ID
      if (this.sessionId) {
        const response = await fetch(
          `${this.config.backendUrl}/get-lecture-plan?sessionId=${this.sessionId}`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.lecturePlan) {
            lecturePlan = data.lecturePlan;
            console.log('Loaded lecture plan by session ID:', lecturePlan.topic);
          }
        }
      }
      
      // Second try: Get latest lecture plan
      if (!lecturePlan) {
        const response = await fetch(
          `${this.config.backendUrl}/get-lecture-plan?latest=true`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.lecturePlan) {
            lecturePlan = data.lecturePlan;
            console.log('Loaded latest lecture plan:', lecturePlan.topic);
          }
        }
      }
      
      // Third try: Check local storage
      if (!lecturePlan && typeof window !== 'undefined') {
        const savedPlan = localStorage.getItem('current_lecture_plan');
        if (savedPlan) {
          try {
            lecturePlan = JSON.parse(savedPlan);
            console.log('Loaded lecture plan from localStorage');
          } catch (e) {
            console.warn('Failed to parse localStorage lecture plan:', e);
          }
        }
      }
      
      if (lecturePlan) {
        // Clean and validate the lecture plan
        this.lecturePlan = this.cleanAndValidateLecturePlan(lecturePlan);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error loading lecture plan:', error);
      return false;
    }
  }

  cleanAndValidateLecturePlan(plan) {
    if (!plan || typeof plan !== 'object') {
      return null;
    }
    
    // Ensure impTopics exists and is array
    if (!plan.impTopics || !Array.isArray(plan.impTopics)) {
      plan.impTopics = [];
    }
    
    // Clean each topic
    plan.impTopics = plan.impTopics.map((topic, index) => {
      if (!topic || typeof topic !== 'object') {
        return this.createDefaultTopic(index);
      }
      
      // Ensure required fields
      return {
        id: topic.id || `topic-${index + 1}`,
        title: this.cleanTopicTitle(topic.title || topic.name || `Topic ${index + 1}`),
        description: topic.description || topic.text || topic.full_text || '',
        importance: topic.importance || 'medium',
        weightage: typeof topic.weightage === 'number' ? topic.weightage : 50,
        difficulty: topic.difficulty || 'medium',
        
        // Educational fields (may be empty initially)
        keyInsights: Array.isArray(topic.keyInsights) ? topic.keyInsights : 
                    Array.isArray(topic.key_insights) ? topic.key_insights : [],
        
        commonMisconceptions: Array.isArray(topic.commonMisconceptions) ? topic.commonMisconceptions :
                            Array.isArray(topic.common_misconceptions) ? topic.common_misconceptions : [],
        
        realWorldApplications: Array.isArray(topic.realWorldApplications) ? topic.realWorldApplications :
                             Array.isArray(topic.real_world_applications) ? topic.real_world_applications : [],
        
        prerequisites: Array.isArray(topic.prerequisites) ? topic.prerequisites : [],
        
        // Metadata
        estimatedTime: topic.estimated_time || topic.estimatedTime || '25-35 minutes',
        educationalValue: topic.educational_value || topic.educationalValue || {},
        
        // Keep original for reference
        originalData: topic
      };
    }).filter(topic => {
      // Filter out topics with garbage titles
      const title = topic.title.toLowerCase();
      const garbagePatterns = [
        'fig', 'table', 'cid:', 'activity', 'exercise', 
        'question', 'answer', 'solution', 'blank'
      ];
      
      return !garbagePatterns.some(pattern => title.includes(pattern)) &&
             topic.title.length > 5 &&
             topic.title.split(' ').length <= 10;
    });
    
    // Limit to max topics
    plan.impTopics = plan.impTopics.slice(0, this.config.maxTopics);
    
    // Add metadata if missing
    if (!plan.metadata) plan.metadata = {};
    plan.metadata.cleanedAt = new Date().toISOString();
    plan.metadata.totalValidTopics = plan.impTopics.length;
    
    return plan;
  }

  cleanTopicTitle(title) {
    if (!title || typeof title !== 'string') {
      return 'Learning Topic';
    }
    
    let clean = title
      // Remove PDF artifacts
      .replace(/\(cid:\d+\)/g, '')
      .replace(/Fig\.?\s*\d+[\.\d]*\s*[:–-]\s*/gi, '')
      .replace(/Table\s*\d+[\.\d]*\s*[:–-]\s*/gi, '')
      .replace(/\b\d+\.\d+\s*[-–]\s*/g, '')
      .replace(/^\s*[•\-*]\s*/, '')
      
      // Remove numbering
      .replace(/^(Chapter|Section|Topic|Unit|Module|Activity)\s*\d+[\.\d]*\s*[:–-]\s*/gi, '')
      .replace(/^\d+[\.\)\s]*/, '')
      
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Ensure proper sentence ending
    if (clean && !clean.endsWith('.') && !clean.endsWith('?') && !clean.endsWith('!')) {
      clean = clean + '.';
    }
    
    // Remove incomplete endings
    const incompleteEndings = [' a', ' an', ' the', ' and', ' but', ' or', ' for', ' with', ' of', ' in', ' on', ' at'];
    incompleteEndings.forEach(ending => {
      if (clean.toLowerCase().endsWith(ending + '.')) {
        clean = clean.substring(0, clean.length - ending.length - 1) + '.';
      }
    });
    
    // Capitalize properly
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    
    // Limit length
    const words = clean.split(' ');
    if (words.length > 10) {
      clean = words.slice(0, 8).join(' ') + '...';
    }
    
    return clean || 'Important Concept';
  }

  createDefaultTopic(index) {
    const defaultTopics = [
      "Process Synchronization in Operating Systems",
      "Memory Management Techniques",
      "CPU Scheduling Algorithms",
      "File System Organization",
      "Deadlock Detection and Prevention",
      "Virtual Memory Concepts"
    ];
    
    const title = index < defaultTopics.length ? defaultTopics[index] : `Topic ${index + 1}`;
    
    return {
      id: `topic-${index + 1}`,
      title: title,
      description: `This topic covers important concepts related to ${title.toLowerCase()}.`,
      importance: 'medium',
      weightage: 50,
      difficulty: 'medium',
      keyInsights: [],
      commonMisconceptions: [],
      realWorldApplications: [],
      prerequisites: [],
      estimatedTime: '25-35 minutes',
      educationalValue: {},
      isDefault: true
    };
  }

  async createEducationalMockPlan() {
    console.log('Creating educational mock plan...');
    
    // Create meaningful educational topics (not generic!)
    const educationalTopics = [
      {
        id: "topic-1",
        title: "Process Synchronization in Operating Systems",
        description: "Mechanisms for coordinating access to shared resources among multiple processes. Essential for preventing race conditions and ensuring data consistency in concurrent systems.",
        importance: "high",
        weightage: 95,
        difficulty: "medium",
        keyInsights: [
          "Critical section problem and solutions",
          "Semaphore operations and implementation",
          "Monitor concepts and usage",
          "Deadlock conditions and avoidance"
        ],
        commonMisconceptions: [
          "Thinking mutex and semaphore are interchangeable",
          "Believing deadlock avoidance guarantees no deadlocks",
          "Confusing race condition with deadlock"
        ],
        realWorldApplications: [
          "Database transaction management",
          "Multi-threaded web servers",
          "Real-time system coordination"
        ],
        prerequisites: ["Process Management", "Thread Basics"],
        estimatedTime: "35-45 minutes",
        educationalValue: {
          conceptualDepth: 0.8,
          practicalRelevance: 0.9,
          examImportance: 0.95
        }
      },
      {
        id: "topic-2",
        title: "Memory Management Techniques",
        description: "Methods for managing computer memory allocation, protection, and optimization. Includes paging, segmentation, and virtual memory concepts.",
        importance: "high",
        weightage: 90,
        difficulty: "medium",
        keyInsights: [
          "Paging concepts and page tables",
          "Segmentation and its advantages",
          "Virtual memory implementation",
          "Page replacement algorithms"
        ],
        commonMisconceptions: [
          "Confusing physical and virtual addresses",
          "Thinking all page replacement algorithms are equally efficient",
          "Believing segmentation eliminates external fragmentation"
        ],
        realWorldApplications: [
          "Operating system memory allocation",
          "Database buffer management",
          "Web browser tab isolation"
        ],
        prerequisites: ["Computer Architecture", "Basic OS Concepts"],
        estimatedTime: "30-40 minutes",
        educationalValue: {
          conceptualDepth: 0.7,
          practicalRelevance: 0.8,
          examImportance: 0.9
        }
      },
      {
        id: "topic-3",
        title: "CPU Scheduling Algorithms",
        description: "Algorithms used by operating systems to decide which processes run when. Includes FCFS, SJF, Round Robin, and priority scheduling.",
        importance: "medium",
        weightage: 85,
        difficulty: "easy",
        keyInsights: [
          "Preemptive vs non-preemptive scheduling",
          "CPU utilization and throughput metrics",
          "Response time and waiting time calculations",
          "Algorithm trade-offs and selection criteria"
        ],
        commonMisconceptions: [
          "Thinking SJF always gives optimal average waiting time",
          "Confusing turnaround time with response time",
          "Believing Round Robin has no starvation"
        ],
        realWorldApplications: [
          "Operating system process scheduling",
          "Real-time system task management",
          "Cloud computing resource allocation"
        ],
        prerequisites: ["Process Concepts", "Basic Algorithms"],
        estimatedTime: "25-35 minutes",
        educationalValue: {
          conceptualDepth: 0.6,
          practicalRelevance: 0.8,
          examImportance: 0.85
        }
      }
    ];
    
    return {
      sessionId: this.sessionId,
      lectureId: `mock_lecture_${Date.now()}`,
      topic: "Operating Systems Core Concepts",
      duration: "90 minutes",
      date: new Date().toISOString().split('T')[0],
      instructor: "AI Learning Assistant",
      studentGoal: this.studentGoal,
      impTopics: educationalTopics,
      totalTopics: educationalTopics.length,
      metadata: {
        analysisDepth: "educational_mock",
        confidenceScore: 0.75,
        generatedAt: new Date().toISOString(),
        isMock: true,
        version: "3.0"
      }
    };
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
    
    this.adaptiveSettings = goalSettings[this.studentGoal] || goalSettings.gate;
    
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
  
  async generateSlideContent(topicIndex, actionType = 'concept_explanation', context = '') {
    console.log(`Generating slide for topic ${topicIndex}, action: ${actionType}`);
    
    try {
      // Get the topic
      const topic = this.enhancedTopics[topicIndex];
      if (!topic) {
        throw new Error(`Topic at index ${topicIndex} not found`);
      }
      
      // Update progress
      this.updateTopicProgress(topic.id, { 
        started: true,
        slidesViewed: (this.topicProgress[topic.id]?.slidesViewed || 0) + 1 
      });
      
      // Try to generate from backend API first (with knowledge state and misconceptions)
      let slideContent;
      let images = [];
      let backendSuccess = false;
      
      try {
        // Prepare knowledge state
        const knowledgeState = {
          level: this.knowledgeLevel,
          misconceptions: this.misconceptions || [],
          topicsCompleted: Array.from(this.completedTopics),
          quizHistory: this.quizHistory.slice(-5) // Last 5 quizzes
        };
        
        // Prepare misconceptions list
        const misconceptionsList = (this.misconceptions || []).map(m => ({
          concept: m.concept || m.type || 'general',
          description: m.description || m.question || '',
          topic: topic.title
        }));
        
        // Call backend API
        const backendResponse = await fetch(`${this.config.backendUrl}/generate-slide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic,
            actionType: actionType,
            context: context,
            studentGoal: this.studentGoal,
            knowledgeLevel: this.knowledgeLevel,
            sessionId: this.sessionId,
            lecturePlan: this.lecturePlan,
            knowledgeState: knowledgeState,
            misconceptions: misconceptionsList,
            previousSlides: this.learningHistory.slice(-3) // Last 3 slides
          }),
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });
        
        if (backendResponse.ok) {
          const backendData = await backendResponse.json();
          if (backendData.success && backendData.slide) {
            slideContent = backendData.slide.content;
            images = backendData.slide.images || [];
            backendSuccess = true;
            console.log('Slide generated from backend API');
          }
        }
      } catch (backendError) {
        console.warn('Backend API failed, using local generation:', backendError.message);
      }
      
      // Fallback to local generation if backend failed
      if (!backendSuccess) {
        if (actionType === 'explain-more') {
          slideContent = this.generateExplainMoreSlide(topic, context);
        } else if (actionType === 'ask-question') {
          slideContent = this.generateQuestionAnswerSlide(topic, context);
        } else if (actionType === 'quiz-results' || actionType === 'mistake-explanation') {
          slideContent = this.generateQuizResultsSlide(topic, context);
        } else {
          slideContent = this.generateConceptSlide(topic);
        }
        
        // Generate images locally
        images = await this.generateSlideImages(topic, slideContent);
      }
      
      // Create complete slide object
      const slide = {
        id: `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: slideContent.title || topic.title,
        type: actionType,
        content: slideContent,
        images: images,
        metadata: {
          generatedAt: new Date().toISOString(),
          topicId: topic.id,
          topicIndex: topicIndex,
          studentGoal: this.studentGoal,
          knowledgeLevel: this.knowledgeLevel,
          actionType: actionType,
          context: context,
          adaptiveSettings: this.adaptiveSettings,
          source: backendSuccess ? 'backend_api' : 'intelligence_engine_v3',
          hasKnowledgeState: backendSuccess
        }
      };
      
      // Track in learning history
      this.learningHistory.push({
        timestamp: new Date().toISOString(),
        slideId: slide.id,
        topicId: topic.id,
        actionType: actionType,
        slideTitle: slide.title
      });
      
      console.log(`Slide generated: ${slide.title} (${slide.metadata.source})`);
      return slide;
      
    } catch (error) {
      console.error('Slide generation failed:', error);
      return this.createEmergencySlide(topicIndex, actionType, context);
    }
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

  async generateSlideImages(topic, slideContent) {
    try {
      // Try to get real educational images
      if (this.imageGenerator) {
        const images = await this.imageGenerator.getEducationalImages(
          topic.title, 
          2, 
          slideContent.narrative
        );
        
        if (images && images.length > 0 && !images[0].isPlaceholder) {
          return images;
        }
      }
      
      // Fallback to conceptual images
      return this.generateConceptualImages(topic, slideContent);
      
    } catch (error) {
      console.warn('Image generation failed, using fallback:', error.message);
      return this.generateConceptualImages(topic, slideContent);
    }
  }

  generateConceptualImages(topic, slideContent) {
    const colors = ['3b82f6', '10b981', '8b5cf6', 'f59e0b', 'ef4444'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const encodedTitle = encodeURIComponent(topic.title.substring(0, 30));
    const encodedInsight = slideContent.keyInsights && slideContent.keyInsights[0] 
      ? encodeURIComponent(slideContent.keyInsights[0].substring(0, 40))
      : encodedTitle;
    
    return [
      {
        id: `concept_${Date.now()}_1`,
        url: `https://via.placeholder.com/800x500/${color}/ffffff?text=${encodedTitle}`,
        caption: `Concept Overview: ${topic.title}`,
        alt: `Conceptual diagram for ${topic.title}`,
        source: 'conceptual',
        isPlaceholder: true
      },
      {
        id: `concept_${Date.now()}_2`,
        url: `https://via.placeholder.com/600x400/${colors[1]}/ffffff?text=${encodedInsight}`,
        caption: 'Key Insight Visualization',
        alt: 'Visual representation of important learning point',
        source: 'conceptual',
        isPlaceholder: true
      }
    ];
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
      images: [{
        id: `emergency_img_${Date.now()}`,
        url: `https://via.placeholder.com/800x500/3b82f6/ffffff?text=${encodeURIComponent(topic.title.substring(0, 30))}`,
        caption: 'Educational Content',
        alt: 'Learning system interface',
        source: 'emergency',
        isPlaceholder: true
      }],
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
  
  async generateQuiz(topic, difficulty = 'medium') {
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
        lecturePlan: this.lecturePlan
      };
      
      // Try backend first
      let quiz;
      try {
        const response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quizData),
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.quiz) {
            quiz = data.quiz;
          } else {
            throw new Error('Backend quiz generation failed');
          }
        } else {
          throw new Error(`Backend error: ${response.status}`);
        }
      } catch (backendError) {
        console.log('Backend quiz failed, generating locally:', backendError.message);
        quiz = this.generateLocalQuiz(topicData, difficulty);
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
        quiz: this.generateFallbackQuiz(topic)
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
      timeEstimate: this.getTimeEstimate(type, difficulty)
    };
    
    if (type === 'conceptual') {
      return {
        ...baseQuestion,
        question: `What is the fundamental concept of ${topic.title}?`,
        options: [
          { id: "A", text: "Basic principle that forms the foundation", isCorrect: true },
          { id: "B", text: "Advanced application only for experts", isCorrect: false },
          { id: "C", text: "Historical background information", isCorrect: false },
          { id: "D", text: "Optional supplementary knowledge", isCorrect: false }
        ],
        correctAnswer: "A",
        explanation: `The fundamental concept of ${topic.title} involves understanding its basic principles and definitions, which are essential for ${this.studentGoal.toUpperCase()} preparation.`,
        misconceptionAnalysis: "Many students confuse basic concepts with advanced applications. Fundamentals are always required.",
        examRelevance: `Tested directly in ${this.studentGoal.toUpperCase()} through definition and basic application questions.`
      };
    } else if (type === 'application') {
      return {
        ...baseQuestion,
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
        examRelevance: `Analysis questions differentiate average from top performers in ${this.studentGoal.toUpperCase()}.`
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
          type: "conceptual"
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

  createEmergencyAnalysis() {
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
        message: 'Learning system initialization failed. Please try again.',
        action: 'Restart learning session'
      }],
      isEmergency: true,
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

  initializeImageGenerator() {
    // Return a simple image generator
    return {
      getEducationalImages: async (topic, count, context) => {
        // This would integrate with your actual image server
        // For now, return conceptual images
        return [];
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