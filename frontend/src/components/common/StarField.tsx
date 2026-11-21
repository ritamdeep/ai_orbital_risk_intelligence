import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  layer: number; // 0 = far, 1 = mid, 2 = near
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  speedMultiplier: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  vx: number;
  vy: number;
  life: number; // 0 to 1
  duration: number; // in seconds
  opacity: number;
}

export const StarField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let nextShootingStarTime = performance.now() + (6000 + Math.random() * 4000);
    let isTabVisible = !document.hidden;

    // Check prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = reducedMotionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    reducedMotionQuery.addEventListener('change', handleMotionChange);

    // Parallax tracking
    const isPointerFine = window.matchMedia('(pointer: fine)').matches;
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseCurrentX = 0;
    let mouseCurrentY = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerFine) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      mouseTargetX = (e.clientX - w / 2) / (w / 2); // -1 to 1
      mouseTargetY = (e.clientY - h / 2) / (h / 2); // -1 to 1
    };

    if (isPointerFine) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }

    // Stars collection
    let stars: Star[] = [];
    let shootingStar: ShootingStar | null = null;

    const resizeAndInit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Star count scaling with screen area: 250 to 400
      const starCount = Math.floor(Math.min(400, Math.max(250, (w * h) / 4500)));

      stars = [];
      for (let i = 0; i < starCount; i++) {
        const rand = Math.random();
        let layer = 0;
        let radius = 0.6 + Math.random() * 0.4;
        let baseAlpha = 0.2 + Math.random() * 0.25;
        let speedMultiplier = 0.35;
        let color = 'rgba(224, 242, 254, '; // Cool light blue-white

        if (rand > 0.75) {
          // Near layer
          layer = 2;
          radius = 1.3 + Math.random() * 0.8;
          baseAlpha = 0.7 + Math.random() * 0.3;
          speedMultiplier = 1.0;
          color = 'rgba(255, 255, 255, ';
        } else if (rand > 0.35) {
          // Mid layer
          layer = 1;
          radius = 0.9 + Math.random() * 0.5;
          baseAlpha = 0.4 + Math.random() * 0.35;
          speedMultiplier = 0.65;
          color = 'rgba(207, 250, 254, ';
        }

        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius,
          layer,
          baseAlpha,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.8 + Math.random() * 2.2,
          speedMultiplier,
          color,
        });
      }
    };

    resizeAndInit();
    window.addEventListener('resize', resizeAndInit);

    // Visibility change handler
    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Spawn a shooting star
    const trySpawnShootingStar = (now: number, w: number, h: number) => {
      if (prefersReducedMotion || shootingStar) return;
      if (now >= nextShootingStarTime) {
        const startX = Math.random() * (w * 0.75);
        const startY = Math.random() * (h * 0.4);
        const angle = (30 + Math.random() * 20) * (Math.PI / 180); // 30-50 deg downward-right
        const speed = 750 + Math.random() * 300; // px/sec

        shootingStar = {
          x: startX,
          y: startY,
          length: 80 + Math.random() * 60,
          speed,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          duration: 0.9 + Math.random() * 0.3,
          opacity: 0.6 + Math.random() * 0.4,
        };

        // Next shooting star in 6-10 seconds
        nextShootingStarTime = now + (6000 + Math.random() * 4000);
      }
    };

    // Render loop
    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isTabVisible) return;

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Smooth mouse parallax interpolation
      mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.05;
      mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.05;

      ctx.clearRect(0, 0, w, h);

      // Draw all stars
      const timeSec = currentTime / 1000;
      const baseSpeedX = 4; // slow continuous gentle diagonal downward drift
      const baseSpeedY = 7;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        if (!prefersReducedMotion) {
          // Drift
          s.x += baseSpeedX * s.speedMultiplier * dt;
          s.y += baseSpeedY * s.speedMultiplier * dt;

          // Wrap edges smoothly
          if (s.x > w + 5) s.x = -5;
          if (s.x < -5) s.x = w + 5;
          if (s.y > h + 5) s.y = -5;
          if (s.y < -5) s.y = h + 5;
        }

        // Parallax offset based on layer
        const parallaxFactor = s.layer === 2 ? 10 : s.layer === 1 ? 5 : 2;
        const drawX = s.x - mouseCurrentX * parallaxFactor;
        const drawY = s.y - mouseCurrentY * parallaxFactor;

        // Twinkle
        const twinkle = prefersReducedMotion
          ? 1
          : 0.6 + 0.4 * Math.sin(timeSec * s.twinkleSpeed + s.twinklePhase);
        const currentAlpha = Math.max(0.05, Math.min(1, s.baseAlpha * twinkle));

        ctx.fillStyle = `${s.color}${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(drawX, drawY, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle soft glow for near stars
        if (s.layer === 2 && currentAlpha > 0.6) {
          ctx.fillStyle = `${s.color}${currentAlpha * 0.25})`;
          ctx.beginPath();
          ctx.arc(drawX, drawY, s.radius * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Handle shooting stars
      trySpawnShootingStar(currentTime, w, h);

      if (shootingStar) {
        shootingStar.life += dt / shootingStar.duration;

        if (shootingStar.life >= 1) {
          shootingStar = null;
        } else {
          // Progress & fading
          shootingStar.x += shootingStar.vx * dt;
          shootingStar.y += shootingStar.vy * dt;

          const progress = shootingStar.life;
          const currentFade =
            progress < 0.2
              ? progress / 0.2
              : 1 - (progress - 0.2) / 0.8;
          const starAlpha = shootingStar.opacity * Math.max(0, currentFade);

          const tailX = shootingStar.x - (shootingStar.vx / shootingStar.speed) * shootingStar.length;
          const tailY = shootingStar.y - (shootingStar.vy / shootingStar.speed) * shootingStar.length;

          const grad = ctx.createLinearGradient(tailX, tailY, shootingStar.x, shootingStar.y);
          grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
          grad.addColorStop(0.6, `rgba(56, 189, 248, ${starAlpha * 0.4})`);
          grad.addColorStop(1, `rgba(255, 255, 255, ${starAlpha})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(shootingStar.x, shootingStar.y);
          ctx.stroke();

          // Bright head point
          ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
          ctx.beginPath();
          ctx.arc(shootingStar.x, shootingStar.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
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
    <>
      {/* Zero-performance-cost CSS Radial Nebula Glows behind everything */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.14) 0%, rgba(2, 132, 199, 0.06) 45%, transparent 72%),
            radial-gradient(circle at 20% 40%, rgba(14, 165, 233, 0.08) 0%, transparent 45%),
            radial-gradient(circle at 80% 60%, rgba(99, 102, 241, 0.07) 0%, transparent 40%)
          `,
        }}
      />
      {/* Star Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
      />
    </>
  );
};
