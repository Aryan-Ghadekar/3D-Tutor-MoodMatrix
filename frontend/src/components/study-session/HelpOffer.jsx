'use client';

import { X, Brain, BookOpen, HelpCircle, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';

const OPTIONS = [
  { key: 'quiz', icon: BookOpen, title: 'Quick check quiz', text: 'Test your understanding of this topic', tone: 'blue' },
  { key: 'explain', icon: Lightbulb, title: 'Explain it differently', text: 'Get a deeper, alternative explanation', tone: 'purple' },
  { key: 'simplify', icon: Sparkles, title: 'Have the avatar explain it simply', text: 'A shorter explanation with a real-world example, read aloud', tone: 'purple' },
  { key: 'ask', icon: HelpCircle, title: 'Ask a question', text: 'Get clarification on a specific point', tone: 'green' },
];

const TONES = {
  blue: 'hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 [&_.icon]:bg-blue-100 [&_.icon]:text-blue-600',
  purple: 'hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 [&_.icon]:bg-purple-100 [&_.icon]:text-purple-600',
  green: 'hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 [&_.icon]:bg-green-100 [&_.icon]:text-green-600',
};

/**
 * Offers help when the student seems stuck (struggling on quizzes, asking for repeated
 * explanations, or idle on one slide for a while).
 */
export default function HelpOffer({ show, cognitiveLoad, onQuiz, onExplain, onSimplify, onAsk, onClose }) {
  if (!show) return null;

  const handlers = { quiz: () => onQuiz(), explain: () => onExplain(), simplify: () => onSimplify(), ask: () => onAsk() };
  const message =
    cognitiveLoad === 'high'
      ? 'This topic seems challenging. Want some help?'
      : 'Taking a while on this slide? Here are a few ways to move forward.';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Learning support">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${cognitiveLoad === 'high' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                <Brain size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Learning support</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">Cognitive load: {cognitiveLoad}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>

          <div className="space-y-3">
            {OPTIONS.map(({ key, icon: Icon, title, text, tone }) => (
              <button
                key={key}
                onClick={handlers[key]}
                className={`w-full flex items-center justify-between p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 transition-all ${TONES[tone]}`}
              >
                <div className="flex items-center gap-3">
                  <div className="icon p-2 rounded-lg">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-white">{title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{text}</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            ))}

            <button
              onClick={onClose}
              className="w-full p-3 text-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all"
            >
              Continue without help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
