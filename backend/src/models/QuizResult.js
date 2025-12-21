const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuizResult = sequelize.define('QuizResult', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: DataTypes.INTEGER,
  sessionId: DataTypes.STRING,
  questionCount: DataTypes.INTEGER,
  correctAnswers: DataTypes.INTEGER,
  difficultyLevel: DataTypes.STRING,
  loadBefore: DataTypes.FLOAT,
  loadAfter: DataTypes.FLOAT,
  completionTime: DataTypes.INTEGER, // seconds
  completedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'quiz_results',
  timestamps: false
});

module.exports = QuizResult;