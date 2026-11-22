import React, { useMemo, useState } from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import { formatDistance, formatVelocity, formatUTC } from '../../utils/formatters';
import {
  MISS_DISTANCE_THRESHOLD_KM,
  CRITICALITY_THRESHOLD,
  MAX_MISS_DISTANCE_KM,
  MAX_CRITICALITY_SCORE,
} from '../../constants/screeningConfig';
import { GlassCard } from '../common/GlassCard';
import { Info } from 'lucide-react';

export interface RiskMatrix2DProps {
  conjunctions: ConjunctionEvent[];
  selectedConjunction?: ConjunctionEvent | null;
  onSelectConjunction: (event: ConjunctionEvent) => void;
}

/** Round up to a clean axis maximum (20, 25, 40, 50, 60, 80, 100, 120, 150, 160, 200, ...) */
function niceCeil(value: number): number {
  if (value <= 20) return 20;
  const padded = value * 1.06;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const normalized = padded / magnitude;
  const niceSteps = [1, 1.2, 1.5, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const step of niceSteps) {
    if (normalized <= step) {
      return Math.ceil(step * magnitude);
    }
  }
  return Math.ceil(padded);
}

function buildXTicks(xMax: number): number[] {
  const tickCount = 5;
  const step = xMax / tickCount;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round(step * i));
  }
  return ticks;
}

interface PlottedNode {
  event: ConjunctionEvent;
  index: number;
  critScore: number;
  cx: number;
  cy: number;
  isSelected: boolean;
  isHovered: boolean;
  isUrgent: boolean;
  isCaution: boolean;
  primaryColor: string;
}

interface LabelLayout {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  needsLeader: boolean;
}

