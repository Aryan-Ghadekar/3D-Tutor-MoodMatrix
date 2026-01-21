import fs from 'fs';
import path from 'path';

const OPENROUTER_API_KEY = "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";

// Path to mock_lecture_plan.json
const LECTURE_PLAN_PATH = path.join(process.cwd(), 'frontend', 'src', 'app', 'lib', 'mock_lecture_plan.json');

export async function generateAssessmentQuestions(sessionId, studentGoal = null) {
  try {
    console.log(`Generating CONTENT-BASED diagnostic MCQs for session: ${sessionId}`);
    
    // 1. Read ACTUAL content from mock_lecture_plan.json
    const lecturePlans = readLecturePlansFromFile();
    if (!lecturePlans || lecturePlans.length === 0) {
      throw new Error('No lecture plans found in mock_lecture_plan.json');
    }
    
    // 2. Find the specific lecture plan
    let targetPlan = null;
    if (sessionId) {
      targetPlan = lecturePlans.find(plan => plan.sessionId === sessionId);
    }
    
    // Use latest if not found
    if (!targetPlan && lecturePlans.length > 0) {
      targetPlan = lecturePlans[0];
      console.log(`Using latest lecture plan: "${targetPlan.topic}"`);
    }
    
    if (!targetPlan) {
      throw new Error('Could not find lecture plan');
    }
    
    console.log(`Lecture: "${targetPlan.topic}" with ${targetPlan.impTopics?.length || 0} topics`);
    
    // 3. Extract ALL content from the lecture plan
    const lectureContent = extractCompleteLectureContent(targetPlan);
    
    // 4. Generate diagnostic MCQs using actual content
    const diagnosticQuestions = await generateDiagnosticMCQs(lectureContent, studentGoal);
    
    // 5. Ensure we have 10-12 quality questions
    const finalQuestions = ensureQuestionCount(diagnosticQuestions, lectureContent, 10);
    
    console.log(`Generated ${finalQuestions.length} diagnostic MCQs from ACTUAL lecture content`);
    
    return {
      success: true,
      diagnosticSession: true,
      questions: finalQuestions,
      metadata: {
        sessionId: targetPlan.sessionId,
        lectureId: targetPlan.lectureId,
        lectureTopic: targetPlan.topic,
        topicsCovered: targetPlan.impTopics?.map(t => t.title) || [],
        totalQuestions: finalQuestions.length,
        estimatedTime: finalQuestions.reduce((sum, q) => sum + (q.timeEstimate || 90), 0),
        generatedAt: new Date().toISOString(),
        studentGoal: studentGoal,
        contentBased: true,
        diagnosticFocus: 'knowledge_state_assessment'
      }
    };
    
  } catch (error) {
    console.error("Diagnostic MCQ generation error:", error.message);
    
    // Fallback
    const fallbackQuestions = generateContentBasedFallbackQuestions(sessionId, 10);
    return {
      success: false,
      diagnosticSession: true,
      error: error.message,
      questions: fallbackQuestions,
      metadata: {
        sessionId: sessionId,
        totalQuestions: fallbackQuestions.length,
        isFallback: true,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

// =============================
// FILE READING FUNCTIONS
// =============================

function readLecturePlansFromFile() {
  try {
    if (!fs.existsSync(LECTURE_PLAN_PATH)) {
      console.warn(`File not found: ${LECTURE_PLAN_PATH}`);
      return null;
    }
    
    const fileContent = fs.readFileSync(LECTURE_PLAN_PATH, 'utf-8');
    const lecturePlans = JSON.parse(fileContent);
    
    if (!Array.isArray(lecturePlans)) {
      console.warn('Lecture plan file does not contain an array');
      return null;
    }
    
    console.log(`Loaded ${lecturePlans.length} lecture plans`);
    return lecturePlans;
  } catch (error) {
    console.error('Error reading lecture plan file:', error.message);
    return null;
  }
}

// =============================
// CONTENT EXTRACTION
// =============================

function extractCompleteLectureContent(lecturePlan) {
  const topics = lecturePlan.impTopics || [];
  
  // Extract detailed content from each topic
  const detailedTopics = topics.map((topic, index) => {
    const content = topic.description || topic.full_text || '';
    
    return {
      id: topic.id || `topic-${index + 1}`,
      title: topic.title || `Topic ${index + 1}`,
      description: content,
      importance: topic.importance || 'medium',
      weightage: topic.weightage || 50,
      difficulty: topic.difficulty || 'medium',
      
      // Extract specific content elements
      keyTerms: extractKeyTerms(content, topic.title),
      definitions: extractDefinitions(content),
      examples: extractExamples(content),
      processes: extractProcesses(content),
      comparisons: extractComparisons(content),
      
      // From lecture plan
      keyInsights: topic.key_insights || topic.keyInsights || [],
      misconceptions: topic.common_misconceptions || topic.commonMisconceptions || [],
      applications: topic.real_world_applications || topic.realWorldApplications || [],
      
      // Metadata
      educationalValue: topic.educational_value || topic.educationalValue || {}
    };
  });
  
  // Extract overall lecture concepts
  const allKeyTerms = new Set();
  const allDefinitions = [];
  const allExamples = [];
  const allProcesses = [];
  const allComparisons = [];
  const allMisconceptions = [];
  
  detailedTopics.forEach(topic => {
    topic.keyTerms.forEach(term => allKeyTerms.add(term));
    topic.definitions.forEach(def => allDefinitions.push({ topic: topic.title, definition: def }));
    topic.examples.forEach(ex => allExamples.push({ topic: topic.title, example: ex }));
    topic.processes.forEach(proc => allProcesses.push({ topic: topic.title, process: proc }));
    topic.comparisons.forEach(comp => allComparisons.push({ topic: topic.title, comparison: comp }));
    topic.misconceptions.forEach(mis => allMisconceptions.push(mis));
  });
  
  return {
    lectureTitle: lecturePlan.topic || 'Lecture Content',
    lectureId: lecturePlan.lectureId,
    sessionId: lecturePlan.sessionId,
    date: lecturePlan.date || new Date().toISOString().split('T')[0],
    instructor: lecturePlan.instructor || 'AI Assistant',
    topics: detailedTopics,
    totalTopics: detailedTopics.length,
    
    // Extracted content collections
    keyTerms: Array.from(allKeyTerms).slice(0, 50),
    definitions: allDefinitions,
    examples: allExamples,
    processes: allProcesses,
    comparisons: allComparisons,
    misconceptions: allMisconceptions,
    
    metadata: lecturePlan.metadata || {}
  };
}

function extractKeyTerms(content, title) {
  if (!content) return [];
  
  const terms = new Set();
  
  // Add title words
  const titleWords = title.split(/[\s,.-]+/)
    .filter(word => word.length > 3 && /^[A-Za-z]/.test(word));
  titleWords.forEach(word => terms.add(word.toLowerCase()));
  
  // Extract capitalized terms (likely proper nouns/important terms)
  const capitalizedTerms = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  capitalizedTerms.forEach(term => {
    if (term.split(' ').length <= 3) {
      terms.add(term.toLowerCase());
    }
  });
  
  // Extract terms in quotes or emphasis
  const quotedTerms = content.match(/"([^"]+)"/g) || [];
  quotedTerms.forEach(term => {
    terms.add(term.replace(/"/g, '').toLowerCase());
  });
  
  return Array.from(terms).slice(0, 15);
}

function extractDefinitions(content) {
  if (!content) return [];
  
  const definitions = [];
  
  // Pattern: [Term] is/are/means/refers to [definition]
  const definitionPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|are|means|refers to|defined as)\s+([^.!?]+[.!?])/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+(?:which|that)\s+(?:is|are|means)[^.!?]+[.!?]/gi,
    /called\s+"?([^".,!?]+)"?[^.!?]*[.!?]/gi
  ];
  
  definitionPatterns.forEach(pattern => {
    const matches = [...content.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1] && match[2]) {
        definitions.push({
          term: match[1].trim(),
          definition: match[2].trim()
        });
      }
    });
  });
  
  return definitions.slice(0, 10);
}

