"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Target, GraduationCap, BookOpen, Trophy, School, Brain,
  ArrowRight, Check, Award
} from 'lucide-react';

export default function GoalSelectionPage() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState('');
  const [loading, setLoading] = useState(false);

  const goals = [
    {
      id: 'gate',
      title: 'GATE Exam',
      description: 'Graduate Aptitude Test in Engineering - Focus on problem-solving',
      icon: GraduationCap,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'jee',
      title: 'JEE Advanced',
      description: 'Joint Entrance Examination - Advanced level concepts',
      icon: Trophy,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'neet',
      title: 'NEET UG',
      description: 'Medical Entrance - Biology and Chemistry focus',
      icon: BookOpen,
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'semester',
      title: 'University Exams',
      description: 'College/University semester examinations',
      icon: School,
      color: 'from-orange-500 to-red-500'
    },
    {
      id: 'concept',
      title: 'Concept Mastery',
      description: 'Deep understanding of fundamental concepts',
      icon: Brain,
      color: 'from-indigo-500 to-purple-500'
    }
  ];

  const handleSubmit = async () => {
    if (!selectedGoal) return;
    
    setLoading(true);
    // The study session reads the goal from localStorage, so this must succeed even if the server call fails
    localStorage.setItem('learning_goal', selectedGoal);
    try {
      const response = await fetch('/api/user/profile/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: selectedGoal })
      });
      if (!response.ok) console.warn('Goal was saved locally but not on the server:', response.status);
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setLoading(false);
      router.push('/lecture-input');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Target className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Set Your Learning Goal
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Tell us your objective so we can personalize your study experience. 
            You can always change this later in settings.
          </p>
        </div>

        {/* Goal Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => setSelectedGoal(goal.id)}
              className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left
                ${selectedGoal === goal.id 
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 shadow-lg scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${goal.color} flex items-center justify-center mb-4`}>
                <goal.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {goal.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {goal.description}
              </p>
              {selectedGoal === goal.id && (
                <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400">
                  <Check className="w-5 h-5 mr-2" />
                  <span className="text-sm font-medium">Selected</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push('/lecture-input')}
            className="px-8 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Skip for now
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedGoal || loading}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              
              <>
                Start Studying
                <ArrowRight className="w-5 h-5" />
              </>
              
            )}
          </button>
        </div>

        <p className="text-center text-gray-500 dark:text-gray-500 text-sm mt-6">
          You can update your goal anytime from your profile settings
        </p>
      </div>
    </div>
  );
}