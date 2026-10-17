'use client';

import { useEffect, useRef } from 'react';
import { Camera, CameraOff, ShieldCheck, X } from 'lucide-react';

const LEVEL = {
  low: { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  medium: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  high: { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
};

const POSTURE_LABELS = {
  slouch: 'Slouching',
  handNearHead: 'Hand near head',
  fidget: 'Fidgeting',
};

/** Consent, live preview and readout for camera-based cognitive-load tracking. */
export default function SensorPanel({ sensor, onClose }) {
  const videoRef = useRef(null);
  const { status, error, stream, reading, start, stop } = sensor;
  const active = status === 'active';
  const level = LEVEL[reading.level] || LEVEL.medium;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream, active]);

  const posture = reading.posture?.calibrated ? reading.posture : null;
  const flagged = posture ? Object.entries(posture.features).filter(([, v]) => v >= 0.5).map(([k]) => POSTURE_LABELS[k]) : [];

  return (
    <div className="w-72 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden" data-testid="sensor-panel">
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
        <div className="flex items-center gap-2 text-sm font-semibold"><Camera className="w-4 h-4" /> Load tracking</div>
        <button onClick={onClose} aria-label="Close panel" className="p-1 rounded hover:bg-white/20"><X className="w-4 h-4" /></button>
      </div>

      {status === 'off' || status === 'error' || status === 'unsupported' ? (
        <div className="p-3 space-y-3">
          <p className="text-xs text-gray-700 dark:text-gray-300">
            Use your camera to estimate cognitive load from facial expression and posture, so the tutor can offer help
            when you seem overloaded.
          </p>
          <p className="text-xs flex gap-2 text-gray-600 dark:text-gray-400">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            Video is analysed in your browser and never uploaded or stored. Only a 0-100 load score is used.
          </p>
          {error && <p role="alert" className="text-xs text-red-600" data-testid="sensor-error">{error}</p>}
          <button onClick={start} disabled={status === 'unsupported'} data-testid="sensor-enable" className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            Enable camera
          </button>
        </div>
      ) : (
        <div className="p-3 space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" data-testid="sensor-video" />
            {status === 'starting' && <div className="absolute inset-0 flex items-center justify-center text-xs text-white bg-black/60">Loading models...</div>}
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">Cognitive load</span>
              <span className={`font-semibold capitalize ${level.text}`} data-testid="sensor-level">
                {reading.score === null ? '...' : `${reading.score}% ${reading.level}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className={`h-full transition-all duration-500 ${level.bar}`} style={{ width: `${reading.score ?? 0}%` }} />
            </div>
          </div>

          <dl className="text-xs grid grid-cols-2 gap-x-2 gap-y-1 text-gray-700 dark:text-gray-300" data-testid="sensor-details">
            <dt className="text-gray-500">Expression</dt>
            <dd className="capitalize">{active ? (reading.hasFace ? reading.emotion : 'no face in view') : '-'}</dd>
            <dt className="text-gray-500">Posture</dt>
            <dd>{!reading.hasBody ? 'no body in view' : !posture ? 'calibrating...' : flagged.length ? flagged.join(', ') : 'good'}</dd>
          </dl>

          <button onClick={stop} data-testid="sensor-disable" className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
            <CameraOff className="w-4 h-4" /> Turn camera off
          </button>
        </div>
      )}
    </div>
  );
}
