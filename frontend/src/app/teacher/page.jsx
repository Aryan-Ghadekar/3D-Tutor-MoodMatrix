"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Brain, Copy, Download, Mic, MicOff, Pause, Play, Presentation, Users, XCircle, HelpCircle } from "lucide-react";
import Header from "../../components/Header";
import { classroomApi, TEACHER_KEY, readJson } from "@/lib/classroomApi";
import { useLectureAudio } from "@/hooks/useLectureAudio";
import { buildClassReport, downloadFile, safeFilename } from "@/lib/notes";

const LEVEL_STYLES = {
  low: { bar: "bg-green-500", text: "text-green-600 dark:text-green-400", label: "Comfortable" },
  medium: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Engaged" },
  high: { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "Overloaded" },
};

const levelOf = (score) => (score >= 65 ? "high" : score <= 35 ? "low" : "medium");

function Sparkline({ points }) {
  if (!points.length) {
    return <div className="h-24 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">Waiting for students...</div>;
  }
  const w = 300, h = 90;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" role="img" aria-label="Average class load over time">
      <line x1="0" x2={w} y1={h - 0.65 * h} y2={h - 0.65 * h} stroke="currentColor" strokeDasharray="4 4" className="text-red-300" />
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ icon: Icon, label, value, testId }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid={testId}>{value}</div>
    </div>
  );
}

