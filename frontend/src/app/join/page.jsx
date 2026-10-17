"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ArrowRight } from "lucide-react";
import Header from "../../components/Header";
import { classroomApi, STUDENT_KEY } from "@/lib/classroomApi";

export default function JoinClassPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill the name for signed-in students
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => d.user && setName(d.user.name)).catch(() => {});
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalized = code.trim().toUpperCase();
      const joined = await classroomApi.join(normalized, name.trim() || "Student");

      // Use the teacher's lecture directly: no upload or knowledge test needed
      const plan = joined.plan;
      localStorage.setItem("lectureData", JSON.stringify({
        content: "Live class", lecturePlan: plan, videoUrl: null, files: [],
        timestamp: new Date().toISOString(), sessionId: plan.sessionId,
      }));
      localStorage.setItem(STUDENT_KEY, JSON.stringify({ code: normalized, studentId: joined.studentId, name: name.trim() || "Student" }));

      const goal = localStorage.getItem("learning_goal") || "gate";
      router.push(`/study-session?sessionId=${plan.sessionId}&classroom=${normalized}&goal=${goal}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      <main className="max-w-md mx-auto px-6 pt-20">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-5">
            <Users className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Join a live class</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Enter the code your teacher shows on the board. Your teacher only sees the class&apos;s combined
            cognitive-load level, never your camera or answers.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            {error && (
              <div role="alert" className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class code</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                required
                autoComplete="off"
                placeholder="ABC234"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xl tracking-[0.3em] text-center font-mono"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your name (optional)</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.trim().length < 6}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Joining..." : (<>Join class <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