function extractExamples(content) {
  if (!content) return [];
  
  const examples = [];
  const exampleMarkers = ['for example', 'e.g.', 'such as', 'including', 'like', 'for instance'];
  
  exampleMarkers.forEach(marker => {
    const regex = new RegExp(`${marker}[^.!?]*[.!?]`, 'gi');
    const matches = [...content.matchAll(regex)];
    matches.forEach(match => {
      if (match[0]) {
        examples.push(match[0].trim());
      }
    });
  });
  
  return examples.slice(0, 10);
}

function extractProcesses(content) {
  if (!content) return [];
  
  const processes = [];
  
  // Look for numbered steps
  const numberedSteps = content.match(/\d+\.\s+[^.!?]+[.!?]/gi) || [];
  numberedSteps.forEach(step => processes.push(step.trim()));
  
  // Look for sequence markers
  const sequenceMarkers = ['first', 'second', 'third', 'then', 'next', 'finally', 'after', 'before'];
  sequenceMarkers.forEach(marker => {
    const regex = new RegExp(`${marker}[^.!?]*[.!?]`, 'gi');
    const matches = [...content.matchAll(regex)];
    matches.forEach(match => {
      if (match[0]) {
        processes.push(match[0].trim());
      }
    });
  });
  
  return processes.slice(0, 10);
}

function extractComparisons(content) {
  if (!content) return [];
  
  const comparisons = [];
  const comparisonMarkers = ['compared to', 'versus', 'vs.', 'different from', 'similar to', 'unlike', 'like'];
  
  comparisonMarkers.forEach(marker => {
    const regex = new RegExp(`${marker}[^.!?]*[.!?]`, 'gi');
    const matches = [...content.matchAll(regex)];
    matches.forEach(match => {
      if (match[0]) {
        comparisons.push(match[0].trim());
      }
    });
  });
  
  return comparisons.slice(0, 10);
}