export default function TeacherPage() {
  const [phase, setPhase] = useState("checking"); // checking | forbidden | setup | live
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(null);
  const [cls, setCls] = useState(null);           // { code, token }
  const [dash, setDash] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const audio = useLectureAudio({ code: cls?.code, token: cls?.token });

  // Who is this, and is a class already running?
  useEffect(() => {
    (async () => {
      try {
        const me = await (await fetch("/api/auth/me")).json();
        setUser(me.user);
        if (me.user?.role !== "teacher") return setPhase("forbidden");
      } catch {
        return setPhase("forbidden");
      }
      const lecture = readJson("lectureData");
      setPlan(lecture?.lecturePlan || null);
      const saved = readJson(TEACHER_KEY);
      if (saved?.code && saved?.token) {
        try {
          await classroomApi.dashboard(saved.code, saved.token);
          setCls(saved);
          return setPhase("live");
        } catch {
          localStorage.removeItem(TEACHER_KEY);
        }
      }
      setPhase("setup");
    })();
  }, []);

  const startClass = async () => {
    setBusy(true);
    setError("");
    try {
      const created = await classroomApi.create(plan, user?.name);
      const next = { code: created.code, token: created.teacherToken };
      localStorage.setItem(TEACHER_KEY, JSON.stringify(next));
      setCls(next);
      setPhase("live");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Poll the dashboard while live
  useEffect(() => {
    if (phase !== "live" || !cls) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const d = await classroomApi.dashboard(cls.code, cls.token);
        if (!cancelled) { setDash(d); setError(""); }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [phase, cls]);

  const control = useCallback(async (body) => {
    setError("");
    try {
      await classroomApi.control(cls.code, cls.token, body);
      setDash(await classroomApi.dashboard(cls.code, cls.token));
    } catch (e) {
      setError(e.message);
    }
  }, [cls]);

  const endClass = async () => {
    if (!window.confirm("End the class for everyone?")) return;
    audio.stop();
    try {
      await classroomApi.end(cls.code, cls.token);
      const final = await classroomApi.dashboard(cls.code, cls.token);
      downloadFile(`class-report-${safeFilename(final.lectureTopic)}.md`, buildClassReport(final));
    } catch (e) {
      setError(e.message);
      return;
    }
    localStorage.removeItem(TEACHER_KEY);
    setCls(null);
    setDash(null);
    setPhase("setup");
  };

  const downloadReport = () => dash && downloadFile(`class-report-${safeFilename(dash.lectureTopic)}.md`, buildClassReport(dash));

  const joinUrl = typeof window !== "undefined" && cls ? `${window.location.origin}/join` : "/join";
  const copy = async () => {
    await navigator.clipboard?.writeText(`${joinUrl} (code ${cls.code})`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ------------------------------------------------------------------ render
  const shell = (children) => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  );

  if (phase === "checking") return shell(<p className="text-gray-600 dark:text-gray-400">Loading...</p>);

  if (phase === "forbidden") {
    return shell(
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <Presentation className="w-10 h-10 mx-auto text-purple-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Teacher access only</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {user ? "You are signed in as a student." : "Sign in with a teacher account to run a live class."}
        </p>
        <Link href="/auth/login" className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium">
          {user ? "Switch account" : "Sign in as teacher"}
        </Link>
      </div>
    );
  }

  if (phase === "setup") {
    return shell(
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Start a live class</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Students join with a code and study your lecture while you watch the class&apos;s combined cognitive load.
        </p>
        {error && <div role="alert" className="mb-4 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">{error}</div>}
        {plan ? (
          <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Lecture</div>
            <div className="font-semibold text-gray-900 dark:text-white" data-testid="setup-lecture">{plan.topic}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{plan.impTopics?.length} topics</div>
          </div>
        ) : (
          <p className="mb-6 text-sm text-amber-700 dark:text-amber-300">You have not uploaded a lecture yet.</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={startClass}
            disabled={!plan || busy}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Starting..." : "Start class"}
          </button>
          <Link href="/lecture-input" className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            {plan ? "Upload a different lecture" : "Upload a lecture"}
          </Link>
        </div>
      </div>
    );
  }

  // ---- live
  const agg = dash?.aggregate;
  const state = dash?.state;
  const history = dash?.history || [];
  const level = agg?.active ? levelOf(agg.averageLoad) : "medium";
  const styles = LEVEL_STYLES[level];
  const total = Math.max(agg?.active || 0, 1);
  const lastPause = Object.entries(dash?.quizResults || {}).slice(-1)[0];

  return shell(
    <div className="space-y-6">
      {/* header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Live class - {dash?.lectureTopic || "..."}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-4xl font-mono font-bold tracking-[0.25em] text-gray-900 dark:text-white" data-testid="class-code">{cls.code}</span>
            <button onClick={copy} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300" title="Copy join details">
              <Copy className="w-4 h-4" />
            </button>
            {copied && <span className="text-sm text-green-600">Copied</span>}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Students open <span className="font-mono">{joinUrl}</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadReport} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Report
          </button>
          <button onClick={endClass} className="px-4 py-2 rounded-lg bg-red-600 text-white flex items-center gap-2 text-sm">
            <XCircle className="w-4 h-4" /> End class
          </button>
        </div>
      </div>

      {error && <div role="alert" className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">{error}</div>}

      {agg?.overloaded && (
        <div data-testid="overload-alert" className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/30 dark:border-red-800 p-4 text-red-800 dark:text-red-200">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <div className="font-semibold">The class looks overloaded</div>
            <div className="text-sm">{agg.levels.high} of {agg.active} students are in high cognitive load. Consider pausing for a quick quiz or an avatar explanation.</div>
          </div>
        </div>
      )}

      {state?.paused && (
        <div data-testid="paused-banner" className="rounded-xl border border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800 p-4 text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
          <span>Class paused: students are doing a {state.pauseMode === "quiz" ? "quick quiz" : "simplified avatar explanation"}.</span>
          {lastPause && state.pauseMode === "quiz" && <span className="text-sm">{lastPause[1].responses} responses, average {Math.round(lastPause[1].averageScore)}%</span>}
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Users} label="Joined" value={agg?.joined ?? 0} testId="stat-joined" />
        <Stat icon={Users} label="Active now" value={agg?.active ?? 0} testId="stat-active" />
        <Stat icon={Brain} label="Average load" value={agg?.active ? `${Math.round(agg.averageLoad)}%` : "-"} testId="stat-avg" />
        <Stat icon={HelpCircle} label="Last quiz avg" value={lastPause ? `${Math.round(lastPause[1].averageScore)}%` : "-"} testId="stat-quiz" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* load */}
        <section className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">Class cognitive load</h2>
            <span className={`text-sm font-medium ${styles.text}`} data-testid="class-level">{agg?.active ? styles.label : "No active students"}</span>
          </div>
          <Sparkline points={history.map((h) => h.averageLoad)} />
          <div className="mt-4 space-y-2">
            {["low", "medium", "high"].map((lvl) => (
              <div key={lvl} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-gray-600 dark:text-gray-400">{LEVEL_STYLES[lvl].label}</span>
                <div className="flex-1 h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full ${LEVEL_STYLES[lvl].bar}`} style={{ width: `${((agg?.levels?.[lvl] || 0) / total) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-gray-900 dark:text-white" data-testid={`level-${lvl}`}>{agg?.levels?.[lvl] || 0}</span>
              </div>
            ))}
          </div>
        </section>

        {/* controls */}
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Classroom controls</h2>
          {state?.paused ? (
            <button data-testid="btn-resume" onClick={() => control({ action: "resume" })} className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold flex items-center justify-center gap-2">
              <Play className="w-4 h-4" /> Resume lecture
            </button>
          ) : (
            <>
              <button data-testid="btn-pause-quiz" onClick={() => control({ action: "pause", mode: "quiz" })} className="w-full py-3 rounded-lg bg-amber-500 text-white font-semibold flex items-center justify-center gap-2">
                <Pause className="w-4 h-4" /> Pause and quiz
              </button>
              <button data-testid="btn-pause-avatar" onClick={() => control({ action: "pause", mode: "avatar" })} className="w-full py-3 rounded-lg bg-purple-600 text-white font-semibold flex items-center justify-center gap-2">
                <Pause className="w-4 h-4" /> Pause and explain with avatar
              </button>
            </>
          )}

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">Lecture audio context</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Captures what you say (speech-to-text in your browser) so quizzes and explanations can use the last 2-3 minutes.
            </p>
            {audio.supported ? (
              <button
                data-testid="btn-audio"
                onClick={audio.listening ? audio.stop : audio.start}
                className={`w-full py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${audio.listening ? "border-red-400 text-red-600" : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"}`}
              >
                {audio.listening ? <><MicOff className="w-4 h-4" /> Stop capturing</> : <><Mic className="w-4 h-4" /> Capture lecture audio</>}
              </button>
            ) : (
              <p className="text-xs text-amber-600">Speech recognition is not supported in this browser (use Chrome or Edge).</p>
            )}
            {audio.error && <p className="text-xs text-red-600 mt-1">{audio.error}</p>}
            {dash?.recentTranscript && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto" data-testid="transcript">{dash.recentTranscript}</p>
            )}
          </div>
        </section>
      </div>

      {/* topics */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Current topic</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {(dash?.topics || []).map((title, i) => (
            <button
              key={i}
              data-testid={`topic-${i}`}
              onClick={() => control({ action: "set_topic", topicIndex: i })}
              className={`text-left px-4 py-3 rounded-lg border text-sm transition ${
                state?.topicIndex === i
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-medium"
                  : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300"
              }`}
            >
              {i + 1}. {title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
