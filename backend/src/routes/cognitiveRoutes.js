const express = require('express');
const router = express.Router();
const { CognitiveLoad } = require('../models');

// POST: Record cognitive load data
router.post('/record', async (req, res) => {
  try {
    const { userId, sessionId, loadValue, emotionData, postureData, activityData } = req.body;
    if (typeof loadValue !== 'number' || loadValue < 0 || loadValue > 100) {
      return res.status(400).json({ success: false, error: 'loadValue must be a number between 0 and 100' });
    }

    const loadRecord = await CognitiveLoad.create({
      userId,
      sessionId,
      loadValue,
      emotionData,
      postureData,
      activityData
    });

    // Check if we should trigger help offer
    const shouldOfferHelp = loadValue > 70; // Simple threshold
    
    res.json({
      success: true,
      data: loadRecord,
      shouldOfferHelp,
      offerType: shouldOfferHelp ? determineOfferType(loadValue, activityData) : null
    });
  } catch (error) {
    console.error('Error recording cognitive load:', error);
    res.status(500).json({ error: 'Failed to record cognitive load' });
  }
});

// GET: Get load history for a session
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await CognitiveLoad.findAll({
      where: { sessionId },
      order: [['timestamp', 'ASC']],
      limit: 100
    });
    
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch load history' });
  }
});

function determineOfferType(loadValue, activityData) {
  if (loadValue > 80) return 'explanation';
  if (loadValue > 70 && activityData?.hesitation) return 'qa';
  return 'quiz';
}

module.exports = router;