// =============================
// DIAGNOSTIC MCQ GENERATION
// =============================

async function generateDiagnosticMCQs(lectureContent, studentGoal) {
  try {
    // First, generate questions using the API for better quality
    const apiQuestions = await generateMCQsWithAPI(lectureContent, studentGoal);
    
    // Then, supplement with content-based questions
    const contentQuestions = generateContentBasedMCQs(lectureContent);
    
    // Combine both, prioritizing API questions
    const allQuestions = [...apiQuestions, ...contentQuestions].slice(0, 15);
    
    // Ensure variety in question types
    const finalQuestions = diversifyQuestions(allQuestions);
    
    return finalQuestions;
  } catch (error) {
    console.error('API generation failed, using content-based only:', error.message);
    return generateContentBasedMCQs(lectureContent);
  }
}

async function generateMCQsWithAPI(lectureContent, studentGoal) {
  const { lectureTitle, topics, definitions, examples, misconceptions } = lectureContent;
  
  // Build detailed content for the prompt
  const topicsText = topics.map(topic => `
Topic: ${topic.title}
Description: ${topic.description.substring(0, 200)}...
Key Terms: ${topic.keyTerms.slice(0, 5).join(', ')}
Key Insights: ${topic.keyInsights.slice(0, 2).join('; ')}
`).join('\n');

  const prompt = `Create 12 diagnostic MCQs to assess a student's knowledge state after studying this lecture.

LECTURE: ${lectureTitle}
TOTAL TOPICS: ${topics.length}

TOPIC DETAILS:
${topicsText}

KEY DEFINITIONS:
${definitions.slice(0, 5).map(d => `• ${d.term}: ${d.definition}`).join('\n')}

COMMON MISCONCEPTIONS:
${misconceptions.slice(0, 5).map((m, i) => `• ${i+1}. ${m}`).join('\n')}

STUDENT GOAL: ${studentGoal || 'General understanding assessment'}

REQUIREMENTS:
1. Create 12 MCQs that test understanding of the ACTUAL CONTENT above
2. Each question must reference specific content from the lecture
3. Include different types:
   - 4 Definition/Concept questions
   - 3 Application/Scenario questions
   - 3 Comparison/Analysis questions
   - 2 Misconception identification questions

4. For EACH MCQ:
   - Question must be specific and content-based
   - Provide 4 plausible options (A, B, C, D)
   - Exactly ONE correct answer
   - Wrong answers should be common mistakes based on the content
   - Include detailed explanation referencing lecture content
   - Mention which topic the question tests

FORMAT EACH QUESTION AS:
{
  "question": "Specific question about lecture content",
  "options": [
    "Option A text",
    "Option B text", 
    "Option C text",
    "Option D text"
  ],
  "correctAnswer": "A/B/C/D",
  "explanation": "Detailed explanation why this is correct",
  "topicTested": "Which topic this tests",
  "difficulty": "Easy/Medium/Hard",
  "questionType": "definition/application/comparison/misconception"
}

Return JSON array of 12 question objects.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000"
      },
      body: JSON.stringify({
        model: "openai/gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert educational diagnostician creating MCQs based on specific lecture content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse and process API questions
    return parseAPIQuestions(content, lectureContent);
    
  } catch (error) {
    console.error('API MCQ generation error:', error);
    return [];
  }
}

function parseAPIQuestions(content, lectureContent) {
  try {
    let cleanContent = content;
    
    // Extract JSON
    if (cleanContent.includes('```json')) {
      const match = cleanContent.match(/```json\n([\s\S]*?)\n```/);
      if (match) cleanContent = match[1];
    } else if (cleanContent.includes('```')) {
      const match = cleanContent.match(/```\n([\s\S]*?)\n```/);
      if (match) cleanContent = match[1];
    }
    
    // Find JSON array
    const jsonMatch = cleanContent.match(/\[\s*\{[\s\S]*\}\s*\]/) || cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON array found in API response');
      return [];
    }
    
    cleanContent = jsonMatch[0];
    const parsed = JSON.parse(cleanContent);
    
    const questions = Array.isArray(parsed) ? parsed : 
                     parsed.questions ? parsed.questions : 
                     parsed.diagnostic_assessment?.questions || [];
    
    // Process questions
    return questions
      .filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 4)
      .map((q, index) => processAPIQuestion(q, index, lectureContent))
      .filter(q => q !== null)
      .slice(0, 12);
    
  } catch (error) {
    console.error('Error parsing API questions:', error);
    return [];
  }
}

