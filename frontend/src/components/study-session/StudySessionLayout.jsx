
import React from 'react';
import { BrainCircuit, Brain, Target, BarChart, AlertOctagon, PieChart, RefreshCw, Power } from 'lucide-react';
import Header from '../Header'; // Adjust path based on location
import SlideViewer from './SlideViewer';
import ControlBar from './ControlBar';
import SidePanel from './SidePanel';
import { X as XIcon, CheckCircle, SkipBack, SkipForward } from 'lucide-react';

export default function StudySessionLayout(props) {
    const {
        theme,
        loading,
        loadingMessage,
        error,

        // Session Data
        cognitiveLoad,
        studentGoal,
        quizHistory,
        misconceptions,
        topicsCompleted,
        totalTopics,
        currentSlideData,
        slides,
        currentSlideIndex,
        currentTopicIndex,
        currentTopicIndex: propTopicIndex, // Aliasing if needed, but it's passed as is

        // Actions
        handleRestartSession,
        setShowProgressModal,
        handleDownloadPPT, // Note: This was in page.jsx but not in hook return? I need to check hook.
        showProgressModal,

        // Render Helpers (Some moved to sub-components)
        activeView,

        // ... all other props passed down 
    } = props;

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

    const currentSlideNumber = currentSlideIndex + 1;
    const totalSlides = slides.length;

    // Progress Modal Logic (Keep basic UI here or extract? It's small enough to keep or move to separate component)
    // Let's keep it here for now to save time, but referencing props.
    const lecturePlan = props.lecturePlan;

    const renderProgressModal = () => {
        if (!showProgressModal || !lecturePlan) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className={`max-w-2xl w-full rounded-xl shadow-2xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} transform transition-all`}>
                    <div className="p-6 border-b border-gray-300 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Learning Progress</h3>
                            <button
                                onClick={() => setShowProgressModal(false)} // Need setter from props
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                            >
                                <XIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">Overall Progress</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {topicsCompleted.size} of {totalTopics} topics
                                </span>
                            </div>
                            <div className="h-3 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${totalTopics > 0 ? (topicsCompleted.size / totalTopics) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {lecturePlan.impTopics?.map((topic, index) => {
                                const isCompleted = topicsCompleted.has(index);
                                const isCurrent = index === currentTopicIndex;
                                const progress = props.intelligenceEngine?.topicProgress?.[topic.id];

                                return (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-lg border cursor-pointer transition ${isCurrent
                                            ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                                            : isCompleted
                                                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                                                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                                            }`}
                                        onClick={() => props.jumpToTopic(index)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCurrent
                                                    ? 'bg-blue-500 text-white'
                                                    : isCompleted
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{topic.title}</p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                        <span>Importance: {topic.importance}</span>
                                                        {progress?.quizScore && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Quiz: {progress.quizScore}%</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {isCurrent && (
                                                    <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                                        Current
                                                    </div>
                                                )}
                                                {isCompleted && (
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-300 dark:border-gray-700">
                        <button
                            onClick={() => setShowProgressModal(false)}
                            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition font-semibold"
                        >
                            Continue Learning
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading && !currentSlideData) {
        return (
            <div className={`h-screen flex items-center justify-center ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'}`}>
                <div className="text-center max-w-md">
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                        <Brain className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-6">
                        {loadingMessage}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Preparing your intelligent learning experience...
                    </p>
                </div>
            </div>
        );
    }

    if (error && !currentSlideData) {
        return (
            <div className={`h-screen flex flex-col items-center justify-center ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} p-6`}>
                <div className={`text-center max-w-md p-6 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} rounded-xl shadow-lg`}>
                    <div className="text-red-500 text-4xl mb-4">⚠️</div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Learning Session Error
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        Restart Session
                    </button>
                </div>
            </div>
        );
    }

    // Sample questions 
    const sampleQuestions = [
        "Can you explain this concept with a real-world example?",
        "What are the most common mistakes when learning this?",
        "How does this relate to other concepts I've learned?",
        "What's the most important thing to remember about this?",
        "Can you break this down into simpler steps?"
    ];
    // Add topic specific if exists
    const currentTopic = props.intelligenceEngine?.enhancedTopics?.[currentTopicIndex];
    if (currentTopic?.questionSeeds) {
        sampleQuestions.unshift(...currentTopic.questionSeeds.slice(0, 3));
    }

    return (
        <div className={`h-screen ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} transition-colors flex flex-col overflow-hidden`}>
            {/* Header */}
            <Header />

            {/* Session Info Bar */}
            <div className={`h-12 flex-shrink-0 ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} border-b ${theme === 'light' ? 'border-gray-300' : 'border-gray-700'} flex items-center px-6`}>
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                            <BrainCircuit className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden md:block">Intelligent Learning AI</h1>
                    </div>

                    <div className="flex items-center gap-2 ml-6 overflow-x-auto no-scrollbar">
                        <div className={`px-3 py-1.5 rounded-md ${loadColor.lightBg} ${loadColor.text} border ${loadColor.border} text-sm font-semibold flex items-center gap-2 whitespace-nowrap`}>
                            <Brain className="w-4 h-4" />
                            <span className="hidden sm:inline">{cognitiveLoad.toUpperCase()} Cognitive Load</span>
                            <span className="sm:hidden">{cognitiveLoad.toUpperCase()}</span>
                        </div>

                        <div className={`px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-sm font-semibold flex items-center gap-2 whitespace-nowrap`}>
                            <Target className="w-4 h-4" />
                            <span className="hidden sm:inline">Goal: {studentGoal.toUpperCase()}</span>
                            <span className="sm:hidden">{studentGoal.toUpperCase()}</span>
                        </div>

                        {quizHistory.length > 0 && (
                            <div className={`px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-sm font-semibold flex items-center gap-2 whitespace-nowrap`}>
                                <BarChart className="w-4 h-4" />
                                <span className="hidden sm:inline">Quizzes: {quizHistory.length}</span>
                                <span className="sm:hidden">{quizHistory.length}</span>
                            </div>
                        )}

                        {misconceptions.length > 0 && (
                            <div className={`px-3 py-1.5 rounded-md bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 text-sm font-semibold flex items-center gap-2 whitespace-nowrap`}>
                                <AlertOctagon className="w-4 h-4" />
                                <span className="hidden sm:inline">Gaps: {misconceptions.length}</span>
                                <span className="sm:hidden">{misconceptions.length}</span>
                            </div>
                        )}

                        {/* Progress Button */}
                        <button
                            onClick={() => setShowProgressModal(true)}
                            className={`px-3 py-1.5 rounded-md ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-700 hover:bg-gray-600'} text-gray-700 dark:text-gray-300 border ${theme === 'light' ? 'border-gray-300' : 'border-gray-600'} text-sm font-semibold flex items-center gap-2 whitespace-nowrap`}
                        >
                            <PieChart className="w-4 h-4" />
                            <span className="hidden sm:inline">Progress: {topicsCompleted.size}/{totalTopics}</span>
                            <span className="sm:hidden">{topicsCompleted.size}/{totalTopics}</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRestartSession}
                        className={`p-2 lg:px-4 lg:py-2 rounded-lg ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'} flex items-center gap-2 text-sm font-semibold transition`}
                        title="Restart Session"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden lg:inline">Restart</span>
                    </button>

                    {/* Download button removed or needs props.handleDownloadPPT check */}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex min-h-0">
                {/* Slide Area */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex-1 p-6 flex items-center justify-center min-h-0 bg-gray-50 dark:bg-gray-900">
                        <div className={`w-full h-full max-w-6xl rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-gray-800'} shadow-xl flex flex-col border ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'} overflow-hidden`}>
                            {/* Simplified Slide Header just for context if needed, but SlideViewer manages content */}
                            <div className="flex-1 min-h-0 overflow-hidden relative">
                                <SlideViewer
                                    currentSlideData={currentSlideData}
                                    loading={loading}
                                    loadingMessage={loadingMessage}
                                    renderQuizResultsHeader={() => null} // Handled by QuizBoard usually, but if needed for slides
                                />
                            </div>
                        </div>
                    </div>

                    {/* Navigation Bar */}
                    <ControlBar
                        currentSlideIndex={currentSlideIndex}
                        currentSlideNumber={currentSlideNumber}
                        totalSlides={totalSlides}
                        slidesLength={slides.length}
                        loading={loading}
                        currentTopicIndex={currentTopicIndex}
                        totalTopics={totalTopics}
                        isPlaying={false} // State needed
                        setIsPlaying={() => { }} // State needed
                        handlePreviousSlide={props.handlePreviousSlide}
                        handleNextSlide={props.handleNextSlide}
                        jumpToTopic={props.jumpToTopic}
                        theme={theme}
                    />
                </div>

                {/* Side Panel */}
                <SidePanel
                    activeView={activeView}
                    theme={theme}
                    cognitiveLoad={cognitiveLoad}
                    studentGoal={studentGoal}
                    handleTakeQuiz={props.handleTakeQuiz}
                    handleExplainMore={props.handleExplainMore}
                    setActiveView={props.setActiveView}
                    setShowProgressModal={setShowProgressModal}
                    handleClosePane={() => props.setActiveView(null)}

                    // Quiz
                    quizData={props.quizData}
                    quizCompleted={props.quizCompleted}
                    currentQuestionIndex={props.currentQuestionIndex}
                    getAdaptiveQuizDifficulty={() => 'medium'} // TODO: Expose from hook or pass
                    handleAnswerSelect={props.handleAnswerSelect || props.handleQuizAnswer} // Hook called it handleQuizAnswer
                    selectedAnswer={props.selectedAnswer}
                    handleSubmitAnswer={() => props.handleNextQuestion && props.handleNextQuestion()} // Wait, hook needs careful mapping. 
                    // In hook I exposed handleQuizAnswer. I need to make sure SidePanel gets what it needs.
                    handleNextQuestion={() => { }} // TODO: Hook check
                    handleRestartQuiz={() => { }} // TODO: Hook check
                    quizScore={props.quizScore}

                    // Ask
                    sampleQuestions={sampleQuestions}
                    handleAskQuestion={props.handleAskQuestion}
                    userQuestion={props.userQuestion}
                    setUserQuestion={props.setUserQuestion}
                    handleSubmitQuestion={() => props.handleAskQuestion(props.userQuestion)}

                    // Adaptive
                    currentTopic={currentTopic}
                    currentTopicIndex={currentTopicIndex}
                    totalTopics={totalTopics}
                    topicsCompleted={topicsCompleted}
                    misconceptions={misconceptions}
                    adaptiveSuggestions={props.adaptiveSuggestions}
                />
            </div>

            {renderProgressModal()}
        </div>
    );
}
