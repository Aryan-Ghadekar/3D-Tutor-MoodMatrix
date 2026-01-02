// app/api/get-quiz-results/route.js
import { NextResponse } from 'next/server';
import { 
  generateAssessmentQuestions, 
  analyzeTestResults 
} from '@/lib/question-generator';
import { getStudyPlan } from '@/lib/study-plan-storage';

// GET: Get quiz questions and analysis for a specific session
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const studentGoal = searchParams.get('goal') || null;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId parameter is required"
      }, { status: 400 });
    }
    
    console.log(`Generating quiz results for session: ${sessionId}, goal: ${studentGoal}`);
    
    // 1. Get study plan from storage
    const studyPlan = getStudyPlan(sessionId);
    if (!studyPlan) {
      return NextResponse.json({
        success: false,
        error: `No study plan found for session: ${sessionId}`,
        fallback: true,
        metadata: {
          sessionId,
          isFallback: true,
          generatedAt: new Date().toISOString()
        }
      }, { status: 404 });
    }
    
    // 2. Generate assessment questions with metadata
    const questionResult = await generateAssessmentQuestions(sessionId, studentGoal);
    
    if (!questionResult.success) {
      console.warn(`Using fallback questions for session: ${sessionId}`);
    }
    
    // 3. Create sample answers for demo/GET request
    const sampleAnswers = {};
    const answerTimes = {};
    
    questionResult.questions.forEach(question => {
      const correctOption = question.options.find(opt => opt.isCorrect);
      const wrongOptions = question.options.filter(opt => !opt.isCorrect);
      
      // For demo: Mix correct and incorrect answers based on question difficulty
      let isCorrect = true;
      if (question.difficulty === 'Easy') {
        isCorrect = Math.random() > 0.2; // 80% correct
      } else if (question.difficulty === 'Medium') {
        isCorrect = Math.random() > 0.4; // 60% correct
      } else {
        isCorrect = Math.random() > 0.6; // 40% correct
      }
      
      if (isCorrect && correctOption) {
        sampleAnswers[question.id] = correctOption.id;
      } else if (wrongOptions.length > 0) {
        const randomWrong = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
        sampleAnswers[question.id] = randomWrong.id;
      } else if (correctOption) {
        sampleAnswers[question.id] = correctOption.id;
      }
      
      // Generate realistic time taken (between 30% and 150% of timeEstimate)
      const timeEstimate = question.timeEstimate || 60;
      const minTime = Math.max(20, timeEstimate * 0.3);
      const maxTime = Math.min(180, timeEstimate * 1.5);
      answerTimes[question.id] = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    });
    
    // 4. Format answers for analysis
    const formattedAnswers = questionResult.questions.map((question, index) => ({
      questionId: question.id,
      selectedOption: sampleAnswers[question.id],
      timeTaken: answerTimes[question.id],
      isCorrect: sampleAnswers[question.id] === question.options.find(opt => opt.isCorrect)?.id,
      answeredAt: new Date(Date.now() - (questionResult.questions.length - index) * 1000).toISOString()
    }));
    
    // 5. Analyze results
    const analysis = analyzeTestResults(formattedAnswers, questionResult.questions, studentGoal);
    
    // 6. Extract knowledge gaps from analysis
    const knowledgeGaps = extractKnowledgeGaps(analysis, questionResult.questions);
    
    // 7. Prepare comprehensive response
    const response = {
      success: true,
      sessionId: sessionId,
      generatedAt: new Date().toISOString(),
      
      // Quiz metadata from question generator
      quizMetadata: questionResult.metadata,
      
      // Questions data
      quiz: {
        totalQuestions: questionResult.questions.length,
        estimatedTime: questionResult.metadata?.estimatedTime || 0,
        difficultySpread: questionResult.metadata?.difficultySpread,
        topicsCovered: questionResult.metadata?.topicsCovered || [],
        questions: questionResult.questions.map(q => ({
          id: q.id,
          topicId: q.topicId,
          topicName: q.topicName,
          question: q.question,
          options: q.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect
          })),
          difficulty: q.difficulty,
          timeEstimate: q.timeEstimate,
          conceptsTested: q.conceptsTested,
          explanation: q.explanation,
          wrongOptionExplanations: q.wrongOptionExplanations
        }))
      },
      
      // Analysis results
      analysis: {
        // Overall performance
        performance: {
          score: analysis.score,
          totalQuestions: analysis.totalQuestions,
          correctAnswers: analysis.correctAnswers,
          incorrectAnswers: analysis.incorrectAnswers,
          skippedQuestions: analysis.skippedQuestions,
          scorePercentage: analysis.scorePercentage,
          performanceLevel: analysis.performanceLevel,
          timePerformance: analysis.timePerformance
        },
        
        // Detailed analysis
        insights: {
          topicPerformance: analysis.topicPerformance,
          difficultyPerformance: analysis.difficultyPerformance,
          conceptMastery: analysis.conceptMastery,
          strengthAreas: analysis.examInsights.strengthAreas,
          weakAreas: analysis.examInsights.weakAreas,
          improvementSuggestions: analysis.examInsights.improvementSuggestions
        },
        
        // Knowledge gaps
        knowledgeGaps: knowledgeGaps,
        
        // Recommendations
        recommendations: analysis.recommendations,
        
        // Goal-specific insights
        goalContext: {
          studentGoal: studentGoal,
          hasGoal: studentGoal !== null,
          examStrategy: analysis.recommendations.examStrategy
        }
      },
      
      // Sample data (for reference in GET requests)
      sampleData: {
        answers: formattedAnswers,
        demoNote: "These are sample answers generated for demonstration. Submit real answers via POST for personalized analysis."
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error in get-quiz-results:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      fallback: true,
      metadata: {
        generatedAt: new Date().toISOString(),
        isFallback: true
      },
      analysis: {
        performance: {
          score: 0,
          totalQuestions: 0,
          scorePercentage: 0,
          performanceLevel: "Error",
          error: error.message
        }
      }
    }, { status: 500 });
  }
}

