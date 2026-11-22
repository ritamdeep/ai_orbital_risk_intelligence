export type MissionCategory = 
  | 'EARTH_OBSERVATION'
  | 'DISASTER_MANAGEMENT'
  | 'METEOROLOGY'
  | 'COMMUNICATIONS'
  | 'NAVIGATION'
  | 'SCIENTIFIC'
  | 'CUBESAT_RESEARCH';

export type CriticalityTier = 
  | 'TIER_1_CRITICAL' 
  | 'TIER_2_HIGH' 
  | 'TIER_3_MODERATE' 
  | 'TIER_4_STANDARD';

export interface SensorPayload {
  sensor_name: string;
  sensor_type: 'OPTICAL_PAN_MS' | 'SYNTHETIC_APERTURE_RADAR' | 'THERMAL_INFRARED' | 'ATMOSPHERIC_SOUNDER' | 'OCEAN_COLOR_MONITOR' | 'RF_TRANSPONDER' | 'OTHER';
  spatial_resolution_m?: number;
  swath_width_km?: number;
  spectral_bands?: string[];
  revisit_time_days?: number;
  primary_application: string;
}

export interface CriticalityAssessment {
  score: number; // 0 - 100
  tier: CriticalityTier;
  rationale: string;
  breakdown: {
    life_safety_support: number;       // e.g. Early cyclone warning, search & rescue
    disaster_management: number;       // Flood mapping, damage assessment
    national_infrastructure: number;   // Power grid sync, navigation, critical comms
    commercial_scientific: number;     // Environmental science, commercial sensing
  };
  scoring_factors: string[];
}

export interface EarthServiceImpact {
  norad_id: number;
  satellite_name: string;
  disrupted_sectors: string[];
  immediate_consequences: string[];
  regional_exposure: string[];
  lead_time_to_impact_hours: number;
  service_degradation_severity: 'SEVERE' | 'HIGH' | 'MODERATE' | 'LOW';
}

export interface RedundancyGap {
  parameter: string; // e.g. "Sensor Modality", "Spatial Resolution", "Revisit Time", "Orbital Phasing"
  target_value: string;
  alternative_value: string;
  impact_assessment: string;
}

export interface AlternativeSatellite {
  norad_id: number;
  name: string;
  operator: string;
  orbit_regime: string;
  sensor_type: string;
  sensor_parity: 'FULL' | 'PARTIAL' | 'MINIMAL' | 'INCOMPATIBLE';
  revisit_time_hours?: number;
  coverage_overlap_pct: number;
  redundancy_gaps: RedundancyGap[];
  viability_verdict: string;
}

export interface SatelliteMissionProfile {
  norad_id: number;
  name: string;
  operator: string;
  country: string;
  launch_year: number;
  mission_category: MissionCategory;
  primary_mission_purpose: string;
  verified_operational_status: 'OPERATIONAL' | 'DEGRADED' | 'STANDBY' | 'DECOMMISSIONED';
  sensors: SensorPayload[];
  criticality: CriticalityAssessment;
  earth_impact: EarthServiceImpact;
  continuity_alternatives: AlternativeSatellite[];
  dataSource?: 'real' | 'mock';
}

export interface OperatorAIBriefing {
  conjunction_id: string;
  executive_summary: string;
  physical_encounter_analysis: string;
  mission_vulnerability_analysis: string;
  service_continuity_plan: string;
  actionable_recommendations: string[];
  scientific_disclaimer: string;
  generated_at: string;
  dataSource?: 'real' | 'mock';
  generatedBy?: 'llm' | 'rule_based';
}
