const express = require('express');
const router = express.Router();

// Mock quiz questions
const quizQuestions = {
  backpropagation: [
    {
      id: 1,
      question: "What is the main purpose of backpropagation in neural networks?",
      options: [
        "To initialize weights randomly",
        "To adjust weights based on error gradient",
        "To increase network depth",
        "To visualize neural networks"
      ],
      correctAnswer: 1,
      difficulty: "easy"
    },
    {
      id: 2,
      question: "Which activation function is commonly used with backpropagation?",
      options: [
        "Sigmoid",
        "ReLU",
        "Tanh",
        "All of the above"
      ],
      correctAnswer: 3,
      difficulty: "medium"
    }
  ],
  calculus: [
    {
      id: 1,
      question: "What is the derivative of x²?",
      options: ["x", "2x", "x³/3", "1"],
      correctAnswer: 1,
      difficulty: "easy"
    }
  ]
};

const defaultQuestions = [
  {
    id: 1,
    question: "Sample question",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: 0,
    difficulty: "easy"
  }
];

const questionsFor = (topic) => quizQuestions[topic] || defaultQuestions;

// GET: Get quiz questions for a topic
router.get('/questions/:topic', (req, res) => {
  const { topic } = req.params;
  const questions = questionsFor(topic);
  
  // Adapt difficulty based on cognitive load (simplified)
  const { loadLevel = 'medium' } = req.query;
  
  let filteredQuestions = questions;
  if (loadLevel === 'high') {
    filteredQuestions = questions.filter(q => q.difficulty === 'easy');
  } else if (loadLevel === 'medium') {
    filteredQuestions = questions.filter(q => q.difficulty !== 'hard');
  }
  
  res.json({
    success: true,
    topic,
    questions: filteredQuestions,
    count: filteredQuestions.length
  });
});

// POST: Submit quiz results
router.post('/submit', async (req, res) => {
  try {
    const { userId, sessionId, topic, answers, loadBefore = 50, completionTime } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, error: 'answers must be a non-empty array' });
    }

    const questions = questionsFor(topic);
    let correct = 0;
    
    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.questionId);
      if (question && question.correctAnswer === answer.selectedOption) {
        correct++;
      }
    });
    
    const result = {
      id: Date.now(),
      userId,
      sessionId,
      topic,
      questionCount: answers.length,
      correctAnswers: correct,
      score: Math.round((correct / answers.length) * 100),
      loadBefore,
      completionTime,
      completedAt: new Date().toISOString()
    };
    
    // Calculate load after quiz (simplified)
    const loadAfter = Math.max(0, loadBefore - (correct * 10));
    
    res.json({
      success: true,
      data: result,
      loadAfter,
      message: `Quiz completed! Score: ${result.score}%`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit quiz' });
  }
});

// GET: Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Quiz routes are working!',
    availableTopics: Object.keys(quizQuestions)
  });
});

module.exports = router;