const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CognitiveLoad = sequelize.define('CognitiveLoad', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  loadValue: {
    type: DataTypes.FLOAT, // 0-100
    allowNull: false
  },
  emotionData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  postureData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  activityData: {
    type: DataTypes.JSON,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'cognitive_loads',
  timestamps: false
});

module.exports = CognitiveLoad;