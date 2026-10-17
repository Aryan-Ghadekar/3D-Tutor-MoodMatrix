import { useCallback, useEffect, useRef, useState } from 'react';
import { splitIntoChunks, estimateSpeechMs } from '@/lib/speech/script';

const START_TIMEOUT_MS = 1500;   // if the browser never starts speaking, fall back to a timed simulation
const PULSE_INTERVAL_MS = 180;

function pickVoice(voices) {
  return (
    voices.find((v) => /en[-_](GB|US|IN|AU)/i.test(v.lang) && /natural|google|microsoft/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null
  );
}

/**
 * Text-to-speech with a mouth-level signal for the avatar.
 *
 * `levelRef.current` (0-1) pulses on every spoken word so the avatar can animate without re-rendering.
 * When the browser has no speech voices the speech is simulated with timers, so the avatar and the
 * captions still play at a natural pace (just silently).
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState('');
  const [silent, setSilent] = useState(false);       // true when speech is being simulated
  const levelRef = useRef(0);
  const session = useRef(0);                         // increments to cancel in-flight playback
  const timers = useRef([]);
  const keepAlive = useRef([]);                      // utterances must stay referenced or Chrome may drop their events

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  const cancel = useCallback(() => {
    session.current += 1;
    clearTimers();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    levelRef.current = 0;
    setSpeaking(false);
    setCaption('');
  }, []);

  const speak = useCallback((text, { rate = 1 } = {}) => {
    const chunks = splitIntoChunks(text);
    if (!chunks.length) return;

    cancel();
    const id = session.current;
    const alive = () => session.current === id;
    setSpeaking(true);

    const finish = () => {
      if (!alive()) return;
      clearTimers();
      levelRef.current = 0;
      setSpeaking(false);
      setCaption('');
    };

    const pulse = () => { levelRef.current = 0.45 + Math.random() * 0.55; };
    const decay = setInterval(() => { levelRef.current *= 0.6; }, 60);
    timers.current.push(decay);

    // Simulated playback: pulses at a speaking cadence for the estimated duration of each chunk
    const simulate = (index) => {
      if (!alive()) return;
      if (index >= chunks.length) return finish();
      setCaption(chunks[index]);
      setSilent(true);
      const duration = estimateSpeechMs(chunks[index], rate);
      const ticker = setInterval(pulse, PULSE_INTERVAL_MS);
      timers.current.push(ticker);
      timers.current.push(setTimeout(() => {
        clearInterval(ticker);
        simulate(index + 1);
      }, duration));
    };

    if (!supported) return simulate(0);

    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (!voice) return simulate(0);   // no voices installed (e.g. headless browsers)

    const play = (index) => {
      if (!alive()) return;
      if (index >= chunks.length) return finish();

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      keepAlive.current = [utterance];

      let started = false;
      const watchdog = setTimeout(() => {
        // The engine never started: stop it and fall back so the lesson is not stuck
        if (!started && alive()) {
          window.speechSynthesis.cancel();
          simulate(index);
        }
      }, START_TIMEOUT_MS);
      timers.current.push(watchdog);

      utterance.onstart = () => { started = true; clearTimeout(watchdog); setSilent(false); setCaption(chunks[index]); pulse(); };
      utterance.onboundary = () => pulse();
      utterance.onend = () => { clearTimeout(watchdog); play(index + 1); };
      utterance.onerror = (e) => {
        clearTimeout(watchdog);
        if (e.error === 'canceled' || e.error === 'interrupted') return;
        play(index + 1);
      };
      window.speechSynthesis.speak(utterance);
    };

    play(0);
  }, [cancel, supported]);

  // Voices load asynchronously in Chrome; touching the list makes them available when we speak
  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, [supported]);

  useEffect(() => cancel, [cancel]);

  return { supported, speaking, silent, caption, levelRef, speak, cancel };
}
