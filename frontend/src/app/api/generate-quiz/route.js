/**
 * INTELLIGENT QUIZ GENERATION API
 * Generates adaptive quizzes based on three input streams:
 * 1. Student Goal and Profile
 * 2. Knowledge State from Previous Interactions
 * 3. Lecture Plan Content
 */

import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/config';

// =========================================================
// CONFIGURATION
// =========================================================
const USE_EXTERNAL_APIS = false; // Set to true to enable OpenRouter, etc.

// =========================================================
// MAIN API ROUTE
// =========================================================
export async function POST(request) {
  console.log('=== INTELLIGENT QUIZ GENERATION STARTED ===');
  const startTime = Date.now();

  try {
    // Parse and validate request
    const data = await request.json();

    // Log request for debugging
    console.log('Quiz generation request:', {
      hasTopic: !!data.topic,
      topicTitle: data.topic?.title || data.topic,
      difficulty: data.difficulty,
      studentGoal: data.studentGoal,
      questions: data.numberOfQuestions,
      sessionId: data.sessionId ? `${data.sessionId.substring(0, 8)}...` : 'none',
      hasMisconceptions: data.misconceptions?.length > 0,
      hasPreviousPerformance: !!data.previousPerformance,
      cognitiveLoad: data.cognitiveLoad
    });

    // Validate required fields
    if (!data.topic) {
      throw new Error("Missing required field: topic");
    }

    if (!data.sessionId) {
      throw new Error("Missing required field: sessionId");
    }

    // Extract and enhance data
    const enhancedTopic = enhanceQuizTopicData(data.topic, data.lecturePlan);
    const difficulty = data.difficulty || 'medium';
    const studentGoal = data.studentGoal || 'gate';
    const numberOfQuestions = Math.min(data.numberOfQuestions || 5, 10);
    const sessionId = data.sessionId;
    const misconceptions = data.misconceptions || [];
    const previousPerformance = data.previousPerformance || {};
    const cognitiveLoad = data.cognitiveLoad || 'medium';

    console.log('Processing quiz for:', {
      topicTitle: enhancedTopic.title,
      difficulty,
      studentGoal,
      questions: numberOfQuestions,
      cognitiveLoad,
      hasRealData: !!(enhancedTopic.keyInsights || enhancedTopic.commonMisconceptions)
    });

    // Generate adaptive quiz using intelligent methods
    let quizData;
    let generationSource = 'intelligent_local';

    try {
      // First try: Use backend with REAL topic data
      quizData = await generateFromBackendWithRealTopic(
        enhancedTopic, difficulty, studentGoal, numberOfQuestions,
        sessionId, misconceptions, previousPerformance, cognitiveLoad, data.recentContext || ''
      );
      generationSource = 'backend_intelligent';
      console.log('Backend quiz generation successful');
    } catch (backendError) {
      console.log('Backend failed, using intelligent local generation:', backendError.message);

      // Second try: Intelligent local generation with REAL topic data
      quizData = generateIntelligentLocalQuiz(
        enhancedTopic, difficulty, studentGoal, numberOfQuestions,
        misconceptions, previousPerformance, cognitiveLoad
      );
      generationSource = 'intelligent_local';
    }

    // Enhance quiz with adaptive metadata
    const enhancedQuiz = enhanceQuizWithAdaptiveIntelligence(
      quizData, enhancedTopic, difficulty, studentGoal,
      misconceptions, previousPerformance, cognitiveLoad, sessionId, generationSource
    );

    // Generate personalized recommendations
    const recommendations = generateIntelligentRecommendations(
      enhancedQuiz, previousPerformance, cognitiveLoad, misconceptions
    );

    console.log('Quiz generated successfully:', {
      questions: enhancedQuiz.questions.length,
      difficulty: enhancedQuiz.difficulty,
      source: generationSource,
      adaptiveLevel: enhancedQuiz.metadata?.adaptiveLevel,
      time: Date.now() - startTime + 'ms'
    });

    return NextResponse.json({
      success: true,
      quiz: enhancedQuiz,
      recommendations: recommendations,
      educationalMetadata: {
        topicEnhanced: true,
        misconceptionsTargeted: misconceptions.length,
        adaptiveLevel: enhancedQuiz.metadata?.adaptiveLevel,
        cognitiveLoadAdjusted: cognitiveLoad
      },
      message: `Intelligent quiz generated via ${generationSource.replace('_', ' ')}`,
      performance: {
        generationTime: Date.now() - startTime,
        questionsGenerated: enhancedQuiz.questions.length
      }
    });

  } catch (error) {
    console.error('FATAL ERROR in quiz generation:', error);

    // Intelligent emergency fallback
    const emergencyQuiz = await createIntelligentEmergencyQuiz(error, request);

    return NextResponse.json({
      success: false,
      quiz: emergencyQuiz,
      error: error.message,
      isFallback: true,
      message: "Using intelligent emergency fallback quiz",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// =========================================================
// TOPIC DATA ENHANCEMENT FOR QUIZ
// =========================================================

function enhanceQuizTopicData(topic, lecturePlan = null) {
  console.log('Enhancing topic data for quiz generation...');

  // If topic is a string, create enhanced object
  if (typeof topic === 'string') {
    return createEnhancedQuizTopicFromString(topic, lecturePlan);
  }

  // If topic is already an object, enhance it
  const enhanced = { ...topic };

  // Ensure required fields
  enhanced.id = enhanced.id || `quiz_topic_${Date.now()}`;
  enhanced.title = cleanQuizTopicTitle(enhanced.title || enhanced.name || 'Learning Topic');
  enhanced.description = enhanced.description || enhanced.text || enhanced.full_text || '';

  // Add quiz-specific educational data
  if (!enhanced.keyInsights || enhanced.keyInsights.length === 0) {
    enhanced.keyInsights = extractQuizInsightsFromDescription(enhanced.description);
  }

  if (!enhanced.commonMisconceptions || enhanced.commonMisconceptions.length === 0) {
    enhanced.commonMisconceptions = extractQuizMisconceptionsFromDescription(enhanced.description);
  }

  // Add quiz question seeds
  enhanced.quizQuestionSeeds = generateQuizQuestionSeeds(enhanced);

  // Determine question types suitable for this topic
  enhanced.suitableQuestionTypes = determineSuitableQuestionTypes(enhanced);

  // Add metadata
  enhanced.quizMetadata = {
    enhancedAt: new Date().toISOString(),
    wordCount: enhanced.description.split(' ').length,
    estimatedQuizTime: estimateQuizTime(enhanced.description),
    difficultyIndicators: analyzeTopicDifficulty(enhanced.description)
  };

  console.log(`Topic enhanced for quiz: "${enhanced.title}"`, {
    insights: enhanced.keyInsights.length,
    misconceptions: enhanced.commonMisconceptions.length,
    questionSeeds: enhanced.quizQuestionSeeds.length,
    suitableTypes: enhanced.suitableQuestionTypes
  });

  return enhanced;
}

function createEnhancedQuizTopicFromString(topicString, lecturePlan) {
  console.log('Creating enhanced quiz topic from string:', topicString.substring(0, 50));

  // Try to find matching topic in lecture plan
  let matchingTopic = null;
  if (lecturePlan?.impTopics) {
    matchingTopic = lecturePlan.impTopics.find(t =>
      t.title && t.title.toLowerCase().includes(topicString.toLowerCase().substring(0, 20))
    );
  }

  if (matchingTopic) {
    console.log('Found matching topic in lecture plan for quiz');
    return enhanceQuizTopicData(matchingTopic, lecturePlan);
  }

  // Create new enhanced quiz topic
  const title = cleanQuizTopicTitle(topicString);

  return {
    id: `quiz_enhanced_${Date.now()}`,
    title: title,
    description: `Quiz on ${title} covering fundamental concepts, applications, and analysis questions.`,
    keyInsights: [
      `Core principles and definitions`,
      `Key applications and use cases`,
      `Important relationships and connections`,
      `Common implementation approaches`
    ],
    commonMisconceptions: [
      `Confusing similar concepts or terminology`,
      `Overlooking fundamental assumptions`,
      `Misapplying concepts in wrong contexts`,
      `Incomplete understanding of mechanisms`
    ],
    quizQuestionSeeds: [
      `What is the fundamental concept of ${title}?`,
      `How is ${title} applied in practice?`,
      `What distinguishes different approaches to ${title}?`,
      `What common errors occur when working with ${title}?`,
      `How does ${title} relate to broader concepts?`
    ],
    suitableQuestionTypes: ['conceptual', 'application', 'analysis'],
    importance: 'medium',
    weightage: 65,
    difficulty: 'medium',
    quizMetadata: {
      createdFromString: true,
      originalString: topicString,
      enhancedAt: new Date().toISOString(),
      estimatedQuizTime: '5-7 minutes'
    }
  };
}

function cleanQuizTopicTitle(title) {
  if (!title || typeof title !== 'string') {
    return 'Quiz Topic';
  }

  let clean = title
    // Remove quiz-specific artifacts
    .replace(/\b(quiz|test|exam|questions?|problems?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize properly
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Limit length
  const words = clean.split(' ');
  if (words.length > 8) {
    clean = words.slice(0, 6).join(' ') + '...';
  }

  return clean || 'Important Concept';
}

function extractQuizInsightsFromDescription(description) {
  if (!description || description.length < 30) {
    return [
      "Fundamental principles and definitions",
      "Key applications and practical uses",
      "Important relationships with other concepts"
    ];
  }

  const insights = [];
  const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);

  // Look for definition sentences (often contain "is", "are", "means", "refers to")
  const definitionPatterns = ['is', 'are', 'means', 'refers to', 'defined as', 'called'];

  for (const sentence of sentences.slice(0, 5)) {
    const lowerSentence = sentence.toLowerCase();

    // Check for definition patterns
    const isDefinition = definitionPatterns.some(pattern =>
      lowerSentence.includes(` ${pattern} `)
    );

    // Check for importance indicators
    const isImportant = lowerSentence.includes('important') ||
      lowerSentence.includes('essential') ||
      lowerSentence.includes('crucial') ||
      lowerSentence.includes('key');

    // Check for application patterns
    const isApplication = lowerSentence.includes('used to') ||
      lowerSentence.includes('applied') ||
      lowerSentence.includes('practice') ||
      lowerSentence.includes('real-world');

    if (isDefinition) {
      insights.push(`Definition: ${sentence.trim()}`);
    } else if (isImportant) {
      insights.push(`Important: ${sentence.trim()}`);
    } else if (isApplication && insights.length < 4) {
      insights.push(`Application: ${sentence.trim()}`);
    }

    // Limit to 4 insights max
    if (insights.length >= 4) break;
  }

  // If we didn't find enough insights, add generic ones
  while (insights.length < 3) {
    const genericInsights = [
      "Core principles that govern this topic",
      "Fundamental relationships and dependencies",
      "Practical implications and use cases"
    ];
    insights.push(genericInsights[insights.length]);
  }

  return insights;
}

function extractQuizMisconceptionsFromDescription(description) {
  if (!description || description.length < 50) {
    return [
      "Confusing similar terminology",
      "Overlooking key assumptions",
      "Misapplying concepts in wrong contexts",
      "Misunderstanding causal relationships"
    ];
  }

  const misconceptions = [];
  const lowerDesc = description.toLowerCase();

  // Look for contrast words that indicate misconceptions
  const contrastWords = ['however', 'but', 'although', 'despite', 'unlike', 'while'];
  const sentences = description.split(/[.!?]+/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();

    // Check for common misconception indicators
    const hasMisconceptionIndicator =
      lowerSentence.includes('common mistake') ||
      lowerSentence.includes('often confused') ||
      lowerSentence.includes('misunderstanding') ||
      lowerSentence.includes('incorrect') ||
      contrastWords.some(word => lowerSentence.includes(word));

    if (hasMisconceptionIndicator && misconceptions.length < 4) {
      misconceptions.push(sentence.trim());
    }
  }

  // If we didn't find misconceptions, add common ones
  if (misconceptions.length === 0) {
    misconceptions.push(
      "Confusing this concept with similar or related concepts",
      "Overlooking important assumptions or boundary conditions",
      "Applying the concept in inappropriate contexts",
      "Misunderstanding the causal mechanisms involved"
    );
  }

  return misconceptions.slice(0, 4);
}

function generateQuizQuestionSeeds(topic) {
  const seeds = [];
  const title = topic.title || 'this topic';

  // Basic question stems
  const questionStems = [
    `What is the fundamental concept behind ${title}?`,
    `How does ${title} apply to real-world situations?`,
    `What distinguishes ${title} from similar concepts?`,
    `What are the limitations of ${title}?`,
    `How does ${title} relate to broader principles?`,
    `What common errors occur when working with ${title}?`,
    `What are the key components of ${title}?`,
    `How would you implement ${title} in practice?`,
    `What assumptions underlie ${title}?`,
    `How has ${title} evolved over time?`
  ];

  // Add topic-specific seeds if available
  if (topic.keyInsights && topic.keyInsights.length > 0) {
    topic.keyInsights.slice(0, 3).forEach(insight => {
      const insightText = insight.replace(/^(Definition:|Important:|Application:)\s*/i, '');
      seeds.push(`Explain: ${insightText}`);
    });
  }

  // Add general question seeds
  seeds.push(...questionStems.slice(0, 7));

  return seeds.slice(0, 8); // Return maximum 8 seeds
}

function determineSuitableQuestionTypes(topic) {
  const types = [];

  // Always include conceptual questions
  types.push('conceptual');

  // Check for practical content
  const description = topic.description.toLowerCase();
  const hasPracticalContent =
    description.includes('apply') ||
    description.includes('use') ||
    description.includes('implement') ||
    description.includes('practice') ||
    description.includes('real-world');

  if (hasPracticalContent) {
    types.push('application');
  }

  // Check for analytical content
  const hasAnalyticalContent =
    description.includes('analyze') ||
    description.includes('compare') ||
    description.includes('contrast') ||
    description.includes('evaluate') ||
    description.includes('relationship');

  if (hasAnalyticalContent) {
    types.push('analysis');
  }

  // Check for computational/mathematical content
  const hasComputationalContent =
    description.includes('calculate') ||
    description.includes('formula') ||
    description.includes('equation') ||
    description.includes('solve') ||
    description.includes('compute');

  if (hasComputationalContent) {
    types.push('numerical');
  }

  // If we have few types, add default ones
  if (types.length < 2) {
    types.push('application', 'analysis');
  }

  return types.slice(0, 4); // Maximum 4 question types
}

function estimateQuizTime(description) {
  if (!description) return '5-7 minutes';

  const wordCount = description.split(' ').length;

  if (wordCount < 100) {
    return '3-5 minutes';
  } else if (wordCount < 300) {
    return '5-8 minutes';
  } else if (wordCount < 500) {
    return '8-12 minutes';
  } else {
    return '10-15 minutes';
  }
}

function analyzeTopicDifficulty(description) {
  const indicators = [];
  const lowerDesc = description.toLowerCase();

  // Analyze complexity indicators
  if (lowerDesc.includes('complex') || lowerDesc.includes('complicated')) {
    indicators.push('high_complexity');
  }

  if (lowerDesc.includes('advanced') || lowerDesc.includes('sophisticated')) {
    indicators.push('advanced_level');
  }

  if (lowerDesc.includes('basic') || lowerDesc.includes('fundamental')) {
    indicators.push('fundamental');
  }

  // Check for mathematical content
  const mathPatterns = ['equation', 'formula', 'calculate', 'solve', 'compute', 'derivation'];
  if (mathPatterns.some(pattern => lowerDesc.includes(pattern))) {
    indicators.push('mathematical');
  }

  // Check for conceptual density
  const conceptWords = ['concept', 'theory', 'principle', 'model', 'framework', 'paradigm'];
  const conceptCount = conceptWords.filter(word => lowerDesc.includes(word)).length;
  if (conceptCount > 3) {
    indicators.push('concept_dense');
  }

  return indicators.length > 0 ? indicators : ['standard_difficulty'];
}

// =========================================================
// BACKEND QUIZ GENERATION
// =========================================================

async function generateFromBackendWithRealTopic(
  enhancedTopic, difficulty, studentGoal, numberOfQuestions,
  sessionId, misconceptions, previousPerformance, cognitiveLoad, recentContext = ''
) {
  console.log('Generating quiz from backend with real topic data...');

  const payload = {
    topic: enhancedTopic,
    difficulty,
    studentGoal,
    numberOfQuestions,
    sessionId,
    misconceptions: misconceptions.filter(m => m && typeof m === 'object'),
    previousPerformance,
    cognitiveLoad,
    recentContext
  };

  const response = await fetch(`${BACKEND_URL}/generate-topic-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.success || !data.quiz) {
    throw new Error(`Backend returned invalid data: ${data.message || 'No quiz generated'}`);
  }

  return data.quiz;
}

// =========================================================
// INTELLIGENT LOCAL QUIZ GENERATION
// =========================================================

function generateIntelligentLocalQuiz(
  enhancedTopic, difficulty, studentGoal, numberOfQuestions,
  misconceptions, previousPerformance, cognitiveLoad
) {
  console.log('Generating intelligent local quiz...');

  const questions = [];
  const questionCount = Math.max(5, Math.min(numberOfQuestions, 10));

  // Determine question distribution based on difficulty and cognitive load
  const distribution = calculateQuestionDistribution(
    questionCount, difficulty, studentGoal, cognitiveLoad, enhancedTopic.suitableQuestionTypes
  );

  // Generate questions for each type
  Object.entries(distribution).forEach(([type, count]) => {
    for (let i = 0; i < count; i++) {
      const question = generateQuestionByType(
        type, enhancedTopic, difficulty, studentGoal, i + 1,
        misconceptions, previousPerformance
      );
      if (question) {
        questions.push(question);
      }
    }
  });

  // Ensure we have at least 5 questions
  while (questions.length < 5) {
    const fallbackQuestion = createFallbackQuestion(enhancedTopic, questions.length + 1);
    questions.push(fallbackQuestion);
  }

  // Sort questions by estimated difficulty
  questions.sort((a, b) => a.difficultyScore - b.difficultyScore);

  return {
    id: `local_quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: `Quiz: ${enhancedTopic.title}`,
    description: `Adaptive quiz on ${enhancedTopic.title} covering key concepts and applications.`,
    difficulty: difficulty,
    topicId: enhancedTopic.id,
    questions: questions,
    metadata: {
      generatedLocally: true,
      generationMethod: 'intelligent_local',
      topicEnhanced: true,
      studentGoal,
      cognitiveLoad
    }
  };
}

function calculateQuestionDistribution(totalQuestions, difficulty, studentGoal, cognitiveLoad, suitableTypes) {
  const distribution = {};

  // Base distribution by difficulty
  const baseDistributions = {
    easy: { conceptual: 0.6, application: 0.3, analysis: 0.1 },
    medium: { conceptual: 0.4, application: 0.4, analysis: 0.2 },
    hard: { conceptual: 0.3, application: 0.4, analysis: 0.3 }
  };

  // Adjust for student goal
  const goalAdjustments = {
    gate: { analysis: 0.1, conceptual: -0.1 },
    placement: { application: 0.1, conceptual: -0.1 },
    general: { conceptual: 0.1, application: -0.1 }
  };

  // Adjust for cognitive load
  const cognitiveAdjustments = {
    low: { conceptual: 0.2, analysis: -0.2 },
    medium: {}, // No adjustment
    high: { conceptual: -0.1, analysis: 0.1 }
  };

  // Start with base distribution
  const base = baseDistributions[difficulty] || baseDistributions.medium;
  Object.keys(base).forEach(type => {
    distribution[type] = base[type];
  });

  // Apply adjustments
  const adjustments = goalAdjustments[studentGoal] || {};
  Object.keys(adjustments).forEach(type => {
    if (distribution[type] !== undefined) {
      distribution[type] = Math.max(0.1, Math.min(0.8, distribution[type] + adjustments[type]));
    }
  });

  // Apply cognitive load adjustments
  const cognitiveAdjs = cognitiveAdjustments[cognitiveLoad] || {};
  Object.keys(cognitiveAdjs).forEach(type => {
    if (distribution[type] !== undefined) {
      distribution[type] = Math.max(0.1, Math.min(0.8, distribution[type] + cognitiveAdjs[type]));
    }
  });

  // Normalize and convert to counts
  const types = Object.keys(distribution);
  const sum = types.reduce((acc, type) => acc + distribution[type], 0);
  let remainingQuestions = totalQuestions;
  const counts = {};

  // Assign integer counts
  types.forEach((type, index) => {
    if (index === types.length - 1) {
      counts[type] = remainingQuestions;
    } else {
      const count = Math.max(1, Math.floor((distribution[type] / sum) * totalQuestions));
      counts[type] = Math.min(count, remainingQuestions - (types.length - index - 1));
      remainingQuestions -= counts[type];
    }
  });

  // Filter to only include suitable types
  const finalDistribution = {};
  suitableTypes.forEach(type => {
    if (counts[type] > 0) {
      finalDistribution[type] = counts[type];
    }
  });

  // Ensure we have at least some questions
  if (Object.keys(finalDistribution).length === 0) {
    finalDistribution.conceptual = totalQuestions;
  }

  return finalDistribution;
}

function generateQuestionByType(
  type, enhancedTopic, difficulty, studentGoal, questionNumber,
  misconceptions, previousPerformance
) {
  const questionId = `${enhancedTopic.id}_q${questionNumber}_${type}_${Date.now()}`;

  switch (type) {
    case 'conceptual':
      return generateConceptualQuestion(questionId, enhancedTopic, difficulty, questionNumber);
    case 'application':
      return generateApplicationQuestion(questionId, enhancedTopic, difficulty, questionNumber);
    case 'analysis':
      return generateAnalysisQuestion(questionId, enhancedTopic, difficulty, questionNumber);
    case 'numerical':
      return generateNumericalQuestion(questionId, enhancedTopic, difficulty, questionNumber);
    default:
      return generateConceptualQuestion(questionId, enhancedTopic, difficulty, questionNumber);
  }
}

function generateConceptualQuestion(id, topic, difficulty, questionNumber) {
  const difficultyMultiplier = { easy: 0.7, medium: 1.0, hard: 1.3 }[difficulty] || 1.0;

  // Question stems based on topic insights
  const stems = [
    `What is the primary definition of ${topic.title}?`,
    `Which of the following best describes ${topic.title}?`,
    `What is the fundamental principle behind ${topic.title}?`,
    `Which concept is most closely associated with ${topic.title}?`,
    `What distinguishes ${topic.title} from similar concepts?`
  ];

  const questionText = stems[Math.floor(Math.random() * stems.length)];

  // Generate options
  const options = generateConceptualOptions(topic, difficulty);

  return {
    id,
    questionNumber,
    type: 'conceptual',
    text: questionText,
    options: options.options,
    correctAnswer: options.correctAnswer,
    explanation: `This question tests your understanding of the core concept of ${topic.title}. ${options.explanation}`,
    difficulty: difficulty,
    difficultyScore: 3.5 * difficultyMultiplier,
    metadata: {
      targetsConcept: true,
      requiresRecall: true,
      topicInsight: topic.keyInsights?.[0] || 'Fundamental concept understanding'
    }
  };
}

function generateConceptualOptions(topic, difficulty) {
  const correctOptions = [
    `The correct definition of ${topic.title}`,
    `Accurate description based on established principles`,
    `Proper conceptual understanding`,
    `The standard interpretation accepted by experts`
  ];

  const distractors = [
    `A common misconception about ${topic.title}`,
    `An oversimplification that misses key aspects`,
    `Confusion with a related but different concept`,
    `A misinterpretation based on incomplete understanding`,
    `An outdated or disproven understanding`,
    `Correct but incomplete description`
  ];

  const options = [];
  const correctIndex = Math.floor(Math.random() * 4);

  // Add correct option
  options.push({
    id: `opt_${Date.now()}_0`,
    text: correctOptions[Math.floor(Math.random() * correctOptions.length)],
    isCorrect: true
  });

  // Add distractors
  for (let i = 1; i < 4; i++) {
    options.push({
      id: `opt_${Date.now()}_${i}`,
      text: distractors[Math.floor(Math.random() * distractors.length)],
      isCorrect: false
    });
  }

  // Shuffle options
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  const correctAnswer = shuffled.findIndex(opt => opt.isCorrect);

  return {
    options: shuffled,
    correctAnswer: correctAnswer.toString(),
    explanation: `Understanding the precise definition is crucial for building a solid foundation in ${topic.title}.`
  };
}

function generateApplicationQuestion(id, topic, difficulty, questionNumber) {
  const difficultyMultiplier = { easy: 0.8, medium: 1.1, hard: 1.4 }[difficulty] || 1.1;

  const stems = [
    `How would you apply ${topic.title} to solve a real-world problem?`,
    `Which scenario best demonstrates the practical use of ${topic.title}?`,
    `In what situation would ${topic.title} be most effectively utilized?`,
    `What is a practical example of ${topic.title} in action?`,
    `How can ${topic.title} be implemented to achieve a specific goal?`
  ];

  const questionText = stems[Math.floor(Math.random() * stems.length)];
  const options = generateApplicationOptions(topic, difficulty);

  return {
    id,
    questionNumber,
    type: 'application',
    text: questionText,
    options: options.options,
    correctAnswer: options.correctAnswer,
    explanation: `This question tests your ability to apply ${topic.title} in practical scenarios. ${options.explanation}`,
    difficulty: difficulty,
    difficultyScore: 4.0 * difficultyMultiplier,
    metadata: {
      requiresApplication: true,
      realWorldContext: true,
      topicInsight: topic.keyInsights?.find(i => i.toLowerCase().includes('application')) || 'Practical implementation'
    }
  };
}

function generateApplicationOptions(topic, difficulty) {
  const correctOptions = [
    `Scenario that correctly applies ${topic.title} principles`,
    `Appropriate use case demonstrating effective application`,
    `Real-world implementation following best practices`,
    `Practical example that leverages ${topic.title} correctly`
  ];

  const distractors = [
    `Misapplication in wrong context`,
    `Over-application beyond valid boundaries`,
    `Incorrect implementation leading to failure`,
    `Application that violates fundamental assumptions`,
    `Scenario that doesn't actually use ${topic.title} principles`,
    `Correct principle applied to wrong problem type`
  ];

  // Similar structure to conceptual options
  const options = generateOptionsFromTemplates(correctOptions, distractors);

  return {
    ...options,
    explanation: `Practical application requires understanding both the concept and its appropriate contexts of use.`
  };
}

function generateAnalysisQuestion(id, topic, difficulty, questionNumber) {
  const difficultyMultiplier = { easy: 0.9, medium: 1.2, hard: 1.5 }[difficulty] || 1.2;

  const stems = [
    `Analyze the relationship between ${topic.title} and related concepts.`,
    `What conclusions can be drawn from applying ${topic.title} in this scenario?`,
    `Compare and contrast ${topic.title} with alternative approaches.`,
    `Evaluate the effectiveness of ${topic.title} in different contexts.`,
    `What insights can be gained by analyzing ${topic.title} from multiple perspectives?`
  ];

  const questionText = stems[Math.floor(Math.random() * stems.length)];
  const options = generateAnalysisOptions(topic, difficulty);

  return {
    id,
    questionNumber,
    type: 'analysis',
    text: questionText,
    options: options.options,
    correctAnswer: options.correctAnswer,
    explanation: `This question requires analytical thinking about ${topic.title}. ${options.explanation}`,
    difficulty: difficulty,
    difficultyScore: 4.5 * difficultyMultiplier,
    metadata: {
      requiresAnalysis: true,
      criticalThinking: true,
      topicInsight: topic.keyInsights?.find(i => i.toLowerCase().includes('relationship')) || 'Analytical understanding'
    }
  };
}

function generateAnalysisOptions(topic, difficulty) {
  const correctOptions = [
    `Insightful analysis considering multiple factors`,
    `Balanced evaluation weighing pros and cons`,
    `Deep understanding of relationships and implications`,
    `Comprehensive analysis that integrates different perspectives`
  ];

  const distractors = [
    `Overly simplistic analysis missing nuances`,
    `Analysis based on incorrect assumptions`,
    `Focus on irrelevant factors while missing key ones`,
    `Logical errors in reasoning process`,
    `Valid but incomplete analysis`,
    `Correct analysis of wrong aspect`
  ];

  const options = generateOptionsFromTemplates(correctOptions, distractors);

  return {
    ...options,
    explanation: `Analytical questions test your ability to think critically and understand complex relationships.`
  };
}

function generateNumericalQuestion(id, topic, difficulty, questionNumber) {
  const difficultyMultiplier = { easy: 0.8, medium: 1.1, hard: 1.4 }[difficulty] || 1.1;

  const stems = [
    `Calculate the value based on ${topic.title} principles.`,
    `Solve this problem using ${topic.title} equations.`,
    `What is the numerical result when applying ${topic.title}?`,
    `Perform the calculation related to ${topic.title}.`
  ];

  const questionText = stems[Math.floor(Math.random() * stems.length)];

  // Generate numerical options
  const baseValue = 10 + Math.floor(Math.random() * 90);
  const correctValue = baseValue * (1 + Math.random() * 0.5);
  const options = [];

  // Add correct option
  options.push({
    id: `opt_${Date.now()}_0`,
    text: correctValue.toFixed(2),
    isCorrect: true
  });

  // Add distractors with common calculation errors
  const errors = [0.5, 0.8, 1.2, 1.5, 2.0];
  for (let i = 1; i < 4; i++) {
    const errorFactor = errors[Math.floor(Math.random() * errors.length)];
    const wrongValue = correctValue * errorFactor;
    options.push({
      id: `opt_${Date.now()}_${i}`,
      text: wrongValue.toFixed(2),
      isCorrect: false
    });
  }

  // Shuffle
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  const correctAnswer = shuffled.findIndex(opt => opt.isCorrect);

  return {
    id,
    questionNumber,
    type: 'numerical',
    text: questionText,
    options: shuffled,
    correctAnswer: correctAnswer.toString(),
    explanation: `Numerical questions test your ability to apply ${topic.title} principles in quantitative scenarios. Always double-check your calculations.`,
    difficulty: difficulty,
    difficultyScore: 4.2 * difficultyMultiplier,
    metadata: {
      requiresCalculation: true,
      numericalReasoning: true,
      topicInsight: 'Quantitative application'
    }
  };
}

function generateOptionsFromTemplates(correctTemplates, distractorTemplates) {
  const options = [];

  // Add correct option
  options.push({
    id: `opt_${Date.now()}_0`,
    text: correctTemplates[Math.floor(Math.random() * correctTemplates.length)],
    isCorrect: true
  });

  // Add distractors
  for (let i = 1; i < 4; i++) {
    options.push({
      id: `opt_${Date.now()}_${i}`,
      text: distractorTemplates[Math.floor(Math.random() * distractorTemplates.length)],
      isCorrect: false
    });
  }

  // Shuffle
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  const correctAnswer = shuffled.findIndex(opt => opt.isCorrect);

  return {
    options: shuffled,
    correctAnswer: correctAnswer.toString(),
    explanation: `Carefully analyze each option to identify the most accurate response.`
  };
}

function createFallbackQuestion(topic, questionNumber) {
  return {
    id: `fallback_${Date.now()}_${questionNumber}`,
    questionNumber,
    type: 'conceptual',
    text: `What is the most important aspect of ${topic.title}?`,
    options: [
      { id: 'opt_a', text: 'Understanding core principles', isCorrect: true },
      { id: 'opt_b', text: 'Memorizing all details', isCorrect: false },
      { id: 'opt_c', text: 'Knowing historical context', isCorrect: false },
      { id: 'opt_d', text: 'Applying advanced techniques', isCorrect: false }
    ],
    correctAnswer: '0',
    explanation: `The most important aspect is understanding the core principles that form the foundation of ${topic.title}.`,
    difficulty: 'medium',
    difficultyScore: 3.0,
    metadata: {
      fallbackQuestion: true,
      essentialUnderstanding: true
    }
  };
}

// =========================================================
// QUIZ ENHANCEMENT WITH ADAPTIVE INTELLIGENCE
// =========================================================

function enhanceQuizWithAdaptiveIntelligence(
  quiz, enhancedTopic, difficulty, studentGoal,
  misconceptions, previousPerformance, cognitiveLoad, sessionId, generationSource
) {
  console.log('Enhancing quiz with adaptive intelligence...');

  const enhancedQuiz = { ...quiz };

  // Calculate adaptive level based on multiple factors
  const adaptiveLevel = calculateAdaptiveLevel(
    difficulty, studentGoal, cognitiveLoad, misconceptions.length,
    previousPerformance, enhancedTopic
  );

  // Add comprehensive metadata
  enhancedQuiz.metadata = {
    ...enhancedQuiz.metadata,
    sessionId,
    generationSource,
    enhancedTopicId: enhancedTopic.id,
    adaptiveLevel,
    studentGoal,
    cognitiveLoad,
    misconceptionCount: misconceptions.length,
    previousPerformanceAvailable: Object.keys(previousPerformance).length > 0,
    difficultyProfile: analyzeDifficultyProfile(enhancedQuiz.questions),
    questionTypes: countQuestionTypes(enhancedQuiz.questions),
    topicComplexity: enhancedTopic.quizMetadata?.difficultyIndicators || [],
    generationTimestamp: new Date().toISOString(),
    estimatedCompletionTime: estimateQuizCompletionTime(enhancedQuiz.questions, cognitiveLoad)
  };

  // Add topic context to quiz
  enhancedQuiz.topicContext = {
    title: enhancedTopic.title,
    keyInsights: enhancedTopic.keyInsights?.slice(0, 3) || [],
    commonMisconceptions: enhancedTopic.commonMisconceptions?.slice(0, 3) || [],
    importance: enhancedTopic.importance || 'medium',
    weightage: enhancedTopic.weightage || 50
  };

  // Tag questions with learning objectives
  enhancedQuiz.questions = enhancedQuiz.questions.map((question, index) => ({
    ...question,
    metadata: {
      ...question.metadata,
      learningObjective: determineLearningObjective(question, enhancedTopic, index),
      cognitiveLevel: determineCognitiveLevel(question.type),
      adaptiveWeight: calculateQuestionWeight(question, adaptiveLevel, index),
      targetsMisconceptions: checkIfTargetsMisconceptions(question, misconceptions)
    }
  }));

  // Add educational scaffolding
  enhancedQuiz.educationalScaffolding = {
    hintsAvailable: adaptiveLevel >= 0.5,
    explanationsDetailed: adaptiveLevel >= 0.7,
    adaptiveFeedback: true,
    learningPathIntegration: studentGoal !== 'general',
    progressTracking: true
  };

  console.log('Quiz enhanced with adaptive intelligence', {
    adaptiveLevel: adaptiveLevel.toFixed(2),
    questionCount: enhancedQuiz.questions.length,
    questionTypes: enhancedQuiz.metadata.questionTypes
  });

  return enhancedQuiz;
}

function calculateAdaptiveLevel(difficulty, studentGoal, cognitiveLoad, misconceptionCount, previousPerformance, topic) {
  let score = 0;

  // Difficulty contributes 30%
  const difficultyScores = { easy: 0.3, medium: 0.5, hard: 0.7 };
  score += (difficultyScores[difficulty] || 0.5) * 0.3;

  // Student goal contributes 20%
  const goalScores = { gate: 0.8, placement: 0.7, general: 0.4 };
  score += (goalScores[studentGoal] || 0.5) * 0.2;

  // Cognitive load contributes 15%
  const loadScores = { low: 0.3, medium: 0.5, high: 0.7 };
  score += (loadScores[cognitiveLoad] || 0.5) * 0.15;

  // Misconceptions contribute 15%
  const misconceptionScore = Math.min(misconceptionCount / 5, 1);
  score += misconceptionScore * 0.15;

  // Previous performance contributes 10%
  const performanceScore = calculatePerformanceScore(previousPerformance);
  score += performanceScore * 0.1;

  // Topic complexity contributes 10%
  const topicScore = calculateTopicComplexityScore(topic);
  score += topicScore * 0.1;

  // Normalize to 0-1 range
  return Math.max(0.1, Math.min(0.95, score));
}

function calculatePerformanceScore(previousPerformance) {
  if (!previousPerformance || Object.keys(previousPerformance).length === 0) {
    return 0.5; // Neutral if no data
  }

  // Calculate average score if available
  if (previousPerformance.averageScore !== undefined) {
    return previousPerformance.averageScore / 100;
  }

  // Look for recent performance
  if (previousPerformance.recentQuizzes && previousPerformance.recentQuizzes.length > 0) {
    const recentScores = previousPerformance.recentQuizzes
      .slice(0, 3)
      .map(q => q.score || 0);

    if (recentScores.length > 0) {
      const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      return avg / 100;
    }
  }

  return 0.5;
}

function calculateTopicComplexityScore(topic) {
  if (!topic.quizMetadata?.difficultyIndicators) {
    return 0.5;
  }

  const indicators = topic.quizMetadata.difficultyIndicators;
  let complexity = 0.5;

  // Adjust based on difficulty indicators
  if (indicators.includes('high_complexity')) complexity += 0.2;
  if (indicators.includes('advanced_level')) complexity += 0.15;
  if (indicators.includes('mathematical')) complexity += 0.1;
  if (indicators.includes('concept_dense')) complexity += 0.1;
  if (indicators.includes('fundamental')) complexity -= 0.1;

  return Math.max(0.1, Math.min(0.9, complexity));
}

function analyzeDifficultyProfile(questions) {
  const difficulties = questions.map(q => q.difficultyScore || 3);
  const avg = difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
  const min = Math.min(...difficulties);
  const max = Math.max(...difficulties);

  return {
    average: parseFloat(avg.toFixed(2)),
    range: parseFloat((max - min).toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    distribution: {
      easy: difficulties.filter(d => d < 3).length,
      medium: difficulties.filter(d => d >= 3 && d <= 4).length,
      hard: difficulties.filter(d => d > 4).length
    }
  };
}

function countQuestionTypes(questions) {
  const counts = {};
  questions.forEach(q => {
    counts[q.type] = (counts[q.type] || 0) + 1;
  });
  return counts;
}

function estimateQuizCompletionTime(questions, cognitiveLoad) {
  const baseTimePerQuestion = {
    conceptual: 60,    // seconds
    application: 90,
    analysis: 120,
    numerical: 150
  };

  const cognitiveLoadMultiplier = {
    low: 0.8,
    medium: 1.0,
    high: 1.2
  };

  let totalSeconds = 0;
  questions.forEach(q => {
    totalSeconds += baseTimePerQuestion[q.type] || 90;
  });

  const multiplier = cognitiveLoadMultiplier[cognitiveLoad] || 1.0;
  totalSeconds *= multiplier;

  // Convert to minutes
  const minutes = Math.ceil(totalSeconds / 60);

  return {
    estimatedMinutes: minutes,
    timeRange: `${Math.floor(minutes * 0.8)}-${Math.ceil(minutes * 1.2)} minutes`,
    perQuestionAverage: Math.round(totalSeconds / questions.length)
  };
}

function determineLearningObjective(question, topic, index) {
  const objectives = [
    `Understand core concepts of ${topic.title}`,
    `Apply ${topic.title} principles to solve problems`,
    `Analyze relationships involving ${topic.title}`,
    `Evaluate different aspects of ${topic.title}`,
    `Synthesize knowledge about ${topic.title} with other concepts`
  ];

  const typeMapping = {
    conceptual: objectives[0],
    application: objectives[1],
    analysis: objectives[2],
    numerical: objectives[1]
  };

  return typeMapping[question.type] || objectives[0];
}

function determineCognitiveLevel(questionType) {
  const levels = {
    conceptual: 'remember',
    application: 'apply',
    analysis: 'analyze',
    numerical: 'apply'
  };

  return levels[questionType] || 'understand';
}

function calculateQuestionWeight(question, adaptiveLevel, index) {
  let weight = 1.0;

  // Higher weight for more difficult questions in adaptive quizzes
  if (adaptiveLevel > 0.7 && question.difficultyScore > 4) {
    weight = 1.3;
  } else if (adaptiveLevel < 0.4 && question.difficultyScore < 3) {
    weight = 0.8;
  }

  // Adjust based on position (later questions slightly higher weight)
  const positionFactor = 1 + (index * 0.05);
  weight *= positionFactor;

  return parseFloat(weight.toFixed(2));
}

function checkIfTargetsMisconceptions(question, misconceptions) {
  if (!misconceptions || misconceptions.length === 0) {
    return false;
  }

  // Check if question text contains any misconception keywords
  const questionText = question.text.toLowerCase();
  const misconceptionKeywords = misconceptions
    .join(' ')
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 5);

  return misconceptionKeywords.some(keyword => questionText.includes(keyword));
}

// =========================================================
// INTELLIGENT RECOMMENDATIONS
// =========================================================

function generateIntelligentRecommendations(quiz, previousPerformance, cognitiveLoad, misconceptions) {
  console.log('Generating intelligent recommendations...');

  const recommendations = {
    beforeQuiz: [],
    duringQuiz: [],
    afterQuiz: [],
    studySuggestions: []
  };

  // Before quiz recommendations based on cognitive load and previous performance
  if (cognitiveLoad === 'high') {
    recommendations.beforeQuiz.push(
      "Take short breaks between questions to maintain focus",
      "Read each question twice before attempting to answer"
    );
  } else if (cognitiveLoad === 'low') {
    recommendations.beforeQuiz.push(
      "Try to complete the quiz efficiently while maintaining accuracy",
      "Challenge yourself by timing each question"
    );
  }

  // Add previous performance-based recommendations
  if (previousPerformance?.averageScore !== undefined) {
    const avgScore = previousPerformance.averageScore;
    if (avgScore < 60) {
      recommendations.beforeQuiz.push(
        "Focus on understanding the explanations thoroughly",
        "Don't rush - accuracy is more important than speed"
      );
    } else if (avgScore > 80) {
      recommendations.beforeQuiz.push(
        "Try to complete the quiz faster than your average time",
        "Pay attention to nuanced differences in options"
      );
    }
  }

  // During quiz recommendations based on quiz characteristics
  const questionTypes = quiz.metadata?.questionTypes || {};
  if (questionTypes.analysis && questionTypes.analysis > 0) {
    recommendations.duringQuiz.push(
      "For analysis questions, consider multiple perspectives before answering",
      "Look for keywords like 'compare', 'contrast', 'evaluate' in analysis questions"
    );
  }

  if (questionTypes.numerical && questionTypes.numerical > 0) {
    recommendations.duringQuiz.push(
      "Double-check calculations for numerical questions",
      "Estimate the answer before calculating to catch obvious errors"
    );
  }

  // After quiz recommendations
  recommendations.afterQuiz.push(
    "Review explanations for all questions, even those you answered correctly",
    "Note down concepts you found challenging for focused review"
  );

  // Study suggestions based on misconceptions
  if (misconceptions && misconceptions.length > 0) {
    misconceptions.slice(0, 2).forEach(misconception => {
      recommendations.studySuggestions.push(
        `Focus on understanding: ${misconception.substring(0, 60)}...`
      );
    });
  }

  // Add general learning strategy
  const difficultyProfile = quiz.metadata?.difficultyProfile;
  if (difficultyProfile && difficultyProfile.average > 4) {
    recommendations.studySuggestions.push(
      "This topic appears challenging. Consider reviewing foundational concepts first",
      "Break down complex concepts into smaller parts for easier understanding"
    );
  }

  return recommendations;
}

// =========================================================
// EMERGENCY FALLBACK QUIZ
// =========================================================

async function createIntelligentEmergencyQuiz(error, request) {
  console.log('🆘 Creating intelligent emergency fallback quiz...');

  try {
    // Try to extract topic from request if available
    let topicTitle = 'Important Concepts';
    try {
      const clone = request.clone();
      const data = clone.json ? await clone.json().catch(() => ({})) : {};
      topicTitle = data.topic?.title || data.topic || 'Important Concepts';
    } catch (e) {
      // Ignore and use default
    }

    return {
      id: `emergency_quiz_${Date.now()}`,
      title: `Quiz: ${topicTitle}`,
      description: "Emergency fallback quiz covering key concepts. The main quiz system encountered an error.",
      difficulty: 'medium',
      questions: [
        {
          id: 'emergency_q1',
          questionNumber: 1,
          type: 'conceptual',
          text: `What is the fundamental concept behind ${topicTitle}?`,
          options: [
            { id: 'opt_a', text: 'Core principles and foundations', isCorrect: true },
            { id: 'opt_b', text: 'Advanced applications only', isCorrect: false },
            { id: 'opt_c', text: 'Historical background', isCorrect: false },
            { id: 'opt_d', text: 'Memorization of facts', isCorrect: false }
          ],
          correctAnswer: '0',
          explanation: `The fundamental concept involves understanding core principles and foundations that form the basis of ${topicTitle}.`,
          difficulty: 'medium',
          difficultyScore: 3.0,
          metadata: { emergencyFallback: true }
        },
        {
          id: 'emergency_q2',
          questionNumber: 2,
          type: 'application',
          text: `How would you apply ${topicTitle} in practice?`,
          options: [
            { id: 'opt_a', text: 'Following established procedures', isCorrect: false },
            { id: 'opt_b', text: 'Using appropriate tools and methods', isCorrect: true },
            { id: 'opt_c', text: 'Trial and error only', isCorrect: false },
            { id: 'opt_d', text: 'Copying from others', isCorrect: false }
          ],
          correctAnswer: '1',
          explanation: `Applying ${topicTitle} in practice requires using appropriate tools and methods while following sound principles.`,
          difficulty: 'medium',
          difficultyScore: 3.5,
          metadata: { emergencyFallback: true }
        },
        {
          id: 'emergency_q3',
          questionNumber: 3,
          type: 'analysis',
          text: `What important relationship exists within ${topicTitle}?`,
          options: [
            { id: 'opt_a', text: 'Cause and effect relationships', isCorrect: false },
            { id: 'opt_b', text: 'Interdependence of components', isCorrect: true },
            { id: 'opt_c', text: 'Random associations', isCorrect: false },
            { id: 'opt_d', text: 'Isolated independent parts', isCorrect: false }
          ],
          correctAnswer: '1',
          explanation: `${topicTitle} typically involves interdependence of components working together to achieve desired outcomes.`,
          difficulty: 'medium',
          difficultyScore: 4.0,
          metadata: { emergencyFallback: true }
        }
      ],
      metadata: {
        emergencyFallback: true,
        errorMessage: error.message,
        generatedAt: new Date().toISOString(),
        note: "This is an emergency fallback quiz. The main system encountered an error."
      }
    };
  } catch (fallbackError) {
    // Ultimate fallback - return a very basic quiz
    return {
      id: `ultimate_fallback_${Date.now()}`,
      title: "Learning Concepts Quiz",
      description: "Basic quiz covering important learning concepts",
      difficulty: 'medium',
      questions: [
        {
          id: 'q1',
          questionNumber: 1,
          type: 'conceptual',
          text: "What is the most important aspect of learning?",
          options: [
            { id: 'opt_a', text: 'Understanding fundamental concepts', isCorrect: true },
            { id: 'opt_b', text: 'Memorizing information', isCorrect: false },
            { id: 'opt_c', text: 'Completing assignments quickly', isCorrect: false },
            { id: 'opt_d', text: 'Getting perfect scores', isCorrect: false }
          ],
          correctAnswer: '0',
          explanation: "Understanding fundamental concepts allows for deeper learning and application in various contexts.",
          difficulty: 'easy',
          difficultyScore: 2.5,
          metadata: { ultimateFallback: true }
        }
      ],
      metadata: {
        ultimateFallback: true,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

// =========================================================
// HEALTH CHECK ENDPOINT
// =========================================================

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'quiz-generation-api',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: {
      intelligentGeneration: true,
      topicEnhancement: true,
      adaptiveQuiz: true,
      emergencyFallback: true,
      recommendations: true
    },
    configuration: {
      backendUrl: BACKEND_URL,
      useExternalAPIs: USE_EXTERNAL_APIS
    }
  });
}
