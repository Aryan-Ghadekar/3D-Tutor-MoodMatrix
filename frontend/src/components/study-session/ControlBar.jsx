
import React from 'react';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Play, Pause } from 'lucide-react';

export default function ControlBar({
    currentSlideIndex,
    currentSlideNumber,
    totalSlides,
    slidesLength,
    loading,
    currentTopicIndex,
    totalTopics,
    isPlaying,
    setIsPlaying,
    handlePreviousSlide,
    handleNextSlide,
    jumpToTopic,
    theme // Passed for explicit styling if needed, though Tailwind dark mode classes handle most
}) {
    return (
        <div className="h-16 flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={handlePreviousSlide}
                    disabled={currentSlideIndex === 0}
                    className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${currentSlideIndex === 0
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-400 dark:border-gray-600'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200 border-gray-400 dark:border-gray-600'
                        }`}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </button>

                <div className="px-4 py-2 rounded-lg border bg-gray-100 border-gray-400 dark:bg-gray-700 dark:border-gray-600">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Slide </span>
                    <span className="text-base font-bold text-gray-900 dark:text-white mx-1">{currentSlideNumber}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">of {Math.max(totalSlides, 1)}</span>
                </div>

                <button
                    onClick={handleNextSlide}
                    disabled={loading}
                    className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${loading
                        ? 'opacity-50 cursor-not-allowed'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200 border-gray-400 dark:border-gray-600'
                        }`}
                >
                    {currentSlideIndex >= slidesLength - 1 ? 'Next Topic' : 'Next Slide'}
                    <ChevronRight className="w-4 h-4" />
                </button>

                {/* Topic Navigation */}
                {totalTopics > 1 && (
                    <div className="flex items-center gap-2 ml-4">
                        <button
                            onClick={() => jumpToTopic(Math.max(0, currentTopicIndex - 1))}
                            disabled={currentTopicIndex === 0}
                            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Previous Topic"
                        >
                            <SkipBack className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                            Topic {currentTopicIndex + 1}/{totalTopics}
                        </span>
                        <button
                            onClick={() => jumpToTopic(Math.min(totalTopics - 1, currentTopicIndex + 1))}
                            disabled={currentTopicIndex === totalTopics - 1}
                            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Next Topic"
                        >
                            <SkipForward className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${isPlaying
                        ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                        : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-300 border-blue-400 dark:border-blue-700'
                        }`}
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? "Pause" : "Play"}
                </button>
            </div>
        </div>
    );
}
