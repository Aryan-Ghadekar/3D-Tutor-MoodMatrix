"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Brain, Check, HelpCircle, Timer, ArrowLeft, Home } from 'lucide-react';
import Header from '../../components/Header';

export default function KnowledgeTestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get parameters
  const lectureId = searchParams.get('lectureId');
  const sessionId = searchParams.get('sessionId');
  const topic = searchParams.get('topic') || "Computer Engineering";
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [lecturePlan, setLecturePlan] = useState(null);
  const [testQuestions, setTestQuestions] = useState([]);
  const [displayTopic, setDisplayTopic] = useState(topic);

  // Generate AI-powered questions based on lecture plan content
  const generateIntelligentQuestions = async (lecturePlan) => {
    if (!lecturePlan || !lecturePlan.impTopics) {
      return generateFallbackQuestions();
    }

    setGeneratingQuestions(true);
    try {
      // Call AI question generation API
      const response = await fetch('/api/generate-ai-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lecturePlan: lecturePlan,
          questionCount: 10,
          questionTypes: ['conceptual', 'application', 'misconception', 'definition', 'analysis', 'practical', 'evaluation']
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.questions) {
          return data.questions;
        }
      }
    } catch (error) {
      console.error('Error generating AI questions:', error);
    } finally {
      setGeneratingQuestions(false);
    }

    // Fallback to rule-based generation if AI fails
    return generateRuleBasedQuestions(lecturePlan);
  };

  // Fallback rule-based question generation
  const generateRuleBasedQuestions = (lecturePlan) => {
    const questions = [];
    const topics = lecturePlan.impTopics;
    let questionId = 1;

    // Generate different types of questions for each topic
    topics.forEach((content, index) => {
      if (questionId > 10) return; // Limit to 10 questions

      // Conceptual understanding question
      questions.push(generateConceptualQuestion(content, questionId++));
      if (questionId > 10) return;

      // Application question
      questions.push(generateApplicationQuestion(content, questionId++));
      if (questionId > 10) return;

      // Misconception question
      if (content.misconceptions && content.misconceptions.length > 0) {
        questions.push(generateMisconceptionQuestion(content, questionId++));
        if (questionId > 10) return;
      }

      // Mix other question types
      const questionTypes = ['definition', 'analysis', 'practical', 'evaluation'];
      const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
      
      switch (randomType) {
        case 'definition':
          questions.push(generateDefinitionQuestion(content, questionId++));
          break;
        case 'analysis':
          questions.push(generateAnalysisQuestion(content, questionId++));
          break;
        case 'practical':
          questions.push(generatePracticalQuestion(content, questionId++));
          break;
        case 'evaluation':
          questions.push(generateEvaluationQuestion(content, questionId++));
          break;
      }
    });

    // Shuffle and return first 10 questions
    return shuffleArray(questions).slice(0, 10);
  };
  const generateConceptualQuestion = (content, questionId) => {
    const correctAnswer = extractKeyConcept(content.fullText);
    const distractors = generateDistractors(correctAnswer, content, 'conceptual');
    
    return {
      id: questionId,
      type: 'conceptual',
      topicId: content.id,
      topicName: content.title,
      question: `What is the fundamental concept behind ${content.title}?`,
      options: shuffleArray([correctAnswer, ...distractors]).map((opt, idx) => ({
        id: String.fromCharCode(65 + idx), // A, B, C, D
        text: opt,
        isCorrect: opt === correctAnswer
      })),
      explanation: `The fundamental concept of ${content.title} is ${correctAnswer}.`,
      difficulty: content.importance === 'high' ? 'hard' : content.importance === 'medium' ? 'medium' : 'easy',
      weightage: content.weightage,
      assessedSkill: 'conceptual_understanding'
    };
  };

  const generateApplicationQuestion = (content, questionId) => {
    const application = content.applications && content.applications.length > 0 ? 
      content.applications[0] : extractApplication(content.fullText);
    const scenarios = generateApplicationScenarios(content.title, application);
    const correctIndex = Math.floor(Math.random() * 4);
    
    return {
      id: questionId,
      type: 'application',
      topicId: content.id,
      topicName: content.title,
      question: `Which scenario best demonstrates the practical application of ${content.title}?`,
      options: scenarios.map((scenario, idx) => ({
        id: String.fromCharCode(65 + idx),
        text: scenario,
        isCorrect: idx === correctIndex
      })),
      explanation: `This scenario correctly applies ${content.title} in a real-world context.`,
      difficulty: 'medium',
      weightage: content.weightage,
      assessedSkill: 'practical_application'
    };
  };

  const generateMisconceptionQuestion = (content, questionId) => {
    const misconception = content.misconceptions && content.misconceptions.length > 0 ? 
      content.misconceptions[0] : generateCommonMisconception(content.title);
    const correctConcept = extractKeyConcept(content.fullText);
    const distractors = generateMisconceptionDistractors(correctConcept, misconception);
    
    return {
      id: questionId,
      type: 'misconception',
      topicId: content.id,
      topicName: content.title,
      question: `Which of the following is a common misconception about ${content.title}?`,
      options: shuffleArray([misconception, ...distractors]).map((opt, idx) => ({
        id: String.fromCharCode(65 + idx),
        text: opt,
        isCorrect: opt === misconception
      })),
      explanation: `This is a common misunderstanding about ${content.title}. The correct understanding is: ${correctConcept}`,
      difficulty: 'hard',
      weightage: content.weightage,
      assessedSkill: 'misconception_identification'
    };
  };

  const generateDefinitionQuestion = (content, questionId) => {
    const definition = extractDefinition(content.fullText);
    const terms = generateDefinitionOptions(content.title, definition);
    
    return {
      id: questionId,
      type: 'definition',
      topicId: content.id,
      topicName: content.title,
      question: `Which statement best defines ${content.title}?`,
      options: terms.map((term, idx) => ({
        id: String.fromCharCode(65 + idx),
        text: term.text,
        isCorrect: term.isCorrect
      })),
      explanation: `The correct definition of ${content.title} encompasses its core principles and applications.`,
      difficulty: 'easy',
      weightage: content.weightage,
      assessedSkill: 'definitional_knowledge'
    };
  };

  const generateAnalysisQuestion = (content, questionId) => {
    const analysisScenario = generateAnalysisScenario(content);
    const options = generateAnalysisOptions(content, analysisScenario);
    
    return {
      id: questionId,
      type: 'analysis',
      topicId: content.id,
      topicName: content.title,
      question: `Analyze the following situation related to ${content.title}: ${analysisScenario.situation}`,
      options: options.map((opt, idx) => ({
        id: String.fromCharCode(65 + idx),
        text: opt.text,
        isCorrect: opt.isCorrect
      })),
      explanation: `This analysis correctly identifies the key factors and implications of ${content.title}.`,
      difficulty: 'hard',
      weightage: content.weightage,
      assessedSkill: 'analytical_thinking'
    };
  };

  const generatePracticalQuestion = (content, questionId) => {
    const practicalScenario = generatePracticalScenario(content);
    const solutions = generateSolutionOptions(content, practicalScenario);
    
    return {
      id: questionId,
      type: 'practical',
      topicId: content.id,
      topicName: content.title,
      question: `Given a practical scenario involving ${content.title}, which approach would be most effective?`,
      options: solutions.map((sol, idx) => ({
        id: String.fromCharCode(65 + idx),
        text: sol.text,
        isCorrect: sol.isCorrect
      })),
      explanation: `This solution effectively addresses the practical challenges of ${content.title}.`,
      difficulty: 'medium',
      weightage: content.weightage,
      assessedSkill: 'practical_reasoning'
    };
  };

  const generateEvaluationQuestion = (content, questionId) => {
    const evaluationScenario = generateEvaluationScenario(content);
    const criteria = generateEvaluationCriteria(content);
    
    return {
      id: questionId,
      type: 'evaluation',
      topicId: content.id,
      topicName: content.title,
      question: `Evaluate the effectiveness of different approaches to ${content.title}: ${evaluationScenario}`,
      options: criteria.map((criterion, idx) => ({
        id: String.fromCharCode(65 + idx),
        text: criterion.text,
        isCorrect: criterion.isCorrect
      })),
      explanation: `This evaluation criterion provides the most comprehensive assessment of ${content.title}.`,
      difficulty: 'hard',
      weightage: content.weightage,
      assessedSkill: 'evaluative_judgment'
    };
  };

  // Helper functions
  const extractKeyConcept = (fullText) => {
    if (!fullText) return "Core concept understanding";
    
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      return sentences[0].trim().substring(0, 100) + (sentences[0].length > 100 ? "..." : "");
    }
    return "Fundamental principles and core concepts";
  };

  const extractApplication = (fullText) => {
    if (!fullText) return "Practical application in real-world scenarios";
    
    const appKeywords = ['application', 'used for', 'applies to', 'practical', 'real-world', 'implemented'];
    const sentences = fullText.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (appKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        return sentence.trim();
      }
    }
    return "Practical implementation and usage";
  };

  const extractDefinition = (fullText) => {
    if (!fullText) return "Comprehensive understanding and application";
    
    const sentences = fullText.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('is') || sentence.toLowerCase().includes('refers to')) {
        return sentence.trim();
      }
    }
    return extractKeyConcept(fullText);
  };

  const generateDistractors = (correctAnswer, content, type) => {
    const distractors = [];
    
    if (type === 'conceptual') {
      distractors.push(
        `Related but incorrect concept about ${content.title}`,
        `Common misunderstanding of ${content.title}`,
        `Oversimplified explanation of ${content.title}`
      );
    }
    
    return distractors.slice(0, 3);
  };

  const generateApplicationScenarios = (title, application) => {
    const scenarios = [
      `Using ${title} to solve a real-world problem efficiently`,
      `Implementing ${title} in a practical business context`,
      `Applying ${title} principles to improve system performance`,
      `Utilizing ${title} for optimal resource management`
    ];
    
    return scenarios;
  };

  const generateCommonMisconception = (title) => {
    const misconceptions = [
      `${title} works the same way in all situations`,
      `${title} requires no prior knowledge or prerequisites`,
      `${title} can be mastered without practical experience`,
      `${title} is only theoretical and has no practical use`
    ];
    
    return misconceptions[Math.floor(Math.random() * misconceptions.length)];
  };

  const generateMisconceptionDistractors = (correctConcept, misconception) => {
    return [
      correctConcept,
      "Partially correct but incomplete understanding",
      "Related but different concept"
    ];
  };

  const generateDefinitionOptions = (title, definition) => {
    return [
      { text: definition, isCorrect: true },
      { text: `Incorrect definition of ${title}`, isCorrect: false },
      { text: `Partial definition missing key aspects`, isCorrect: false },
      { text: `Completely unrelated concept`, isCorrect: false }
    ];
  };

  const generateAnalysisScenario = (content) => {
    return {
      situation: `Given the implementation of ${content.title}, analyze the potential benefits and challenges.`,
      factors: ["Efficiency", "Scalability", "Maintainability", "Cost-effectiveness"]
    };
  };

  const generateAnalysisOptions = (content, scenario) => {
    return [
      { text: `The implementation provides significant benefits with manageable challenges`, isCorrect: true },
      { text: `The challenges outweigh any potential benefits`, isCorrect: false },
      { text: `There are no challenges in the implementation`, isCorrect: false },
      { text: `The benefits are minimal and not worth the effort`, isCorrect: false }
    ];
  };

  const generatePracticalScenario = (content) => {
    return {
      situation: `You need to implement ${content.title} in a real-world project with limited resources.`,
      context: "Consider the constraints and requirements of practical implementation."
    };
  };

  const generateSolutionOptions = (content, scenario) => {
    return [
      { text: `Use ${content.title} principles to optimize the implementation`, isCorrect: true },
      { text: `Ignore ${content.title} and use alternative methods`, isCorrect: false },
      { text: `Implement without considering resource constraints`, isCorrect: false },
      { text: `Delay implementation until more resources are available`, isCorrect: false }
    ];
  };

  const generateEvaluationScenario = (content) => {
    return `Evaluate different approaches to implementing ${content.title} based on effectiveness, efficiency, and practicality.`;
  };

  const generateEvaluationCriteria = (content) => {
    return [
      { text: `Comprehensive evaluation considering multiple factors and long-term impact`, isCorrect: true },
      { text: `Evaluation based only on immediate benefits`, isCorrect: false },
      { text: `Evaluation without considering practical constraints`, isCorrect: false },
      { text: `Minimal evaluation with insufficient criteria`, isCorrect: false }
    ];
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const generateFallbackQuestions = () => {
    return [
      {
        id: 1,
        type: 'conceptual',
        topicName: 'General Knowledge',
        question: "Which of the following statements is MOST accurate?",
        options: [
          { id: 'A', text: 'A process and a program are the same because both are stored in memory', isCorrect: false },
          { id: 'B', text: 'A program becomes a process only after it finishes execution', isCorrect: false },
          { id: 'C', text: 'Multiple processes can be created from the same program', isCorrect: true },
          { id: 'D', text: 'Processes cannot share memory under any circumstances', isCorrect: false }
        ],
        explanation: 'Multiple processes can be created from the same program, each with its own memory space.',
        difficulty: 'medium',
        assessedSkill: 'conceptual_understanding'
      }
    ];
  };

  // Event handlers
  const handleAnswer = (questionId, answerId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
    
    // Auto-advance after answering
    if (currentQuestion < testQuestions.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 500);
    }
  };

  const calculateScore = () => {
    if (!testQuestions.length) return 0;
    
    let correctAnswers = 0;
    let totalQuestions = 0;
    
    testQuestions.forEach(question => {
      const userAnswer = answers[question.id];
      if (userAnswer) {
        totalQuestions++;
        const selectedOption = question.options.find(opt => opt.id === userAnswer);
        if (selectedOption && selectedOption.isCorrect) {
          correctAnswers++;
        }
      }
    });
    
    return totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  };

  const analyzeStudentKnowledge = () => {
    const analysis = {
      strengths: [],
      weaknesses: [],
      misconceptions: [],
      skillLevels: {},
      topicPerformance: {},
      recommendations: [],
      detailedMisunderstandings: []
    };
    
    testQuestions.forEach(question => {
      const userAnswer = answers[question.id];
      if (!userAnswer) return;
      
      const selectedOption = question.options.find(opt => opt.id === userAnswer);
      const isCorrect = selectedOption && selectedOption.isCorrect;
      
      // Analyze by skill type
      const skill = question.assessedSkill;
      if (!analysis.skillLevels[skill]) {
        analysis.skillLevels[skill] = { correct: 0, total: 0 };
      }
      analysis.skillLevels[skill].total++;
      if (isCorrect) {
        analysis.skillLevels[skill].correct++;
      }
      
      // Analyze topic performance
      if (!analysis.topicPerformance[question.topicId]) {
        analysis.topicPerformance[question.topicId] = {
          topicName: question.topicName,
          correct: 0,
          total: 0,
          questions: []
        };
      }
      analysis.topicPerformance[question.topicId].total++;
      analysis.topicPerformance[question.topicId].questions.push({
        question: question.question,
        userAnswer: selectedOption?.text || 'No answer',
        correctAnswer: question.options.find(opt => opt.isCorrect)?.text,
        isCorrect,
        explanation: question.explanation,
        questionType: question.type,
        difficulty: question.difficulty
      });
      if (isCorrect) {
        analysis.topicPerformance[question.topicId].correct++;
      }
      
      // Identify strengths and weaknesses
      if (isCorrect) {
        if (!analysis.strengths.includes(skill)) {
          analysis.strengths.push(skill);
        }
      } else {
        if (!analysis.weaknesses.includes(skill)) {
          analysis.weaknesses.push(skill);
        }
        
        // Track detailed misunderstandings
        const misunderstanding = {
          topic: question.topicName,
          questionType: question.type,
          question: question.question,
          userAnswer: selectedOption?.text || 'No answer',
          correctAnswer: question.options.find(opt => opt.isCorrect)?.text,
          explanation: question.explanation,
          difficulty: question.difficulty,
          assessedSkill: skill,
          misconceptionType: identifyMisconceptionType(question, selectedOption?.text)
        };
        
        analysis.detailedMisunderstandings.push(misunderstanding);
        
        // Check for misconceptions
        if (question.type === 'misconception' && !isCorrect) {
          analysis.misconceptions.push({
            topic: question.topicName,
            misconception: question.explanation,
            userAnswer: selectedOption?.text,
            correctAnswer: question.options.find(opt => opt.isCorrect)?.text
          });
        }
      }
    });
    
    // Generate specific recommendations based on misunderstandings
    analysis.recommendations = generateRecommendations(analysis);
    
    return analysis;
  };

  const identifyMisconceptionType = (question, userAnswer) => {
    if (!userAnswer) return 'no_answer';
    
    const questionType = question.type;
    const userAnswerLower = userAnswer.toLowerCase();
    
    if (questionType === 'conceptual') {
      if ('only about theoretical' in userAnswerLower) return 'theoretical_only';
      if ('complicate simple' in userAnswerLower) return 'overcomplication';
      if ('without studying' in userAnswerLower) return 'fundamentals_missing';
    } else if (questionType === 'application') {
      if ('cannot be used' in userAnswerLower) return 'application_rejection';
      if ('only in academic' in userAnswerLower) return 'limited_scope';
      if ('specialized equipment' in userAnswerLower) return 'resource_assumption';
    } else if (questionType === 'definition') {
      if ('collection of unrelated' in userAnswerLower) return 'fragmented_understanding';
      if ('only mathematical' in userAnswerLower) return 'domain_confusion';
      if ('programming language' in userAnswerLower) return 'category_error';
    }
    
    return 'general_misunderstanding';
  };

  const generateRecommendations = (analysis) => {
    const recommendations = [];
    
    // Skill-based recommendations
    analysis.weaknesses.forEach(weakness => {
      switch (weakness) {
        case 'conceptual_understanding':
          recommendations.push('Focus on understanding fundamental principles and core concepts');
          break;
        case 'practical_application':
          recommendations.push('Practice applying concepts in real-world scenarios');
          break;
        case 'misconception_identification':
          recommendations.push('Review common misconceptions and clarify misunderstandings');
          break;
        case 'definitional_knowledge':
          recommendations.push('Study precise definitions and terminology');
          break;
        case 'analytical_thinking':
          recommendations.push('Practice analyzing components and relationships');
          break;
        case 'practical_reasoning':
          recommendations.push('Work on practical problem-solving skills');
          break;
        case 'evaluative_judgment':
          recommendations.push('Develop criteria for evaluating effectiveness and quality');
          break;
        default:
          recommendations.push(`Focus on improving ${weakness.replace('_', ' ')}`);
      }
    });
    
    // Topic-specific recommendations
    Object.entries(analysis.topicPerformance).forEach(([topicId, performance]) => {
      const accuracy = (performance.correct / performance.total) * 100;
      if (accuracy < 50) {
        recommendations.push(`Review ${performance.topicName} - significant improvement needed (${Math.round(accuracy)}% accuracy)`);
      } else if (accuracy < 75) {
        recommendations.push(`Strengthen understanding of ${performance.topicName} (${Math.round(accuracy)}% accuracy)`);
      }
    });
    
    return recommendations;
  };

  const saveTestResultsToFile = async (testResults) => {
    try {
      // Create a comprehensive report
      const report = {
        metadata: {
          testId: `test_${Date.now()}`,
          timestamp: new Date().toISOString(),
          lectureId: testResults.lectureId,
          sessionId: testResults.sessionId,
          topic: testResults.topic,
          sourceType: testResults.sourceType,
          totalQuestions: testResults.totalQuestions,
          score: testResults.score,
          correctAnswers: testResults.correctAnswers
        },
        knowledgeAnalysis: testResults.knowledgeAnalysis,
        detailedResults: testResults.questionDetails,
        summary: {
          strengths: testResults.knowledgeAnalysis.strengths,
          weaknesses: testResults.knowledgeAnalysis.weaknesses,
          misconceptions: testResults.knowledgeAnalysis.misconceptions,
          detailedMisunderstandings: testResults.knowledgeAnalysis.detailedMisunderstandings,
          recommendations: testResults.knowledgeAnalysis.recommendations,
          skillPerformance: Object.entries(testResults.knowledgeAnalysis.skillLevels).map(([skill, data]) => ({
            skill,
            accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
            correct: data.correct,
            total: data.total
          })),
          topicPerformance: Object.entries(testResults.knowledgeAnalysis.topicPerformance).map(([topicId, performance]) => ({
            topicId,
            topicName: performance.topicName,
            accuracy: performance.total > 0 ? Math.round((performance.correct / performance.total) * 100) : 0,
            correct: performance.correct,
            total: performance.total,
            questionsAnswered: performance.questions.length
          }))
        }
      };
      
      // Save to localStorage as backup
      if (typeof window !== 'undefined') {
        const existingResults = JSON.parse(localStorage.getItem('allTestResults') || '[]');
        existingResults.push(report);
        localStorage.setItem('allTestResults', JSON.stringify(existingResults));
        
        // Also save current test for immediate access
        localStorage.setItem('currentTestResults', JSON.stringify(report));
        
        // Save detailed misunderstandings separately for targeted remediation
        const misunderstandings = testResults.knowledgeAnalysis.detailedMisunderstandings || [];
        if (misunderstandings.length > 0) {
          const existingMisunderstandings = JSON.parse(localStorage.getItem('studentMisunderstandings') || '[]');
          existingMisunderstandings.push(...misunderstandings);
          localStorage.setItem('studentMisunderstandings', JSON.stringify(existingMisunderstandings));
        }
      }
      
      // Try to save to backend
      try {
        await fetch('/api/save-test-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
      } catch (error) {
        console.log('Backend save failed, using localStorage only');
      }
      
    } catch (error) {
      console.error('Error saving test results to file:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const score = calculateScore();
      const knowledgeAnalysis = analyzeStudentKnowledge();
      
      let testResults = {
        lectureId,
        sessionId,
        topic: displayTopic,
        score,
        totalQuestions: testQuestions.length,
        correctAnswers: Math.round((score / 100) * testQuestions.length),
        answers,
        knowledgeAnalysis,
        completedAt: new Date().toISOString(),
        questionDetails: testQuestions.map(q => ({
          id: q.id,
          type: q.type,
          topicName: q.topicName,
          question: q.question,
          userAnswer: answers[q.id],
          correctAnswer: q.options.find(opt => opt.isCorrect)?.id,
          isCorrect: answers[q.id] === q.options.find(opt => opt.isCorrect)?.id,
          explanation: q.explanation,
          assessedSkill: q.assessedSkill,
          difficulty: q.difficulty
        }))
      };
      
      if (lecturePlan) {
        // Add lecture-specific data
        testResults.lecturePlan = lecturePlan;
        testResults.sourceType = lecturePlan.source_type || 'unknown';
        
        // Update session data
        if (typeof window !== 'undefined') {
          const sessionData = JSON.parse(sessionStorage.getItem('current_lecture_session') || '{}');
          sessionData.knowledgeTestResults = testResults;
          sessionData.knowledgeTestCompleted = true;
          sessionStorage.setItem('current_lecture_session', JSON.stringify(sessionData));
          localStorage.setItem('current_lecture_session', JSON.stringify(sessionData));
        }
        
        // Save detailed results to file
        await saveTestResultsToFile(testResults);
        
        // Send to backend for storage
        try {
          await fetch('/api/save-knowledge-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testResults)
          });
        } catch (apiError) {
          console.log('API not available, using localStorage only');
        }
        
        // Navigate to STUDY SESSION
        const params = new URLSearchParams();
        if (lectureId) params.append('lectureId', lectureId);
        if (sessionId) params.append('sessionId', sessionId);
        params.append('knowledgeTestCompleted', 'true');
        router.push(`/study-session?${params.toString()}`);
        
      } else {
        // Simple topic-based test
        testResults.sourceType = 'topic';
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastTestResults', JSON.stringify(testResults));
        }
        
        // Save detailed results to file
        await saveTestResultsToFile(testResults);
        
        // Navigate to STUDY SESSION
        router.push('/study-session');
      }
      
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Error saving test results. Please try again.');
      router.push('/study-session');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    let testResults = {};
    
    if (lecturePlan) {
      // Skip lecture-based test
      testResults = {
        lectureId,
        sessionId,
        score: 0,
        answers: {},
        knowledgeLevel: 'beginner',
        topicKnowledge: {},
        skipped: true,
        completedAt: new Date().toISOString()
      };
      
      const sessionData = JSON.parse(sessionStorage.getItem('current_lecture_session') || '{}');
      sessionData.knowledgeTestResults = testResults;
      sessionData.knowledgeTestCompleted = true;
      sessionStorage.setItem('current_lecture_session', JSON.stringify(sessionData));
      
      router.push(`/study-session?lectureId=${lectureId}&sessionId=${sessionId}`);
    } else {
      // Skip simple topic-based test
      testResults = {
        topic: displayTopic,
        score: 0,
        answers: {},
        knowledgeLevel: 'beginner',
        completedAt: new Date().toISOString(),
        skipped: true
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastTestResults', JSON.stringify(testResults));
      }
      
      router.push('/study-session');
    }
  };

  // Update the main function call to use AI-powered generation
  const generateKnowledgeTestQuestions = async (lecturePlan) => {
    return await generateIntelligentQuestions(lecturePlan);
  };

  // Load lecture plan and generate questions
  useEffect(() => {
    const loadLecturePlan = async () => {
      setLoading(true);
      try {
        if (lectureId && sessionId) {
          // Try to get from session storage first
          if (typeof window !== 'undefined') {
            const sessionData = JSON.parse(sessionStorage.getItem('current_lecture_session') || '{}');
            
            if (sessionData.lecturePlan) {
              setLecturePlan(sessionData.lecturePlan);
              setDisplayTopic(sessionData.topic || topic);
              const questions = await generateIntelligentQuestions(sessionData.lecturePlan);
              setTestQuestions(questions);
              setLoading(false);
              return;
            }
          }
          
          // Fallback to API
          const response = await fetch(`/api/get-lecture-plan?lectureId=${lectureId}&sessionId=${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.lecturePlan) {
              setLecturePlan(data.lecturePlan);
              setDisplayTopic(data.topic || topic);
              const questions = await generateIntelligentQuestions(data.lecturePlan);
              setTestQuestions(questions);
            }
          }
        } else {
          // Use fallback questions for topic-based test
          const questions = generateFallbackQuestions();
          setTestQuestions(questions);
        }
      } catch (error) {
        console.error('Error loading lecture plan:', error);
        // Use fallback questions on error
        const questions = generateFallbackQuestions();
        setTestQuestions(questions);
      } finally {
        setLoading(false);
      }
    };

    loadLecturePlan();
  }, [lectureId, sessionId, topic]);

  if (loading && testQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {generatingQuestions ? 'Generating AI-powered questions...' : 'Loading knowledge assessment...'}
          </p>
          {generatingQuestions && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Creating personalized quiz questions from your lecture content
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <main className="pt-16 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header with navigation */}
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            
            <button
              onClick={() => router.push('/study-session')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
              Home
            </button>
          </div>

          {/* Main test container */}
          <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                    Knowledge Assessment
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Topic: <span className="font-medium">{displayTopic}</span>
                  </p>
                  {lecturePlan && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Based on {lecturePlan.impTopics?.length || 0} key topics
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Timer className="w-4 h-4" />
                <span>2-3 minutes</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Question {currentQuestion + 1} of {testQuestions.length}</span>
                <span>{Math.round((currentQuestion + 1) / testQuestions.length * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${((currentQuestion + 1) / testQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Current Question */}
            <div className="mb-8">
              <div className="flex items-start gap-3 mb-6">
                <HelpCircle className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h2 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white mb-3">
                    {testQuestions[currentQuestion]?.question}
                  </h2>
                  {testQuestions[currentQuestion]?.topicName && (
                    <div className="mb-4 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg inline-block">
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        Topic: {testQuestions[currentQuestion].topicName}
                      </span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {testQuestions[currentQuestion]?.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleAnswer(testQuestions[currentQuestion].id, option.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all
                          ${answers[testQuestions[currentQuestion].id] === option.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white mb-1">
                              {option.id}. {option.text}
                            </div>
                          </div>
                          {answers[testQuestions[currentQuestion].id] === option.id && (
                            <Check className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex gap-3">
                {currentQuestion > 0 && (
                  <button
                    onClick={() => setCurrentQuestion(prev => prev - 1)}
                    className="px-6 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Previous
                  </button>
                )}
                
                {currentQuestion < testQuestions.length - 1 && (
                  <button
                    onClick={() => setCurrentQuestion(prev => prev + 1)}
                    disabled={!answers[testQuestions[currentQuestion].id]}
                    className="px-6 py-2 rounded-lg bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next Question
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="px-6 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Skip assessment
                </button>
                
                {currentQuestion === testQuestions.length - 1 && (
                  <button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length < testQuestions.length || loading}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      'Complete Assessment'
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* Info footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                This AI-powered assessment generates personalized questions from your lecture content to understand your knowledge state and identify learning gaps.
                {lecturePlan && ` Based on ${lecturePlan.impTopics?.length} key topics from your lecture.`}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
