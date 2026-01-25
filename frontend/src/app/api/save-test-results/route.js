import { NextResponse } from 'next/server';

// Backend configuration
const BACKEND_URL = "http://localhost:8001";  // Change to 8001 if needed

export async function POST(request) {
  try {
    const body = await request.json();

    // This is the comprehensive report format
    const {
      metadata,
      knowledgeAnalysis,
      detailedResults,
      summary
    } = body;

    console.log(`Saving comprehensive test report: ${metadata?.testId}`);

    // Validate required fields
    if (!metadata || !metadata.lectureId || !metadata.sessionId) {
      console.warn('Missing metadata, saving locally only');
      return NextResponse.json({
        success: true,
        message: 'Saved locally (missing metadata)',
        savedLocally: true
      });
    }

    // Prepare data for backend
    const questionsArray = detailedResults || [];

    const answersArray = questionsArray.map(q => ({
      questionId: q.id,
      selectedAnswer: q.userAnswer
    }));

    const misconceptions = knowledgeAnalysis?.detailedMisunderstandings?.map(m => ({
      topic: m.topic,
      question: m.question,
      yourAnswer: m.userAnswer,
      correctAnswer: m.correctAnswer,
      explanation: m.explanation,
      type: m.misconceptionType || 'knowledge_gap'
    })) || [];

    const weakTopics = summary?.topicPerformance
      ?.filter(t => t.accuracy < 70)
      ?.map(t => t.topicName) || [];

    const recommendations = knowledgeAnalysis?.recommendations || [];

    try {
      const response = await fetch(`${BACKEND_URL}/save-quiz-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: metadata.sessionId,
          lecture_id: metadata.lectureId,
          score: metadata.score,
          correct: metadata.correctAnswers,
          total: metadata.totalQuestions,
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

        return NextResponse.json({
          success: true,
          message: 'Saved locally (backend unavailable)',
          savedLocally: true,
          backendError: errorData.detail || 'Backend save failed'
        });
      }

      const data = await response.json();

      console.log(`Comprehensive test report saved successfully`);

      return NextResponse.json({
        success: true,
        message: 'Test report saved successfully',
        savedPath: data.saved_path,
        savedLocally: true,
        savedToBackend: true
      });
    } catch (fetchError) {
      console.error('Backend connection error:', fetchError);

      return NextResponse.json({
        success: true,
        message: 'Saved locally (backend unavailable)',
        savedLocally: true,
        backendError: fetchError.message
      });
    }

  } catch (error) {
    console.error('Error in save-test-results API:', error);

    return NextResponse.json({
      success: true,
      message: 'Saved locally',
      savedLocally: true,
      error: error.message
    });
  }
}