const express = require('express');
const router = express.Router();
const { HelpOffer } = require('../models');

// POST: Record help offer shown
router.post('/offer-shown', async (req, res) => {
  try {
    const { userId, sessionId, triggerType, loadValue } = req.body;
    
    const offer = await HelpOffer.create({
      userId,
      sessionId,
      triggerType,
      loadValue,
      offerShownAt: new Date()
    });

    res.json({ 
      success: true, 
      data: offer,
      message: 'Offer recorded' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record offer' });
  }
});

// POST: Record user choice
router.post('/record-choice', async (req, res) => {
  try {
    const { offerId, userChoice, loadAfterAction } = req.body;
    
    const offer = await HelpOffer.findByPk(offerId);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    offer.userChoice = userChoice;
    offer.choiceTime = new Date();
    offer.loadAfterAction = loadAfterAction;
    await offer.save();

    res.json({ 
      success: true, 
      data: offer,
      message: 'Choice recorded' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record choice' });
  }
});

module.exports = router;