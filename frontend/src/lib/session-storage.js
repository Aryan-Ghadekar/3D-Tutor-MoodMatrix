const SESSION_STORAGE_KEY = 'adaptive_learning_sessions';
const CURRENT_SESSION_KEY = 'current_learning_session';

export class SessionStorage {
  constructor() {
    this.initializeStorage();
  }

  initializeStorage() {
    if (!localStorage.getItem(SESSION_STORAGE_KEY)) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({}));
    }
  }

  createNewSession(goal, topic) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData = {
      sessionId,
      goal,
      topic,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      slides: [],
      quizzes: [],
      interactions: [],
      misconceptions: [],
      cognitiveLoad: 'medium',
      knowledgeLevel: 'beginner',
      progress: {
        slidesCompleted: 0,
        quizzesCompleted: 0,
        totalTimeSpent: 0,
        lastTopic: topic
      },
      settings: {
        difficulty: 'adaptive',
        explanationDepth: 'detailed',
        quizFrequency: 'adaptive',
        feedbackEnabled: true
      },
      metadata: {
        version: '1.0',
        platform: 'web'
      }
    };

    this.saveSession(sessionId, sessionData);
    this.setCurrentSession(sessionId);
    
    return sessionData;
  }

  saveSession(sessionId, sessionData) {
    try {
      const allSessions = this.getAllSessions();
      sessionData.lastActivity = new Date().toISOString();
      allSessions[sessionId] = sessionData;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(allSessions));
      return true;
    } catch (error) {
      console.error('Error saving session:', error);
      return false;
    }
  }

  getSession(sessionId) {
    try {
      const allSessions = this.getAllSessions();
      return allSessions[sessionId] || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  updateSession(sessionId, updates) {
    try {
      const session = this.getSession(sessionId);
      if (!session) return false;

      const updatedSession = {
        ...session,
        ...updates,
        lastActivity: new Date().toISOString()
      };

      return this.saveSession(sessionId, updatedSession);
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }

  addSlideToSession(sessionId, slideData) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const slides = session.slides || [];
    slides.push({
      ...slideData,
      viewedAt: new Date().toISOString(),
      slideNumber: slides.length + 1
    });

    return this.updateSession(sessionId, {
      slides,
      progress: {
        ...session.progress,
        slidesCompleted: slides.length,
        lastTopic: slideData.topic || session.topic
      }
    });
  }

  addQuizToSession(sessionId, quizData, results) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const quizzes = session.quizzes || [];
    quizzes.push({
      ...quizData,
      results,
      completedAt: new Date().toISOString(),
      quizNumber: quizzes.length + 1
    });

    const misconceptions = results.misconceptions || [];
    const allMisconceptions = [...(session.misconceptions || []), ...misconceptions];

    return this.updateSession(sessionId, {
      quizzes,
      misconceptions: allMisconceptions,
      progress: {
        ...session.progress,
        quizzesCompleted: quizzes.length
      }
    });
  }

  addInteractionToSession(sessionId, interaction) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const interactions = session.interactions || [];
    interactions.push({
      ...interaction,
      timestamp: new Date().toISOString()
    });

    return this.updateSession(sessionId, { interactions });
  }

  updateCognitiveLoad(sessionId, cognitiveLoad) {
    return this.updateSession(sessionId, { cognitiveLoad });
  }

  updateKnowledgeLevel(sessionId, knowledgeLevel) {
    return this.updateSession(sessionId, { knowledgeLevel });
  }

  getSessionProgress(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const totalSlides = session.slides?.length || 0;
    const totalQuizzes = session.quizzes?.length || 0;
    const totalMisconceptions = session.misconceptions?.length || 0;
    const totalInteractions = session.interactions?.length || 0;

    const lastQuiz = session.quizzes?.slice(-1)[0];
    const lastScore = lastQuiz?.results?.score || 0;

    const weakConcepts = this.analyzeWeakConcepts(session);

    return {
      sessionId,
      goal: session.goal,
      topic: session.topic,
      slidesCompleted: totalSlides,
      quizzesCompleted: totalQuizzes,
      misconceptionsFound: totalMisconceptions,
      interactions: totalInteractions,
      averageQuizScore: this.calculateAverageScore(session),
      lastQuizScore: lastScore,
      cognitiveLoad: session.cognitiveLoad,
      knowledgeLevel: session.knowledgeLevel,
      weakConcepts: weakConcepts.slice(0, 5),
      timeSpent: session.progress?.totalTimeSpent || 0,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt
    };
  }

  calculateAverageScore(session) {
    const quizzes = session.quizzes || [];
    if (quizzes.length === 0) return 0;

    const total = quizzes.reduce((sum, quiz) => sum + (quiz.results?.score || 0), 0);
    return Math.round(total / quizzes.length);
  }

  analyzeWeakConcepts(session) {
    const misconceptions = session.misconceptions || [];
    const conceptMap = {};

    misconceptions.forEach(misconception => {
      const concept = misconception.concept || 'Unknown';
      if (!conceptMap[concept]) {
        conceptMap[concept] = { count: 0, examples: [] };
      }
      conceptMap[concept].count++;
      if (conceptMap[concept].examples.length < 3) {
        conceptMap[concept].examples.push(misconception.example);
      }
    });

    return Object.entries(conceptMap)
      .map(([concept, data]) => ({
        concept,
        count: data.count,
        examples: data.examples,
        severity: data.count > 3 ? 'high' : data.count > 1 ? 'medium' : 'low'
      }))
      .sort((a, b) => b.count - a.count);
  }

  getSessionAnalytics(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const progress = this.getSessionProgress(sessionId);
    const weakConcepts = this.analyzeWeakConcepts(session);

    const interactionTypes = {};
    session.interactions?.forEach(interaction => {
      const type = interaction.type || 'unknown';
      interactionTypes[type] = (interactionTypes[type] || 0) + 1;
    });

    const quizPerformance = {};
    session.quizzes?.forEach((quiz, index) => {
      quizPerformance[`quiz_${index + 1}`] = {
        score: quiz.results?.score || 0,
        topic: quiz.topic || 'Unknown',
        date: quiz.completedAt
      };
    });

    const timeAnalysis = this.analyzeTimeSpent(session);

    return {
      sessionId,
      progress,
      weakConcepts,
      interactionTypes,
      quizPerformance,
      timeAnalysis,
      cognitiveLoadHistory: this.getCognitiveLoadHistory(session),
      recommendations: this.generateRecommendations(session)
    };
  }

  analyzeTimeSpent(session) {
    const slides = session.slides || [];
    const totalTime = slides.reduce((sum, slide) => sum + (slide.timeSpent || 0), 0);
    const averageTimePerSlide = slides.length > 0 ? Math.round(totalTime / slides.length) : 0;

    return {
      totalTime,
      averageTimePerSlide,
      slidesWithHighTime: slides.filter(s => (s.timeSpent || 0) > 300).length,
      estimatedRemainingTime: this.estimateRemainingTime(session)
    };
  }

  estimateRemainingTime(session) {
    const slides = session.slides || [];
    const averageTime = slides.length > 0 
      ? slides.reduce((sum, slide) => sum + (slide.timeSpent || 0), 0) / slides.length
      : 120;

    const estimatedTopics = 5;
    const slidesPerTopic = 2;
    const totalEstimatedSlides = estimatedTopics * slidesPerTopic;
    const slidesRemaining = totalEstimatedSlides - slides.length;

    return Math.max(0, slidesRemaining * averageTime);
  }

  getCognitiveLoadHistory(session) {
    const interactions = session.interactions || [];
    const loadHistory = [];

    interactions.forEach((interaction, index) => {
      if (interaction.cognitiveLoad) {
        loadHistory.push({
          index,
          load: interaction.cognitiveLoad,
          type: interaction.type,
          timestamp: interaction.timestamp
        });
      }
    });

    return loadHistory;
  }

  generateRecommendations(session) {
    const recommendations = [];
    const progress = this.getSessionProgress(session.sessionId);

    if (progress.averageQuizScore < 60) {
      recommendations.push({
        type: 'difficulty_adjustment',
        priority: 'high',
        message: 'Consider lowering difficulty level',
        action: 'reduce_difficulty'
      });
    }

    if (progress.weakConcepts.length > 0) {
      recommendations.push({
        type: 'concept_review',
        priority: 'medium',
        message: `Review: ${progress.weakConcepts.map(c => c.concept).join(', ')}`,
        action: 'review_weak_concepts'
      });
    }

    if (session.cognitiveLoad === 'high' && session.interactions?.length > 10) {
      recommendations.push({
        type: 'break_suggestion',
        priority: 'low',
        message: 'Take a short break to reduce cognitive load',
        action: 'suggest_break'
      });
    }

    return recommendations;
  }

  setCurrentSession(sessionId) {
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
  }

  getCurrentSession() {
    const sessionId = localStorage.getItem(CURRENT_SESSION_KEY);
    return sessionId ? this.getSession(sessionId) : null;
  }

  getCurrentSessionId() {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  }

  getAllSessions() {
    try {
      const sessions = localStorage.getItem(SESSION_STORAGE_KEY);
      return sessions ? JSON.parse(sessions) : {};
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return {};
    }
  }

  deleteSession(sessionId) {
    try {
      const allSessions = this.getAllSessions();
      delete allSessions[sessionId];
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(allSessions));

      const currentSession = this.getCurrentSessionId();
      if (currentSession === sessionId) {
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  clearAllSessions() {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({}));
      localStorage.removeItem(CURRENT_SESSION_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing all sessions:', error);
      return false;
    }
  }

  exportSessionData(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return {
      sessionData: session,
      progress: this.getSessionProgress(sessionId),
      analytics: this.getSessionAnalytics(sessionId),
      exportDate: new Date().toISOString(),
      format: 'adaptive_learning_v1'
    };
  }

  importSessionData(data) {
    try {
      if (!data.sessionData || !data.sessionData.sessionId) {
        throw new Error('Invalid session data format');
      }

      const sessionId = data.sessionData.sessionId;
      this.saveSession(sessionId, data.sessionData);
      return sessionId;
    } catch (error) {
      console.error('Error importing session data:', error);
      return null;
    }
  }
}

export default SessionStorage;