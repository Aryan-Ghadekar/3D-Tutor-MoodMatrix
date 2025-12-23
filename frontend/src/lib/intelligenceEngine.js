export class IntelligenceEngine {
  constructor() {
    this.userPatterns = {
      weakConcepts: new Set(),
      frequentMistakes: {},
      questionTypes: {},
      loadPatterns: []
    };
  }

  analyzeAnswer(question, userAnswer, isCorrect, cognitiveLoad) {
    const analysis = {
      concept: this.extractConcept(question),
      difficulty: question.difficulty,
      isCorrect,
      loadAtAnswer: cognitiveLoad,
      timestamp: Date.now()
    };

    if (!isCorrect) {
      this.userPatterns.frequentMistakes[analysis.concept] = 
        (this.userPatterns.frequentMistakes[analysis.concept] || 0) + 1;
      
      if (question.difficulty === 'easy' && cognitiveLoad > 0.6) {
        this.userPatterns.weakConcepts.add(analysis.concept);
      }
    }

    return analysis;
  }

  analyzeQuestion(questionText, cognitiveLoad) {
    const complexity = this.assessQuestionComplexity(questionText);
    const isBasic = complexity === 'basic';
    
    return {
      complexity,
      isBasic,
      loadAtQuestion: cognitiveLoad,
      suggestsGap: isBasic && cognitiveLoad > 0.7
    };
  }

  getBestHelpType(patterns, cognitiveLoad, currentContext) {
    const { weakConcepts, frequentMistakes } = patterns;
    
    if (weakConcepts.size > 0) {
      return {
        type: 'explanation',
        reason: `Confused about: ${Array.from(weakConcepts).join(', ')}`,
        priority: 'high'
      };
    }
    
    if (cognitiveLoad > 0.75 && currentContext.timeOnSlide > 180) {
      return {
        type: 'quiz',
        reason: 'Stuck on this concept for too long',
        priority: 'high'
      };
    }
    
    if (currentContext.recentQuestions?.some(q => q.isBasic)) {
      return {
        type: 'explanation',
        reason: 'Basic questions suggest need for clarification',
        priority: 'medium'
      };
    }
    
    if (cognitiveLoad > 0.6) {
      return {
        type: 'quiz',
        reason: 'Good time to reinforce learning',
        priority: 'medium'
      };
    }
    
    return {
      type: 'qa',
      reason: 'Clarify specific points',
      priority: 'low'
    };
  }

  getAdaptiveQuestions(allQuestions, patterns, cognitiveLoad) {
    const { weakConcepts, frequentMistakes } = patterns;
    
    let filteredQuestions = [...allQuestions];
    
    if (cognitiveLoad > 0.8) {
      filteredQuestions = allQuestions.filter(q => q.difficulty === 'easy');
    }
    else if (cognitiveLoad > 0.6 && weakConcepts.size > 0) {
      filteredQuestions = allQuestions.filter(q => 
        q.difficulty !== 'hard' && 
        this.conceptMatches(q, Array.from(weakConcepts))
      );
    }
    else if (cognitiveLoad < 0.5) {
      const hardQuestions = allQuestions.filter(q => q.difficulty === 'hard');
      if (hardQuestions.length > 0) {
        filteredQuestions = [
          ...allQuestions.filter(q => q.difficulty !== 'hard'),
          ...hardQuestions.slice(0, 1)
        ];
      }
    }
    
    filteredQuestions.sort((a, b) => {
      const aRelevance = this.calculateRelevance(a, patterns);
      const bRelevance = this.calculateRelevance(b, patterns);
      return bRelevance - aRelevance;
    });
    
    const questionCount = this.getOptimalQuestionCount(cognitiveLoad);
    return filteredQuestions.slice(0, questionCount);
  }

  extractConcept(question) {
    const text = question.question.toLowerCase();
    if (text.includes('backpropagation')) return 'backpropagation';
    if (text.includes('activation')) return 'activation_functions';
    if (text.includes('gradient')) return 'gradient_descent';
    if (text.includes('neuron')) return 'neurons';
    return 'general';
  }


    conceptMatches(question, concepts) {
        if (!concepts || concepts.length === 0) return false;
        
        const questionText = question.question.toLowerCase();
        const questionConcept = this.extractConcept(question);
        
        return concepts.some(concept => {
            const conceptLower = concept.toLowerCase();
            return questionText.includes(conceptLower) || 
                questionConcept.toLowerCase().includes(conceptLower) ||
                conceptLower.includes(questionConcept.toLowerCase());
        });
    }

  assessQuestionComplexity(question) {
    const basicTerms = ['what is', 'define', 'simple', 'basic'];
    const advancedTerms = ['explain', 'how does', 'why', 'compare'];
    
    const lowerQ = question.toLowerCase();
    if (basicTerms.some(term => lowerQ.includes(term))) return 'basic';
    if (advancedTerms.some(term => lowerQ.includes(term))) return 'advanced';
    return 'medium';
  }

  getOptimalQuestionCount(load) {
    if (load > 0.8) return 2; // High load → fewer questions
    if (load > 0.6) return 3; // Medium load → standard
    return 4; // Low load → more questions
  }

  calculateRelevance(question, patterns) {
    let score = 0;
    const concept = this.extractConcept(question);
    
    // Higher score for weak concepts
    if (patterns.weakConcepts.has(concept)) score += 3;
    
    // Higher score for frequent mistakes
    if (patterns.frequentMistakes[concept]) score += 2;
    
    // Can adjust for difficulty
    if (question.difficulty === 'easy') score += 1;
    
    return score;
  }
}