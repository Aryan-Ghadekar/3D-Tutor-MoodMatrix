"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../theme-provider";
import { Brain, ArrowRight, Sparkles } from "lucide-react";

export default function LectureInputPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const [lectureTopic, setLectureTopic] = useState("");
    const isLight = theme === "light";

    const handleProceed = (e) => {
        e.preventDefault();
        if (lectureTopic.trim()) {
            router.push(`/study-session?topic=${encodeURIComponent(lectureTopic.trim())}`);
        }
    };

    return (
        <div
            className={`min-h-[calc(100-80px)] flex flex-col items-center justify-center p-6 transition-colors duration-500
      ${isLight
                    ? "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-gray-900"
                    : "bg-gradient-to-br from-[#0B1220] via-[#0E1628] to-[#0A1020] text-white"
                }`}
        >
            <div className={`w-full max-w-xl p-8 rounded-3xl backdrop-blur-xl border transition-all duration-300 transform hover:scale-[1.01]
        ${isLight
                    ? "bg-white/70 border-white/50 shadow-2xl"
                    : "bg-gray-900/40 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.3)]"
                }`}
            >
                <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg animate-pulse">
                        <Brain className="w-10 h-10 text-white" />
                    </div>
                    <h2 className={`text-4xl font-bold mb-3 ${isLight ? "text-gray-900" : "text-white"}`}>
                        Ready to learn?
                    </h2>
                    <p className={`${isLight ? "text-gray-600" : "text-gray-400"} text-lg max-w-md`}>
                        Enter your lecture topic or paste a URL to start your AI-powered study session.
                    </p>
                </div>

                <form onSubmit={handleProceed} className="space-y-6">
                    <div className="relative group">
                        <input
                            type="text"
                            value={lectureTopic}
                            onChange={(e) => setLectureTopic(e.target.value)}
                            placeholder="e.g., Introduction to Neural Networks"
                            className={`w-full px-6 py-5 rounded-2xl text-lg outline-none transition-all duration-300 border
                ${isLight
                                    ? "bg-white border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900"
                                    : "bg-gray-800/50 border-gray-700 focus:border-purple-500 focus:ring-4 focus:ring-purple-900/20 text-white placeholder-gray-500"
                                }`}
                            required
                        />
                        {lectureTopic && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-blue-500 animate-in fade-in slide-in-from-right-2">
                                <Sparkles className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={!lectureTopic.trim()}
                        className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-bold text-xl shadow-xl transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
            ${isLight
                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-blue-200"
                                : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-purple-900/30"
                            }`}
                    >
                        Generate Study Session
                        <ArrowRight className="w-6 h-6" />
                    </button>
                </form>

                <div className="mt-8 flex justify-center gap-6">
                    <div className={`flex items-center gap-2 text-sm ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        AI Ready
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        Real-time Insights
                    </div>
                </div>
            </div>
        </div>
    );
}
