const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HelpOffer = sequelize.define('HelpOffer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: DataTypes.INTEGER,
  sessionId: DataTypes.STRING,
  triggerType: {
    type: DataTypes.ENUM('quiz', 'explanation', 'qa', 'general'),
    allowNull: false
  },
  loadValue: DataTypes.FLOAT,
  offerShownAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  userChoice: {
    type: DataTypes.ENUM('quiz', 'explanation', 'qa', 'continue', 'dismissed'),
    allowNull: true
  },
  choiceTime: DataTypes.DATE,
  loadAfterAction: DataTypes.FLOAT
}, {
  tableName: 'help_offers',
  timestamps: false
});

module.exports = HelpOffer;