// POST: Analyze specific student answers
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      answers, 
      studentId = 'anonymous',
      studentGoal = null,
      customMetadata 
    } = body;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId is required in request body"
      }, { status: 400 });
    }
    
    console.log(`Analyzing student answers for session: ${sessionId}, student: ${studentId}`);
    
    // 1. Get study plan
    const studyPlan = getStudyPlan(sessionId);
    if (!studyPlan) {
      return NextResponse.json({
        success: false,
        error: `No study plan found for session: ${sessionId}`
      }, { status: 404 });
    }
    
    // 2. Generate questions (to ensure consistency)
    const questionResult = await generateAssessmentQuestions(sessionId, studentGoal);
    
    // 3. Validate and format answers
    const formattedAnswers = [];
    const invalidAnswers = [];
    
    questionResult.questions.forEach(question => {
      const answer = Array.isArray(answers) 
        ? answers.find(a => a.questionId === question.id || a.id === question.id)
        : answers[question.id];
      
      if (answer) {
        formattedAnswers.push({
          questionId: question.id,
          selectedOption: answer.selectedOption || answer.answer,
          timeTaken: answer.timeTaken || 0,
          isCorrect: answer.selectedOption === question.options.find(opt => opt.isCorrect)?.id,
          answeredAt: answer.answeredAt || new Date().toISOString()
        });
      } else {
        invalidAnswers.push(question.id);
      }
    });
    
    if (invalidAnswers.length > 0) {
      console.warn(`Missing answers for questions: ${invalidAnswers.join(', ')}`);
    }
    
    // 4. Analyze results
    const analysis = analyzeTestResults(formattedAnswers, questionResult.questions, studentGoal);
    
    // 5. Extract knowledge gaps
    const knowledgeGaps = extractKnowledgeGaps(analysis, questionResult.questions);
    
    // 6. Prepare response
    const response = {
      success: true,
      sessionId: sessionId,
      studentId: studentId,
      analyzedAt: new Date().toISOString(),
      
      // Quiz context
      quizContext: questionResult.metadata,
      
      // Submission details
      submission: {
        totalQuestions: questionResult.questions.length,
        answeredQuestions: formattedAnswers.length,
        unansweredQuestions: invalidAnswers.length,
        completionRate: (formattedAnswers.length / questionResult.questions.length) * 100
      },
      
      // Performance analysis
      performance: {
        score: analysis.score,
        totalQuestions: analysis.totalQuestions,
        correctAnswers: analysis.correctAnswers,
        incorrectAnswers: analysis.incorrectAnswers,
        skippedQuestions: analysis.skippedQuestions,
        scorePercentage: analysis.scorePercentage,
        performanceLevel: analysis.performanceLevel,
        
        // Time analysis
        timeSummary: {
          totalTimeUsed: analysis.timePerformance.totalTimeUsed,
          averageTimePerQuestion: analysis.timePerformance.averageTimePerQuestion,
          timeManagementScore: analysis.timePerformance.timeManagementScore,
          recommendation: analysis.timePerformance.timeManagementScore < 70 
            ? "Consider improving time management" 
            : "Good time management"
        },
        
        // Topic-wise performance
        topicBreakdown: Object.entries(analysis.topicPerformance).map(([topic, data]) => ({
          topic,
          accuracy: data.accuracy,
          correct: data.correct,
          total: data.total,
          performance: data.accuracy >= 80 ? "Strong" : 
                     data.accuracy >= 60 ? "Moderate" : "Needs Improvement"
        })),
        
        // Difficulty-wise performance
        difficultyBreakdown: Object.entries(analysis.difficultyPerformance)
          .filter(([_, data]) => data.total > 0)
          .map(([difficulty, data]) => ({
            difficulty,
            accuracy: data.accuracy,
            correct: data.correct,
            total: data.total
          }))
      },
      
      // Knowledge assessment
      knowledgeAssessment: {
        strongConcepts: analysis.examInsights.strengthAreas.slice(0, 5),
        weakConcepts: analysis.examInsights.weakAreas.slice(0, 5),
        conceptMastery: Object.entries(analysis.conceptMastery)
          .map(([concept, data]) => ({
            concept,
            mastery: data.masteryLevel,
            correct: data.correct,
            total: data.total
          }))
          .sort((a, b) => a.mastery - b.mastery),
        
        knowledgeGaps: knowledgeGaps
      },
      
      // Recommendations
      recommendations: {
        immediateActions: [
          ...analysis.recommendations.reviewConcepts.map(rc => 
            `Review: ${rc.concept} (${rc.mastery}% mastery)`
          ),
          ...analysis.recommendations.practiceFocus.map(pf => 
            `Practice: ${pf.area} (current: ${pf.currentAccuracy}%)`
          )
        ],
        studyPlan: analysis.recommendations.nextTopics,
        examStrategy: analysis.recommendations.examStrategy,
        
        // Goal-specific recommendations
        goalRecommendations: studentGoal ? 
          getGoalSpecificRecommendations(studentGoal, analysis.scorePercentage) : 
          []
      },
      
      // Improvement roadmap
      improvementRoadmap: {
        week1: {
          focus: "Address critical knowledge gaps",
          tasks: knowledgeGaps.slice(0, 3).map(gap => `Review: ${gap.concept}`)
        },
        week2: {
          focus: "Strengthen moderate concepts",
          tasks: analysis.examInsights.weakAreas.slice(0, 2).map(area => `Practice: ${area}`)
        },
        week3: {
          focus: "Mastery and speed",
          tasks: ["Timed practice tests", "Advanced applications"]
        }
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error in POST quiz-results:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      studentId: body.studentId || 'anonymous',
      analyzedAt: new Date().toISOString(),
      performance: {
        error: true,
        message: "Analysis failed",
        technicalError: error.message
      }
    }, { status: 500 });
  }
}

