'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const SKIN = 0xe8b894;

const mesh = (geometry, color, extra = {}) => new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...extra }));

function buildAvatar() {
  const root = new THREE.Group();

  // Jacket, shirt collar and bow tie
  const jacket = mesh(new THREE.CylinderGeometry(0.78, 1.05, 1.25, 32), 0x23305a);
  jacket.position.y = -1.35;
  const collar = mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.18, 24), 0xf5f5f5);
  collar.position.y = -0.78;
  const bowL = mesh(new THREE.ConeGeometry(0.12, 0.2, 16), 0xb3202a);
  bowL.rotation.z = Math.PI / 2; bowL.position.set(-0.13, -0.83, 0.34);
  const bowR = bowL.clone(); bowR.rotation.z = -Math.PI / 2; bowR.position.x = 0.13;
  const knot = mesh(new THREE.SphereGeometry(0.055, 16, 12), 0x8f1a22);
  knot.position.set(0, -0.83, 0.35);
  const neck = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.35, 20), SKIN);
  neck.position.y = -0.58;
  root.add(jacket, collar, bowL, bowR, knot, neck);

  // Head
  const head = new THREE.Group();
  head.position.y = 0.22;
  const skull = mesh(new THREE.SphereGeometry(0.62, 40, 30), SKIN);
  skull.scale.set(1, 1.1, 0.96);
  const hair = mesh(new THREE.SphereGeometry(0.655, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.46), 0xb9bcc4);
  hair.scale.set(1, 1.1, 0.98); hair.position.set(0, 0.02, -0.04);
  const earL = mesh(new THREE.SphereGeometry(0.1, 16, 12), SKIN); earL.scale.set(0.5, 1, 0.8); earL.position.set(-0.62, 0, 0);
  const earR = earL.clone(); earR.position.x = 0.62;
  const nose = mesh(new THREE.SphereGeometry(0.075, 16, 12), 0xd9a47f); nose.scale.set(0.9, 1.1, 1.2); nose.position.set(0, -0.04, 0.6);
  head.add(skull, hair, earL, earR, nose);

  // Eyes (groups scale on Y to blink)
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.22, 0.1, 0.52);
    const white = mesh(new THREE.SphereGeometry(0.085, 20, 16), 0xffffff, { roughness: 0.3 });
    const pupil = mesh(new THREE.SphereGeometry(0.045, 16, 12), 0x1b1b24, { roughness: 0.2 });
    pupil.position.z = 0.055;
    eye.add(white, pupil);
    head.add(eye);
    eyes.push(eye);
  }

  // Eyebrows
  const brows = [];
  for (const side of [-1, 1]) {
    const brow = mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), 0x8d8f98);
    brow.position.set(side * 0.22, 0.27, 0.55);
    head.add(brow);
    brows.push(brow);
  }

  // Round glasses
  const frameMaterial = { color: 0xc9a227, metalness: 0.6, roughness: 0.3 };
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.012, 10, 36), new THREE.MeshStandardMaterial(frameMaterial));
    lens.position.set(side * 0.22, 0.1, 0.57);
    head.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), new THREE.MeshStandardMaterial(frameMaterial));
  bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.12, 0.58);
  head.add(bridge);

  // Mouth: an ellipse whose height follows the speech level
  const mouth = mesh(new THREE.SphereGeometry(0.12, 24, 16), 0x6b1f2a, { roughness: 0.4 });
  mouth.position.set(0, -0.28, 0.52);
  head.add(mouth);

  root.add(head);
  return { root, head, mouth, eyes, brows, jacket };
}

/**
 * 3D tutor avatar. Pass `levelRef` (a ref holding 0-1) to animate the mouth, `speaking` to nod and raise the
 * eyebrows, and `mood` ('neutral' | 'happy' | 'concerned') for the expression.
 */
export default function AvatarTutor({ levelRef, speaking = false, mood = 'neutral', className = '' }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ speaking, mood });
  const [failed, setFailed] = useState(false);

  stateRef.current.speaking = speaking;
  stateRef.current.mood = mood;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      setFailed(true);
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.35, 5.2);
    camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6); rim.position.set(-3, 1, -2);
    scene.add(key, rim);

    const { root, head, mouth, eyes, brows, jacket } = buildAvatar();
    scene.add(root);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame;
    let nextBlink = 2;
    let blinkUntil = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const { speaking: isSpeaking, mood: currentMood } = stateRef.current;
      const level = isSpeaking ? Math.min(1, levelRef?.current ?? 0.5) : 0;

      // Idle motion
      head.rotation.y = Math.sin(t * 0.6) * 0.09;
      head.rotation.x = Math.sin(t * 0.9) * 0.03 + level * 0.06;
      head.rotation.z = currentMood === 'concerned' ? 0.06 : 0;
      jacket.scale.y = 1 + Math.sin(t * 1.6) * 0.008;

      // Mouth follows the speech level; a gentle smile when happy
      const openness = 0.12 + level * 0.9;
      mouth.scale.set(currentMood === 'happy' ? 1.25 : 1, openness * 0.7, 0.35);
      mouth.position.y = -0.28 - level * 0.02;

      // Eyebrows: raised while explaining, angled when concerned
      const raise = level * 0.025 + (currentMood === 'concerned' ? 0.02 : 0);
      brows.forEach((brow, i) => {
        brow.position.y = 0.27 + raise;
        brow.rotation.z = (i === 0 ? 1 : -1) * (currentMood === 'concerned' ? -0.25 : 0);
      });

      // Blinking
      if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random() * 3; }
      const blink = t < blinkUntil ? 0.08 : 1;
      eyes.forEach((eye) => { eye.scale.y = blink; });

      renderer.render(scene, camera);
    };
    animate();

    const onContextLost = (e) => { e.preventDefault(); cancelAnimationFrame(frame); setFailed(true); };
    canvas.addEventListener('webglcontextlost', onContextLost);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((obj) => {
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        materials.forEach((m) => m.dispose());
      });
      renderer.dispose();
    };
  }, [levelRef]);

  if (failed) {
    // No WebGL: fall back to the static portrait
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/3D_avatar_professor.avif" alt="Professor avatar" className={`object-contain ${className}`} data-testid="avatar-fallback" />
    );
  }

  return <canvas ref={canvasRef} className={className} data-testid="avatar-canvas" aria-label="3D tutor avatar" role="img" />;
}
