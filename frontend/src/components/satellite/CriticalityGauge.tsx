import React, { useEffect, useId, useState } from 'react';

interface CriticalityGaugeProps {
  score: number;
  tier: string;
}

export const CriticalityGauge: React.FC<CriticalityGaugeProps> = ({ score, tier }) => {
  const [animatedScore, setAnimatedScore] = useState<number>(0);
  const uid = useId().replace(/:/g, '');
  const gradId = `cyanTealGaugeGrad-${uid}`;
  const glowId = `gaugeGlow-${uid}`;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimatedScore(score);
      return;
    }

    setAnimatedScore(0);
    const startTime = performance.now();
    const duration = 650;

    let animFrame: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(easeOut * score));

      if (progress < 1) {
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [score]);

  const r = 68;
  const circumference = Math.PI * r;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  const isTier1 = score >= 85 || tier.toLowerCase().includes('1');

  return (
    <div
      className="flex flex-col items-center justify-center relative select-none"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Mission Criticality Score: ${score} out of 100, ${tier}`}
    >
      <div className="relative w-52 h-32 flex items-end justify-center">
        <svg viewBox="0 0 180 108" className="w-52 h-32 overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4">
                <animate
                  attributeName="stop-color"
                  values="#06b6d4;#2dd4bf;#06b6d4"
                  dur="5s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="55%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#2dd4bf">
                <animate
                  attributeName="stop-color"
                  values="#2dd4bf;#38bdf8;#2dd4bf"
                  dur="5s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
            <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 22 96 A 68 68 0 0 1 158 96"
            fill="none"
            stroke="rgba(255, 255, 255, 0.10)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Animated Glowing Progress Arc */}
          <path
            d="M 22 96 A 68 68 0 0 1 158 96"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter={`url(#${glowId})`}
            className="transition-all duration-75"
          />
        </svg>

        {/* Center Score (Big KPI Tabular Nums) */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
          <div className="flex items-baseline space-x-1">
            <span className="type-kpi text-white text-glow-cyan">{animatedScore}</span>
            <span className="text-xs font-data font-medium text-[#94adc9]">/ 100</span>
          </div>
        </div>
      </div>

      {/* Tier Pill Badge below Gauge */}
      <div className="mt-3">
        <span
          className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-sans font-semibold tracking-wide border ${
            isTier1
              ? 'border-rose-400/50 bg-rose-500/15 text-rose-200 pulse-critical-soft'
              : 'border-cyan-400/45 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan'
          }`}
        >
          {tier}
        </span>
      </div>
    </div>
  );
};
