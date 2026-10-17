import { useCallback, useEffect, useRef, useState } from 'react';

const ERRORS = {
  'not-allowed': 'Microphone permission was denied.',
  'service-not-allowed': 'Microphone permission was denied.',
  'no-speech': 'I did not hear anything. Try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection.',
};

/** Speech-to-text with the Web Speech API (Chrome / Edge / Safari). */
export function useVoiceInput({ onFinalText, lang = 'en-US' } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onFinalText);
  callbackRef.current = onFinalText;

  const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supported = !!Recognition;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Recognition || recognitionRef.current) return;
    setError(null);
    setInterim('');

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const { transcript } = event.results[i][0];
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) callbackRef.current?.(finalText.trim());
    };
    recognition.onerror = (event) => setError(ERRORS[event.error] || `Voice input failed (${event.error}).`);
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      recognitionRef.current = null;
      setError('Could not start voice input.');
    }
  }, [Recognition, lang]);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  return { supported, listening, interim, error, start, stop };
}
