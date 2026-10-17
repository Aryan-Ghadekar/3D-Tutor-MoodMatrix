'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square, Volume2, Sparkles, X } from 'lucide-react';
import AvatarTutor from '../AvatarTutor';
import { useSpeech } from '@/hooks/useSpeech';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { buildSpokenScript } from '@/lib/speech/script';

/**
 * The 3D tutor. It reads slides aloud, re-explains the current topic in simpler words, and takes spoken
 * questions. New slides (explanations, answers) are read automatically while auto-read is on.
 */
export default function AvatarPanel({
  slide,
  newestSlide,           // slide generated most recently (explain-more, answer, simplified...)
  cognitiveLoad,
  busy,
  onSimplify,
  onAsk,
  onClose,
}) {
  const { supported: ttsSupported, speaking, silent, caption, levelRef, speak, cancel } = useSpeech();
  const [rate, setRate] = useState(1);
  const [autoRead, setAutoRead] = useState(true);
  const lastSpokenId = useRef(newestSlide?.id || null);

  const voice = useVoiceInput({ onFinalText: (text) => { cancel(); onAsk?.(text); } });

  const readSlide = (target, style = 'full') => {
    if (!target?.content) return;
    speak(buildSpokenScript(target.content, { style }), { rate });
  };

  // Read newly generated slides (answers, explanations) automatically
  useEffect(() => {
    if (!autoRead || !newestSlide || newestSlide.id === lastSpokenId.current) return;
    lastSpokenId.current = newestSlide.id;
    if (newestSlide.type === 'quiz-results' || newestSlide.type === 'completion') return;
    readSlide(newestSlide, newestSlide.type === 'simplified-explanation' ? 'simple' : 'full');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestSlide?.id, autoRead]);

  const mood = cognitiveLoad === 'high' ? 'concerned' : speaking ? 'happy' : 'neutral';
  const status = voice.listening ? 'Listening...' : busy ? 'Thinking...' : speaking ? (silent ? 'Explaining (no voice available)' : 'Explaining') : 'Ready';

  return (
    <div className="w-72 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden" data-testid="avatar-panel">
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" /> Professor Avatar</div>
        <button onClick={() => { cancel(); onClose?.(); }} aria-label="Close avatar" className="p-1 rounded hover:bg-white/20"><X className="w-4 h-4" /></button>
      </div>

      <div className="bg-gradient-to-b from-sky-100 to-indigo-100 dark:from-slate-700 dark:to-slate-800">
        <AvatarTutor levelRef={levelRef} speaking={speaking} mood={mood} className="w-full h-52 block" />
      </div>

      <div className="px-3 pt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span data-testid="avatar-status">{status}</span>
        <select
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-gray-700 dark:text-gray-300"
          aria-label="Speaking speed"
        >
          <option value={0.8}>Slow</option>
          <option value={1}>Normal</option>
          <option value={1.25}>Fast</option>
        </select>
      </div>

      <p className="px-3 py-2 min-h-[3.5rem] max-h-20 overflow-y-auto text-xs italic text-gray-700 dark:text-gray-300" data-testid="avatar-caption" aria-live="polite">
        {caption || voice.interim || (voice.error ? voice.error : 'Ask me to explain this slide, or ask a question out loud.')}
      </p>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        {speaking ? (
          <button onClick={cancel} data-testid="avatar-stop" className="col-span-2 py-2 rounded-lg bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2">
            <Square className="w-4 h-4" /> Stop
          </button>
        ) : (
          <button onClick={() => readSlide(slide)} disabled={!slide} data-testid="avatar-speak" className="py-2 rounded-lg bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Volume2 className="w-4 h-4" /> Explain
          </button>
        )}
        {!speaking && (
          <button onClick={onSimplify} disabled={busy} data-testid="avatar-simplify" className="py-2 rounded-lg bg-purple-600 text-white text-sm font-medium disabled:opacity-50">
            Simpler
          </button>
        )}
        {voice.supported ? (
          <button
            onClick={voice.listening ? voice.stop : () => { cancel(); voice.start(); }}
            data-testid="avatar-mic"
            className={`col-span-2 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${voice.listening ? 'border-red-400 text-red-600 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            {voice.listening ? <><MicOff className="w-4 h-4" /> Stop listening</> : <><Mic className="w-4 h-4" /> Ask by voice</>}
          </button>
        ) : (
          <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">Voice questions need Chrome or Edge; use Ask Questions on the right instead.</p>
        )}
        <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
          Read new explanations and answers aloud
        </label>
        {!ttsSupported && <p className="col-span-2 text-xs text-amber-600">This browser has no speech synthesis; the avatar will explain silently with captions.</p>}
      </div>
    </div>
  );
}
