/**
 * Viewer for the punch-clock model. This is the "stage" the model expects: it
 * owns the renderer, camera and lights so `punch-clock-model.js` can stay pure
 * geometry. The model is built once and handed over; nothing here reaches into
 * its parts except to set the time.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createPunchClock,
  createPunchClockMaterials,
  setPunchClockTime,
  disposePunchClock,
  CASE_DARK,
  CASE_LIGHT,
} from './punch-clock-model.js';

// Between the dial centre (y=20) and the model's midpoint (y=16), biased to the
// dial — it is the subject, but the plinth should not fall out of frame.
const CLOCK_CENTRE = new THREE.Vector3(0, 19, 5);

export function PunchClock({
  className = '',
  style,
  isDarkMode = false,
  live = true,
  spin = true,
  time = null,
}) {
  const hostRef = useRef(null);
  // Kept in refs so a prop change never forces the scene to be rebuilt.
  const settings = useRef({ live, spin, time });
  settings.current = { live, spin, time };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return undefined; // no WebGL — the host just stays empty
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
    camera.position.set(26, 34, 78);
    camera.lookAt(CLOCK_CENTRE);

    // Three lights: a soft fill, a key from the upper right that casts the
    // shadow, and a cool rim to pick out the chrome.
    const ambient = new THREE.AmbientLight(0xffffff, isDarkMode ? 0.55 : 0.8);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff4e2, isDarkMode ? 1.5 : 1.9);
    key.position.set(34, 52, 46);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 10;
    key.shadow.camera.far = 160;
    key.shadow.camera.left = -30;
    key.shadow.camera.right = 30;
    key.shadow.camera.top = 50;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.0015;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9fc6ff, isDarkMode ? 0.9 : 0.5);
    rim.position.set(-40, 24, -18);
    scene.add(rim);

    // Materials are built per mount, so the two themes never share an instance
    // and nothing has to be re-coloured in place. The effect re-runs on
    // `isDarkMode`, which rebuilds the scene with the right case value.
    const clock = createPunchClock({
      materials: createPunchClockMaterials({
        caseColor: isDarkMode ? CASE_DARK : CASE_LIGHT,
      }),
    });
    // The model's origin is the bottom-centre of the back plate; drop it so the
    // clock is centred on the canvas rather than sitting on the bottom edge.
    const pedestal = new THREE.Group();
    pedestal.name = 'PunchClockPedestal';
    pedestal.add(clock);
    scene.add(pedestal);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Pull back on narrow canvases so the full 35 cm of clock stays in frame.
      camera.position.setLength(w / h < 0.9 ? 96 : 78);
      camera.lookAt(CLOCK_CENTRE);
      camera.updateProjectionMatrix();
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    );

    let frame = 0;
    let lastSecond = -1;
    const start = performance.now();

    const render = (now) => {
      frame = requestAnimationFrame(render);
      const { live: isLive, spin: shouldSpin, time: fixed } = settings.current;

      if (isLive) {
        const date = fixed instanceof Date ? fixed : new Date();
        if (date.getSeconds() !== lastSecond) {
          lastSecond = date.getSeconds();
          setPunchClockTime(clock, date);
        }
      } else if (fixed) {
        setPunchClockTime(clock, fixed);
      }

      if (shouldSpin && !reduceMotion?.matches) {
        // A slow drift either side of front-on, never a full turn — the dial
        // has to stay readable.
        pedestal.rotation.y = Math.sin((now - start) / 6000) * 0.26;
      } else {
        pedestal.rotation.y = 0;
      }

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(render);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      disposePunchClock(clock);
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [isDarkMode]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={style}
      role="img"
      aria-label="Mechanical punch clock"
    />
  );
}

export default PunchClock;
