import React, { useEffect, useState } from 'react';

interface CriticalityGaugeProps {
  score: number;
  tier: string;
}

export const CriticalityGauge: React.FC<CriticalityGaugeProps> = ({ score, tier }) => {
  const [animatedScore, setAnimatedScore] = useState<number>(0);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimatedScore(score);
      return;
    }

    setAnimatedScore(0);
    const startTime = performance.now();
    const duration = 650; // ms

    let animFrame: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(easeOut * score));

      if (progress < 1) {
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [score]);

  // Semicircle geometry
  const r = 68;
  const circumference = Math.PI * r; // ~213.6
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div 
      className="flex flex-col items-center justify-center relative select-none"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Mission Criticality Score: ${score} out of 100, ${tier}`}
    >
      <div className="relative w-48 h-28 flex items-end justify-center">
        <svg viewBox="0 0 180 105" className="w-48 h-28 overflow-visible">
          <defs>
            <linearGradient id="cyanGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 22 95 A 68 68 0 0 1 158 95"
            fill="none"
            stroke="#1e293b"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Animated Glowing Progress Arc */}
          <path
            d="M 22 95 A 68 68 0 0 1 158 95"
            fill="none"
            stroke="url(#cyanGaugeGrad)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#gaugeGlow)"
            className="transition-all duration-75"
          />
        </svg>

        {/* Center Score & Tier */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1.5 pointer-events-none">
          <div className="flex items-baseline space-x-1 font-mono">
            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {animatedScore}
            </span>
            <span className="text-xs font-semibold text-slate-400">/ 100</span>
          </div>
        </div>
      </div>

      {/* Tier Pill Badge below Gauge */}
      <div className="mt-2.5">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-mono tracking-wide border border-cyan-400/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
          {tier}
        </span>
      </div>
    </div>
  );
};
