"use client";

import { useState, useEffect } from 'react';
import { Settings, Target, Save, Check } from 'lucide-react';

export default function SettingsPage() {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchUserGoal();
  }, []);

  const fetchUserGoal = async () => {
    const response = await fetch('/api/user/profile');
    const data = await response.json();
    setGoal(data.goal || '');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch('/api/user/profile/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your learning preferences</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Learning Goal</h2>
        </div>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Update your primary learning objective. This helps us personalize your study materials.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {['gate', 'jee', 'neet', 'semester', 'concept'].map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`p-4 rounded-xl border-2 transition-all
                ${goal === g
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
            >
              <div className="font-medium capitalize">{g}</div>
              {goal === g && (
                <div className="flex items-center gap-1 text-sm mt-2">
                  <Check className="w-4 h-4" />
                  <span>Selected</span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium flex items-center gap-2 hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
          
          {saved && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 px-4">
              <Check className="w-5 h-5" />
              <span>Goal updated successfully!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}