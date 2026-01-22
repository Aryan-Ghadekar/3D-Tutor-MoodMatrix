import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const FASTAPI_URL = BACKEND_URL;

// Force correct port - override any caching
const FALLBACK_URLS = ["http://localhost:8000", "http://localhost:8000"];

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // CASE 1: JSON request (from study-session)
    if (contentType.includes('application/json')) {
      console.log('📥 JSON request detected - reading lecture plan');

      try {
        const { topic, studentGoal } = await request.json();
        console.log('Request for lecture plan:', { topic, studentGoal });

        // Try to read from mock_lecture_plan.json
        const mockFilePath = path.join(process.cwd(), 'src/app/lib/mock_lecture_plan.json');

        if (fs.existsSync(mockFilePath)) {
          const fileContent = fs.readFileSync(mockFilePath, 'utf8');
          let lecturePlanData;

          try {
            lecturePlanData = JSON.parse(fileContent);

            // Handle both array and object formats
            let lecturePlan;
            if (Array.isArray(lecturePlanData) && lecturePlanData.length > 0) {
              // Get the most recent plan
              lecturePlan = lecturePlanData[0];
              console.log('📄 Using most recent lecture plan from array');
            } else if (typeof lecturePlanData === 'object') {
              lecturePlan = lecturePlanData;
              console.log('📄 Using lecture plan object');
            } else {
              throw new Error('Invalid lecture plan format');
            }

            // Adapt plan for student goal
            const adaptedPlan = adaptPlanForGoal(lecturePlan, studentGoal);

            return NextResponse.json({
              success: true,
              message: 'Lecture plan retrieved successfully',
              lecturePlan: adaptedPlan,
              studyPlan: adaptedPlan, // Add studyPlan for consistency
              sessionId: adaptedPlan.sessionId,
              lectureId: adaptedPlan.lectureId,
              source: 'mock_file',
              retrievedAt: new Date().toISOString()
            });

          } catch (parseError) {
            console.error('Error parsing lecture plan:', parseError);
            return generateFallbackPlan(topic, studentGoal);
          }
        } else {
          console.log('📭 No mock lecture plan found, generating fallback');
          return generateFallbackPlan(topic, studentGoal);
        }

      } catch (jsonError) {
        console.error('Error processing JSON request:', jsonError);
        return generateFallbackPlan('Operating Systems', 'gate');
      }
    }

    // CASE 2: FormData request (from lecture-input)
    else if (contentType.includes('multipart/form-data')) {
      console.log('📤 FormData request detected - processing files');

      const formData = await request.formData();
      const pdfFile = formData.get('pdf');
      const pptFile = formData.get('ppt');
      const audioFile = formData.get('audio');
      const youtubeUrl = formData.get('youtube_url');
      const courseName = formData.get('course_name') || 'Auto Generated Lecture';
      const duration = formData.get('duration') || '45 minutes';

      // Validate that at least one input source is provided
      if (!pdfFile && !pptFile && !youtubeUrl) {
        return NextResponse.json(
          { error: 'At least one of PDF, PowerPoint file, or YouTube URL must be provided' },
          { status: 400 }
        );
      }

      // Validate file types if provided
      if (pdfFile && pdfFile.size > 0 && pdfFile.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'PDF file must be valid (application/pdf)' },
          { status: 400 }
        );
      }

      if (pptFile && pptFile.size > 0 && !pptFile.type.includes('presentation')) {
        return NextResponse.json(
          { error: 'PowerPoint file must be valid (.ppt or .pptx)' },
          { status: 400 }
        );
      }

      if (pdfFile && pdfFile.size > 0) {
        console.log(`PDF received: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(2)} KB)`);
      }
      if (pptFile && pptFile.size > 0) {
        console.log(`PowerPoint received: ${pptFile.name} (${(pptFile.size / 1024).toFixed(2)} KB)`);
      }
      if (youtubeUrl) {
        console.log(`YouTube URL received: ${youtubeUrl}`);
      }
      console.log(`Course: ${courseName}, Duration: ${duration}`);

      const fastapiFormData = new FormData();

      // Add the primary content source (PDF, PPT, or YouTube URL)
      if (pdfFile && pdfFile.size > 0) {
        fastapiFormData.append('pdf', pdfFile);
      }
      if (pptFile && pptFile.size > 0) {
        fastapiFormData.append('ppt', pptFile);
      }
      if (youtubeUrl) {
        fastapiFormData.append('youtube_url', youtubeUrl);
      }

      fastapiFormData.append('course_name', courseName);
      fastapiFormData.append('duration', duration);

      let hasAudio = false;
      if (audioFile && audioFile.size > 0) {
        const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/mp3', 'audio/x-m4a', 'audio/webm', 'audio/ogg'];
        if (audioTypes.includes(audioFile.type)) {
          fastapiFormData.append('audio', audioFile);
          hasAudio = true;
          console.log(`Audio received: ${audioFile.name} (${(audioFile.size / 1024).toFixed(2)} KB)`);
        } else {
          console.warn(`Unsupported audio type: ${audioFile.type}`);
        }
      }

      console.log('Calling FastAPI service...');
      console.log(`Primary URL: ${FASTAPI_URL}/analyze-lecture`);
      console.log(`Fallback URLs: ${FALLBACK_URLS.join(', ')}`);

      // Test FastAPI connection first with fallback
      let workingUrl = FASTAPI_URL;
      let testResponse;

      for (const url of FALLBACK_URLS) {
        try {
          testResponse = await fetch(`${url}/`, { timeout: 5000 });
          if (testResponse.ok) {
            workingUrl = url;
            console.log(`✅ FastAPI connection successful on: ${url}`);
            break;
          }
        } catch (testError) {
          console.log(`❌ FastAPI test failed on ${url}: ${testError.message}`);
          continue;
        }
      }

      if (!testResponse || !testResponse.ok) {
        console.log('🚫 All FastAPI connection attempts failed');
        return NextResponse.json(
          {
            error: 'Backend service is not running',
            details: 'Start FastAPI with: python main.py or uvicorn main:app --port 8000'
          },
          { status: 503 }
        );
      }

      const response = await fetch(`${workingUrl}/analyze-lecture`, {
        method: 'POST',
        body: fastapiFormData,
      });

      console.log(`FastAPI response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch {
          errorText = 'No error details available';
        }

        console.error('FastAPI error:', errorText);

        return NextResponse.json(
          {
            error: 'Failed to process lecture',
            details: errorText
          },
          { status: response.status }
        );
      }

      let fastAPIData;
      try {
        fastAPIData = await response.json();
        console.log('✅ Lecture plan generated successfully by FastAPI');

        // Validate response structure
        if (!fastAPIData.success) {
          throw new Error(fastAPIData.error || 'FastAPI reported failure');
        }

        if (!fastAPIData.studyPlan && !fastAPIData.lecturePlan && !fastAPIData.lectureId) {
          throw new Error('Invalid response structure from FastAPI - missing lecture plan data');
        }

      } catch (parseError) {
        console.error('Failed to parse or validate response:', parseError);
        return NextResponse.json(
          {
            error: 'Invalid response from backend',
            details: parseError.message
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Lecture plan generated',
        studyPlan: fastAPIData.studyPlan || fastAPIData.lecturePlan || fastAPIData,
        sessionId: fastAPIData.studyPlan?.sessionId || fastAPIData.sessionId || fastAPIData.lectureId,
        lectureId: fastAPIData.studyPlan?.lectureId || fastAPIData.lectureId,
        source: 'fastapi',
        generatedAt: new Date().toISOString()
      });

    } else {
      // Unknown content type
      return NextResponse.json(
        {
          error: 'Unsupported content type',
          details: 'Please send either JSON or FormData'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in get-lecture-plan:', error.message);

    // Fallback: Load from mock if available
    try {
      const mockData = await loadMockLecturePlan();
      const latestPlan = mockData[0]; // Get latest plan

      return NextResponse.json({
        success: true,
        studyPlan: latestPlan,
        sessionId: latestPlan.sessionId,
        lectureId: latestPlan.lectureId,
        isFallback: true,
        message: 'Using fallback lecture plan'
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);

      // Generate a basic fallback
      const basicPlan = {
        sessionId: `session_${Date.now()}`,
        lectureId: `lecture_${Date.now()}`,
        topic: "Computer Science Fundamentals",
        duration: "45 minutes",
        date: new Date().toISOString().split('T')[0],
        instructor: "AI Assistant",
        impTopics: [
          {
            id: "topic-1",
            title: "Introduction to Computing",
            description: "Basic concepts of computer systems",
            importance: "high",
            weightage: 80.5
          },
          {
            id: "topic-2",
            title: "Data Structures",
            description: "Organizing and storing data efficiently",
            importance: "high",
            weightage: 85.2
          }
        ]
      };

      return NextResponse.json({
        success: true,
        studyPlan: basicPlan,
        sessionId: basicPlan.sessionId,
        lectureId: basicPlan.lectureId,
        isFallback: true,
        message: 'Using basic fallback plan'
      });
    }
  }
}

function adaptPlanForGoal(lecturePlan, studentGoal) {
  if (!studentGoal || !lecturePlan) return lecturePlan;

  const goalInfo = {
    gate: {
      examFocus: "Problem-solving speed and accuracy",
      preparationTips: ["Practice time-bound questions", "Focus on previous year papers"],
      weightageAdjustment: 1.2
    },
    jee: {
      examFocus: "Conceptual depth and mathematical rigor",
      preparationTips: ["Master fundamentals", "Practice derivation-based problems"],
      weightageAdjustment: 1.1
    },
    neet: {
      examFocus: "Visual learning and memory techniques",
      preparationTips: ["Use diagrams", "Focus on NCERT concepts"],
      weightageAdjustment: 1.0
    },
    semester: {
      examFocus: "University-specific syllabus coverage",
      preparationTips: ["Follow course outline", "Practice previous semester papers"],
      weightageAdjustment: 0.9
    },
    concept: {
      examFocus: "Deep understanding and application",
      preparationTips: ["Build from first principles", "Connect to real-world examples"],
      weightageAdjustment: 1.0
    }
  };

  const goalData = goalInfo[studentGoal] || goalInfo.gate;

  // Update topics with goal-specific adjustments
  if (lecturePlan.impTopics && Array.isArray(lecturePlan.impTopics)) {
    lecturePlan.impTopics = lecturePlan.impTopics.map(topic => ({
      ...topic,
      weightage: Math.min(100, Math.round(topic.weightage * goalData.weightageAdjustment)),
      examRelevance: `${goalData.examFocus} - ${topic.title}`,
      preparationTips: [...(topic.preparationTips || []), ...goalData.preparationTips.slice(0, 2)]
    }));
  }

  // Add goal metadata
  lecturePlan.studentGoal = studentGoal;
  lecturePlan.adaptedForGoal = true;
  lecturePlan.adaptationDate = new Date().toISOString();
  lecturePlan.goalSpecificInfo = goalData;

  return lecturePlan;
}

function generateFallbackPlan(topic, studentGoal) {
  console.log('🔄 Generating fallback lecture plan');

  const fallbackPlan = {
    lectureId: `fallback-${Date.now()}`,
    sessionId: `session-fallback-${Date.now()}`,
    topic: topic || "Operating Systems",
    duration: "45 minutes",
    date: new Date().toISOString().split('T')[0],
    instructor: "AI Assistant",
    studentGoal: studentGoal || "gate",
    impTopics: [
      {
        id: "topic-1",
        title: `Introduction to ${topic || "Operating Systems"}`,
        description: `Fundamental concepts and principles of ${topic || "operating systems"}. Learn about process management, memory allocation, and system calls.`,
        importance: "high",
        weightage: 35,
        prerequisites: [],
        commonMisconceptions: [
          "Confusing OS with application software",
          "Thinking all OS functions are automatic"
        ],
        keyInsights: [
          "OS manages hardware and software resources",
          "Provides interface between users and hardware"
        ],
        examRelevance: "Core concept for all computer science exams",
        preparationTips: ["Focus on definitions", "Understand basic functions"]
      },
      {
        id: "topic-2",
        title: `Advanced ${topic || "OS"} Concepts`,
        description: `Deeper exploration of ${topic || "operating system"} principles including synchronization, deadlocks, and memory management.`,
        importance: "high",
        weightage: 40,
        prerequisites: ["topic-1"],
        commonMisconceptions: [
          "Misunderstanding deadlock conditions",
          "Confusing paging with segmentation"
        ],
        keyInsights: [
          "Process synchronization prevents race conditions",
          "Deadlocks require all four conditions"
        ],
        examRelevance: "High-weightage topic in technical interviews",
        preparationTips: ["Practice with diagrams", "Solve example problems"]
      },
      {
        id: "topic-3",
        title: `${topic || "OS"} Applications`,
        description: `Practical applications and real-world implementations of ${topic || "operating system"} concepts.`,
        importance: "medium",
        weightage: 25,
        prerequisites: ["topic-1", "topic-2"],
        commonMisconceptions: [
          "Overcomplicating simple concepts",
          "Missing real-world connections"
        ],
        keyInsights: [
          "OS concepts apply to all computing devices",
          "Understanding OS helps optimize application performance"
        ],
        examRelevance: "Application-based questions",
        preparationTips: ["Study case studies", "Relate to daily computer use"]
      }
    ],
    difficultyMetrics: {
      conceptualDifficulty: "medium",
      mathematicalDifficulty: studentGoal === 'jee' ? "high" : "medium",
      implementationDifficulty: "medium",
      overall: studentGoal === 'gate' ? "intermediate" : "beginner"
    },
    learningObjectives: [
      `Understand fundamental concepts of ${topic || "operating systems"}`,
      `Apply ${topic || "OS"} principles to solve problems`,
      `Master ${topic || "OS"} for ${studentGoal || "exam"} preparation`
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "fallback_generator",
      isFallback: true,
      confidence: 0.7,
      note: "Using fallback content - upload PDF for personalized plan"
    }
  };

  const adaptedPlan = adaptPlanForGoal(fallbackPlan, studentGoal);

  return NextResponse.json({
    success: true,
    message: 'Using fallback lecture plan',
    studyPlan: adaptedPlan,
    sessionId: adaptedPlan.sessionId,
    lectureId: adaptedPlan.lectureId,
    source: 'fallback',
    isFallback: true,
    retrievedAt: new Date().toISOString()
  });
}

// Helper function to load mock data
async function loadMockLecturePlan() {
  try {
    // Try to read from the mock file
    const mockFilePath = path.join(process.cwd(), 'src/app/lib/mock_lecture_plan.json');
    const fileContents = fs.readFileSync(mockFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error loading mock file:', error);

    // Return default mock data
    return [
      {
        sessionId: "mock-session-123",
        lectureId: "mock-lecture-456",
        topic: "Operating Systems",
        duration: "45 minutes",
        date: new Date().toISOString().split('T')[0],
        instructor: "AI Assistant",
        impTopics: [
          {
            id: "topic-1",
            title: "Process Management",
            description: "Managing processes in operating systems",
            importance: "high",
            weightage: 90.0
          },
          {
            id: "topic-2",
            title: "Memory Management",
            description: "Allocation and management of memory",
            importance: "high",
            weightage: 85.0
          }
        ]
      }
    ];
  }
}

// GET endpoint to retrieve stored lecture plan
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const lectureId = url.searchParams.get('lectureId');

    // Load from mock file
    const mockData = await loadMockLecturePlan();

    let planToUse;
    if (sessionId || lectureId) {
      planToUse = mockData.find(p =>
        (sessionId && p.sessionId === sessionId) ||
        (lectureId && p.lectureId === lectureId)
      );
    }

    if (!planToUse) {
      planToUse = mockData[0];
    }

    return NextResponse.json({
      success: true,
      lecturePlan: planToUse,
      knowledgeTestQuestions: [],
      isFallback: true
    });

  } catch (error) {
    console.error('Error fetching lecture plan:', error);

    // Return minimal fallback
    return NextResponse.json({
      success: true,
      lecturePlan: {
        sessionId: "fallback-session",
        lectureId: "fallback-lecture",
        topic: "General Concepts",
        impTopics: [
          {
            id: "topic-1",
            title: "Basic Concepts",
            importance: "medium"
          }
        ]
      },
      knowledgeTestQuestions: [],
      isFallback: true
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}