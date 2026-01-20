import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    // Get session data from localStorage (simulate client-side)
    let sessionData = {};
    let lecturePlan = {};
    
    if (typeof window !== 'undefined') {
      sessionData = JSON.parse(localStorage.getItem('current_lecture_session') || '{}');
      lecturePlan = sessionData.lecturePlan || {};
    }
    
    return NextResponse.json({
      success: true,
      sessionId,
      sessionData: {
        hasLecturePlan: !!lecturePlan,
        topics: lecturePlan.impTopics?.map(t => t.title) || [],
        topicCount: lecturePlan.impTopics?.length || 0,
        goal: sessionData.studentGoal,
        knowledgeTest: sessionData.knowledgeTestResults ? 'Available' : 'None'
      },
      localStorageKeys: typeof window !== 'undefined' ? Object.keys(localStorage) : [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}