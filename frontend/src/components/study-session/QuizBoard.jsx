
import React from 'react';
import {
    FileQuestion, Clock, Eye, CheckCircle, XCircle, Lightbulb, Trophy, X as XIcon
} from 'lucide-react';

export default function QuizBoard({
    quizData,
    quizCompleted,
    currentQuestionIndex,
    getAdaptiveQuizDifficulty,
    handleAnswerSelect,
    selectedAnswer,
    handleSubmitAnswer,
    handleNextQuestion,
    handleRestartQuiz,
    handleClosePane,
    cognitiveLoad
}) {
    if (!quizData || quizData.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="text-center">
                    <FileQuestion className="w-16 h-16 mx-auto text-amber-400 mb-4" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Loading intelligent quiz...</p>
                </div>
            </div>
        );
    }

    // Quiz Header
    const renderHeader = () => (
        <div className="flex-shrink-0 p-6 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <FileQuestion className="w-5 h-5 text-amber-500" />
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Adaptive Quiz</h3>
                </div>
                <button
                    onClick={handleClosePane}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition border border-gray-300 dark:border-gray-600"
                >
                    <XIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </button>
            </div>
            {!quizCompleted && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900 border border-amber-300 dark:border-amber-700">
                    <p className="text-sm text-gray-800 dark:text-gray-300">
                        Quiz adapted to {cognitiveLoad} cognitive load
                    </p>
                </div>
            )}
        </div>
    );

    if (quizCompleted) {
        const currentQuiz = quizData;
        const correctAnswers = currentQuiz.filter(q => q.userAnswer === q.correctAnswer).length;
        const totalQuestions = currentQuiz.length;
        const score = Math.round((correctAnswers / totalQuestions) * 100);

        return (
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 h-full">
                {renderHeader()}
                <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <div className="text-center mb-6">
                        <Trophy className="w-16 h-16 mx-auto text-amber-500 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Quiz Completed!
                        </h3>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                            {score}%
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {correctAnswers} out of {totalQuestions} correct
                        </p>

                        {/* Performance feedback */}
                        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                                {score >= 80 ? 'Excellent! Strong understanding demonstrated.' :
                                    score >= 60 ? 'Good! Solid grasp with room for improvement.' :
                                        'Keep practicing! Review the concepts and try again.'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {currentQuiz.map((question, index) => (
                            <div key={index} className={`p-4 rounded-lg border ${question.userAnswer === question.correctAnswer
                                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                                }`}>
                                <div className="flex items-start gap-2 mb-2">
                                    {question.userAnswer === question.correctAnswer ? (
                                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 dark:text-white">{question.question}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Your answer: <span className="font-semibold">{question.userAnswer}</span>
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Correct answer: <span className="font-semibold text-green-600 dark:text-green-400">{question.correctAnswer}</span>
                                        </p>
                                        {question.explanation && (
                                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                                                <p className="text-sm text-gray-700 dark:text-gray-300">{question.explanation}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleRestartQuiz}
                            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition font-semibold"
                        >
                            Continue Learning
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Active Question Render
    const currentQuestion = quizData[currentQuestionIndex];
    if (!currentQuestion) return null;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 h-full">
            {renderHeader()}
            <div className="p-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FileQuestion className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Question {currentQuestionIndex + 1} of {quizData.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                            Adaptive difficulty: {getAdaptiveQuizDifficulty()}
                        </span>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {currentQuestion.question}
                    </h3>

                    <div className="space-y-3">
                        {currentQuestion.options.map((option, index) => {
                            const isSelected = selectedAnswer === option.id;
                            const isAnswered = currentQuestion.userAnswer;
                            const isCorrect = option.isCorrect;

                            return (
                                <button
                                    key={index}
                                    onClick={() => !isAnswered && handleAnswerSelect(option.id)}
                                    className={`w-full text-left p-4 rounded-lg transition-all border ${isAnswered
                                        ? isCorrect
                                            ? 'border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/30'
                                            : isSelected
                                                ? 'border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/30'
                                                : 'border-gray-300 dark:border-gray-600'
                                        : isSelected
                                            ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                        }`}
                                    disabled={isAnswered}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`font-medium ${isAnswered
                                            ? isCorrect
                                                ? 'text-green-700 dark:text-green-300'
                                                : isSelected
                                                    ? 'text-red-700 dark:text-red-300'
                                                    : 'text-gray-700 dark:text-gray-300'
                                            : isSelected
                                                ? 'text-gray-900 dark:text-white'
                                                : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {option.text}
                                        </span>
                                        {isSelected && !isAnswered && (
                                            <div className="p-1 rounded bg-blue-100 dark:bg-blue-800">
                                                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                        )}
                                        {isAnswered && isCorrect && (
                                            <div className="p-1 rounded bg-green-100 dark:bg-green-800">
                                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            </div>
                                        )}
                                        {isAnswered && isSelected && !isCorrect && (
                                            <div className="p-1 rounded bg-red-100 dark:bg-red-800">
                                                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {currentQuestion.userAnswer && currentQuestion.explanation && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <div className="flex items-start gap-2">
                            <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div>
                                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Explanation</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{currentQuestion.explanation}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-gray-300 dark:border-gray-700 flex-shrink-0">
                <button
                    onClick={currentQuestion.userAnswer ? handleNextQuestion : handleSubmitAnswer}
                    disabled={!selectedAnswer && !currentQuestion.userAnswer}
                    className={`w-full py-3 rounded-lg font-semibold transition ${!selectedAnswer && !currentQuestion.userAnswer
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
                        }`}
                >
                    {currentQuestion.userAnswer
                        ? (currentQuestionIndex < quizData.length - 1 ? 'Next Question' : 'See Results')
                        : 'Submit Answer'}
                </button>
            </div>
        </div>
    );
}
