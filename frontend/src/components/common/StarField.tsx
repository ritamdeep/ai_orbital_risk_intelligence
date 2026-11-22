import React, { useEffect, useRef } from 'react';

interface StarFieldProps {
  warpTrigger?: string | number;
}

interface ShootingStar {
  active: boolean;
  x: number;
  y: number;
  length: number;
  speed: number;
  vx: number;
  vy: number;
  life: number;
  duration: number;
  opacity: number;
}

// Precomputed star tint palette: crisp white, cool blue, soft cyan, warm white
const STAR_COLORS: readonly string[] = [
  'rgba(255, 255, 255, ',
  'rgba(186, 230, 253, ',
  'rgba(103, 232, 249, ',
  'rgba(254, 243, 199, ',
];

// Layer speeds in px/sec (far -> near)
const LAYER_SPEEDS = [6, 14, 26, 45];
const LAYER_PARALLAX = [3, 7, 13, 20];

export const StarField: React.FC<StarFieldProps> = ({ warpTrigger }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const warpStartRef = useRef<number>(-1);
  const lastTriggerRef = useRef<string | number | undefined>(warpTrigger);

  // Trigger brief 600ms warp acceleration when the user switches tabs
  useEffect(() => {
    if (lastTriggerRef.current !== warpTrigger) {
      lastTriggerRef.current = warpTrigger;
      warpStartRef.current = performance.now();
    }
  }, [warpTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId = 0;
    let lastTime = performance.now();
    let isTabVisible = !document.hidden;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = reducedMotionQuery.matches;

    const isPointerFine = window.matchMedia('(pointer: fine)').matches;
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseCurrentX = 0;
    let mouseCurrentY = 0;

    // Flat typed arrays (zero per-frame allocation)
    const MAX_STARS = 2000;
    const starX = new Float32Array(MAX_STARS);
    const starY = new Float32Array(MAX_STARS);
    const starRadius = new Float32Array(MAX_STARS);
    const starBaseAlpha = new Float32Array(MAX_STARS);
    const starTwinklePhase = new Float32Array(MAX_STARS);
    const starTwinkleSpeed = new Float32Array(MAX_STARS);
    const starSwayPhase = new Float32Array(MAX_STARS);
    const starLayer = new Uint8Array(MAX_STARS);
    const starColorIdx = new Uint8Array(MAX_STARS);
    const starFeature = new Uint8Array(MAX_STARS);

    let activeStarCount = 0;
    let viewportW = window.innerWidth;
    let viewportH = window.innerHeight;

    // Pre-allocated pool for up to 3 simultaneous shooting stars
    const shootingPool: ShootingStar[] = Array.from({ length: 3 }, () => ({
      active: false,
      x: 0,
      y: 0,
      length: 0,
      speed: 0,
      vx: 0,
      vy: 0,
      life: 0,
      duration: 1,
      opacity: 0,
    }));

    let nextShootingStarTime = performance.now() + (2000 + Math.random() * 2000);

    // Adaptive quality metrics (2s sliding measurement window)
    let frameAccumMs = 0;
    let frameSamples = 0;
    let qualityWindowStart = performance.now();

    const computeStarCount = (w: number, h: number) => {
      // ~1,296 stars at 1920x1080 (within 1,000-1,500 target), hard cap 2,000
      let count = Math.round((w * h) / 1600);
      count = Math.max(450, Math.min(MAX_STARS, count));
      if (w <= 1024) {
        // Reduce star count by ~40% on tablet and mobile
        count = Math.round(count * 0.6);
      }
      return Math.max(250, Math.min(MAX_STARS, count));
    };

    const drawStaticFrame = () => {
      ctx.clearRect(0, 0, viewportW, viewportH);
      for (let i = 0; i < activeStarCount; i++) {
        const alpha = starBaseAlpha[i];
        const colorPrefix = STAR_COLORS[starColorIdx[i]];
        const r = starRadius[i];
        const x = starX[i];
        const y = starY[i];

        if (starFeature[i] === 1) {
          ctx.fillStyle = `${colorPrefix}${(alpha * 0.22).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, r * 3.1, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `${colorPrefix}${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const resizeAndInit = () => {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewportW * dpr);
      canvas.height = Math.floor(viewportH * dpr);
      canvas.style.width = `${viewportW}px`;
      canvas.style.height = `${viewportH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      activeStarCount = computeStarCount(viewportW, viewportH);
      frameAccumMs = 0;
      frameSamples = 0;
      qualityWindowStart = performance.now();

      for (let i = 0; i < activeStarCount; i++) {
        starX[i] = Math.random() * viewportW;
        starY[i] = Math.random() * viewportH;

        const rand = Math.random();
        let layer = 0;
        let radius = 0.5 + Math.random() * 0.35;
        let baseAlpha = 0.18 + Math.random() * 0.20;
        let isFeature = 0;

        if (rand > 0.91) {
          // Layer 3: near
          layer = 3;
          radius = 1.45 + Math.random() * 0.75;
          baseAlpha = 0.74 + Math.random() * 0.26;
          if (Math.random() < 0.28) {
            isFeature = 1;
            radius += 0.45;
          }
        } else if (rand > 0.72) {
          // Layer 2: mid-near
          layer = 2;
          radius = 1.05 + Math.random() * 0.50;
          baseAlpha = 0.52 + Math.random() * 0.28;
        } else if (rand > 0.42) {
          // Layer 1: mid-far
          layer = 1;
          radius = 0.78 + Math.random() * 0.38;
          baseAlpha = 0.34 + Math.random() * 0.24;
        }

        // Color distribution: mostly crisp white, some ice-blue, cyan, warm white
        const cRand = Math.random();
        let cIdx = 0;
        if (cRand > 0.86) cIdx = 3; // warm white
        else if (cRand > 0.68) cIdx = 2; // cyan
        else if (cRand > 0.46) cIdx = 1; // cool blue

        starLayer[i] = layer;
        starRadius[i] = radius;
        starBaseAlpha[i] = baseAlpha;
        starTwinklePhase[i] = Math.random() * Math.PI * 2;
        starTwinkleSpeed[i] = 1.1 + Math.random() * 2.8;
        starSwayPhase[i] = Math.random() * Math.PI * 2;
        starColorIdx[i] = cIdx;
        starFeature[i] = isFeature;
      }

      if (prefersReducedMotion) {
        drawStaticFrame();
      }
    };

    const spawnOneShootingStar = (w: number, h: number) => {
      const slot = shootingPool.find((s) => !s.active);
      if (!slot) return;

      const angleDeg = 20 + Math.random() * 38;
      const angle = (angleDeg * Math.PI) / 180;
      const speed = 780 + Math.random() * 480;

      slot.active = true;
      slot.x = Math.random() * w * 0.85;
      slot.y = Math.random() * h * 0.48;
      slot.length = 85 + Math.random() * 115;
      slot.speed = speed;
      slot.vx = Math.cos(angle) * speed;
      slot.vy = Math.sin(angle) * speed;
      slot.life = 0;
      slot.duration = 0.65 + Math.random() * 0.45;
      slot.opacity = 0.65 + Math.random() * 0.35;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerFine || prefersReducedMotion) return;
      mouseTargetX = (e.clientX - viewportW / 2) / (viewportW / 2);
      mouseTargetY = (e.clientY - viewportH / 2) / (viewportH / 2);
    };

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now();
        qualityWindowStart = lastTime;
        frameAccumMs = 0;
        frameSamples = 0;
      }
    };

    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        for (let j = 0; j < shootingPool.length; j++) shootingPool[j].active = false;
        drawStaticFrame();
      } else {
        lastTime = performance.now();
      }
    };

    resizeAndInit();
    window.addEventListener('resize', resizeAndInit, { passive: true });
    if (isPointerFine) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotionQuery.addEventListener('change', handleMotionChange);

    // Diagonal drift unit vector (~28 deg down-right)
    const dirX = 0.56;
    const dirY = 0.83;

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isTabVisible || prefersReducedMotion) return;

      const rawDtMs = now - lastTime;
      const dt = Math.min(rawDtMs / 1000, 0.08);
      lastTime = now;

      // Adaptive quality: evaluate avg frame time over 2s intervals
      if (rawDtMs > 0 && rawDtMs < 150) {
        frameAccumMs += rawDtMs;
        frameSamples++;
      }
      if (now - qualityWindowStart >= 2000) {
        if (frameSamples > 15) {
          const avgMs = frameAccumMs / frameSamples;
          if (avgMs > 20.5 && activeStarCount > 350) {
            activeStarCount = Math.max(350, Math.floor(activeStarCount * 0.8));
          }
        }
        frameAccumMs = 0;
        frameSamples = 0;
        qualityWindowStart = now;
      }

      // Compute 600ms warp multiplier on tab switch
      let warpMult = 1;
      if (warpStartRef.current > 0) {
        const elapsed = now - warpStartRef.current;
        if (elapsed >= 600) {
          warpStartRef.current = -1;
        } else {
          const t = elapsed / 600;
          // Sharp ramp-up then smooth cubic ease-out back to 1
          const envelope = t < 0.18 ? t / 0.18 : Math.pow(1 - (t - 0.18) / 0.82, 2.2);
          warpMult = 1 + 3.8 * Math.max(0, envelope);
        }
      }

      mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.06;
      mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.06;

      ctx.clearRect(0, 0, viewportW, viewportH);

      const timeSec = now * 0.001;
      const w = viewportW;
      const h = viewportH;

      for (let i = 0; i < activeStarCount; i++) {
        const layer = starLayer[i];
        const speed = LAYER_SPEEDS[layer] * warpMult;

        // Diagonal drift + gentle sinusoidal sway
        let x = starX[i] + (dirX * speed + Math.sin(timeSec * 0.45 + starSwayPhase[i]) * (1.2 + layer * 0.9)) * dt;
        let y = starY[i] + dirY * speed * dt;

        if (x > w + 8) x -= w + 16;
        else if (x < -8) x += w + 16;
        if (y > h + 8) y -= h + 16;
        else if (y < -8) y += h + 16;

        starX[i] = x;
        starY[i] = y;

        const pFactor = LAYER_PARALLAX[layer];
        const drawX = x - mouseCurrentX * pFactor;
        const drawY = y - mouseCurrentY * pFactor;

        // Visible twinkle
        const twinkle = 0.56 + 0.44 * Math.sin(timeSec * starTwinkleSpeed[i] + starTwinklePhase[i]);
        const alpha = starBaseAlpha[i] * twinkle;
        const colorPrefix = STAR_COLORS[starColorIdx[i]];
        const r = starRadius[i];

        // Soft halo for feature stars
        if (starFeature[i] === 1) {
          ctx.fillStyle = `${colorPrefix}${(alpha * 0.24).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(drawX, drawY, r * 3.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Brief streak during tab-switch warp on near layers
        if (warpMult > 1.35 && layer >= 2) {
          const streakLen = (warpMult - 1) * (layer === 3 ? 5.5 : 3.2);
          ctx.strokeStyle = `${colorPrefix}${(alpha * 0.65).toFixed(3)})`;
          ctx.lineWidth = r * 1.15;
          ctx.beginPath();
          ctx.moveTo(drawX - dirX * streakLen, drawY - dirY * streakLen);
          ctx.lineTo(drawX, drawY);
          ctx.stroke();
        } else {
          ctx.fillStyle = `${colorPrefix}${alpha.toFixed(3)})`;
          if (r <= 1.0) {
            // Fast rect draw for tiny far stars
            ctx.fillRect(drawX - r * 0.5, drawY - r * 0.5, r * 1.5, r * 1.5);
          } else {
            ctx.beginPath();
            ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Shooting stars every 2 to 4 seconds (occasionally 2 at once)
      if (now >= nextShootingStarTime) {
        spawnOneShootingStar(w, h);
        if (Math.random() < 0.28) {
          spawnOneShootingStar(w, h);
        }
        nextShootingStarTime = now + (2000 + Math.random() * 2000);
      }

      for (let j = 0; j < shootingPool.length; j++) {
        const s = shootingPool[j];
        if (!s.active) continue;

        s.life += dt / s.duration;
        if (s.life >= 1) {
          s.active = false;
          continue;
        }

        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const fade = s.life < 0.18 ? s.life / 0.18 : 1 - (s.life - 0.18) / 0.82;
        const alpha = s.opacity * Math.max(0, fade);

        const invSpeed = 1 / s.speed;
        const tailX = s.x - s.vx * invSpeed * s.length;
        const tailY = s.y - s.vy * invSpeed * s.length;

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, 'rgba(34, 211, 238, 0)');
        grad.addColorStop(0.65, `rgba(103, 232, 249, ${(alpha * 0.45).toFixed(3)})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${alpha.toFixed(3)})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeAndInit);
      if (isPointerFine) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* 4 Large Slowly Drifting Gradient Orbs (giving glass real depth to blur) */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />
      <div className="ambient-orb ambient-orb-4" />

      {/* Subtle Radial Vignette */}
      <div className="ambient-vignette" />

      {/* Denser 4-Layer Animated Starfield Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />

      {/* Subtle 3.5% Noise Grain Overlay */}
      <div className="ambient-noise" />
    </div>
  );
};
