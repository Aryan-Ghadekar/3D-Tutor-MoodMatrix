import { NextResponse } from 'next/server';

// In-memory storage for user goals (replace with database in production)
const userGoals = new Map();

export async function PUT(request) {
  try {
    const { goal } = await request.json();
    
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal is required' },
        { status: 400 }
      );
    }

    // Get or create a session ID (in production, use actual user authentication)
    const sessionId = request.headers.get('x-session-id') || 'default';
    
    // Store the goal
    userGoals.set(sessionId, { goal, updatedAt: new Date().toISOString() });
    
    // Also store in localStorage via response headers (client will handle)
    return NextResponse.json(
      { 
        success: true, 
        goal,
        message: 'Goal saved successfully'
      },
      { 
        status: 200,
        headers: {
          'Set-Cookie': `user_goal=${goal}; Path=/; Max-Age=31536000`
        }
      }
    );
  } catch (error) {
    console.error('Error saving goal:', error);
    return NextResponse.json(
      { error: 'Failed to save goal', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const sessionId = request.headers.get('x-session-id') || 'default';
    const goalData = userGoals.get(sessionId);
    
    if (!goalData) {
      return NextResponse.json(
        { goal: null },
        { status: 200 }
      );
    }
    
    return NextResponse.json(goalData, { status: 200 });
  } catch (error) {
    console.error('Error fetching goal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goal', details: error.message },
      { status: 500 }
    );
  }
}



