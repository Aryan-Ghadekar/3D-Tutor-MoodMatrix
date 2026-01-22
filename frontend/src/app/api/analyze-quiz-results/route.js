import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, questions, answers, studentGoal } = body;

    // Forward to backend
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

    const response = await fetch(`${BACKEND_URL}/analyze-quiz-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        questions: questions,
        answers: answers,
        student_goal: studentGoal
      })
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error analyzing results:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}