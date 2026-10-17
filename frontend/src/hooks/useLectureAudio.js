import { useCallback, useEffect, useRef, useState } from 'react';
import { classroomApi } from '@/lib/classroomApi';

/**
 * Teacher-side capture of the live lecture audio with the Web Speech API. Recognised sentences are sent to
 * the class so a pause quiz / explanation can use "what the teacher just said" as context.
 * Audio itself never leaves the browser's speech engine; only the recognised text is sent.
 */
export function useLectureAudio({ code, token }) {
  const [listening, setListening] = useState(false);
  const [lastText, setLastText] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const wantedRef = useRef(false);
  const creds = useRef({ code, token });
  creds.current = { code, token };

  const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supported = !!Recognition;

  const stop = useCallback(() => {
    wantedRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Recognition || recognitionRef.current) return;
    wantedRef.current = true;
    setError(null);

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;
        setLastText(text);
        classroomApi.transcript(creds.current.code, creds.current.token, text).catch(() => {});
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : `Audio capture failed (${event.error}).`);
      wantedRef.current = false;
    };
    // The engine stops itself after silence; restart while the teacher still wants capture on
    recognition.onend = () => {
      recognitionRef.current = null;
      if (wantedRef.current) setTimeout(start, 300);
      else setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError('Could not start audio capture.');
    }
  }, [Recognition]);

  useEffect(() => () => { wantedRef.current = false; recognitionRef.current?.abort?.(); }, []);

  return { supported, listening, lastText, error, start, stop };
}
