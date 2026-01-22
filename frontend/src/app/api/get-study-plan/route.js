// src/app/api/get-study-plan/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { topic, studentGoal } = await request.json();
    
    console.log('Getting study plan for:', { topic, studentGoal });
    
    try {
      const filePath = path.join(process.cwd(), 'src/app/lib/mock_lecture_plan.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lecturePlan = JSON.parse(fileContent);
        
        // Update the plan with current topic/goal
        const updatedPlan = {
          ...lecturePlan,
          topic: topic || lecturePlan.topic,
          studentGoal: studentGoal || 'gate',
          metadata: {
            ...lecturePlan.metadata,
            adaptedForGoal: studentGoal,
            generatedAt: new Date().toISOString()
          }
        };
        
        return NextResponse.json({
          success: true,
          plan: updatedPlan,
          source: 'mock_file'
        });
      }
    } catch (fileError) {
      console.log('No mock file found, generating dynamic plan');
    }
    
    // Generate a dynamic plan based on topic
    const dynamicPlan = generateDynamicStudyPlan(topic, studentGoal);
    
    return NextResponse.json({
      success: true,
      plan: dynamicPlan,
      source: 'dynamic_generation'
    });
    
  } catch (error) {
    console.error('Error getting study plan:', error);
    
    // Return fallback plan
    const fallbackPlan = generateDynamicStudyPlan('Operating Systems', 'gate');
    
    return NextResponse.json({
      success: false,
      plan: fallbackPlan,
      error: error.message,
      source: 'fallback'
    });
  }
}

function generateDynamicStudyPlan(topic, studentGoal) {
  const now = new Date();
  const lectureId = `plan_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const baseTopics = [
    {
      id: "topic-1",
      title: `Introduction to ${topic}`,
      description: `Fundamental concepts and principles of ${topic}`,
      importance: "high",
      weightage: 30,
      prerequisites: [],
      commonMisconceptions: [
        "Confusing basic terminology",
        "Misunderstanding foundational principles"
      ],
      keyInsights: [
        "Start with clear definitions",
        "Understand the core principles"
      ]
    },
    {
      id: "topic-2",
      title: `${topic} Core Concepts`,
      description: `Advanced principles and applications of ${topic}`,
      importance: "high",
      weightage: 40,
      prerequisites: ["topic-1"],
      commonMisconceptions: [
        "Overcomplicating simple concepts",
        "Missing practical applications"
      ],
      keyInsights: [
        "Connect theory to practice",
        "Focus on application scenarios"
      ]
    },
    {
      id: "topic-3",
      title: `${topic} Applications`,
      description: `Real-world applications and problem-solving with ${topic}`,
      importance: "medium",
      weightage: 30,
      prerequisites: ["topic-1", "topic-2"],
      commonMisconceptions: [
        "Applying concepts incorrectly",
        "Missing edge cases"
      ],
      keyInsights: [
        "Practice with real examples",
        "Learn from common mistakes"
      ]
    }
  ];
  
  const goalSpecificTips = {
    gate: [
      "Focus on problem-solving speed",
      "Practice previous year questions",
      "Master time management"
    ],
    jee: [
      "Emphasize conceptual clarity",
      "Practice derivation-based problems",
      "Understand inter-topic connections"
    ],
    neet: [
      "Use visual learning techniques",
      "Focus on diagram-based questions",
      "Master NCERT concepts"
    ],
    semester: [
      "Follow university syllabus",
      "Practice previous year papers",
      "Balance theory and numericals"
    ],
    concept: [
      "Build from first principles",
      "Explore multiple approaches",
      "Connect to real-world applications"
    ]
  };
  
  return {
    lectureId,
    topic: topic || "Operating Systems",
    duration: "45 minutes",
    date: now.toISOString().split('T')[0],
    instructor: "Adaptive Learning AI",
    studentGoal: studentGoal || "gate",
    impTopics: baseTopics,
    difficultyMetrics: {
      conceptualDifficulty: "medium",
      mathematicalDifficulty: studentGoal === 'jee' ? "high" : "medium",
      implementationDifficulty: "medium",
      overall: studentGoal === 'gate' ? "intermediate" : "beginner"
    },
    learningObjectives: [
      `Understand fundamental concepts of ${topic}`,
      `Apply ${topic} principles to solve problems`,
      `Master ${topic} for ${studentGoal} preparation`
    ],
    assessmentCriteria: {
      knowledgeCheck: ["Concept definitions", "Theory recall"],
      skillEvaluation: ["Problem solving", "Application skills"],
      misconceptionDetection: ["Error identification", "Concept clarification"]
    },
    examTips: goalSpecificTips[studentGoal] || goalSpecificTips.gate,
    metadata: {
      generatedAt: now.toISOString(),
      source: "adaptive_learning_system",
      version: "1.0",
      confidence: 0.85
    }
  };
}

export async function GET() {
  return NextResponse.json({
    message: "Study Plan API",
    usage: "POST with { topic, studentGoal } to get personalized study plan"
  });
}