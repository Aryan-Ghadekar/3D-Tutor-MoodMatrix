// In-memory implementation of the cognitive-load and help-offer endpoints.
// Used when no database is configured (DB_NAME unset) so the API still works out of the box.
const express = require('express');

const loadsBySession = new Map();
const offers = new Map();
let nextOfferId = 1;

function determineOfferType(loadValue, activityData) {
  if (loadValue > 80) return 'explanation';
  if (loadValue > 70 && activityData?.hesitation) return 'qa';
  return 'quiz';
}

const cognitive = express.Router();

cognitive.post('/record', (req, res) => {
  const { userId, sessionId, loadValue, emotionData, postureData, activityData } = req.body;
  if (typeof loadValue !== 'number' || loadValue < 0 || loadValue > 100) {
    return res.status(400).json({ success: false, error: 'loadValue must be a number between 0 and 100' });
  }

  const record = { userId, sessionId, loadValue, emotionData, postureData, activityData, timestamp: new Date().toISOString() };
  const history = loadsBySession.get(sessionId) || [];
  history.push(record);
  loadsBySession.set(sessionId, history.slice(-100));

  const shouldOfferHelp = loadValue > 70;
  res.json({
    success: true,
    data: record,
    shouldOfferHelp,
    offerType: shouldOfferHelp ? determineOfferType(loadValue, activityData) : null
  });
});

cognitive.get('/history/:sessionId', (req, res) => {
  res.json({ success: true, data: loadsBySession.get(req.params.sessionId) || [] });
});

const help = express.Router();

help.post('/offer-shown', (req, res) => {
  const { userId, sessionId, triggerType, loadValue } = req.body;
  const offer = { id: nextOfferId++, userId, sessionId, triggerType, loadValue, offerShownAt: new Date().toISOString() };
  offers.set(offer.id, offer);
  res.json({ success: true, data: offer, message: 'Offer recorded' });
});

help.post('/record-choice', (req, res) => {
  const { offerId, userChoice, loadAfterAction } = req.body;
  const offer = offers.get(Number(offerId));
  if (!offer) return res.status(404).json({ success: false, error: 'Offer not found' });
  Object.assign(offer, { userChoice, loadAfterAction, choiceTime: new Date().toISOString() });
  res.json({ success: true, data: offer, message: 'Choice recorded' });
});

module.exports = { cognitive, help };
