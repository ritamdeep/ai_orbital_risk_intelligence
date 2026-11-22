/**
 * ASTRAVIGIL Shared Text & Enum Formatters
 *
 * Ensures:
 * - No raw enums (TIER_1_CRITICAL -> Tier 1 Critical)
 * - No underscores (ALL_WEATHER -> All Weather)
 * - No nested parentheses (ISRO (Indian Space Research Organisation) -> ISRO, Indian Space Research Organisation)
 * - Consistent readable presentation across all five tabs
 */

export function formatEnum(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCriticalityTier(tier: string | null | undefined): string {
  if (!tier) return 'Unassessed';
  const map: Record<string, string> = {
    TIER_1_CRITICAL: 'Tier 1 Critical',
    TIER_2_HIGH: 'Tier 2 High',
    TIER_3_MODERATE: 'Tier 3 Moderate',
    TIER_4_LOW: 'Tier 4 Low',
    TIER_4_STANDARD: 'Tier 4 Low',
  };
  return map[tier.toUpperCase()] || formatEnum(tier);
}

export function formatInvestigationStatus(status: string | null | undefined): string {
  if (!status) return 'Unreviewed';
  const map: Record<string, string> = {
    UNREVIEWED: 'Unreviewed',
    UNDER_EVALUATION: 'Under Evaluation',
    MONITORING: 'Monitoring',
    DISMISSED: 'Dismissed',
  };
  return map[status.toUpperCase()] || formatEnum(status);
}

export function formatObjectType(type: string | null | undefined): string {
  if (!type) return 'Unknown Object';
  const map: Record<string, string> = {
    PAYLOAD: 'Operational Satellite',
    payload: 'Operational Satellite',
    DEBRIS: 'Space Debris',
    debris: 'Space Debris',
    ROCKET_BODY: 'Rocket Body',
    rocket_body: 'Rocket Body',
    UNKNOWN: 'Uncatalogued Object',
    unknown: 'Uncatalogued Object',
  };
  return map[type] || formatEnum(type);
}

export function formatOperator(op: string | null | undefined): string {
  if (!op) return 'Unknown Operator';
  // Clean up nested parentheses like "(ISRO (Indian Space Research Organisation))"
  // or "ISRO (Indian Space Research Organisation)" -> "ISRO, Indian Space Research Organisation"
  const stripped = op.replace(/^\(+/, '').replace(/\)+$/, '').trim();
  const parts = stripped.split(/\s*[\(\)]+\s*/).filter(Boolean);
  if (parts.length > 1) {
    return parts.join(', ');
  }
  return stripped;
}

export function formatSensorType(type: string | null | undefined): string {
  if (!type) return 'Standard Payload';
  const map: Record<string, string> = {
    OPTICAL_PAN_MS: 'Panchromatic & Multispectral Optical',
    SYNTHETIC_APERTURE_RADAR: 'Synthetic Aperture Radar (SAR)',
    SAR_C_BAND: 'C-Band Synthetic Aperture Radar (SAR)',
    SAR_L_BAND: 'L-Band Synthetic Aperture Radar (SAR)',
    OPTICAL_VHR: 'Very High Resolution Optical (PAN/MX)',
    OPTICAL_MULTISPECTRAL: 'Multispectral Optical Camera',
    HYPERSPECTRAL: 'Hyperspectral Imager',
    OCEAN_MULTI_SENSOR: 'Ocean Color & Scatterometer Suite',
    GEO_MET_IMAGER_SOUNDER: 'Geostationary Meteorological Imager & Sounder',
    POLAR_MET_SOUNDER: 'Polar Atmospheric Sounder',
    IONOSPHERIC_BEACON: 'Ionospheric Research Beacon',
    THERMAL_INFRARED: 'Thermal Infrared (TIR)',
    ATMOSPHERIC_SOUNDER: 'Atmospheric Sounder',
    OCEAN_COLOR_MONITOR: 'Ocean Color Monitor (OCM)',
    RF_TRANSPONDER: 'RF Transponder & Relay',
    OTHER: 'Scientific Research Payload',
  };
  return map[type] || formatEnum(type);
}

export function formatDataAccess(tier: string | null | undefined): string {
  if (!tier) return 'Restricted';
  const map: Record<string, string> = {
    NATIONAL_RESTRICTED: 'Restricted / Government (Institutional Tasking)',
    OPEN_PUBLIC: 'Open Public (Free & Unrestricted)',
    CHARTER_TASKED: 'International Charter / Tasked Emergency',
    COMMERCIAL: 'Commercial Licensed',
    ACADEMIC: 'Academic & Research Use',
  };
  return map[tier.toUpperCase()] || formatEnum(tier);
}
