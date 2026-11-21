import React, { useState } from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { MOCK_MISSION_PROFILES } from '../../services/mock/mockSatellites';
import { formatDistance, formatVelocity, formatUTC } from '../../utils/formatters';
import { MISS_DISTANCE_THRESHOLD_KM, CRITICALITY_THRESHOLD, MAX_MISS_DISTANCE_KM, MAX_CRITICALITY_SCORE } from '../../constants/screeningConfig';
import { Info } from 'lucide-react';

export interface RiskMatrix2DProps {
  conjunctions: ConjunctionEvent[];
  selectedConjunction?: ConjunctionEvent | null;
  onSelectConjunction: (event: ConjunctionEvent) => void;
}

export const RiskMatrix2D: React.FC<RiskMatrix2DProps> = ({
  conjunctions,
  selectedConjunction,
  onSelectConjunction,
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<ConjunctionEvent | null>(null);

  // SVG dimensions & padding for optimal resolution and proportions
  const width = 880;
  const height = 460;
  const padding = { top: 30, right: 35, bottom: 60, left: 65 };
  const plotWidth = width - padding.left - padding.right; // 780
  const plotHeight = height - padding.top - padding.bottom; // 370

  // Coordinate mapping functions
  const getX = (distKm: number) => {
    const clamped = Math.max(0, Math.min(distKm, MAX_MISS_DISTANCE_KM));
    return padding.left + (clamped / MAX_MISS_DISTANCE_KM) * plotWidth;
  };

  const getY = (critScore: number) => {
    const clamped = Math.max(0, Math.min(critScore, MAX_CRITICALITY_SCORE));
    return padding.top + plotHeight - (clamped / MAX_CRITICALITY_SCORE) * plotHeight;
  };

  // Threshold coordinates
  const thresholdX = getX(MISS_DISTANCE_THRESHOLD_KM);
  const thresholdY = getY(CRITICALITY_THRESHOLD);

  // Label placement helper to prevent text overlapping or edge truncation
  const getLabelPlacement = (event: ConjunctionEvent, cx: number, cy: number) => {
    // Specific pixel-perfect placements for catalogued reference events
    if (event.primary_object.norad_id === 44431) {
      // CARTOSAT-3: placed below node and selection aura
      return { x: cx, y: cy + 28, anchor: 'middle' as const };
    }
    if (event.primary_object.norad_id === 51656) {
      // EOS-04 (RISAT-1A): placed to the right
      return { x: cx + 18, y: cy + 4, anchor: 'start' as const };
    }
    if (event.primary_object.norad_id === 41783) {
      // PRATHAM (IIT BOMBAY): placed above node
      return { x: cx, y: cy - 14, anchor: 'middle' as const };
    }
    if (event.primary_object.norad_id === 54361) {
      // OCEANSAT-3 (EOS-06): placed above node
      return { x: cx, y: cy - 14, anchor: 'middle' as const };
    }

    // Dynamic fallback for any additional events
    if (cx > width - 150) {
      return { x: cx - 14, y: cy + 4, anchor: 'end' as const };
    }
    return { x: cx + 14, y: cy + 4, anchor: 'start' as const };
  };

  // Handle keyboard navigation across data points
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectConjunction(conjunctions[index]);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (index + 1) % conjunctions.length;
      onSelectConjunction(conjunctions[nextIdx]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (index - 1 + conjunctions.length) % conjunctions.length;
      onSelectConjunction(conjunctions[prevIdx]);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden h-full">
      {/* Top Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Two-Dimensional Decision Matrix
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 uppercase">
              Scientific Rule #5 Compliant
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Decoupled dimensions: Physical Miss Distance (X-axis) vs. Downstream Mission Criticality (Y-axis).
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-medium shrink-0">
          <span className="flex items-center text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)] mr-1.5" />
            Urgent Threat
          </span>
          <span className="flex items-center text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] mr-1.5" />
            Elevated Caution
          </span>
          <span className="flex items-center text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)] mr-1.5" />
            Routine Tracking
          </span>
        </div>
      </div>

      {/* SVG Scatter Plot Area */}
      <div className="relative mt-3 flex justify-center w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none font-sans"
          role="region"
          aria-label="Two-Dimensional Decision Matrix Scatter Chart"
        >
          <defs>
            {/* Subtle gradients for soft quadrant tinting */}
            <radialGradient id="q1-glow" cx="20%" cy="20%" r="80%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.04" />
            </radialGradient>
            <radialGradient id="q2-glow" cx="80%" cy="20%" r="80%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
            </radialGradient>
            <radialGradient id="q3-glow" cx="20%" cy="80%" r="80%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </radialGradient>
            <radialGradient id="q4-glow" cx="80%" cy="80%" r="80%">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.01" />
            </radialGradient>
          </defs>

          {/* Quadrant Background Shading */}
          {/* Top-Left: Quadrant I (Critical Intervention) */}
          <rect
            x={padding.left}
            y={padding.top}
            width={thresholdX - padding.left}
            height={thresholdY - padding.top}
            fill="url(#q1-glow)"
          />
          {/* Top-Right: Quadrant II (Strategic Vigilance) */}
          <rect
            x={thresholdX}
            y={padding.top}
            width={padding.left + plotWidth - thresholdX}
            height={thresholdY - padding.top}
            fill="url(#q2-glow)"
          />
          {/* Bottom-Left: Quadrant III (Physical Caution) */}
          <rect
            x={padding.left}
            y={thresholdY}
            width={thresholdX - padding.left}
            height={padding.top + plotHeight - thresholdY}
            fill="url(#q3-glow)"
          />
          {/* Bottom-Right: Quadrant IV (Routine Monitoring) */}
          <rect
            x={thresholdX}
            y={thresholdY}
            width={padding.left + plotWidth - thresholdX}
            height={padding.top + plotHeight - thresholdY}
            fill="url(#q4-glow)"
          />

          {/* Subtle Gridlines at intermediate values */}
          <line
            x1={getX(5)}
            y1={padding.top}
            x2={getX(5)}
            y2={padding.top + plotHeight}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={getX(15)}
            y1={padding.top}
            x2={getX(15)}
            y2={padding.top + plotHeight}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={getY(25)}
            x2={padding.left + plotWidth}
            y2={getY(25)}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={getY(75)}
            x2={padding.left + plotWidth}
            y2={getY(75)}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Threshold Divider Lines */}
          <line
            x1={thresholdX}
            y1={padding.top}
            x2={thresholdX}
            y2={padding.top + plotHeight}
            stroke="#3b82f6"
            strokeOpacity="0.45"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={thresholdY}
            x2={padding.left + plotWidth}
            y2={thresholdY}
            stroke="#3b82f6"
            strokeOpacity="0.45"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />

          {/* Quadrant Labels in Outer Corners (Behind Data Points) */}
          <text
            x={padding.left + 14}
            y={thresholdY - 14}
            fill="#f87171"
            className="text-[11px] font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant I: Critical Intervention
          </text>

          <text
            x={padding.left + plotWidth - 14}
            y={padding.top + 22}
            textAnchor="end"
            fill="#38bdf8"
            className="text-[11px] font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant II: Strategic Vigilance
          </text>

          <text
            x={padding.left + 14}
            y={padding.top + plotHeight - 16}
            fill="#fbbf24"
            className="text-[11px] font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant III: Physical Caution
          </text>

          <text
            x={padding.left + plotWidth - 14}
            y={padding.top + plotHeight - 16}
            textAnchor="end"
            fill="#64748b"
            className="text-[11px] font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant IV: Routine Monitoring
          </text>

          {/* Axes Borders */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="#334155"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="#334155"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left + plotWidth}
            y1={padding.top}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="#1e293b"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left + plotWidth}
            y2={padding.top}
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* X Axis Ticks & Labels */}
          {[0, 5, 10, 15, 20].map((dist) => {
            const x = getX(dist);
            const isFirst = dist === 0;
            return (
              <g key={`x-tick-${dist}`} transform={`translate(${x}, ${padding.top + plotHeight})`}>
                <line y2="5" stroke="#475569" strokeWidth="1.5" />
                <text
                  x={isFirst ? 4 : 0}
                  y="18"
                  textAnchor={isFirst ? 'start' : 'middle'}
                  fill="#64748b"
                  className="text-[11px] font-mono"
                >
                  {dist} km
                </text>
              </g>
            );
          })}

          {/* Y Axis Ticks & Labels */}
          {[0, 25, 50, 75, 100].map((crit) => {
            const y = getY(crit);
            const isZero = crit === 0;
            return (
              <g key={`y-tick-${crit}`} transform={`translate(${padding.left}, ${y})`}>
                <line x2="-5" stroke="#475569" strokeWidth="1.5" />
                <text
                  x="-10"
                  y={isZero ? -4 : 4}
                  textAnchor="end"
                  fill="#64748b"
                  className="text-[11px] font-mono"
                >
                  {crit}
                </text>
              </g>
            );
          })}

          {/* Axis Titles */}
          <text
            x={padding.left + plotWidth / 2}
            y={height - 12}
            textAnchor="middle"
            fill="#94a3b8"
            className="text-[12px] font-semibold tracking-wide"
          >
            ← Closer Separation (Higher Physical Hazard) | Physical Miss Distance (km) →
          </text>

          <text
            x={-(padding.top + plotHeight / 2)}
            y={22}
            transform="rotate(-90)"
            textAnchor="middle"
            fill="#94a3b8"
            className="text-[12px] font-semibold tracking-wide"
          >
            Mission Criticality Score (0-100) →
          </text>

          {/* Conjunction Data Points */}
          {conjunctions.map((event, index) => {
            const profile = MOCK_MISSION_PROFILES[event.primary_object.norad_id];
            const critScore = profile ? profile.criticality.score : 50;
            const cx = getX(event.miss_distance_km);
            const cy = getY(critScore);
            const isSelected = selectedConjunction?.conjunction_id === event.conjunction_id;
            const isHovered = hoveredEvent?.conjunction_id === event.conjunction_id;

            // Classification
            const isUrgent = event.miss_distance_km <= MISS_DISTANCE_THRESHOLD_KM && critScore >= CRITICALITY_THRESHOLD;
            const isCaution = event.miss_distance_km <= MISS_DISTANCE_THRESHOLD_KM && critScore < CRITICALITY_THRESHOLD;

            const primaryColor = isUrgent ? '#ef4444' : isCaution ? '#f59e0b' : '#38bdf8';
            const labelPos = getLabelPlacement(event, cx, cy);

            return (
              <g
                key={event.conjunction_id}
                tabIndex={0}
                role="button"
                aria-label={`Select ${event.primary_object.name} vs ${event.secondary_object.name}, miss distance ${event.miss_distance_km} km, criticality ${critScore}`}
                className="cursor-pointer focus:outline-none transition-transform"
                onClick={() => onSelectConjunction(event)}
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                {/* Outer animated pulsing halo for Urgent Threats */}
                {isUrgent && (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 24 : 20}
                      fill="#ef4444"
                      fillOpacity="0.12"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeOpacity="0.4"
                      className="motion-reduce:animate-none animate-pulse"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 16 : 13}
                      fill="#ef4444"
                      fillOpacity="0.28"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeOpacity="0.75"
                    />
                  </>
                )}

                {/* Single subtle aura for Caution / Routine nodes */}
                {!isUrgent && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 15 : 11}
                    fill={primaryColor}
                    fillOpacity="0.22"
                    stroke={primaryColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                  />
                )}

                {/* Selected Active Indicator Ring */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isUrgent ? 22 : 16}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    className="motion-reduce:animate-none animate-[spin_10s_linear_infinite]"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 8.5 : 7}
                  fill={primaryColor}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />

                {/* Satellite Name Label */}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor={labelPos.anchor}
                  fill="#ffffff"
                  className={`font-mono text-[11px] sm:text-[12px] font-bold tracking-wide select-none ${
                    isSelected ? 'fill-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]' : ''
                  }`}
                >
                  {event.primary_object.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip (Glassmorphic) */}
        {hoveredEvent && (
          <div
            className="absolute top-3 right-5 bg-slate-950/90 backdrop-blur-md text-white p-3.5 rounded-xl text-xs shadow-2xl border border-cyan-500/30 max-w-xs font-mono z-20 pointer-events-none transition-opacity"
            style={{ animation: 'fadeIn 0.15s ease-out' }}
          >
            <div className="font-bold text-cyan-300 text-sm">
              {hoveredEvent.primary_object.name}
            </div>
            <div className="text-slate-400 text-[11px]">
              vs. {hoveredEvent.secondary_object.name}
            </div>
            <div className="mt-2.5 space-y-1 text-slate-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Miss distance:</span>
                <span className="text-cyan-300 font-bold">{formatDistance(hoveredEvent.miss_distance_km)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Relative speed:</span>
                <span className="text-white font-bold">{formatVelocity(hoveredEvent.relative_velocity_km_s)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mission criticality:</span>
                <span className="text-rose-400 font-bold">
                  {MOCK_MISSION_PROFILES[hoveredEvent.primary_object.norad_id]?.criticality.score || 50} / 100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TCA:</span>
                <span className="text-slate-200">{formatUTC(hoveredEvent.tca).substring(0, 16)} UTC</span>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-cyan-400 font-sans">
              Click node to inspect full telemetry in right panel
            </div>
          </div>
        )}
      </div>

      {/* Threshold note caption */}
      <div className="text-[11px] text-slate-500 font-mono italic text-right mt-1">
        Screening thresholds are operator-defined and adjustable
      </div>

      {/* Bottom Operational Guideline Callout Box */}
      <div className="mt-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 sm:p-3.5 flex items-start space-x-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold text-slate-200">Operational Guideline:</span> High mission criticality increases the urgency of operator intervention, but does not alter orbital mechanics or collision probability. Both axes must be investigated independently during conjunction evaluation.
        </p>
      </div>
    </div>
  );
};