function processAPIQuestion(rawQuestion, index, lectureContent) {
  try {
    const questionText = rawQuestion.question;
    const options = rawQuestion.options || [];
    const correctAnswer = rawQuestion.correctAnswer || 'A';
    const explanation = rawQuestion.explanation || '';
    const topicTested = rawQuestion.topicTested || findRelevantTopic(questionText, lectureContent);
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(rawQuestion.difficulty) ? 
                      rawQuestion.difficulty : 'Medium';
    const questionType = rawQuestion.questionType || 'conceptual';
    
    // Validate correct answer
    const correctIndex = correctAnswer.toUpperCase().charCodeAt(0) - 65;
    if (correctIndex < 0 || correctIndex >= options.length) {
      console.warn(`Invalid correct answer "${correctAnswer}" for question ${index}`);
      return null;
    }
    
    // Format options
    const formattedOptions = options.slice(0, 4).map((opt, idx) => ({
      id: String.fromCharCode(65 + idx),
      text: typeof opt === 'string' ? opt : (opt.text || opt.label || `Option ${String.fromCharCode(65 + idx)}`),
      isCorrect: idx === correctIndex
    }));
    
    // Ensure exactly one correct answer
    const correctCount = formattedOptions.filter(opt => opt.isCorrect).length;
    if (correctCount !== 1) {
      formattedOptions.forEach((opt, idx) => {
        opt.isCorrect = idx === 0;
      });
    }
    
    // Extract concepts from question
    const conceptsTested = extractConceptsFromQuestion(questionText, lectureContent);
    
    return {
      id: `api-mcq-${index + 1}`,
      question: questionText,
      questionType: questionType,
      options: formattedOptions,
      correctAnswer: String.fromCharCode(65 + formattedOptions.findIndex(opt => opt.isCorrect)),
      detailedExplanation: explanation,
      difficulty: difficulty,
      timeEstimate: difficulty === 'Hard' ? 90 : difficulty === 'Medium' ? 75 : 60,
      conceptsTested: conceptsTested.length > 0 ? conceptsTested : [topicTested],
      sourceTopic: topicTested,
      diagnosticFocus: questionType,
      metadata: {
        isDiagnostic: true,
        source: 'api',
        confidence: 0.85
      }
    };
    
  } catch (error) {
    console.error(`Error processing API question ${index}:`, error);
    return null;
  }
}

function generateContentBasedMCQs(lectureContent) {
  const questions = [];
  const { topics, definitions, examples, misconceptions, comparisons } = lectureContent;
  
  // 1. Definition Questions (4 questions)
  definitions.slice(0, 4).forEach((def, index) => {
    const question = createDefinitionMCQ(def, index);
    if (question) questions.push(question);
  });
  
  // 2. Topic Concept Questions (4 questions)
  topics.slice(0, 4).forEach((topic, index) => {
    const question = createTopicConceptMCQ(topic, index + questions.length);
    if (question) questions.push(question);
  });
  
  // 3. Application Questions (3 questions)
  examples.slice(0, 3).forEach((example, index) => {
    const question = createApplicationMCQ(example, index + questions.length);
    if (question) questions.push(question);
  });
  
  // 4. Misconception Questions (3 questions)
  misconceptions.slice(0, 3).forEach((misconception, index) => {
    const question = createMisconceptionMCQ(misconception, index + questions.length);
    if (question) questions.push(question);
  });
  
  // 5. Comparison Questions (2 questions)
  comparisons.slice(0, 2).forEach((comparison, index) => {
    const question = createComparisonMCQ(comparison, index + questions.length);
    if (question) questions.push(question);
  });
  
  return questions.slice(0, 15);
}

