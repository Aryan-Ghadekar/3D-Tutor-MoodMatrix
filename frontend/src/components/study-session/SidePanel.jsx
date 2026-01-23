
import React from 'react';
import {
    Brain, FileQuestion, HelpCircle, MessageCircle, BarChart, X as XIcon,
    BookOpen, Clock, AlertOctagon, Lightbulb
} from 'lucide-react';
import QuizBoard from './QuizBoard';

export default function SidePanel({
    activeView,
    theme,
    cognitiveLoad,
    studentGoal,
    handleTakeQuiz,
    handleExplainMore,
    setActiveView,
    setShowProgressModal,
    handleClosePane,

    // Quiz Props
    quizData,
    quizCompleted,
    currentQuestionIndex,
    getAdaptiveQuizDifficulty,
    handleAnswerSelect,
    selectedAnswer,
    handleSubmitAnswer,
    handleNextQuestion,
    handleRestartQuiz,
    quizScore,

    // Ask Question Props
    sampleQuestions,
    handleAskQuestion,
    userQuestion,
    setUserQuestion,
    handleSubmitQuestion,

    // Adaptive Panel Data
    currentTopic,
    currentTopicIndex,
    totalTopics,
    topicsCompleted,
    misconceptions,
    adaptiveSuggestions,
}) {

    const loadColor = (() => {
        switch (cognitiveLoad) {
            case 'high':
                return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500 dark:bg-red-600", lightBg: "bg-red-50 dark:bg-red-900", border: "border-red-200 dark:border-red-800" };
            case 'medium':
                return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500 dark:bg-amber-600", lightBg: "bg-amber-50 dark:bg-amber-900", border: "border-amber-200 dark:border-amber-800" };
            case 'low':
            default:
                return { text: "text-green-600 dark:text-green-400", bg: "bg-green-500 dark:bg-green-600", lightBg: "bg-green-50 dark:bg-green-900", border: "border-green-200 dark:border-green-800" };
        }
    })();

    const renderAdaptivePanel = () => (
        <div className="p-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                Intelligent Learning Panel
            </h3>

            {/* Current Topic Info */}
            {currentTopic && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Current Topic</span>
                        </div>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                            {currentTopicIndex + 1}/{totalTopics}
                        </span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{currentTopic.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{currentTopic.estimatedTime || '25-35 min'}</span>
                            <span className="mx-1">•</span>
                            <span>Difficulty: {currentTopic.difficulty || 'medium'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Progress</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                        {topicsCompleted.size} of {totalTopics} topics
                    </span>
                </div>
                <div className="h-2 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${totalTopics > 0 ? (topicsCompleted.size / totalTopics) * 100 : 0}%` }}
                    ></div>
                </div>
            </div>

            {/* Misconceptions */}
            {misconceptions.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <AlertOctagon className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">Learning Gaps</span>
                        </div>
                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                            {misconceptions.length}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {misconceptions.slice(0, 3).map((misconception, index) => (
                            <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                <div className="flex items-start gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">{misconception.concept}</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">{misconception.type}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Adaptive Suggestions */}
            {adaptiveSuggestions.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Intelligent Suggestions</span>
                    </div>
                    <div className="space-y-2">
                        {adaptiveSuggestions.map((suggestion, index) => (
                            <div key={index} className={`p-3 rounded border ${suggestion.priority === 'high'
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                                }`}>
                                <p className="text-sm text-gray-800 dark:text-gray-300">{suggestion.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cognitive State */}
            <div className={`p-3 rounded border ${loadColor.border} ${loadColor.lightBg}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Brain className={`w-4 h-4 ${loadColor.text}`} />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Cognitive State</span>
                    </div>
                    <span className={`text-sm font-bold ${loadColor.text}`}>
                        {cognitiveLoad.toUpperCase()}
                    </span>
                </div>
                <p className={`text-xs ${loadColor.text}`}>
                    {cognitiveLoad === 'high'
                        ? "Content simplified for optimal learning"
                        : cognitiveLoad === 'medium'
                            ? "Learning at comfortable pace"
                            : "Ready for challenging content"}
                </p>
                <div className="mt-2 flex items-center gap-1">
                    <div className={`h-1.5 flex-1 rounded-full ${cognitiveLoad === 'low' ? 'bg-green-500' : 'bg-green-300'}`}></div>
                    <div className={`h-1.5 flex-1 rounded-full ${cognitiveLoad === 'medium' ? 'bg-amber-500' : 'bg-amber-300'}`}></div>
                    <div className={`h-1.5 flex-1 rounded-full ${cognitiveLoad === 'high' ? 'bg-red-500' : 'bg-red-300'}`}></div>
                </div>
            </div>
        </div>
    );

    const renderDefaultPanel = () => (
        <>
            <div className={`flex-shrink-0 ${theme === 'light' ? 'bg-gradient-to-b from-blue-50 to-purple-50' : 'bg-gradient-to-b from-gray-800 to-gray-900'} border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'}`}>
                <div className="p-6">
                    <div className="relative h-48 w-full mb-4">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-40 h-40">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                                    <Brain className="w-24 h-24 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            Intelligent Learning Assistant
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-400 mb-2">
                            Your personalized learning companion
                        </p>
                        <div className="flex items-center justify-center gap-2">
                            <div className={`px-2 py-1 rounded text-xs ${loadColor.lightBg} ${loadColor.text}`}>
                                {cognitiveLoad.toUpperCase()} LOAD
                            </div>
                            <div className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                {studentGoal.toUpperCase()} GOAL
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                        Intelligent Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            onClick={handleTakeQuiz}
                            className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-amber-900 hover:bg-amber-800 text-amber-300 border-amber-700'
                                }`}
                        >
                            <FileQuestion className="w-5 h-5" />
                            <span className="text-xs font-semibold">Take Quiz</span>
                        </button>
                        <button
                            onClick={handleExplainMore}
                            className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light'
                                ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300'
                                : 'bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700'
                                }`}
                        >
                            <HelpCircle className="w-5 h-5" />
                            <span className="text-xs font-semibold">Explain More</span>
                        </button>
                        <button
                            onClick={() => setActiveView('askQuestions')}
                            className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light'
                                ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                                : 'bg-blue-900 hover:bg-blue-800 text-blue-300 border-blue-700'
                                }`}
                        >
                            <MessageCircle className="w-5 h-5" />
                            <span className="text-xs font-semibold">Ask Questions</span>
                        </button>
                        <button
                            onClick={() => setShowProgressModal(true)}
                            className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition border ${theme === 'light'
                                ? 'bg-gradient-to-br from-green-500 to-emerald-500 hover:opacity-90 border-green-600'
                                : 'bg-gradient-to-br from-green-600 to-emerald-600 hover:opacity-90 border-green-700'
                                }`}
                        >
                            <BarChart className="w-5 h-5 text-white" />
                            <span className="text-xs font-semibold text-white">View Progress</span>
                        </button>
                    </div>

                    {renderAdaptivePanel()}
                </div>
            </div>
        </>
    );

    const renderAskQuestions = () => (
        <div className="flex-1 flex flex-col min-h-0 h-full">
            <div className="flex-shrink-0 p-6 border-b border-gray-300 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Ask Questions</h3>
                    </div>
                    <button
                        onClick={handleClosePane}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                    >
                        <XIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-400 mb-4">
                    Select a question or ask your own:
                </p>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <div className="space-y-2">
                        {sampleQuestions.map((question, index) => (
                            <button
                                key={index}
                                onClick={() => handleAskQuestion(question)}
                                className={`w-full text-left p-3 rounded-lg transition border ${theme === 'light'
                                    ? 'hover:bg-blue-50 border-blue-300'
                                    : 'hover:bg-blue-900 border-blue-700'
                                    }`}
                            >
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-300">{question}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-300 dark:border-gray-700 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-400 mb-2">Or ask your own question:</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={userQuestion}
                            onChange={(e) => setUserQuestion(e.target.value)}
                            placeholder="Type your question..."
                            className={`flex-1 px-3 py-2 rounded-lg border ${theme === 'light'
                                ? 'border-gray-400 bg-white'
                                : 'border-gray-600 bg-gray-700'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                            onKeyPress={(e) => e.key === 'Enter' && handleSubmitQuestion()}
                        />
                        <button
                            onClick={handleSubmitQuestion}
                            disabled={!userQuestion.trim()}
                            className={`px-4 py-2 rounded-lg transition border ${!userQuestion.trim()
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-400 dark:border-gray-600'
                                : 'bg-blue-600 dark:bg-blue-700 text-white hover:opacity-90 border-blue-700 dark:border-blue-800'
                                }`}
                        >
                            Ask
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`w-96 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-l ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex flex-col overflow-hidden h-full z-10 shadow-lg`}>
            {!activeView && renderDefaultPanel()}
            {activeView === 'quiz' && (
                <QuizBoard
                    quizData={quizData}
                    quizCompleted={quizCompleted}
                    currentQuestionIndex={currentQuestionIndex}
                    getAdaptiveQuizDifficulty={getAdaptiveQuizDifficulty}
                    handleAnswerSelect={handleAnswerSelect}
                    selectedAnswer={selectedAnswer}
                    handleSubmitAnswer={handleSubmitAnswer}
                    handleNextQuestion={handleNextQuestion}
                    handleRestartQuiz={handleRestartQuiz}
                    handleClosePane={handleClosePane}
                    cognitiveLoad={cognitiveLoad}
                    quizScore={quizScore}
                />
            )}
            {activeView === 'askQuestions' && renderAskQuestions()}
        </div>
    );
}
