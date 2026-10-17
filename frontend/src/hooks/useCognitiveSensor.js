import { useCallback, useEffect, useRef, useState } from 'react';
import { MISSING_THRESHOLD, blendshapesToMap, estimateEmotions, dominantEmotion, EmotionLoadEstimator } from '@/lib/cognitive/emotion';
import { PostureAnalyzer } from '@/lib/cognitive/posture';
import { LoadFusion } from '@/lib/cognitive/fusion';

// The WASM runtime is copied into /public by scripts/copy-mediapipe.mjs; the model files are fetched once
// from Google's public model bucket unless NEXT_PUBLIC_MEDIAPIPE_MODEL_BASE points somewhere else.
const WASM_BASE = '/mediapipe/wasm';
const MODEL_BASE = process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_BASE || 'https://storage.googleapis.com/mediapipe-models';
const FACE_MODEL = `${MODEL_BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`;
const POSE_MODEL = `${MODEL_BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;

const FRAME_INTERVAL_MS = 200;     // ~5 analysed frames per second is plenty and keeps the CPU cool
const PUBLISH_INTERVAL_MS = 1000;  // React state updates at most once a second

const errorMessage = (err) => {
  if (err?.name === 'NotAllowedError') return 'Camera permission was denied. Allow it in your browser to use load tracking.';
  if (err?.name === 'NotFoundError') return 'No camera was found on this device.';
  return err?.message || 'Could not start the camera.';
};

/**
 * Estimates cognitive load from the webcam. All processing happens in the browser: video frames are never
 * uploaded, only the resulting 0-100 score is used by the app.
 *
 * @param {{behaviorScore?: number|null}} options behaviour-based score (quiz results, help requests) that is
 *   fused with the camera signals.
 */
export function useCognitiveSensor({ behaviorScore = null } = {}) {
  const [status, setStatus] = useState('off'); // off | starting | active | error | unsupported
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const [reading, setReading] = useState({
    score: null, level: 'medium', emotion: null, emotions: null, emotionScore: null,
    posture: null, hasFace: false, hasBody: false,
  });

  const behaviorRef = useRef(behaviorScore);
  behaviorRef.current = behaviorScore;

  const runtime = useRef({ timer: null, video: null, face: null, pose: null, stream: null, starting: false });
  const analysers = useRef({ emotion: new EmotionLoadEstimator(), posture: new PostureAnalyzer(), fusion: new LoadFusion() });

  const stop = useCallback(() => {
    const rt = runtime.current;
    rt.starting = false;
    if (rt.timer) clearInterval(rt.timer);
    rt.timer = null;
    rt.stream?.getTracks().forEach((t) => t.stop());
    rt.face?.close?.();
    rt.pose?.close?.();
    if (rt.video) rt.video.srcObject = null;
    Object.assign(rt, { video: null, face: null, pose: null, stream: null });
    analysers.current.emotion.reset();
    analysers.current.posture.reset();
    analysers.current.fusion.reset();
    setStream(null);
    setStatus('off');
    setReading((r) => ({ ...r, score: null, emotion: null, emotions: null, emotionScore: null, posture: null, hasFace: false, hasBody: false }));
  }, []);

  const start = useCallback(async () => {
    const rt = runtime.current;
    if (rt.starting || rt.timer) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('This browser does not support camera access.');
      return;
    }

    rt.starting = true;
    setStatus('starting');
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      if (!rt.starting) { mediaStream.getTracks().forEach((t) => t.stop()); return; }
      rt.stream = mediaStream;
      setStream(mediaStream);

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = mediaStream;
      await video.play();
      rt.video = video;

      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      const create = async (Landmarker, modelAssetPath, extra) => {
        for (const delegate of ['GPU', 'CPU']) {
          try {
            return await Landmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO', ...extra });
          } catch (e) {
            if (delegate === 'CPU') throw e;
          }
        }
      };
      rt.face = await create(vision.FaceLandmarker, FACE_MODEL, { outputFaceBlendshapes: true, numFaces: 1 });
      rt.pose = await create(vision.PoseLandmarker, POSE_MODEL, { numPoses: 1 });
      if (!rt.starting) { stop(); return; }

      let lastPublish = 0;
      let lastVideoTime = -1;
      let latest = {};

      rt.timer = setInterval(() => {
        if (!rt.video || rt.video.readyState < 2 || rt.video.currentTime === lastVideoTime) return;
        lastVideoTime = rt.video.currentTime;
        const now = Date.now();
        const ts = performance.now();

        try {
          const faceResult = rt.face.detectForVideo(rt.video, ts);
          const categories = faceResult.faceBlendshapes?.[0]?.categories;
          // MoodMatrix pipeline: one update per frame; with no face the estimator holds its last value and
          // drops to 0 after MISSING_THRESHOLD frames.
          const emotions = categories ? estimateEmotions(blendshapesToMap(categories)) : null;
          latest.emotions = emotions;
          latest.emotion = emotions ? dominantEmotion(emotions) : null;
          latest.emotionScore = analysers.current.emotion.update(emotions);
          latest.hasFace = !!emotions;

          const poseResult = rt.pose.detectForVideo(rt.video, ts);
          const posture = analysers.current.posture.update(poseResult.landmarks?.[0] || null);
          latest.posture = posture;
        } catch (e) {
          // a single bad frame must not kill the loop
          return;
        }

        const hasFace = !!latest.hasFace;
        const sawFace = analysers.current.emotion.missingFrames < MISSING_THRESHOLD;

        const fused = analysers.current.fusion.update({
          emotion: sawFace ? latest.emotionScore : undefined,
          posture: latest.posture ? latest.posture.score : undefined,
          behavior: behaviorRef.current ?? undefined,
        });

        if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
          lastPublish = now;
          setReading({
            score: fused.score,
            level: fused.level,
            emotion: latest.emotion || null,
            emotions: latest.emotions || null,
            emotionScore: latest.emotionScore ?? null,
            posture: latest.posture || null,
            hasFace,
            hasBody: !!latest.posture,
          });
        }
      }, FRAME_INTERVAL_MS);

      rt.starting = false;
      setStatus('active');
    } catch (err) {
      console.error('Camera load tracking failed to start:', err);
      stop();
      setStatus('error');
      setError(errorMessage(err));
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { status, error, stream, reading, active: status === 'active', start, stop };
}
