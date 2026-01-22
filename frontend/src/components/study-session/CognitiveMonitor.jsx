'use client';

import { useState, useEffect } from 'react';
import { cognitiveAPI } from '@/lib/api';

export default function CognitiveMonitor({ sessionId, userId }) {
  const [cognitiveLoad, setCognitiveLoad] = useState(50);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastOfferTime, setLastOfferTime] = useState(0);

  // Mock cognitive load data
  const simulateCognitiveLoad = () => {
    if (!isMonitoring) return;

    // Random load between 40-90
    const newLoad = Math.floor(Math.random() * 50) + 40;
    setCognitiveLoad(newLoad);

    // Send to backend
    cognitiveAPI.recordLoad({
      userId,
      sessionId,
      loadValue: newLoad,
      emotionData: { emotion: 'neutral', confidence: 0.8 },
      postureData: { posture: 'sitting', confidence: 0.7 },
      activityData: { timeOnSlide: 60, hesitation: newLoad > 70 }
    }).then(response => {
      console.log('Load recorded:', response);

      // Check if we should trigger help offer
      if (response.data?.shouldOfferHelp) {
        const now = Date.now();
        // Only trigger offer if 1 minute has passed since last offer
        if (now - lastOfferTime > 60000) {
          triggerHelpOffer(response.data.offerType);
          setLastOfferTime(now);
        }
      }
    });
  };

  const triggerHelpOffer = (offerType) => {
    console.log(`Triggering help offer: ${offerType}`);
    const event = new CustomEvent('cognitive-help-offer', {
      detail: { offerType, loadValue: cognitiveLoad }
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    const interval = setInterval(simulateCognitiveLoad, 5000); // Every 5 seconds
    return () => clearInterval(interval);
  }, [isMonitoring, lastOfferTime]);

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-700">Cognitive Load Monitor</h3>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`px-2 py-1 text-xs rounded ${
            isMonitoring ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          } text-white`}
        >
          {isMonitoring ? 'Pause' : 'Resume'}
        </button>
      </div>
      
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Current Load</span>
          <span className={`font-bold ${
            cognitiveLoad > 80 ? 'text-red-600' : 
            cognitiveLoad > 60 ? 'text-yellow-600' : 
            'text-green-600'
          }`}>
            {cognitiveLoad}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              cognitiveLoad > 80 ? 'bg-red-500' : 
              cognitiveLoad > 60 ? 'bg-yellow-500' : 
              'bg-green-500'
            }`}
            style={{ width: `${cognitiveLoad}%` }}
          ></div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Status: {isMonitoring ? 'Monitoring...' : 'Paused'}
        {cognitiveLoad > 70 && <span className="ml-2 text-red-500">High load detected</span>}
      </div>
    </div>
  );
}