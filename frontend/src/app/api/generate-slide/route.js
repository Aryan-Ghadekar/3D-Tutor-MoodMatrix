/**
 * AI-POWERED SLIDE GENERATION API
 * Connects frontend to AI backend for dynamic slide creation
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";

export async function POST(request) {
  console.log('=== AI SLIDE GENERATION REQUEST ===');

  try {
    const data = await request.json();

    console.log('Request Details:', {
      actionType: data.actionType,
      sessionId: data.sessionId?.substring(0, 8) + '...',
      topicIndex: data.currentTopicIndex,
      goal: data.goal,
      hasQuestion: !!data.userQuestion,
      knowledgeLevel: data.knowledgeState?.knowledgeLevel
    });

    // Validate required fields
    if (!data.sessionId) {
      throw new Error("Missing sessionId");
    }
    if (!data.lecturePlan) {
      throw new Error("Missing lecturePlan");
    }

    // Call AI backend
    console.log('Calling AI backend...');

    const backendResponse = await fetch(`${BACKEND_URL}/generate-dynamic-slide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: data.sessionId,
        lecture_plan: data.lecturePlan,
        student_goal: data.goal || 'gate',
        knowledge_state: data.knowledgeState || {},
        current_topic_index: Number(data.currentTopicIndex),
        action_type: data.actionType || 'concept_explanation',
        user_question: data.userQuestion || null,
        context: data.context || ''
      }),
      signal: AbortSignal.timeout(35000) // 35 second timeout for AI
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', backendResponse.status, errorText);
      throw new Error(`Backend error: ${backendResponse.status} - ${errorText.substring(0, 100)}`);
    }

    const result = await backendResponse.json();

    if (!result.success) {
      throw new Error(result.message || 'AI generation failed');
    }

    console.log('AI Slide Generated:', {
      title: result.slide?.title,
      type: result.slide?.type,
      hasImages: result.slide?.images?.length > 0,
      imageCount: result.slide?.images?.length,
      aiModel: result.slide?.metadata?.aiModel
    });

    return NextResponse.json({
      success: true,
      slide: result.slide,
      message: 'AI-generated slide created successfully',
      metadata: {
        generatedBy: 'AI',
        model: result.slide?.metadata?.aiModel,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('CRITICAL ERROR in slide generation:', error);

    // Create emergency fallback slide (NON-AI)
    const emergencySlide = {
      id: `emergency_${Date.now()}`,
      title: 'Learning Content Loading...',
      type: 'concept_explanation',
      content: {
        title: 'Content Preparation',
        narrative: 'The AI system is preparing your personalized learning content. This may take a moment as we ensure the highest quality educational material tailored to your needs.',
        keyInsights: [
          'Personalized content generation in progress',
          'AI analyzing your learning profile',
          'Preparing exam-relevant materials',
          'Optimizing for your knowledge level'
        ],
        analogies: [{
          domain: "Expert Tutor Preparation",
          comparison: "Like an expert tutor reviewing your profile before teaching",
          lesson: "Personalized preparation leads to better learning outcomes"
        }],
        realWorldScenario: {
          situation: "Adaptive learning system optimization",
          application: "AI tailors content to your specific needs",
          outcome: "More effective and efficient learning"
        },
        interactiveElement: "What specific aspect would you like to focus on?",
        examRelevance: "Content will be optimized for your exam preparation",
        commonTraps: [
          "Rushing through material without understanding",
          "Skipping foundational concepts",
          "Not practicing enough"
        ],
        memoryHook: "Personalize → Learn → Practice → Master"
      },
      images: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        isEmergency: true,
        error: error.message,
        generatedBy: 'fallback'
      }
    };

    return NextResponse.json({
      success: false,
      slide: emergencySlide,
      error: error.message,
      isFallback: true,
      message: 'Using emergency fallback content - AI temporarily unavailable'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'AI-Powered Slide Generation API',
    version: '3.0-ai',
    capabilities: {
      ai_generation: true,
      model: 'anthropic/claude-3.5-sonnet',
      adaptive_content: true,
      exam_specific: true,
      knowledge_aware: true,
      image_integration: true
    },
    endpoints: {
      POST: {
        path: '/api/generate-slide',
        description: 'Generate AI-powered educational slides',
        required: ['sessionId', 'lecturePlan'],
        optional: ['actionType', 'goal', 'knowledgeState', 'userQuestion', 'context']
      }
    }
  });
}