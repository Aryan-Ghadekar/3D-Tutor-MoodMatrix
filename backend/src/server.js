require('dotenv').config();
const express = require('express');
const cors = require('cors');

const quizRoutes = require('./routes/quizRoutes');

const PORT = Number(process.env.PORT) || 5000;
const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',') }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', message: 'Backend server is running!', time: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is working', version: '1.1.0', storage: process.env.DB_NAME ? 'mysql' : 'memory' });
});

app.use('/api/quiz', quizRoutes);

// Cognitive-load and help-offer data live in MySQL when DB_NAME is configured, otherwise in memory.
if (process.env.DB_NAME) {
  const { syncDatabase } = require('./models');
  app.use('/api/cognitive', require('./routes/cognitiveRoutes'));
  app.use('/api/help', require('./routes/helpRoutes'));
  syncDatabase();
} else {
  const memory = require('./routes/memoryRoutes');
  app.use('/api/cognitive', memory.cognitive);
  app.use('/api/help', memory.help);
}

app.get('/', (req, res) => {
  res.json({
    message: 'Cognitive Load Aware Tutoring System Backend',
    endpoints: 'Visit /api/health to check API status',
    status: 'running'
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found', message: `The endpoint ${req.originalUrl} does not exist` });
});

// Express only treats a function with four parameters as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('Server error:', err);
  res.status(status).json({ success: false, error: status >= 500 ? 'Internal server error' : err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT} (storage: ${process.env.DB_NAME ? 'mysql' : 'memory'})`);
  });
}

module.exports = app;
