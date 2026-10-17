import { useEffect, useRef, useState } from 'react';
import { classroomApi, STUDENT_KEY, readJson } from '@/lib/classroomApi';

const HEARTBEAT_MS = 3000;

/**
 * Connects a study session to a live class:
 *  - reports the student's cognitive-load score every few seconds (the teacher only sees aggregates)
 *  - follows the topic the teacher selects
 *  - when the teacher pauses the class, starts the quick quiz or the simplified (avatar) explanation,
 *    using the last minutes of the teacher's audio as context, and reports the quiz score back
 *
 * @param {object} session the object returned by useStudySession
 * @param {string|null} code class code from the URL (null = not in a class)
 */
export function useClassroomStudent(session, code) {
  const [membership, setMembership] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [transcript, setTranscript] = useState('');

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const handled = useRef({ topicIndex: null, pauseId: 0, reportedPauseId: 0 });
  const stateRef = useRef(null);

  // Read the join details saved by the /join page
  useEffect(() => {
    if (!code) return;
    const saved = readJson(STUDENT_KEY);
    if (saved && saved.code === code.toUpperCase() && saved.studentId) setMembership(saved);
    else setError('You have not joined this class yet. Join with the class code first.');
  }, [code]);

  // Heartbeat: report load, receive the class state
  useEffect(() => {
    if (!membership) return undefined;
    let cancelled = false;

    const beat = async () => {
      const s = sessionRef.current;
      try {
        const res = await classroomApi.heartbeat(membership.code, {
          studentId: membership.studentId,
          load: s.loadScore ?? 35,
          level: s.cognitiveLoad || 'medium',
          signals: { behavior: Math.round(s.behaviorScore ?? 0) },
        });
        if (cancelled) return;
        stateRef.current = res.state;
        setState(res.state);
        setTranscript(res.recentTranscript || '');
        setConnected(true);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setConnected(false);
        setError(e.status === 404 ? 'The class no longer exists or you were removed from it.' : e.message);
      }
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [membership]);

  const ready = !!session.intelligenceEngine && !session.loading;

  // Follow the teacher's topic
  useEffect(() => {
    if (!state || !ready || state.ended) return;
    if (handled.current.topicIndex === state.topicIndex) return;
    const first = handled.current.topicIndex === null;
    handled.current.topicIndex = state.topicIndex;
    // The first slide of the session is already topic 0
    if (!(first && state.topicIndex === 0)) sessionRef.current.jumpToTopic(state.topicIndex);
  }, [state, ready]);

  // React to a new pause
  useEffect(() => {
    if (!state?.paused || !ready || state.pauseId === handled.current.pauseId) return;
    handled.current.pauseId = state.pauseId;
    const s = sessionRef.current;
    if (state.pauseMode === 'quiz') s.handleTakeQuiz(transcript);
    else if (state.pauseMode === 'avatar') s.handleSimplifiedExplanation(transcript);
  }, [state, ready, transcript]);

  // Report the pause-quiz score once
  useEffect(() => {
    if (!membership || !state?.paused || state.pauseMode !== 'quiz') return;
    if (session.quizCompleted && typeof session.quizScore === 'number' && handled.current.reportedPauseId !== state.pauseId) {
      handled.current.reportedPauseId = state.pauseId;
      classroomApi.result(membership.code, {
        studentId: membership.studentId, score: session.quizScore, pauseId: state.pauseId, topicIndex: state.topicIndex,
      }).catch(() => { /* the next quiz will report again; losing one score is harmless */ });
    }
  }, [membership, state, session.quizCompleted, session.quizScore]);

  return {
    inClass: !!code,
    joined: !!membership,
    code: membership?.code || code?.toUpperCase() || null,
    connected,
    error,
    paused: !!state?.paused,
    pauseMode: state?.pauseMode || null,
    ended: !!state?.ended,
    teacherName: state?.teacherName || null,
    topicIndex: state?.topicIndex ?? null,
    recentTranscript: transcript,
  };
}
