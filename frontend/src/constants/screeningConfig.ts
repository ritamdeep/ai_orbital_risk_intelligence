/**
 * Screening thresholds and matrix configuration constants.
 * These thresholds are operator-defined and adjustable per mission rules.
 */

export const MISS_DISTANCE_THRESHOLD_KM = 10;
export const CRITICALITY_THRESHOLD = 50;

export const MAX_MISS_DISTANCE_KM = 20;
export const MAX_CRITICALITY_SCORE = 100;

/**
 * Physical severity screening thresholds for conjunction alert triage.
 * These are operator screening thresholds, not physical collision certainties.
 */
export const PHYSICAL_SEVERITY_THRESHOLDS = {
  URGENT_KM: 5.0,  // Red left-edge indicator (< 5 km)
  CAUTION_KM: 10.0, // Amber left-edge indicator (5 to 10 km)
  // Above 10 km is Routine / Neutral
} as const;

export const RISK_QUADRANTS = {
  Q1: {
    id: 'Q1',
    name: 'Quadrant I: Critical Intervention',
    description: 'High mission criticality with close physical separation requiring prioritized intervention.',
    threatLevel: 'URGENT_THREAT',
    color: '#ef4444',
  },
  Q2: {
    id: 'Q2',
    name: 'Quadrant II: Strategic Vigilance',
    description: 'High mission criticality with moderate separation; monitor for trajectory perturbations.',
    threatLevel: 'ROUTINE_TRACKING',
    color: '#0ea5e9',
  },
  Q3: {
    id: 'Q3',
    name: 'Quadrant III: Physical Caution',
    description: 'Close physical separation for low-criticality asset; standard avoidance protocol applies.',
    threatLevel: 'ELEVATED_CAUTION',
    color: '#f59e0b',
  },
  Q4: {
    id: 'Q4',
    name: 'Quadrant IV: Routine Monitoring',
    description: 'Nominal orbital separation and baseline criticality; standard screening cycle.',
    threatLevel: 'ROUTINE_TRACKING',
    color: '#64748b',
  },
} as const;
