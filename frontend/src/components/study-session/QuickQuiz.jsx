'use client';

import { useState, useEffect } from 'react';
import { quizAPI } from '@/lib/api';
import { Check, X, Loader } from 'ucide-react';

export default function QuickQuiz({ topic, loadLevel, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [topic, loadLevel]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const response = await quizAPI.getQuestions(topic, loadLevel);
      setQuestions(response.questions.slice(0, 3)); // Max 3 questions
    } catch (error) {
      console.error('Failed to load questions:', error);
      // Mock questions as fallback
      setQuestions([
        {
          id: 1,
          question: "What is backpropagation primarily used for in neural networks?",
          options: ["Initializing weights randomly", "Adjusting weights based on error gradient", "Increasing network depth", "Visualizing neural networks"],
          correctAnswer: 1,
          difficulty: "easy"
        },
        {
          id: 2,
          question: "Which activation function is commonly used with backpropagation?",
          options: ["Sigmoid", "ReLU", "Tanh", "All of the above"],
          correctAnswer: 3,
          difficulty: "medium"
        }
      ]);
    }
    setIsLoading(false);
  };

  const handleOptionSelect = (optionIndex) => {
    setSelectedOption(optionIndex);
    
    // Check if correct
    const isCorrect = optionIndex === questions[currentQuestion].correctAnswer;
    if (isCorrect) {
      setScore(score + 1);
    }

    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
      } else {
        finishQuiz();
      }
    }, 1500);
  };

  const finishQuiz = async () => {
    setShowResult(true);
    
    // Submit results to backend
    try {
      await quizAPI.submitQuiz({
        topic,
        answers: questions.map((q, index) => ({
          questionId: q.id,
          selectedOption: q.correctAnswer // Mock for now
        })),
        loadBefore: loadLevel === 'easy' ? 80 : 70,
        completionTime: questions.length * 10
      });
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }

    // Auto-close after 3 seconds
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center">
          <Loader className="animate-spin mx-auto mb-4" size={32} />
          <p>Loading quiz questions...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center max-w-md">
          <h3 className="text-xl font-bold mb-4">No questions available</h3>
          <p className="text-gray-600 mb-6">Could not load questions for this topic.</p>
          <button
            onClick={onComplete}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-center max-w-md">
          <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
          <p className="text-gray-600 mb-6">
            You scored {score} out of {questions.length}
          </p>
          <div className="text-4xl font-bold mb-6">
            {Math.round((score / questions.length) * 100)}%
          </div>
          <p className="text-gray-500">
            Your cognitive load should decrease now. Continuing in 3 seconds...
          </p>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Quick Check Quiz</h3>
              <p className="text-sm text-gray-500">
                Question {currentQuestion + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h4 className="text-xl font-semibold text-gray-800 mb-4">
              {question.question}
            </h4>
            
            <div className="space-y-3">
              {question.options.map((option, index) => {
                let bgColor = "bg-white";
                let borderColor = "border-gray-200";
                let textColor = "text-gray-800";
                
                if (selectedOption !== null) {
                  if (index === question.correctAnswer) {
                    bgColor = "bg-green-50";
                    borderColor = "border-green-300";
                    textColor = "text-green-700";
                  } else if (index === selectedOption && index !== question.correctAnswer) {
                    bgColor = "bg-red-50";
                    borderColor = "border-red-300";
                    textColor = "text-red-700";
                  }
                }
                
                return (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(index)}
                    disabled={selectedOption !== null}
                    className={`w-full p-4 text-left rounded-lg border ${bgColor} ${borderColor} ${textColor} hover:border-blue-300 transition-all disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full border ${
                          selectedOption !== null && index === question.correctAnswer 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : selectedOption === index
                            ? 'bg-red-500 border-red-500 text-white'
                            : 'bg-white border-gray-300'
                        }`}>
                          {selectedOption !== null && index === question.correctAnswer && <Check size={14} />}
                          {selectedOption === index && index !== question.correctAnswer && <X size={14} />}
                        </div>
                        <span className="font-medium">{option}</span>
                      </div>
                      {selectedOption === index && index !== question.correctAnswer && (
                        <span className="text-red-500 text-sm">Incorrect</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              Current score: {score}/{currentQuestion + 1}
            </div>
            <div>
              {loadLevel === 'easy' ? 'Easy difficulty' : 'Medium difficulty'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}