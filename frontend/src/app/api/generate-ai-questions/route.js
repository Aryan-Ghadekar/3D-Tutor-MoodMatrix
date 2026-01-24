import { NextRequest, NextResponse } from 'next/server';

// Backend configuration - change port here if needed
const BACKEND_URL = "http://localhost:8000";  // Change to 8001 if your backend runs on 8001

export async function POST(request) {
  try {
    const body = await request.json();
    const lecturePlan = body.lecturePlan;
    const questionCount = body.questionCount || 10;
    const questionTypes = body.questionTypes || [
      'conceptual',
      'application',
      'misconception',
      'definition',
      'analysis',
      'practical',
      'evaluation'
    ];

    // Validate lecture plan
    if (!lecturePlan || !lecturePlan.impTopics) {
      return NextResponse.json(
        { success: false, error: 'Invalid lecture plan provided' },
        { status: 400 }
      );
    }

    console.log(`Forwarding question generation request to: ${BACKEND_URL}/generate-diagnostic-mcq`);

    const response = await fetch(`${BACKEND_URL}/generate-diagnostic-mcq`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lecture_plan: lecturePlan,
        num_questions: questionCount,
        question_types: questionTypes
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Backend error:', errorData);
      return NextResponse.json(
        {
          success: false,
          error: errorData.detail || 'Failed to generate questions from backend'
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the response to match frontend expectations
    const questions = data.questions || [];

    console.log(`Successfully generated ${questions.length} questions`);

    return NextResponse.json({
      success: true,
      questions: questions,
      totalQuestions: questions.length,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'fastapi_backend',
        lecturePlanId: lecturePlan.lectureId,
        sessionId: lecturePlan.sessionId,
        backendMetadata: data.metadata
      }
    });

  } catch (error) {
    console.error('Error in generate-ai-questions API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while generating questions',
        details: error.message
      },
      { status: 500 }
    );
  }
}