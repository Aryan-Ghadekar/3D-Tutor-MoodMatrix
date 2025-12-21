const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());


app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'Backend server is running!',
    time: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'API is working perfectly!',
    version: '1.0.0'
  });
});

app.post('/api/cognitive/record', (req, res) => {
  console.log('📊 Received cognitive data:', req.body);
  
  const loadValue = req.body.loadValue || 50;
  const shouldOfferHelp = loadValue > 70;
  
  res.json({
    success: true,
    data: {
      loadValue,
      shouldOfferHelp,
      offerType: shouldOfferHelp ? 'quiz' : null,
      timestamp: new Date().toISOString()
    },
    message: shouldOfferHelp ? 'Help offer triggered!' : 'All good, continue learning'
  });
});

app.post('/api/help/offer-shown', (req, res) => {
  console.log('🆘 Help offer shown:', req.body);
  res.json({
    success: true,
    offerId: Date.now(),
    message: 'Offer recorded successfully'
  });
});

app.post('/api/help/record-choice', (req, res) => {
  console.log('✅ User choice recorded:', req.body);
  res.json({
    success: true,
    message: 'Choice saved successfully'
  });
});

app.get('/api/quiz/questions/:topic', (req, res) => {
  const topic = req.params.topic;
  console.log(`📚 Quiz requested for topic: ${topic}`);
  
  const questions = {
    backpropagation: [
      {
        id: 1,
        question: "What is backpropagation used for in neural networks?",
        options: ["Weight initialization", "Error gradient calculation", "Data preprocessing", "Model deployment"],
        correctAnswer: 1,
        difficulty: "easy"
      }
    ],
    default: [
      {
        id: 1,
        question: "Sample question",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: 0,
        difficulty: "easy"
      }
    ]
  };
  
  res.json({
    success: true,
    topic: topic,
    questions: questions[topic] || questions.default,
    count: (questions[topic] || questions.default).length
  });
});

app.post('/api/quiz/submit', (req, res) => {
  console.log('📝 Quiz submitted:', req.body);
  
  const score = Math.floor(Math.random() * 30) + 70; // 70-100%
  
  res.json({
    success: true,
    score: score,
    totalQuestions: req.body.answers?.length || 0,
    correctAnswers: Math.ceil((score / 100) * (req.body.answers?.length || 1)),
    message: `Quiz completed! Score: ${score}%`,
    loadAfter: Math.max(20, 100 - score) // Mock load reduction
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `The endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET    /api/health',
      'POST   /api/cognitive/record',
      'POST   /api/help/offer-shown',
      'POST   /api/help/record-choice',
      'GET    /api/quiz/questions/:topic',
      'POST   /api/quiz/submit'
    ]
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Cognitive Load Aware Tutoring System Backend',
    description: 'Monitor cognitive load and provide adaptive help',
    endpoints: 'Visit /api/health to check API status',
    status: 'running'
  });
});

app.use((err, req, res) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong on the server'
  });
});


const PORT = 5000;
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('BACKEND SERVER STARTED SUCCESSFULLY!');
  console.log('='.repeat(50));
  console.log(`Port: ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Frontend: http://localhost:3000`);
  console.log('='.repeat(50));
  console.log('Available endpoints:');
  console.log('  GET    /api/health            - Check API health');
  console.log('  POST   /api/cognitive/record  - Record cognitive load');
  console.log('  POST   /api/help/offer-shown  - Record help offer');
  console.log('  POST   /api/help/record-choice - Record user choice');
  console.log('  GET    /api/quiz/questions/:topic - Get quiz questions');
  console.log('  POST   /api/quiz/submit       - Submit quiz answers');
  console.log('='.repeat(50));
});