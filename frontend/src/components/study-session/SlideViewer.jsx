
import React from 'react';
import {
    AlertTriangle, Lightbulb, Trophy, ImageIcon, Target,
    ClipboardCheck, Hand, Brain
} from 'lucide-react';

export default function SlideViewer({
    currentSlideData,
    loading,
    loadingMessage,
    renderQuizResultsHeader
}) {
    if (loading && !currentSlideData) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <Brain className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">{loadingMessage}</p>
            </div>
        );
    }

    if (!currentSlideData) return null;

    const slideContent = currentSlideData.content || {};
    const isActionResponse = currentSlideData.metadata?.actionType;
    const isQuizResults = currentSlideData.type === 'quiz-results';
    const hasImages = currentSlideData.images && currentSlideData.images.length > 0;
    const isEmergency = currentSlideData.metadata?.isEmergency;

    const renderImageSection = (images) => {
        return (
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Visual Learning Aids
                    </h2>
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                        {images.length} image{images.length > 1 ? 's' : ''}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {images.map((image, index) => (
                        <div
                            key={image.id || `img-${index}`}
                            className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                        >
                            <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 overflow-hidden">
                                <img
                                    src={image.url}
                                    alt={image.alt || `Educational diagram ${index + 1}`}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                />
                            </div>
                            <div className="p-3">
                                {image.caption && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {image.caption}
                                    </p>
                                )}
                                {image.source && image.source !== 'placeholder' && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        Source: {image.source}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {/* Emergency/Status Banner */}
            {isEmergency && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                            Using enhanced learning system
                        </span>
                    </div>
                </div>
            )}

            {isActionResponse && !isQuizResults && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                            Intelligent Response: {isActionResponse.replace('-', ' ')}
                        </span>
                    </div>
                </div>
            )}

            {isQuizResults && renderQuizResultsHeader && renderQuizResultsHeader()}

            {/* Main Slide Content */}
            {!isQuizResults && (
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    {currentSlideData.title}
                </h1>
            )}

            {/* Images Section */}
            {hasImages && renderImageSection(currentSlideData.images)}

            {/* Narrative Section */}
            {slideContent.narrative && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b pb-2 dark:border-gray-700">
                        Learning Narrative
                    </h2>
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                            {slideContent.narrative}
                        </p>
                    </div>
                </div>
            )}

            {/* Key Insights */}
            {slideContent.keyInsights && slideContent.keyInsights.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Key Insights
                    </h2>
                    <ul className="space-y-3">
                        {slideContent.keyInsights.map((point, index) => (
                            <li key={index} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                <span className="text-gray-700 dark:text-gray-300">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Analogies */}
            {slideContent.analogies && slideContent.analogies.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Learning Analogies
                    </h2>
                    <div className="space-y-4">
                        {slideContent.analogies.map((analogy, index) => (
                            <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-5 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm transition-transform hover:scale-[1.01]">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
                                        <span className="text-xs font-bold text-white">{index + 1}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200">{analogy.domain}</h3>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 mb-3 ml-11">{analogy.comparison}</p>
                                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 ml-11">
                                    <Lightbulb className="w-4 h-4" />
                                    <span className="font-medium">Lesson: {analogy.lesson}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Real World Scenario */}
            {slideContent.realWorldScenario && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Real-World Application
                    </h2>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-5 rounded-lg border border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Scenario</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-4 pl-7">{slideContent.realWorldScenario.situation}</p>

                        <div className="flex items-center gap-2 mb-2">
                            <ClipboardCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Application</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-4 pl-7">{slideContent.realWorldScenario.application}</p>

                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Outcome</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 pl-7">{slideContent.realWorldScenario.outcome}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Interactive Element */}
                {slideContent.interactiveElement && (
                    <div className="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <Hand className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            <h3 className="font-semibold text-amber-700 dark:text-amber-300">Think & Engage</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 flex-grow">{slideContent.interactiveElement}</p>
                    </div>
                )}

                {/* Exam Relevance */}
                {slideContent.examRelevance && (
                    <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="font-semibold text-blue-700 dark:text-blue-300">Exam Relevance</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 flex-grow">{slideContent.examRelevance}</p>
                    </div>
                )}
            </div>

            {/* Common Traps */}
            {slideContent.commonTraps && slideContent.commonTraps.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Common Pitfalls to Avoid
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {slideContent.commonTraps.map((trap, index) => (
                            <div key={index} className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-700 dark:text-gray-300 font-medium">{trap}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Memory Hook */}
            {slideContent.memoryHook && (
                <div className="mt-8 p-5 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg border border-purple-300 dark:border-purple-600 shadow-md">
                    <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        <h3 className="text-lg font-bold text-purple-700 dark:text-purple-300">Memory Technique</h3>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 text-lg font-medium text-center py-2">{slideContent.memoryHook}</p>
                </div>
            )}

            {/* Lecture passages the answer was based on (retrieval) */}
            {currentSlideData.metadata?.sources?.length > 0 && (
                <details className="mt-6 text-sm" data-testid="slide-sources">
                    <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300">
                        Based on {currentSlideData.metadata.sources.length} passage{currentSlideData.metadata.sources.length > 1 ? 's' : ''} from the lecture
                    </summary>
                    <ul className="mt-2 space-y-2">
                        {currentSlideData.metadata.sources.map((source, index) => (
                            <li key={source.id || index} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-2">{source.kind}</span>
                                {source.snippet}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