// Helper function to extract knowledge gaps from analysis
function extractKnowledgeGaps(analysis, questions) {
  const knowledgeGaps = [];
  
  // Extract from concept mastery
  Object.entries(analysis.conceptMastery).forEach(([concept, data]) => {
    if (data.masteryLevel < 60 && data.total > 0) {
      // Find related questions for context
      const relatedQuestions = questions.filter(q => 
        q.conceptsTested?.includes(concept)
      ).slice(0, 2);
      
      knowledgeGaps.push({
        concept: concept,
        masteryLevel: Math.round(data.masteryLevel),
        correct: data.correct,
        total: data.total,
        priority: data.masteryLevel < 30 ? "High" : 
                 data.masteryLevel < 50 ? "Medium" : "Low",
        relatedQuestions: relatedQuestions.map(q => ({
          id: q.id,
          question: q.question.substring(0, 100) + "..."
        }))
      });
    }
  });
  
  // Extract from topic performance
  Object.entries(analysis.topicPerformance).forEach(([topic, data]) => {
    if (data.accuracy < 60 && data.total > 0) {
      // Check if we already have this as a concept gap
      const existingGap = knowledgeGaps.find(gap => gap.concept === topic);
      if (!existingGap) {
        knowledgeGaps.push({
          concept: topic,
          masteryLevel: Math.round(data.accuracy),
          correct: data.correct,
          total: data.total,
          priority: data.accuracy < 40 ? "High" : "Medium",
          type: "topic"
        });
      }
    }
  });
  
  return knowledgeGaps.sort((a, b) => a.masteryLevel - b.masteryLevel);
}

// Helper function for goal-specific recommendations
function getGoalSpecificRecommendations(goal, scorePercentage) {
  const recommendations = [];
  
  switch (goal.toLowerCase()) {
    case 'gate':
      if (scorePercentage >= 80) {
        recommendations.push(
          "Excellent GATE potential! Focus on time-bound mock tests.",
          "Practice previous year papers with negative marking strategy."
        );
      } else if (scorePercentage >= 60) {
        recommendations.push(
          "Solid foundation. Focus on formula memorization and quick calculations.",
          "Work on numerical ability and data interpretation."
        );
      } else {
        recommendations.push(
          "Focus on core concepts from GATE syllabus.",
          "Start with basic problems before attempting advanced ones."
        );
      }
      break;
      
    case 'jee':
      if (scorePercentage >= 80) {
        recommendations.push(
          "JEE Advanced level preparation recommended.",
          "Focus on multi-concept problems and speed."
        );
      } else if (scorePercentage >= 60) {
        recommendations.push(
          "Good for JEE Main. Practice formula applications.",
          "Work on elimination techniques for MCQs."
        );
      } else {
        recommendations.push(
          "Focus on NCERT fundamentals first.",
          "Master one concept at a time before combining."
        );
      }
      break;
      
    case 'neet':
      if (scorePercentage >= 80) {
        recommendations.push(
          "Excellent NEET preparation. Focus on NCERT diagrams.",
          "Practice assertion-reason type questions."
        );
      } else if (scorePercentage >= 60) {
        recommendations.push(
          "Good understanding. Memorize biological terms and processes.",
          "Work on diagram-based questions."
        );
      } else {
        recommendations.push(
          "Focus on NCERT line-by-line reading.",
          "Create flashcards for important terms."
        );
      }
      break;
      
    default:
      recommendations.push("Continue regular practice and concept review.");
  }
  
  return recommendations;
}