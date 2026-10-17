const sequelize = require('../config/database');
const CognitiveLoad = require('./CognitiveLoad');
const HelpOffer = require('./HelpOffer');
const QuizResult = require('./QuizResult');

// Define relationships if needed
// HelpOffer.belongsTo(CognitiveLoad, { foreignKey: 'loadId' });

// Sync all models
const syncDatabase = async () => {
  try {
    await sequelize.sync();
    console.log('✅ Database tables synced successfully');
  } catch (error) {
    console.error('❌ Error syncing database:', error);
  }
};

module.exports = {
  sequelize,
  CognitiveLoad,
  HelpOffer,
  QuizResult,
  syncDatabase
};