function createDefinitionMCQ(definitionObj, index) {
  const { term, definition, topic } = definitionObj;
  
  // Create plausible wrong answers
  const wrongAnswers = [
    `A similar but different term`,
    `The opposite meaning of ${term}`,
    `An incomplete part of the definition`,
    `A completely unrelated concept`
  ];
  
  // Shuffle and select 3 wrong answers
  const selectedWrongAnswers = shuffleArray(wrongAnswers).slice(0, 3);
  
  return {
    id: `def-mcq-${index + 1}`,
    question: `What is the correct definition of "${term}" according to the lecture?`,
    questionType: 'definition',
    options: [
      { id: 'A', text: definition.substring(0, 120), isCorrect: true },
      { id: 'B', text: selectedWrongAnswers[0], isCorrect: false },
      { id: 'C', text: selectedWrongAnswers[1], isCorrect: false },
      { id: 'D', text: selectedWrongAnswers[2], isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `The lecture specifically defines "${term}" as: ${definition}`,
    difficulty: 'Easy',
    timeEstimate: 60,
    conceptsTested: [term],
    sourceTopic: topic || 'Definitions',
    diagnosticFocus: 'definition_understanding',
    metadata: {
      isDiagnostic: true,
      source: 'content',
      confidence: 0.9
    }
  };
}

function createTopicConceptMCQ(topic, index) {
  const { title, description, keyTerms } = topic;
  
  // Extract main concept
  const mainConcept = title.split(/[^a-zA-Z]/)[0] || keyTerms[0] || 'the concept';
  
  // Create content-based options
  const options = [
    { 
      id: 'A', 
      text: description.split('.')[0].substring(0, 100) || `Key concept about ${title}`, 
      isCorrect: true 
    },
    { id: 'B', text: `Minor detail or example from ${title}`, isCorrect: false },
    { id: 'C', text: `Related concept but different from ${title}`, isCorrect: false },
    { id: 'D', text: `Misunderstanding of ${mainConcept}`, isCorrect: false }
  ];
  
  return {
    id: `topic-mcq-${index + 1}`,
    question: `What is the MAIN concept or key point about "${title}" as explained in the lecture?`,
    questionType: 'concept',
    options: shuffleArray(options),
    correctAnswer: options.find(opt => opt.isCorrect).id,
    detailedExplanation: `The lecture presents "${title}" with this main concept: ${description.split('.')[0]}`,
    difficulty: 'Medium',
    timeEstimate: 75,
    conceptsTested: [title, ...keyTerms.slice(0, 2)],
    sourceTopic: title,
    diagnosticFocus: 'concept_understanding',
    metadata: {
      isDiagnostic: true,
      source: 'content',
      confidence: 0.8
    }
  };
}

function createApplicationMCQ(exampleObj, index) {
  const { example, topic } = exampleObj;
  
  // Extract scenario from example
  const scenario = example.toLowerCase().includes('for example') ? 
                  example.replace(/for example\s*/i, '') :
                  example;
  
  return {
    id: `app-mcq-${index + 1}`,
    question: `Based on the lecture example: "${scenario.substring(0, 80)}...", what is being demonstrated?`,
    questionType: 'application',
    options: [
      { id: 'A', text: `Correct application of ${topic} concept`, isCorrect: true },
      { id: 'B', text: `Incorrect application that contradicts lecture`, isCorrect: false },
      { id: 'C', text: `Unrelated example not from the lecture`, isCorrect: false },
      { id: 'D', text: `Advanced application beyond lecture scope`, isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `This example demonstrates how to apply ${topic} concepts in practice: ${example}`,
    difficulty: 'Medium',
    timeEstimate: 80,
    conceptsTested: [topic],
    sourceTopic: topic,
    diagnosticFocus: 'application_understanding',
    metadata: {
      isDiagnostic: true,
      source: 'content',
      confidence: 0.85
    }
  };
}

function createMisconceptionMCQ(misconception, index) {
  // Extract concept from misconception
  const conceptMatch = misconception.match(/about\s+([^.,!?]+)/i) || 
                      misconception.match(/of\s+([^.,!?]+)/i) ||
                      misconception.match(/regarding\s+([^.,!?]+)/i);
  const concept = conceptMatch ? conceptMatch[1].trim() : 'the concept';
  
  return {
    id: `miscon-mcq-${index + 1}`,
    question: `Which of the following is a COMMON MISCONCEPTION about "${concept}" mentioned in the lecture?`,
    questionType: 'misconception',
    options: [
      { id: 'A', text: misconception.substring(0, 100), isCorrect: true },
      { id: 'B', text: `The correct understanding of ${concept}`, isCorrect: false },
      { id: 'C', text: `Advanced topic related to ${concept}`, isCorrect: false },
      { id: 'D', text: `Completely unrelated idea`, isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `The lecture specifically mentions that "${misconception.substring(0, 80)}..." is a common misconception that students should avoid.`,
    difficulty: 'Medium',
    timeEstimate: 70,
    conceptsTested: [concept],
    sourceTopic: concept,
    diagnosticFocus: 'misconception_identification',
    metadata: {
      isDiagnostic: true,
      source: 'content',
      confidence: 0.9
    }
  };
}

function createComparisonMCQ(comparisonObj, index) {
  const { comparison, topic } = comparisonObj;
  
  // Extract compared items
  const comparedItems = comparison.match(/compared to|versus|vs\.|different from|similar to|like\s+([^.,!?]+)/i);
  
  return {
    id: `comp-mcq-${index + 1}`,
    question: `According to the lecture, how does "${topic}" compare to other concepts?`,
    questionType: 'comparison',
    options: [
      { id: 'A', text: comparison.substring(0, 100), isCorrect: true },
      { id: 'B', text: `The opposite comparison`, isCorrect: false },
      { id: 'C', text: `No comparison was made in lecture`, isCorrect: false },
      { id: 'D', text: `Different comparison not mentioned`, isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `The lecture makes this specific comparison: ${comparison}`,
    difficulty: 'Hard',
    timeEstimate: 85,
    conceptsTested: [topic],
    sourceTopic: topic,
    diagnosticFocus: 'comparison_analysis',
    metadata: {
      isDiagnostic: true,
      source: 'content',
      confidence: 0.8
    }
  };
}

// =============================
// HELPER FUNCTIONS
// =============================

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function findRelevantTopic(questionText, lectureContent) {
  const { topics } = lectureContent;
  
  const questionLower = questionText.toLowerCase();
  
  for (const topic of topics) {
    const titleLower = topic.title.toLowerCase();
    const keyTerms = topic.keyTerms.map(term => term.toLowerCase());
    
    // Check if question contains topic title or key terms
    if (questionLower.includes(titleLower) || 
        keyTerms.some(term => questionLower.includes(term))) {
      return topic.title;
    }
  }
  
  return topics[0]?.title || 'General';
}

function extractConceptsFromQuestion(questionText, lectureContent) {
  const concepts = [];
  const questionLower = questionText.toLowerCase();
  
  lectureContent.keyTerms.forEach(term => {
    if (questionLower.includes(term.toLowerCase())) {
      concepts.push(term);
    }
  });
  
  return concepts.slice(0, 3);
}

function diversifyQuestions(questions) {
  const questionTypes = ['definition', 'concept', 'application', 'misconception', 'comparison'];
  const typeCounts = {};
  
  // Count existing types
  questions.forEach(q => {
    const type = q.questionType || 'concept';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  // Ensure at least 2 of each type for 10+ questions
  const finalQuestions = [...questions];
  const neededTypes = questionTypes.filter(type => (typeCounts[type] || 0) < 2);
  
  return finalQuestions.slice(0, 12); // Return up to 12 questions
}

function ensureQuestionCount(questions, lectureContent, minCount = 10) {
  if (questions.length >= minCount) {
    return questions.slice(0, Math.min(questions.length, 12));
  }
  
  // Generate additional questions
  const additionalNeeded = minCount - questions.length;
  const additionalQuestions = generateAdditionalMCQs(lectureContent, additionalNeeded);
  
  return [...questions, ...additionalQuestions].slice(0, 12);
}

function generateAdditionalMCQs(lectureContent, count) {
  const questions = [];
  const { topics } = lectureContent;
  
  for (let i = 0; i < Math.min(count, topics.length * 2); i++) {
    const topic = topics[i % topics.length];
    const questionTypes = ['definition', 'concept', 'application'];
    const qType = questionTypes[i % questionTypes.length];
    
    let question;
    switch (qType) {
      case 'definition':
        const term = topic.keyTerms[0] || topic.title.split(' ')[0];
        question = createSimpleDefinitionMCQ(term, topic.description, i);
        break;
      case 'concept':
        question = createSimpleConceptMCQ(topic, i);
        break;
      case 'application':
        question = createSimpleApplicationMCQ(topic, i);
        break;
    }
    
    if (question) questions.push(question);
  }
  
  return questions;
}

function createSimpleDefinitionMCQ(term, description, index) {
  return {
    id: `simple-def-${index + 1}`,
    question: `What does "${term}" mean in the context of this lecture?`,
    questionType: 'definition',
    options: [
      { id: 'A', text: description.split('.')[0].substring(0, 80), isCorrect: true },
      { id: 'B', text: 'Different meaning from another context', isCorrect: false },
      { id: 'C', text: 'Opposite meaning', isCorrect: false },
      { id: 'D', text: 'Unrelated definition', isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `The lecture defines "${term}" in this specific context.`,
    difficulty: 'Easy',
    timeEstimate: 60,
    conceptsTested: [term],
    sourceTopic: 'Definitions',
    metadata: { isDiagnostic: true, source: 'supplemental' }
  };
}

function createSimpleConceptMCQ(topic, index) {
  return {
    id: `simple-concept-${index + 1}`,
    question: `What is the key learning about "${topic.title}"?`,
    questionType: 'concept',
    options: [
      { id: 'A', text: topic.description.substring(0, 80), isCorrect: true },
      { id: 'B', text: 'Minor detail only', isCorrect: false },
      { id: 'C', text: 'Prerequisite information', isCorrect: false },
      { id: 'D', text: 'Advanced topic not covered', isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `This is the main concept taught about ${topic.title}.`,
    difficulty: 'Medium',
    timeEstimate: 70,
    conceptsTested: [topic.title],
    sourceTopic: topic.title,
    metadata: { isDiagnostic: true, source: 'supplemental' }
  };
}

function createSimpleApplicationMCQ(topic, index) {
  return {
    id: `simple-app-${index + 1}`,
    question: `How would you use what you learned about "${topic.title}"?`,
    questionType: 'application',
    options: [
      { id: 'A', text: 'Apply as explained in lecture examples', isCorrect: true },
      { id: 'B', text: 'Use in completely different context', isCorrect: false },
      { id: 'C', text: 'Ignore and use intuition instead', isCorrect: false },
      { id: 'D', text: 'Apply opposite of what was taught', isCorrect: false }
    ],
    correctAnswer: 'A',
    detailedExplanation: `Apply ${topic.title} concepts as demonstrated in the lecture.`,
    difficulty: 'Medium',
    timeEstimate: 75,
    conceptsTested: [topic.title],
    sourceTopic: topic.title,
    metadata: { isDiagnostic: true, source: 'supplemental' }
  };
}

function generateContentBasedFallbackQuestions(sessionId, count) {
  try {
    const lecturePlans = readLecturePlansFromFile();
    if (!lecturePlans || lecturePlans.length === 0) {
      return [];
    }
    
    const plan = lecturePlans[0];
    const topics = plan.impTopics || [];
    
    const questions = [];
    for (let i = 0; i < Math.min(count, topics.length * 2); i++) {
      const topic = topics[i % topics.length];
      
      questions.push({
        id: `fb-mcq-${i + 1}`,
        question: `What did the lecture teach about "${topic.title}"?`,
        questionType: 'concept',
        options: [
          { id: 'A', text: topic.description?.substring(0, 80) || 'Key concept', isCorrect: true },
          { id: 'B', text: 'Incorrect interpretation', isCorrect: false },
          { id: 'C', text: 'Unrelated concept', isCorrect: false },
          { id: 'D', text: 'Opposite meaning', isCorrect: false }
        ],
        correctAnswer: 'A',
        detailedExplanation: `The lecture covered: ${topic.description?.substring(0, 120) || 'This topic'}`,
        difficulty: 'Medium',
        timeEstimate: 60,
        conceptsTested: [topic.title],
        sourceTopic: topic.title,
        metadata: { isDiagnostic: true, isFallback: true }
      });
    }
    
    return questions.slice(0, count);
  } catch (error) {
    console.error('Fallback generation error:', error);
    return [];
  }
}

// =============================
// ANALYSIS FUNCTIONS
// =============================

export function analyzeTestResults(answers, questions, studentGoal = null) {
  const analysis = {
    isDiagnostic: true,
    score: 0,
    totalQuestions: questions.length,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedQuestions: 0,
    scorePercentage: 0,
    
    // Diagnostic metrics
    questionTypePerformance: {},
    topicPerformance: {},
    conceptMastery: {},
    
    // Knowledge state analysis
    knowledgeState: {
      conceptualUnderstanding: 0,
      applicationAbility: 0,
      misconceptionRecognition: 0,
      comparativeAnalysis: 0,
      overallMastery: 0
    },
    
    // Detailed insights
    strengths: [],
    weaknesses: [],
    misconceptionsIdentified: [],
    learningGaps: [],
    
    // Recommendations
    recommendations: {
      immediateReview: [],
      practiceFocus: [],
      studyStrategy: '',
      nextSteps: []
    },
    
    performanceLevel: '',
    analyzedAt: new Date().toISOString(),
    studentGoal: studentGoal
  };
  
  // Initialize performance tracking
  questions.forEach(question => {
    const qType = question.questionType || 'concept';
    if (!analysis.questionTypePerformance[qType]) {
      analysis.questionTypePerformance[qType] = { correct: 0, total: 0, accuracy: 0 };
    }
    
    const topic = question.sourceTopic || 'General';
    if (!analysis.topicPerformance[topic]) {
      analysis.topicPerformance[topic] = { correct: 0, total: 0, accuracy: 0 };
    }
    
    question.conceptsTested?.forEach(concept => {
      if (!analysis.conceptMastery[concept]) {
        analysis.conceptMastery[concept] = { correct: 0, total: 0, mastery: 0 };
      }
    });
  });
  
  // Process answers
  questions.forEach((question, index) => {
    const answer = answers[index];
    const qType = question.questionType || 'concept';
    const topic = question.sourceTopic || 'General';
    
    // Update totals
    analysis.questionTypePerformance[qType].total++;
    analysis.topicPerformance[topic].total++;
    question.conceptsTested?.forEach(concept => {
      analysis.conceptMastery[concept].total++;
    });
    
    // Check if answered
    if (!answer || !answer.selectedOption) {
      analysis.skippedQuestions++;
      return;
    }
    
    // Check correctness
    const isCorrect = question.correctAnswer === answer.selectedOption;
    
    if (isCorrect) {
      analysis.correctAnswers++;
      analysis.score++;
      
      analysis.questionTypePerformance[qType].correct++;
      analysis.topicPerformance[topic].correct++;
      question.conceptsTested?.forEach(concept => {
        analysis.conceptMastery[concept].correct++;
      });
      
    } else {
      analysis.incorrectAnswers++;
      
      // Record misconceptions for misconception questions
      if (qType === 'misconception') {
        analysis.misconceptionsIdentified.push({
          concept: question.conceptsTested?.[0] || topic,
          question: question.question.substring(0, 100)
        });
      }
      
      // Record learning gaps
      analysis.learningGaps.push({
        topic: topic,
        questionType: qType,
        concept: question.conceptsTested?.[0] || 'Unknown'
      });
    }
  });
  
  // Calculate percentages
  analysis.scorePercentage = (analysis.correctAnswers / analysis.totalQuestions) * 100;
  
  // Calculate performance metrics
  Object.keys(analysis.questionTypePerformance).forEach(type => {
    const data = analysis.questionTypePerformance[type];
    data.accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
  });
  
  Object.keys(analysis.topicPerformance).forEach(topic => {
    const data = analysis.topicPerformance[topic];
    data.accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
  });
  
  Object.keys(analysis.conceptMastery).forEach(concept => {
    const data = analysis.conceptMastery[concept];
    data.mastery = data.total > 0 ? (data.correct / data.total) * 100 : 0;
  });
  
  // Calculate knowledge state
  const typeAccuracies = analysis.questionTypePerformance;
  analysis.knowledgeState.conceptualUnderstanding = 
    (typeAccuracies.definition?.accuracy || 0 + typeAccuracies.concept?.accuracy || 0) / 2;
  analysis.knowledgeState.applicationAbility = typeAccuracies.application?.accuracy || 0;
  analysis.knowledgeState.misconceptionRecognition = typeAccuracies.misconception?.accuracy || 0;
  analysis.knowledgeState.comparativeAnalysis = typeAccuracies.comparison?.accuracy || 0;
  analysis.knowledgeState.overallMastery = analysis.scorePercentage;
  
  // Identify strengths and weaknesses
  Object.entries(analysis.conceptMastery)
    .filter(([_, data]) => data.mastery >= 80)
    .forEach(([concept]) => analysis.strengths.push(concept));
  
  Object.entries(analysis.conceptMastery)
    .filter(([_, data]) => data.mastery < 60)
    .forEach(([concept]) => analysis.weaknesses.push(concept));
  
  // Generate recommendations
  generateKnowledgeStateRecommendations(analysis, studentGoal);
  
  // Determine performance level
  analysis.performanceLevel = calculateKnowledgeStateLevel(analysis.scorePercentage);
  
  return analysis;
}

function generateKnowledgeStateRecommendations(analysis, studentGoal) {
  const { knowledgeState, weaknesses, misconceptionsIdentified } = analysis;
  
  // Conceptual understanding issues
  if (knowledgeState.conceptualUnderstanding < 70) {
    analysis.recommendations.immediateReview.push({
      area: 'Conceptual Understanding',
      action: 'Review definitions and key concepts from the lecture',
      resources: 'Lecture notes, textbook chapters'
    });
  }
  
  // Application issues
  if (knowledgeState.applicationAbility < 70) {
    analysis.recommendations.practiceFocus.push({
      area: 'Application Skills',
      action: 'Practice with real-world scenarios and examples',
      strategy: 'Try applying concepts to different situations'
    });
  }
  
  // Misconception issues
  if (knowledgeState.misconceptionRecognition < 70 && misconceptionsIdentified.length > 0) {
    analysis.recommendations.immediateReview.push({
      area: 'Misconception Correction',
      action: 'Study why common misconceptions are wrong',
      focus: misconceptionsIdentified.slice(0, 3).map(m => m.concept)
    });
  }
  
  // Specific weak concepts
  weaknesses.slice(0, 3).forEach(concept => {
    analysis.recommendations.immediateReview.push({
      area: `Weak Concept: ${concept}`,
      action: `Re-study the section on "${concept}"`,
      priority: 'High'
    });
  });
  
  // Exam strategy
  if (studentGoal === "gate") {
    analysis.recommendations.studyStrategy = 
      "For GATE: Focus on conceptual clarity and time management. Practice previous year questions.";
  } else if (studentGoal === "jee") {
    analysis.recommendations.studyStrategy = 
      "For JEE: Master problem-solving approaches and speed. Practice diverse question types.";
  } else if (studentGoal === "neet") {
    analysis.recommendations.studyStrategy = 
      "For NEET: Emphasize diagram understanding and factual recall. Focus on NCERT content.";
  }
  
  // Next steps based on performance
  if (analysis.scorePercentage >= 80) {
    analysis.recommendations.nextSteps = [
      "Move to advanced topics",
      "Practice with time limits",
      "Teach concepts to others"
    ];
  } else if (analysis.scorePercentage >= 60) {
    analysis.recommendations.nextSteps = [
      "Review weak areas identified",
      "Take practice quizzes",
      "Create summary notes"
    ];
  } else {
    analysis.recommendations.nextSteps = [
      "Re-watch/re-read lecture material",
      "Focus on foundational concepts",
      "Take basic quizzes first"
    ];
  }
}

function calculateKnowledgeStateLevel(scorePercentage) {
  if (scorePercentage >= 90) return "Expert Mastery";
  if (scorePercentage >= 80) return "Strong Understanding";
  if (scorePercentage >= 70) return "Good Understanding";
  if (scorePercentage >= 60) return "Basic Understanding";
  if (scorePercentage >= 50) return "Developing Understanding";
  if (scorePercentage >= 40) return "Beginning Understanding";
  return "Needs Fundamental Review";
}

export default generateAssessmentQuestions;