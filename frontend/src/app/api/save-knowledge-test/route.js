import { NextResponse } from 'next/server';

// Backend configuration
const BACKEND_URL = "http://localhost:8001";  // Change to 8001 if needed

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Extract data from the test results
    const {
      lectureId,
      sessionId,
      topic,
      score,
      totalQuestions,
      correctAnswers,
      answers,
      knowledgeAnalysis,
      questionDetails,
      lecturePlan
    } = body;

    // Validate required fields
    if (!lectureId || !sessionId || score === undefined) {
      console.warn('Missing required fields, saving locally only');
      return NextResponse.json({
        success: true,
        message: 'Saved locally (missing some fields for backend)',
        savedLocally: true
      });
    }

    console.log(`Saving knowledge test results for session: ${sessionId}`);
    
    // Prepare questions array for backend
    const questionsArray = questionDetails || [];
    
    // Prepare answers array for backend
    const answersArray = Object.entries(answers || {}).map(([questionId, selectedAnswer]) => ({
      questionId: parseInt(questionId),
      selectedAnswer: selectedAnswer
    }));
    
    // Extract misconceptions from knowledge analysis
    const misconceptions = knowledgeAnalysis?.detailedMisunderstandings?.map(m => ({
      topic: m.topic,
      question: m.question,
      yourAnswer: m.userAnswer,
      correctAnswer: m.correctAnswer,
      explanation: m.explanation,
      type: m.misconceptionType || 'knowledge_gap'
    })) || [];
    
    // Extract weak topics
    const weakTopics = knowledgeAnalysis?.weaknesses || [];
    
    // Extract recommendations
    const recommendations = knowledgeAnalysis?.recommendations || [];

    try {
      const response = await fetch(`${BACKEND_URL}/save-quiz-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          lecture_id: lectureId,
          score: score,
          correct: correctAnswers,
          total: totalQuestions,
          questions: questionsArray,
          answers: answersArray,
          misconceptions: misconceptions,
          weak_topics: weakTopics,
          recommendations: recommendations
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Backend error:', errorData);
        
        // Still return success since localStorage worked
        return NextResponse.json({
          success: true,
          message: 'Saved locally (backend unavailable)',
          savedLocally: true,
          backendError: errorData.detail || 'Backend save failed'
        });
      }

      const data = await response.json();
      
      console.log(`✅ Knowledge test results saved successfully`);
      
      return NextResponse.json({
        success: true,
        message: 'Test results saved successfully',
        savedPath: data.saved_path,
        savedLocally: true,
        savedToBackend: true
      });
    } catch (fetchError) {
      console.error('Backend connection error:', fetchError);
      
      // Return success anyway since localStorage worked
      return NextResponse.json({
        success: true,
        message: 'Saved locally (backend unavailable)',
        savedLocally: true,
        backendError: fetchError.message
      });
    }

  } catch (error) {
    console.error('Error in save-knowledge-test API:', error);
    
    // Even on error, return success since the frontend already saved to localStorage
    return NextResponse.json({
      success: true,
      message: 'Saved locally',
      savedLocally: true,
      error: error.message
    });
  }
}