"use client";
import { useTheme } from "./theme-provider";
import { Brain, Play, Settings, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";

export default function HomePage() {
  const { theme } = useTheme();
  const router = useRouter();
  const isLight = theme === "light";

  const handleStartStudySession = () => {
    router.push("/lecture-input");
  };

  const handleConnectDevices = () => {
    console.log("Connect devices clicked");
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-500
      ${isLight
          ? "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-gray-900"
          : "bg-gradient-to-br from-[#0B1220] via-[#0E1628] to-[#0A1020] text-white"
        }`}
    >
      <Header />
      {/* ================= HERO SECTION ================= */}
      <section className="flex flex-col items-center text-center pt-28 px-6">
        <h1
          className={`text-6xl font-extrabold mb-6
          ${isLight
              ? "bg-gradient-to-r from-blue-600 to-purple-600"
              : "bg-gradient-to-r from-blue-400 to-purple-500"
            } bg-clip-text text-transparent`}
        >
          MoodMatrix
        </h1>

        <p className={`text-lg max-w-2xl leading-relaxed mb-10
          ${isLight ? "text-gray-600" : "text-gray-300"}`}
        >
          Transform your learning experience with AI-powered emotional
          intelligence, real-time feedback, and personalized study optimization.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-5 mb-14">
          <button
            onClick={handleStartStudySession}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold shadow-lg transition-transform transform hover:scale-105 active:scale-95
            ${isLight
                ? "bg-gradient-to-r from-purple-400 via-blue-500 to-indigo-500 text-white"
                : "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
              }`}
          >
            <Play className="w-5 h-5" />
            Start Study Session
          </button>

          <button
            onClick={handleConnectDevices}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold shadow-md transition-all hover:bg-gray-100 active:scale-95
            ${isLight
                ? "bg-white border border-gray-200 text-gray-800 hover:shadow-lg"
                : "bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 hover:shadow-lg"
              }`}
          >
            <Settings className="w-5 h-5" />
            Connect Devices
          </button>
        </div>
      </section>

      {/* ================= FEATURE CARDS ================= */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Card 1 */}
          <div
            className={`rounded-3xl p-10 transition-shadow shadow-lg hover:shadow-xl border cursor-pointer hover:scale-[1.02] transition-transform
            ${isLight
                ? "bg-white border-gray-200"
                : "bg-gray-900/80 border-gray-800"
              }`}
            onClick={handleStartStudySession}
          >
            <div className="w-16 h-16 mb-6 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
              <Brain className="w-7 h-7 text-white" />
            </div>

            <h3 className="text-2xl font-semibold mb-3">
              AI-Powered Analysis
            </h3>

            <p className={isLight ? "text-gray-600" : "text-gray-400"}>
              Advanced emotional intelligence monitoring for optimal learning states.
            </p>
          </div>

          {/* Card 2 */}
          <div
            className={`rounded-3xl p-10 transition-shadow shadow-lg hover:shadow-xl border cursor-pointer hover:scale-[1.02] transition-transform
            ${isLight
                ? "bg-white border-gray-200"
                : "bg-gray-900/80 border-gray-800"
              }`}
            onClick={handleStartStudySession}
          >
            <div className="w-16 h-16 mb-6 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>

            <h3 className="text-2xl font-semibold mb-3">
              Real-Time Insights
            </h3>

            <p className={isLight ? "text-gray-600" : "text-gray-400"}>
              Live feedback on focus, posture, and attention levels during study sessions.
            </p>
          </div>
        </div>
      </section>

      <div className="h-32" />

      {/* Floating Button */}
      <div
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 transition-transform active:scale-95"
        onClick={handleStartStudySession}
      >
        <Brain className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}