import { NextResponse } from 'next/server';

// Backend configuration
const BACKEND_URL = "http://localhost:8001";  

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      sessionId,
      lectureId,
      score,
      correct,
      total,
      questions,
      answers,
      misconceptions,
      weakTopics,
      recommendations
    } = body;

    // Validate required fields
    if (!sessionId || !lectureId || score === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`Saving quiz results for session: ${sessionId}`);
    
    const response = await fetch(`${BACKEND_URL}/save-quiz-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        lecture_id: lectureId,
        score: score,
        correct: correct,
        total: total,
        questions: questions || [],
        answers: answers || [],
        misconceptions: misconceptions || [],
        weak_topics: weakTopics || [],
        recommendations: recommendations || []
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Backend error:', errorData);
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.detail || 'Failed to save results to backend' 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log(`Quiz results saved successfully`);
    
    return NextResponse.json({
      success: true,
      message: 'Quiz results saved successfully',
      savedPath: data.saved_path
    });

  } catch (error) {
    console.error('Error in save-quiz-results API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error while saving results',
        details: error.message 
      },
      { status: 500 }
    );
  }
}