export const RiskMatrix2D: React.FC<RiskMatrix2DProps> = ({
  conjunctions,
  selectedConjunction,
  onSelectConjunction,
}) => {
  const { satellites } = useOrbitalIntelligence();
  const [hoveredEvent, setHoveredEvent] = useState<ConjunctionEvent | null>(null);

  const width = 880;
  const height = 470;
  const padding = { top: 32, right: 38, bottom: 62, left: 66 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Dynamic X-domain: 0 to max(20, niceCeil(maxMissDistance))
  const maxMissDistance = useMemo(() => {
    if (conjunctions.length === 0) return MAX_MISS_DISTANCE_KM;
    return Math.max(...conjunctions.map((c) => c.miss_distance_km || 0));
  }, [conjunctions]);

  const xMax = useMemo(
    () => Math.max(MAX_MISS_DISTANCE_KM, niceCeil(maxMissDistance)),
    [maxMissDistance]
  );

  const xTicks = useMemo(() => buildXTicks(xMax), [xMax]);

  const getX = (distKm: number) => {
    const clamped = Math.max(0, Math.min(distKm, xMax));
    return padding.left + (clamped / xMax) * plotWidth;
  };

  const getY = (critScore: number) => {
    const clamped = Math.max(0, Math.min(critScore, MAX_CRITICALITY_SCORE));
    return padding.top + plotHeight - (clamped / MAX_CRITICALITY_SCORE) * plotHeight;
  };

  const thresholdX = getX(MISS_DISTANCE_THRESHOLD_KM);
  const thresholdY = getY(CRITICALITY_THRESHOLD);

  const { nodes, labelMap, hiddenLabelCount } = useMemo(() => {
    const plotted: PlottedNode[] = conjunctions.map((event, index) => {
      const matchedSat = satellites.find((s) =>
        isSameSatellite(s.noradId, event.primary_object.norad_id)
      );
      const critScore = matchedSat ? matchedSat.criticality.score : 50;
      const cx = getX(event.miss_distance_km);
      const cy = getY(critScore);
      const isSelected = selectedConjunction?.conjunction_id === event.conjunction_id;
      const isHovered = hoveredEvent?.conjunction_id === event.conjunction_id;
      const isUrgent =
        event.miss_distance_km <= MISS_DISTANCE_THRESHOLD_KM &&
        critScore >= CRITICALITY_THRESHOLD;
      const isCaution =
        event.miss_distance_km <= MISS_DISTANCE_THRESHOLD_KM &&
        critScore < CRITICALITY_THRESHOLD;
      const primaryColor = isUrgent ? '#f43f5e' : isCaution ? '#f59e0b' : '#38bdf8';

      return {
        event,
        index,
        critScore,
        cx,
        cy,
        isSelected,
        isHovered,
        isUrgent,
        isCaution,
        primaryColor,
      };
    });

    // When >6 points are close together in a cluster, show labels only for selected, hovered & top 3
    const clusterSizes = plotted.map((node) => {
      let count = 0;
      for (const other of plotted) {
        const dx = node.cx - other.cx;
        const dy = node.cy - other.cy;
        if (dx * dx + dy * dy <= 95 * 95) count++;
      }
      return count;
    });
    const hasDenseCluster = clusterSizes.some((c) => c > 6) || plotted.length > 8;

    const top3Ids = new Set(
      [...plotted]
        .sort(
          (a, b) =>
            a.event.miss_distance_km - b.event.miss_distance_km || b.critScore - a.critScore
        )
        .slice(0, 3)
        .map((n) => n.event.conjunction_id)
    );

    const visibleForLabel = plotted.filter((node) => {
      if (!hasDenseCluster) return true;
      return node.isSelected || node.isHovered || top3Ids.has(node.event.conjunction_id);
    });

    // Iterative label collision avoidance with short leader lines
    const labelW = 128;
    const labelH = 18;
    const boxes = visibleForLabel.map((node) => {
      const preferLeft = node.cx > padding.left + plotWidth - 150;
      const anchor: 'start' | 'middle' | 'end' = preferLeft ? 'end' : 'start';
      const initialX = preferLeft ? node.cx - 15 : node.cx + 15;
      const initialY = node.cy - 8;
      return {
        id: node.event.conjunction_id,
        cx: node.cx,
        cy: node.cy,
        x: initialX,
        y: Math.max(padding.top + 16, Math.min(padding.top + plotHeight - 10, initialY)),
        anchor,
      };
    });

    for (let iter = 0; iter < 18; iter++) {
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const aLeft = a.anchor === 'end' ? a.x - labelW : a.x;
          const bLeft = b.anchor === 'end' ? b.x - labelW : b.x;
          const overlapX = Math.min(aLeft + labelW, bLeft + labelW) - Math.max(aLeft, bLeft);
          const overlapY = Math.min(a.y + 4, b.y + 4) - Math.max(a.y - labelH, b.y - labelH);

          if (overlapX > 0 && overlapY > 0) {
            const push = (overlapY + 4) * 0.55;
            if (a.y <= b.y) {
              a.y -= push;
              b.y += push;
            } else {
              a.y += push;
              b.y -= push;
            }
            a.y = Math.max(padding.top + 16, Math.min(padding.top + plotHeight - 10, a.y));
            b.y = Math.max(padding.top + 16, Math.min(padding.top + plotHeight - 10, b.y));
          }
        }
      }
    }

    const map = new Map<string, LabelLayout>();
    for (const box of boxes) {
      const distSq = (box.x - box.cx) ** 2 + (box.y - box.cy) ** 2;
      map.set(box.id, {
        x: box.x,
        y: box.y,
        anchor: box.anchor,
        needsLeader: distSq > 20 * 20,
      });
    }

    return {
      nodes: plotted,
      labelMap: map,
      hiddenLabelCount: plotted.length - visibleForLabel.length,
    };
  }, [conjunctions, satellites, selectedConjunction, hoveredEvent, xMax]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectConjunction(conjunctions[index]);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onSelectConjunction(conjunctions[(index + 1) % conjunctions.length]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onSelectConjunction(conjunctions[(index - 1 + conjunctions.length) % conjunctions.length]);
    }
  };

  const hasSelection = Boolean(selectedConjunction);

  return (
    <GlassCard className="p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden h-full">
      {/* Top Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <h2 className="type-card-title text-white">Two-Dimensional Decision Matrix</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold tracking-[0.06em] bg-cyan-500/15 text-cyan-200 border border-cyan-400/35 uppercase">
              Scientific Rule #5 Compliant
            </span>
          </div>
          <p className="text-sm text-[#b4c6dc] mt-1">
            Decoupled dimensions: Physical Miss Distance (X-axis) vs. Downstream Mission Criticality (Y-axis).
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-sans font-medium shrink-0">
          <span className="flex items-center text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] mr-1.5" />
            Urgent Threat
          </span>
          <span className="flex items-center text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)] mr-1.5" />
            Elevated Caution
          </span>
          <span className="flex items-center text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] mr-1.5" />
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
            <radialGradient id="q1-glow" cx="20%" cy="20%" r="85%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.04" />
            </radialGradient>
            <radialGradient id="q2-glow" cx="80%" cy="20%" r="85%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
            </radialGradient>
            <radialGradient id="q3-glow" cx="20%" cy="80%" r="85%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </radialGradient>
            <radialGradient id="q4-glow" cx="80%" cy="80%" r="85%">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.01" />
            </radialGradient>
            <filter id="pointHalo" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Quadrant Background Shading */}
          <rect
            x={padding.left}
            y={padding.top}
            width={Math.max(0, thresholdX - padding.left)}
            height={thresholdY - padding.top}
            fill="url(#q1-glow)"
          />
          <rect
            x={thresholdX}
            y={padding.top}
            width={Math.max(0, padding.left + plotWidth - thresholdX)}
            height={thresholdY - padding.top}
            fill="url(#q2-glow)"
          />
          <rect
            x={padding.left}
            y={thresholdY}
            width={Math.max(0, thresholdX - padding.left)}
            height={padding.top + plotHeight - thresholdY}
            fill="url(#q3-glow)"
          />
          <rect
            x={thresholdX}
            y={thresholdY}
            width={Math.max(0, padding.left + plotWidth - thresholdX)}
            height={padding.top + plotHeight - thresholdY}
            fill="url(#q4-glow)"
          />

          {/* Dynamic Gridlines */}
          {xTicks.slice(1, -1).map((tick) => (
            <line
              key={`vgrid-${tick}`}
              x1={getX(tick)}
              y1={padding.top}
              x2={getX(tick)}
              y2={padding.top + plotHeight}
              stroke="rgba(148, 173, 201, 0.14)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
          ))}
          {[25, 75].map((yVal) => (
            <line
              key={`hgrid-${yVal}`}
              x1={padding.left}
              y1={getY(yVal)}
              x2={padding.left + plotWidth}
              y2={getY(yVal)}
              stroke="rgba(148, 173, 201, 0.14)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
          ))}

          {/* Retained 10 km Physical Screening Threshold Line */}
          <line
            x1={thresholdX}
            y1={padding.top}
            x2={thresholdX}
            y2={padding.top + plotHeight}
            stroke="#22d3ee"
            strokeOpacity="0.62"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />
          <text
            x={thresholdX + 6}
            y={padding.top + 14}
            fill="#67e8f9"
            className="text-[10px] font-data font-semibold select-none pointer-events-none"
          >
            {MISS_DISTANCE_THRESHOLD_KM} km
          </text>

          {/* Horizontal Criticality Threshold Line */}
          <line
            x1={padding.left}
            y1={thresholdY}
            x2={padding.left + plotWidth}
            y2={thresholdY}
            stroke="#38bdf8"
            strokeOpacity="0.5"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />

          {/* Quadrant Labels */}
          <text
            x={padding.left + 12}
            y={thresholdY - 12}
            fill="#fda4af"
            className="text-[11px] font-sans font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant I: Critical Intervention
          </text>

          <text
            x={padding.left + plotWidth - 14}
            y={padding.top + 22}
            textAnchor="end"
            fill="#7dd3fc"
            className="text-[11px] font-sans font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant II: Strategic Vigilance
          </text>

          <text
            x={padding.left + 12}
            y={padding.top + plotHeight - 14}
            fill="#fcd34d"
            className="text-[11px] font-sans font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant III: Physical Caution
          </text>

          <text
            x={padding.left + plotWidth - 14}
            y={padding.top + plotHeight - 14}
            textAnchor="end"
            fill="#94adc9"
            className="text-[11px] font-sans font-semibold tracking-wide select-none pointer-events-none"
          >
            Quadrant IV: Routine Monitoring
          </text>

          {/* Axes Borders */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="rgba(148, 173, 201, 0.35)"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="rgba(148, 173, 201, 0.35)"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left + plotWidth}
            y1={padding.top}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="rgba(148, 173, 201, 0.14)"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left + plotWidth}
            y2={padding.top}
            stroke="rgba(148, 173, 201, 0.14)"
            strokeWidth="1"
          />

          {/* Dynamic X Axis Ticks */}
          {xTicks.map((dist) => {
            const x = getX(dist);
            const isFirst = dist === 0;
            const isLast = dist === xMax;
            return (
              <g
                key={`x-tick-${dist}`}
                transform={`translate(${x}, ${padding.top + plotHeight})`}
              >
                <line y2="5" stroke="#64748b" strokeWidth="1.5" />
                <text
                  x={isFirst ? 2 : isLast ? -2 : 0}
                  y="19"
                  textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                  fill="#94adc9"
                  className="text-[11px] font-data"
                >
                  {dist} km
                </text>
              </g>
            );
          })}

          {/* Y Axis Ticks */}
          {[0, 25, 50, 75, 100].map((crit) => {
            const y = getY(crit);
            const isZero = crit === 0;
            return (
              <g key={`y-tick-${crit}`} transform={`translate(${padding.left}, ${y})`}>
                <line x2="-5" stroke="#64748b" strokeWidth="1.5" />
                <text
                  x="-10"
                  y={isZero ? -4 : 4}
                  textAnchor="end"
                  fill="#94adc9"
                  className="text-[11px] font-data"
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
            fill="#b4c6dc"
            className="text-[12px] font-sans font-semibold tracking-wide"
          >
            ← Closer Separation (Higher Physical Hazard) | Physical Miss Distance (km) →
          </text>

          <text
            x={-(padding.top + plotHeight / 2)}
            y={20}
            transform="rotate(-90)"
            textAnchor="middle"
            fill="#b4c6dc"
            className="text-[12px] font-sans font-semibold tracking-wide"
          >
            Mission Criticality Score (0-100) →
          </text>

          {/* Leader lines */}
          {nodes.map((node) => {
            const label = labelMap.get(node.event.conjunction_id);
            if (!label || !label.needsLeader) return null;
            return (
              <line
                key={`leader-${node.event.conjunction_id}`}
                x1={node.cx}
                y1={node.cy}
                x2={label.x + (label.anchor === 'end' ? 3 : -3)}
                y2={label.y - 3}
                stroke={node.isSelected ? 'rgba(34, 211, 238, 0.7)' : 'rgba(148, 173, 201, 0.45)'}
                strokeWidth="1"
                strokeDasharray="2 2"
                pointerEvents="none"
              />
            );
          })}

          {/* Conjunction Data Points */}
          {[...nodes]
            .sort(
              (a, b) => Number(a.isSelected || a.isHovered) - Number(b.isSelected || b.isHovered)
            )
            .map((node) => {
              const { event, index, critScore, cx, cy, isSelected, isHovered, isUrgent, primaryColor } =
                node;
              const isDimmed = hasSelection && !isSelected && !isHovered;
              const labelPos = labelMap.get(event.conjunction_id);

              return (
                <g
                  key={event.conjunction_id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${event.primary_object.name} vs ${event.secondary_object.name}, miss distance ${event.miss_distance_km} km, criticality ${critScore}`}
                  className="cursor-pointer focus:outline-none transition-opacity duration-200"
                  opacity={isDimmed ? 0.55 : 1}
                  onClick={() => onSelectConjunction(event)}
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  {/* Soft Halo on Every Point */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered || isSelected ? 17 : isUrgent ? 15 : 12}
                    fill={primaryColor}
                    fillOpacity={isUrgent ? 0.24 : 0.18}
                    stroke={primaryColor}
                    strokeWidth="1"
                    strokeOpacity="0.45"
                  />

                  {/* Selected Point Pulsing Ring */}
                  {isSelected && (
                    <>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={23}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        strokeOpacity="0.85"
                        className="animate-ring-pulse"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={16}
                        fill="none"
                        stroke="#67e8f9"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                    </>
                  )}

                  {/* Main Point Circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 8.5 : isHovered ? 8 : 6.5}
                    fill={primaryColor}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? '2.2' : '1.75'}
                    filter="url(#pointHalo)"
                  />

                  {/* De-collided Satellite Name Label */}
                  {labelPos && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor={labelPos.anchor}
                      fill={isSelected ? '#67e8f9' : '#f1f5f9'}
                      className="font-sans text-[11px] font-semibold tracking-tight select-none"
                      style={{
                        paintOrder: 'stroke',
                        stroke: 'rgba(3, 7, 18, 0.85)',
                        strokeWidth: 3.5,
                        strokeLinejoin: 'round',
                      }}
                    >
                      {event.primary_object.name}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredEvent && (
          <GlassCard
            variant="chip"
            className="absolute top-3 right-5 p-3.5 text-xs max-w-xs z-20 pointer-events-none"
          >
            <div className="font-display font-semibold text-cyan-200 text-sm">
              {hoveredEvent.primary_object.name}
            </div>
            <div className="text-[#94adc9] text-xs font-sans">
              vs. {hoveredEvent.secondary_object.name}
            </div>
            <div className="mt-2.5 space-y-1.5 text-slate-200 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-[#94adc9]">Miss distance:</span>
                <span className="text-cyan-300 font-data font-semibold">
                  {formatDistance(hoveredEvent.miss_distance_km)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#94adc9]">Relative speed:</span>
                <span className="text-white font-data font-semibold">
                  {formatVelocity(hoveredEvent.relative_velocity_km_s)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#94adc9]">Mission criticality:</span>
                <span className="text-rose-300 font-data font-semibold">
                  {satellites.find((s) =>
                    isSameSatellite(s.noradId, hoveredEvent.primary_object.norad_id)
                  )?.criticality.score || 50}{' '}
                  / 100
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#94adc9]">TCA:</span>
                <span className="text-slate-100 font-data">
                  {formatUTC(hoveredEvent.tca).substring(0, 16)} UTC
                </span>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-cyan-300 font-sans">
              Click node to inspect full telemetry in right panel
            </div>
          </GlassCard>
        )}
      </div>

      {/* Dynamic Scale Hint + Threshold Note Caption */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#94adc9] mt-2">
        <span className="font-sans">
          X-axis dynamically scaled{' '}
          <span className="font-data text-cyan-300">0–{xMax} km</span> to fit all{' '}
          <span className="font-data text-slate-200">{conjunctions.length}</span> points (
          <span className="font-data">{MISS_DISTANCE_THRESHOLD_KM} km</span> threshold shown)
          {hiddenLabelCount > 0 ? ' • Hover or select clustered points for labels' : ''}.
        </span>
        <span className="font-sans italic text-[#94adc9]">
          Screening thresholds are operator-defined and adjustable
        </span>
      </div>

      {/* Bottom Operational Guideline Callout Box */}
      <div className="mt-3 bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 flex items-start space-x-3 text-xs sm:text-sm text-[#b4c6dc]">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold text-slate-100">Operational Guideline:</span> High mission criticality increases the urgency of operator intervention, but does not alter orbital mechanics or collision probability. Both axes must be investigated independently during conjunction evaluation.
        </p>
      </div>
    </GlassCard>
  );
};
