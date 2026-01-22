// =========================================================
// MISCONCEPTION TRACKER - ADAPTIVE LEARNING ANALYTICS
// =========================================================

export default class MisconceptionTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.misconceptions = new Map(); // key: concept_type → misconception data
    this.quizHistory = [];
    this.studentProfile = this.createInitialProfile();
    
    console.log(`MisconceptionTracker created for session: ${sessionId}`);
  }

  // =========================================================
  // INITIALIZATION
  // =========================================================

  createInitialProfile() {
    return {
      sessionId: this.sessionId,
      totalQuizzes: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      averageScore: 0,
      weakConcepts: [],
      strongConcepts: [],
      frequentMistakes: {},
      learningPattern: 'balanced',
      engagementLevel: 'medium',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isActive: true
    };
  }

  // =========================================================
  // QUIZ RESULTS PROCESSING
  // =========================================================

  addQuizResults(quizData, userAnswers, quizId) {
    console.log(`Processing quiz results: ${quizId}`);
    
    try {
      // Validate input
      if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz data');
      }
      
      if (!userAnswers || !Array.isArray(userAnswers)) {
        throw new Error('Invalid user answers');
      }
      
      const { score, performanceAnalysis } = this.calculateQuizPerformance(quizData.questions, userAnswers);
      const misconceptions = this.analyzeQuizForMisconceptions(quizData.questions, userAnswers, quizData.topic);
      
      console.log(`Quiz ${quizId}: Score ${score}%, ${misconceptions.length} misconceptions found`);
      
      // Process each misconception
      misconceptions.forEach(misconception => {
        this.addOrUpdateMisconception(misconception, quizId);
      });
      
      // Update quiz history
      this.addToQuizHistory(quizData, quizId, score, userAnswers, misconceptions, performanceAnalysis);
      
      // Update student profile
      this.updateStudentProfile(score, misconceptions, performanceAnalysis);
      
      return {
        success: true,
        score: score,
        misconceptions: misconceptions,
        performanceAnalysis: performanceAnalysis,
        message: `Quiz results processed. Score: ${score}%`
      };
      
    } catch (error) {
      console.error('Error processing quiz results:', error);
      return {
        success: false,
        error: error.message,
        score: 0,
        misconceptions: [],
        performanceAnalysis: null
      };
    }
  }

  calculateQuizPerformance(questions, userAnswers) {
    if (!questions || questions.length === 0) {
      return { score: 0, performanceAnalysis: {} };
    }
    
    let correctCount = 0;
    let totalScore = 0;
    const conceptPerformance = {};
    const difficultyPerformance = {};
    const questionTypes = {};
    
    questions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      const correctAnswer = this.getCorrectAnswer(question);
      const isCorrect = userAnswer === correctAnswer;
      
      if (isCorrect) {
        correctCount++;
        totalScore += question.difficulty === 'hard' ? 2 : question.difficulty === 'medium' ? 1.5 : 1;
      }
      
      // Track concept performance
      const concepts = question.conceptsTested || [question.topic || 'general'];
      concepts.forEach(concept => {
        if (!conceptPerformance[concept]) {
          conceptPerformance[concept] = { total: 0, correct: 0, difficultySum: 0 };
        }
        conceptPerformance[concept].total++;
        if (isCorrect) conceptPerformance[concept].correct++;
        conceptPerformance[concept].difficultySum += this.getDifficultyValue(question.difficulty);
      });
      
      // Track difficulty performance
      const difficulty = question.difficulty || 'medium';
      if (!difficultyPerformance[difficulty]) {
        difficultyPerformance[difficulty] = { total: 0, correct: 0 };
      }
      difficultyPerformance[difficulty].total++;
      if (isCorrect) difficultyPerformance[difficulty].correct++;
      
      // Track question types
      const type = question.type || 'conceptual';
      if (!questionTypes[type]) {
        questionTypes[type] = { total: 0, correct: 0 };
      }
      questionTypes[type].total++;
      if (isCorrect) questionTypes[type].correct++;
    });
    
    // Calculate final score (0-100)
    const maxScore = questions.length * 2; // Hard questions worth 2 points
    const rawScore = Math.round((totalScore / maxScore) * 100);
    const score = Math.min(100, Math.max(0, rawScore));
    
    // Calculate concept accuracies
    Object.keys(conceptPerformance).forEach(concept => {
      const data = conceptPerformance[concept];
      data.accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      data.averageDifficulty = data.total > 0 ? (data.difficultySum / data.total) : 1;
    });
    
    // Calculate difficulty accuracies
    Object.keys(difficultyPerformance).forEach(difficulty => {
      const data = difficultyPerformance[difficulty];
      data.accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    });
    
    // Calculate type accuracies
    Object.keys(questionTypes).forEach(type => {
      const data = questionTypes[type];
      data.accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    });
    
    // Identify weak concepts (accuracy < 60%)
    const weakConcepts = Object.entries(conceptPerformance)
      .filter(([_, data]) => data.accuracy < 60)
      .map(([concept, _]) => concept);
    
    // Identify strong concepts (accuracy >= 80%)
    const strongConcepts = Object.entries(conceptPerformance)
      .filter(([_, data]) => data.accuracy >= 80)
      .map(([concept, _]) => concept);
    
    const performanceAnalysis = {
      correctCount: correctCount,
      totalQuestions: questions.length,
      score: score,
      conceptPerformance: conceptPerformance,
      difficultyPerformance: difficultyPerformance,
      questionTypes: questionTypes,
      weakConcepts: weakConcepts,
      strongConcepts: strongConcepts,
      timeAnalysis: {
        totalTime: questions.reduce((sum, q) => sum + (q.timeEstimate || 60), 0),
        averagePerQuestion: Math.round(questions.reduce((sum, q) => sum + (q.timeEstimate || 60), 0) / questions.length)
      }
    };
    
    return { score, performanceAnalysis };
  }

  getCorrectAnswer(question) {
    if (question.correctAnswer) return question.correctAnswer;
    
    // Find correct option
    const correctOption = question.options?.find(opt => opt.isCorrect);
    return correctOption?.id || null;
  }

  getDifficultyValue(difficulty) {
    const values = { 'easy': 1, 'medium': 2, 'hard': 3 };
    return values[difficulty?.toLowerCase()] || 2;
  }

  // =========================================================
  // MISCONCEPTION ANALYSIS
  // =========================================================

  analyzeQuizForMisconceptions(questions, userAnswers, topic) {
    const misconceptions = [];
    
    if (!questions || !userAnswers || questions.length !== userAnswers.length) {
      return misconceptions;
    }
    
    questions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      const correctAnswer = this.getCorrectAnswer(question);
      
      if (userAnswer !== correctAnswer) {
        const misconception = this.analyzeWrongAnswer(question, userAnswer, topic);
        if (misconception) {
          misconception.questionIndex = index;
          misconception.quizId = question.quizId || `quiz_${Date.now()}`;
          misconception.timestamp = new Date().toISOString();
          misconceptions.push(misconception);
        }
      }
    });
    
    return misconceptions;
  }

  analyzeWrongAnswer(question, wrongAnswer, topic) {
    const options = question.options || [];
    const wrongOption = options.find(opt => opt.id === wrongAnswer);
    
    if (!wrongOption) {
      return {
        concept: topic || 'general',
        type: 'unknown_error',
        description: 'Selected option not found in question',
        severity: 'low',
        evidence: {
          questionId: question.id,
          questionText: question.question?.substring(0, 100),
          wrongAnswer: wrongAnswer,
          correctAnswer: this.getCorrectAnswer(question)
        }
      };
    }
    
    const wrongText = wrongOption.text.toLowerCase();
    const questionText = question.question?.toLowerCase() || '';
    const concepts = question.conceptsTested || [topic || 'general'];
    
    // Analyze misconception type
    let type = 'general_mistake';
    let description = 'General misunderstanding';
    
    if (wrongText.includes('opposite') || wrongText.includes('reverse')) {
      type = 'conceptual_reversal';
      description = 'Reversed or opposite understanding of concept';
    } else if (wrongText.includes('confusion') || wrongText.includes('mix')) {
      type = 'conceptual_confusion';
      description = 'Confusing similar concepts';
    } else if (wrongText.includes('misunderstanding') || wrongText.includes('wrong')) {
      type = 'fundamental_misunderstanding';
      description = 'Fundamental misunderstanding of concept';
    } else if (wrongText.includes('application') || wrongText.includes('use')) {
      type = 'application_error';
      description = 'Error in applying concept';
    } else if (wrongText.includes('memory') || wrongText.includes('recall')) {
      type = 'memory_error';
      description = 'Memory or recall error';
    } else if (wrongText.includes('calculation')) {
      type = 'calculation_error';
      description = 'Calculation or numerical error';
    } else if (questionText.includes('not') || questionText.includes('except')) {
      type = 'negation_error';
      description = 'Misunderstanding negative phrasing';
    }
    
    // Determine severity
    let severity = 'medium';
    if (type === 'conceptual_reversal' || type === 'fundamental_misunderstanding') {
      severity = 'high';
    } else if (type === 'memory_error') {
      severity = 'low';
    }
    
    // Check if it's a pattern (similar to previous mistakes)
    const isPattern = this.checkForPattern(concepts[0], type);
    
    return {
      concept: concepts[0],
      alternativeConcepts: concepts.slice(1),
      type: type,
      description: description,
      severity: severity,
      isPattern: isPattern,
      evidence: {
        questionId: question.id,
        questionText: question.question?.substring(0, 150),
        wrongAnswer: wrongAnswer,
        wrongOptionText: wrongOption.text,
        correctAnswer: this.getCorrectAnswer(question),
        explanation: question.explanation,
        difficulty: question.difficulty || 'medium',
        questionType: question.type || 'unknown',
        timeEstimate: question.timeEstimate || 60
      }
    };
  }

  checkForPattern(concept, type) {
    const key = `${concept}_${type}`;
    if (!this.misconceptions.has(key)) return false;
    
    const existing = this.misconceptions.get(key);
    return existing.count >= 2; // Pattern if seen at least twice
  }

  addOrUpdateMisconception(misconception, quizId) {
    const key = `${misconception.concept}_${misconception.type}`;
    
    if (this.misconceptions.has(key)) {
      // Update existing misconception
      const existing = this.misconceptions.get(key);
      existing.count++;
      existing.quizIds.push(quizId);
      existing.lastOccurred = new Date().toISOString();
      existing.evidence.push(misconception.evidence);
      existing.confidence = Math.min(100, existing.confidence + 15);
      
      // Update severity if this is worse
      if (misconception.severity === 'high' && existing.severity !== 'high') {
        existing.severity = 'high';
      }
      
      console.log(`Updated misconception: ${key} (count: ${existing.count})`);
      
    } else {
      // Create new misconception
      const newMisconception = {
        id: `miscon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        concept: misconception.concept,
        alternativeConcepts: misconception.alternativeConcepts || [],
        type: misconception.type,
        description: misconception.description,
        count: 1,
        severity: misconception.severity,
        confidence: 70,
        firstOccurred: new Date().toISOString(),
        lastOccurred: new Date().toISOString(),
        quizIds: [quizId],
        evidence: [misconception.evidence],
        resolved: false,
        isPattern: misconception.isPattern || false
      };
      
      this.misconceptions.set(key, newMisconception);
      console.log(`New misconception recorded: ${key}`);
    }
  }

  // =========================================================
  // HISTORY AND PROFILE UPDATES
  // =========================================================

  addToQuizHistory(quizData, quizId, score, userAnswers, misconceptions, performanceAnalysis) {
    const historyEntry = {
      quizId: quizId,
      timestamp: new Date().toISOString(),
      topic: quizData.topic || 'Unknown',
      score: score,
      totalQuestions: quizData.questions?.length || 0,
      correctAnswers: performanceAnalysis.correctCount,
      misconceptionsFound: misconceptions.length,
      performanceAnalysis: performanceAnalysis,
      userAnswers: userAnswers,
      quizData: {
        id: quizData.id,
        title: quizData.title,
        difficulty: quizData.difficulty,
        studentGoal: quizData.studentGoal
      },
      metadata: {
        sessionId: this.sessionId,
        processedAt: new Date().toISOString()
      }
    };
    
    this.quizHistory.push(historyEntry);
    
    // Keep only last 20 quizzes
    if (this.quizHistory.length > 20) {
      this.quizHistory = this.quizHistory.slice(-20);
    }
    
    console.log(`Added to quiz history: ${quizId} (Score: ${score}%)`);
  }

  updateStudentProfile(score, misconceptions, performanceAnalysis) {
    this.studentProfile.totalQuizzes++;
    this.studentProfile.totalQuestions += performanceAnalysis.totalQuestions;
    this.studentProfile.correctAnswers += performanceAnalysis.correctCount;
    
    // Update average score
    const totalScore = this.studentProfile.averageScore * (this.studentProfile.totalQuizzes - 1) + score;
    this.studentProfile.averageScore = Math.round(totalScore / this.studentProfile.totalQuizzes);
    
    // Update weak concepts
    if (performanceAnalysis.weakConcepts.length > 0) {
      performanceAnalysis.weakConcepts.forEach(concept => {
        if (!this.studentProfile.weakConcepts.includes(concept)) {
          this.studentProfile.weakConcepts.push(concept);
        }
      });
      
      // Keep only top 10 weak concepts
      if (this.studentProfile.weakConcepts.length > 10) {
        this.studentProfile.weakConcepts = this.studentProfile.weakConcepts.slice(-10);
      }
    }
    
    // Update strong concepts
    if (performanceAnalysis.strongConcepts.length > 0) {
      performanceAnalysis.strongConcepts.forEach(concept => {
        if (!this.studentProfile.strongConcepts.includes(concept)) {
          this.studentProfile.strongConcepts.push(concept);
        }
      });
      
      // Keep only top 10 strong concepts
      if (this.studentProfile.strongConcepts.length > 10) {
        this.studentProfile.strongConcepts = this.studentProfile.strongConcepts.slice(-10);
      }
    }
    
    // Update frequent mistakes
    misconceptions.forEach(misconception => {
      const mistakeKey = `${misconception.concept}_${misconception.type}`;
      this.studentProfile.frequentMistakes[mistakeKey] = 
        (this.studentProfile.frequentMistakes[mistakeKey] || 0) + 1;
    });
    
    // Update learning pattern
    this.updateLearningPattern();
    
    // Update engagement level
    this.updateEngagementLevel();
    
    this.studentProfile.lastUpdated = new Date().toISOString();
    
    console.log(`Student profile updated. Average score: ${this.studentProfile.averageScore}%`);
  }

  updateLearningPattern() {
    if (this.quizHistory.length < 3) return;
    
    const recentScores = this.quizHistory.slice(-3).map(q => q.score);
    const trend = recentScores[recentScores.length - 1] - recentScores[0];
    
    if (trend > 15) {
      this.studentProfile.learningPattern = 'improving_rapidly';
    } else if (trend > 5) {
      this.studentProfile.learningPattern = 'improving';
    } else if (trend < -15) {
      this.studentProfile.learningPattern = 'declining';
    } else if (trend < -5) {
      this.studentProfile.learningPattern = 'slightly_declining';
    } else {
      this.studentProfile.learningPattern = 'stable';
    }
  }

  updateEngagementLevel() {
    if (this.quizHistory.length < 2) return;
    
    const recentQuizzes = this.quizHistory.slice(-5);
    if (recentQuizzes.length < 2) return;
    
    const timeDiffs = [];
    for (let i = 1; i < recentQuizzes.length; i++) {
      const diff = new Date(recentQuizzes[i].timestamp) - new Date(recentQuizzes[i-1].timestamp);
      timeDiffs.push(diff / (1000 * 60 * 60)); // Convert to hours
    }
    
    const avgHours = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    
    if (avgHours < 24) {
      this.studentProfile.engagementLevel = 'high';
    } else if (avgHours < 72) {
      this.studentProfile.engagementLevel = 'medium';
    } else {
      this.studentProfile.engagementLevel = 'low';
    }
  }

  // =========================================================
  // QUERY AND ANALYSIS METHODS
  // =========================================================

  getTopMisconceptions(limit = 5) {
    const allMisconceptions = Array.from(this.misconceptions.values())
      .filter(m => !m.resolved)
      .sort((a, b) => {
        // Sort by: severity (high to low) → count (high to low) → confidence (high to low)
        const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const scoreA = (severityOrder[a.severity] || 1) * a.count * (a.confidence / 100);
        const scoreB = (severityOrder[b.severity] || 1) * b.count * (b.confidence / 100);
        return scoreB - scoreA;
      });
    
    return allMisconceptions.slice(0, limit);
  }

  getMisconceptionsByConcept(concept) {
    return Array.from(this.misconceptions.values())
      .filter(m => 
        m.concept.toLowerCase().includes(concept.toLowerCase()) ||
        m.alternativeConcepts.some(c => c.toLowerCase().includes(concept.toLowerCase()))
      )
      .sort((a, b) => b.count - a.count);
  }

  getMisconceptionSummary() {
    const allMisconceptions = Array.from(this.misconceptions.values());
    const active = allMisconceptions.filter(m => !m.resolved);
    const resolved = allMisconceptions.filter(m => m.resolved);
    
    const byType = {};
    const byConcept = {};
    const bySeverity = { high: 0, medium: 0, low: 0 };
    
    active.forEach(m => {
      byType[m.type] = (byType[m.type] || 0) + 1;
      byConcept[m.concept] = (byConcept[m.concept] || 0) + 1;
      bySeverity[m.severity] = (bySeverity[m.severity] || 0) + 1;
    });
    
    const mostCommonConcept = Object.entries(byConcept)
      .sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    
    const mostCommonType = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])[0] || ['None', 0];
    
    return {
      total: allMisconceptions.length,
      active: active.length,
      resolved: resolved.length,
      byType: byType,
      byConcept: byConcept,
      bySeverity: bySeverity,
      mostCommonConcept: {
        concept: mostCommonConcept[0],
        count: mostCommonConcept[1]
      },
      mostCommonType: {
        type: mostCommonType[0],
        count: mostCommonType[1]
      },
      topMisconceptions: this.getTopMisconceptions(3),
      studentProfile: this.studentProfile,
      quizHistory: {
        totalQuizzes: this.quizHistory.length,
        averageScore: this.studentProfile.averageScore,
        recentQuizzes: this.quizHistory.slice(-3)
      }
    };
  }

  getAdaptiveLearningSuggestions() {
    const summary = this.getMisconceptionSummary();
    const suggestions = [];
    
    // Suggestions based on misconceptions
    if (summary.active > 0) {
      if (summary.bySeverity.high > 0) {
        suggestions.push({
          priority: 'high',
          type: 'remediation',
          title: 'High Severity Misconceptions',
          message: `You have ${summary.bySeverity.high} high-severity misconceptions that need immediate attention.`,
          action: 'Review fundamental concepts thoroughly',
          concepts: Object.entries(summary.byConcept)
            .filter(([_, count]) => count > 0)
            .map(([concept, _]) => concept)
            .slice(0, 3)
        });
      }
      
      if (summary.byType['fundamental_misunderstanding'] > 0) {
        suggestions.push({
          priority: 'high',
          type: 'conceptual_clarity',
          title: 'Fundamental Understanding',
          message: 'Some misconceptions suggest gaps in basic conceptual understanding.',
          action: 'Focus on definitions and core principles before applications',
          concepts: this.getMisconceptionsByConcept('')
            .filter(m => m.type === 'fundamental_misunderstanding')
            .map(m => m.concept)
            .slice(0, 2)
        });
      }
      
      if (summary.byType['application_error'] > 0) {
        suggestions.push({
          priority: 'medium',
          type: 'practice',
          title: 'Application Practice Needed',
          message: 'Errors in applying concepts suggest more practice is needed.',
          action: 'Solve more applied problems with step-by-step solutions',
          count: summary.byType['application_error']
        });
      }
    }
    
    // Suggestions based on performance
    if (summary.studentProfile.averageScore < 60) {
      suggestions.push({
        priority: 'high',
        type: 'foundation',
        title: 'Build Stronger Foundation',
        message: `Average score (${summary.studentProfile.averageScore}%) indicates need for foundational review.`,
        action: 'Review basic concepts and take easier quizzes first',
        targetScore: 70
      });
    }
    
    if (summary.studentProfile.learningPattern === 'declining') {
      suggestions.push({
        priority: 'medium',
        type: 'pace',
        title: 'Adjust Learning Pace',
        message: 'Recent performance suggests the current pace may be too fast.',
        action: 'Slow down and focus on mastery before moving forward',
        reviewTopics: summary.studentProfile.weakConcepts.slice(0, 2)
      });
    }
    
    if (summary.studentProfile.engagementLevel === 'low' && this.quizHistory.length > 2) {
      suggestions.push({
        priority: 'low',
        type: 'consistency',
        title: 'Improve Consistency',
        message: 'Long gaps between learning sessions reduce retention.',
        action: 'Try shorter, more frequent study sessions',
        frequency: 'Daily 30-minute sessions'
      });
    }
    
    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // =========================================================
  // MISCONCEPTION MANAGEMENT
  // =========================================================

  markMisconceptionResolved(misconceptionId) {
    const misconception = Array.from(this.misconceptions.values())
      .find(m => m.id === misconceptionId);
    
    if (misconception) {
      misconception.resolved = true;
      misconception.resolvedAt = new Date().toISOString();
      misconception.resolutionMethod = 'manual';
      console.log(`Marked misconception as resolved: ${misconceptionId}`);
      return true;
    }
    
    console.log(`Misconception not found: ${misconceptionId}`);
    return false;
  }

  markConceptMastered(concept) {
    const relatedMisconceptions = this.getMisconceptionsByConcept(concept);
    let resolvedCount = 0;
    
    relatedMisconceptions.forEach(misconception => {
      if (!misconception.resolved) {
        misconception.resolved = true;
        misconception.resolvedAt = new Date().toISOString();
        misconception.resolutionMethod = 'concept_mastery';
        resolvedCount++;
      }
    });
    
    console.log(`Marked concept as mastered: ${concept} (resolved ${resolvedCount} misconceptions)`);
    return resolvedCount;
  }

  addManualMisconception(concept, type, description, severity = 'medium') {
    const misconception = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      concept: concept,
      type: type,
      description: description,
      severity: severity,
      count: 1,
      confidence: 60,
      firstOccurred: new Date().toISOString(),
      lastOccurred: new Date().toISOString(),
      quizIds: ['manual'],
      evidence: [{
        source: 'manual_entry',
        description: description,
        timestamp: new Date().toISOString()
      }],
      resolved: false,
      isPattern: false,
      isManual: true
    };
    
    const key = `${concept}_${type}`;
    this.misconceptions.set(key, misconception);
    
    console.log(`Added manual misconception: ${concept} - ${type}`);
    return misconception.id;
  }

  // =========================================================
  // DATA PERSISTENCE
  // =========================================================

  saveToLocalStorage() {
    try {
      const data = {
        misconceptions: Array.from(this.misconceptions.entries()),
        quizHistory: this.quizHistory,
        studentProfile: this.studentProfile,
        sessionId: this.sessionId,
        savedAt: new Date().toISOString(),
        version: '2.0'
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`misconception_tracker_${this.sessionId}`, JSON.stringify(data));
        console.log(`Saved misconception data for session: ${this.sessionId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  loadFromLocalStorage() {
    try {
      if (typeof window !== 'undefined') {
        const data = JSON.parse(localStorage.getItem(`misconception_tracker_${this.sessionId}`));
        
        if (data) {
          this.misconceptions = new Map(data.misconceptions || []);
          this.quizHistory = data.quizHistory || [];
          this.studentProfile = data.studentProfile || this.createInitialProfile();
          
          // Ensure all misconceptions have required fields
          this.misconceptions.forEach((value, key) => {
            if (!value.id) value.id = `legacy_${key}_${Date.now()}`;
            if (!value.confidence) value.confidence = 70;
            if (!value.severity) value.severity = 'medium';
          });
          
          console.log(`Loaded misconception data: ${this.misconceptions.size} misconceptions, ${this.quizHistory.length} quizzes`);
          return true;
        }
      }
      
      console.log(`No saved data found for session: ${this.sessionId}`);
      return false;
      
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return false;
    }
  }

  clearSession() {
    this.misconceptions.clear();
    this.quizHistory = [];
    this.studentProfile = this.createInitialProfile();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`misconception_tracker_${this.sessionId}`);
    }
    
    console.log(`Cleared misconception data for session: ${this.sessionId}`);
  }

  exportData() {
    return {
      sessionId: this.sessionId,
      misconceptions: Array.from(this.misconceptions.values()),
      quizHistory: this.quizHistory,
      studentProfile: this.studentProfile,
      summary: this.getMisconceptionSummary(),
      suggestions: this.getAdaptiveLearningSuggestions(),
      exportedAt: new Date().toISOString()
    };
  }

  // =========================================================
  // UTILITY METHODS
  // =========================================================

  getStats() {
    const summary = this.getMisconceptionSummary();
    
    return {
      sessionId: this.sessionId,
      totalQuizzes: this.studentProfile.totalQuizzes,
      averageScore: this.studentProfile.averageScore,
      totalMisconceptions: summary.total,
      activeMisconceptions: summary.active,
      resolvedMisconceptions: summary.resolved,
      weakConcepts: this.studentProfile.weakConcepts.length,
      strongConcepts: this.studentProfile.strongConcepts.length,
      learningPattern: this.studentProfile.learningPattern,
      engagementLevel: this.studentProfile.engagementLevel,
      lastActivity: this.studentProfile.lastUpdated
    };
  }

  isValid() {
    return (
      this.sessionId &&
      this.misconceptions instanceof Map &&
      Array.isArray(this.quizHistory) &&
      this.studentProfile &&
      this.studentProfile.sessionId === this.sessionId
    );
  }

  reset() {
    this.clearSession();
    console.log(`MisconceptionTracker reset for session: ${this.sessionId}`);
  }
}