'use client';

import { useState, useEffect } from 'react';
import { helpAPI, quizAPI } from '@/lib/api';
import { X, Brain, BookOpen, HelpCircle, ChevronRight } from 'lucide-react';

export default function HelpOffer({ sessionId, userId, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [offerType, setOfferType] = useState('quiz');
  const [loadValue, setLoadValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showQA, setShowQA] = useState(false);

  // Listen for cognitive load events
  useEffect(() => {
    const handleHelpOffer = (event) => {
      const { offerType, loadValue } = event.detail;
      setOfferType(offerType);
      setLoadValue(loadValue);
      setIsVisible(true);
      
      // Record that offer was shown
      helpAPI.recordOfferShown({
        userId,
        sessionId,
        triggerType: offerType,
        loadValue
      });
    };

    window.addEventListener('cognitive-help-offer', handleHelpOffer);
    return () => window.removeEventListener('cognitive-help-offer', handleHelpOffer);
  }, [sessionId, userId]);

  const handleChoice = async (choice) => {
    setIsLoading(true);
    
    // Record user choice
    await helpAPI.recordUserChoice({
      offerId: Date.now(), // In real app, get from offer-shown response
      userChoice: choice,
      loadAfterAction: loadValue - 20 // Mock reduction
    });

    // Execute chosen action
    if (choice === 'quiz') {
      setShowQuiz(true);
    } else if (choice === 'explanation') {
      setShowExplanation(true);
    } else if (choice === 'qa') {
      setShowQA(true);
    } else if (choice === 'continue') {
      setIsVisible(false);
      if (onClose) onClose();
    }

    setIsLoading(false);
  };

  const getOfferMessage = () => {
    if (loadValue > 80) {
      return "You seem really stuck. Let me help you understand this better.";
    } else if (loadValue > 70) {
      return "This seems challenging. Want some help?";
    }
    return "Need some assistance with this concept?";
  };

  if (!isVisible) return null;

  if (showQuiz) {
    return <QuickQuiz 
      topic="backpropagation" 
      loadLevel={loadValue > 80 ? 'easy' : 'medium'}
      onComplete={() => {
        setShowQuiz(false);
        setIsVisible(false);
        if (onClose) onClose();
      }}
    />;
  }

  if (showExplanation) {
    return <AdaptiveExplanation 
      concept="backpropagation"
      difficulty={loadValue > 80 ? 'simple' : 'detailed'}
      onClose={() => {
        setShowExplanation(false);
        setIsVisible(false);
        if (onClose) onClose();
      }}
    />;
  }

  if (showQA) {
    return <ContextualQA 
      onClose={() => {
        setShowQA(false);
        setIsVisible(false);
        if (onClose) onClose();
      }}
    />;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                loadValue > 80 ? 'bg-red-100 text-red-600' : 
                'bg-blue-100 text-blue-600'
              }`}>
                <Brain size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800">Learning Support</h3>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    loadValue > 80 ? 'bg-red-500' : 
                    loadValue > 70 ? 'bg-yellow-500' : 
                    'bg-blue-500'
                  }`}></div>
                  <span className="text-sm text-gray-600">
                    Cognitive load: {loadValue}%
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setIsVisible(false);
                handleChoice('dismissed');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-700 mb-6">
            {getOfferMessage()}
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleChoice('quiz')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3 text-left rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="font-medium text-gray-800">Quick Check Quiz</div>
                  <div className="text-sm text-gray-500">Test your understanding with 2-3 questions</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>

            <button
              onClick={() => handleChoice('explanation')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3 text-left rounded-lg border hover:border-purple-300 hover:bg-purple-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="font-medium text-gray-800">Different Explanation</div>
                  <div className="text-sm text-gray-500">See this concept explained in another way</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>

            <button
              onClick={() => handleChoice('qa')}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3 text-left rounded-lg border hover:border-green-300 hover:bg-green-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <div className="font-medium text-gray-800">Ask a Question</div>
                  <div className="text-sm text-gray-500">Get clarification on specific points</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>

            <button
              onClick={() => handleChoice('continue')}
              disabled={isLoading}
              className="w-full p-3 text-center rounded-lg border hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-all"
            >
              Continue without help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}