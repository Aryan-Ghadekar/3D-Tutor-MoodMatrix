/**
 * Quiz Storage - Unified quiz results management
 */

export class QuizStorage {
  static STORAGE_KEY = 'quiz_results_all';
  static SESSION_KEY = 'current_session_quiz';

  static saveQuizResults(quizData) {
    try {
      // Save to main storage
      const allResults = this.getAllResults();
      const newResult = {
        ...quizData,
        timestamp: new Date().toISOString(),
        id: `quiz_${Date.now()}`
      };
      
      allResults.unshift(newResult);
      
      // Keep last 50 results
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allResults.slice(0, 50)));
      
      // Save current session
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(newResult));
      
      console.log('Quiz results saved:', {
        score: quizData.score,
        total: quizData.total,
        misconceptions: quizData.misconceptions?.length || 0
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save quiz results:', error);
      return false;
    }
  }

  static getAllResults() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static getLatestResult() {
    const results = this.getAllResults();
    return results.length > 0 ? results[0] : null;
  }

  static getCurrentSessionQuiz() {
    try {
      const data = sessionStorage.getItem(this.SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static getStudentProfile() {
    const allResults = this.getAllResults();
    
    if (allResults.length === 0) {
      return {
        averageScore: 0,
        totalQuizzes: 0,
        weakTopics: [],
        strongTopics: [],
        misconceptions: [],
        knowledgeLevel: 'beginner'
      };
    }

    // Calculate average score
    const totalScore = allResults.reduce((sum, r) => sum + (r.score || 0), 0);
    const avgScore = Math.round(totalScore / allResults.length);

    // Extract weak topics (score < 60%)
    const weakTopics = new Set();
    const allMisconceptions = [];

    allResults.forEach(result => {
      if (result.weak_topics) {
        result.weak_topics.forEach(topic => weakTopics.add(topic));
      }
      if (result.misconceptions) {
        allMisconceptions.push(...result.misconceptions);
      }
    });

    // Determine knowledge level
    let knowledgeLevel = 'beginner';
    if (avgScore >= 80) {
      knowledgeLevel = 'advanced';
    } else if (avgScore >= 60) {
      knowledgeLevel = 'intermediate';
    }

    return {
      averageScore: avgScore,
      totalQuizzes: allResults.length,
      weakTopics: Array.from(weakTopics),
      strongTopics: [],
      misconceptions: allMisconceptions.slice(0, 10),
      knowledgeLevel: knowledgeLevel,
      lastQuizDate: allResults[0]?.timestamp || null,
      lastQuizScore: allResults[0]?.score || 0
    };
  }

  static clearAll() {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    console.log('All quiz data cleared');
  }
}