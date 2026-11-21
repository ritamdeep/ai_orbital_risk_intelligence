import { SpaceObjectSummary } from '../../types/orbital';
import { SatelliteMissionProfile } from '../../types/intelligence';

export const MOCK_SPACE_OBJECTS: SpaceObjectSummary[] = [
  {
    norad_id: 44431,
    name: 'CARTOSAT-3',
    intl_designator: '2019-081A',
    object_type: 'PAYLOAD',
    country_code: 'IND',
    orbit_regime: 'LEO',
    perigee_km: 505.0,
    apogee_km: 512.0,
    inclination_deg: 97.5,
    period_min: 94.8,
    current_position: { latitude: 18.42, longitude: 79.12, altitude_km: 508.4 },
    tle_epoch: '2026-11-21T18:00:00Z',
    is_active: true
  },
  {
    norad_id: 51656,
    name: 'EOS-04 (RISAT-1A)',
    intl_designator: '2022-013A',
    object_type: 'PAYLOAD',
    country_code: 'IND',
    orbit_regime: 'LEO',
    perigee_km: 529.0,
    apogee_km: 535.0,
    inclination_deg: 97.5,
    period_min: 95.2,
    current_position: { latitude: -12.30, longitude: 85.45, altitude_km: 531.1 },
    tle_epoch: '2026-11-21T19:30:00Z',
    is_active: true
  },
  {
    norad_id: 41752,
    name: 'INSAT-3DR',
    intl_designator: '2016-054A',
    object_type: 'PAYLOAD',
    country_code: 'IND',
    orbit_regime: 'GEO',
    perigee_km: 35782.0,
    apogee_km: 35790.0,
    inclination_deg: 0.1,
    period_min: 1436.1,
    current_position: { latitude: 0.05, longitude: 74.02, altitude_km: 35786.0 },
    tle_epoch: '2026-11-21T12:00:00Z',
    is_active: true
  },
  {
    norad_id: 54361,
    name: 'OCEANSAT-3 (EOS-06)',
    intl_designator: '2022-158A',
    object_type: 'PAYLOAD',
    country_code: 'IND',
    orbit_regime: 'LEO',
    perigee_km: 720.0,
    apogee_km: 724.0,
    inclination_deg: 98.3,
    period_min: 99.2,
    current_position: { latitude: 45.10, longitude: 60.18, altitude_km: 721.8 },
    tle_epoch: '2026-11-21T21:00:00Z',
    is_active: true
  },
  {
    norad_id: 41783,
    name: 'PRATHAM (IIT BOMBAY)',
    intl_designator: '2016-059C',
    object_type: 'PAYLOAD',
    country_code: 'IND',
    orbit_regime: 'LEO',
    perigee_km: 668.0,
    apogee_km: 704.0,
    inclination_deg: 98.2,
    period_min: 98.4,
    current_position: { latitude: -30.50, longitude: 120.40, altitude_km: 686.2 },
    tle_epoch: '2026-11-21T14:15:00Z',
    is_active: true
  },
  // Catalogued Debris
  {
    norad_id: 28221,
    name: 'FENGYUN 1C DEBRIS',
    intl_designator: '1999-025DF',
    object_type: 'DEBRIS',
    country_code: 'CHN',
    orbit_regime: 'LEO',
    perigee_km: 502.0,
    apogee_km: 518.0,
    inclination_deg: 98.8,
    period_min: 94.7,
    current_position: { latitude: 19.10, longitude: 80.30, altitude_km: 509.8 },
    tle_epoch: '2026-11-21T18:45:00Z',
    is_active: false
  },
  {
    norad_id: 34454,
    name: 'COSMOS 2251 DEBRIS',
    intl_designator: '1993-036ABB',
    object_type: 'DEBRIS',
    country_code: 'RUS',
    orbit_regime: 'LEO',
    perigee_km: 524.0,
    apogee_km: 541.0,
    inclination_deg: 74.0,
    period_min: 95.3,
    current_position: { latitude: -11.90, longitude: 86.10, altitude_km: 532.0 },
    tle_epoch: '2026-11-21T20:10:00Z',
    is_active: false
  },
  {
    norad_id: 23467,
    name: 'SL-16 R/B DEBRIS',
    intl_designator: '1994-074C',
    object_type: 'ROCKET_BODY',
    country_code: 'CIS',
    orbit_regime: 'LEO',
    perigee_km: 660.0,
    apogee_km: 712.0,
    inclination_deg: 71.0,
    period_min: 98.5,
    current_position: { latitude: -29.80, longitude: 121.20, altitude_km: 687.5 },
    tle_epoch: '2026-11-21T16:00:00Z',
    is_active: false
  }
];

export const MOCK_MISSION_PROFILES: Record<number, SatelliteMissionProfile> = {
  44431: {
    norad_id: 44431,
    name: 'CARTOSAT-3',
    operator: 'ISRO (Indian Space Research Organisation)',
    country: 'India',
    launch_year: 2019,
    mission_category: 'EARTH_OBSERVATION',
    primary_mission_purpose: 'Sub-meter optical high-resolution planetary surface cartography, strategic coastal monitoring, urban cadastral mapping, and critical national infrastructure tracking.',
    verified_operational_status: 'OPERATIONAL',
    sensors: [
      {
        sensor_name: 'Panchromatic (PAN) High-Resolution Camera',
        sensor_type: 'OPTICAL_PAN_MS',
        spatial_resolution_m: 0.28,
        swath_width_km: 17.0,
        spectral_bands: ['0.45 - 0.90 µm (PAN)'],
        revisit_time_days: 4,
        primary_application: 'High-precision urban infrastructure and coastal vulnerability surveillance'
      },
      {
        sensor_name: 'Multispectral (MX) 4-Band Camera',
        sensor_type: 'OPTICAL_PAN_MS',
        spatial_resolution_m: 1.12,
        swath_width_km: 16.0,
        spectral_bands: ['Blue (0.45-0.52 µm)', 'Green (0.52-0.59 µm)', 'Red (0.62-0.68 µm)', 'NIR (0.77-0.86 µm)'],
        revisit_time_days: 4,
        primary_application: 'Vegetation health index, water body boundary mapping'
      }
    ],
    criticality: {
      score: 92,
      tier: 'TIER_1_CRITICAL',
      rationale: 'Highest-resolution domestic optical earth-observation asset in India. Critical for national infrastructure planning, rapid post-disaster structural integrity assessment, and coastal defense monitoring.',
      breakdown: {
        life_safety_support: 75,
        disaster_management: 90,
        national_infrastructure: 98,
        commercial_scientific: 88
      },
      scoring_factors: [
        'Sole operational domestic provider of 0.28m ground resolution imagery',
        'Directly feeds National Disaster Emergency Management and NDRF relief corridors',
        'Primary high-resolution baseline for Survey of India national cartography',
        'High capital replacement cost ($140M+ estimated mission budget)'
      ]
    },
    earth_impact: {
      norad_id: 44431,
      satellite_name: 'CARTOSAT-3',
      disrupted_sectors: [
        'Disaster Management & Damage Assessment',
        'Urban Infrastructure Planning',
        'Coastal Zone Regulation & Surveillance',
        'National Geographic Cadastral Mapping'
      ],
      immediate_consequences: [
        'Total loss of 0.28m resolution rapid-response tactical imagery across the Indian subcontinent',
        'Degradation of flood inundation structural impact assessment for civil defense forces',
        'Delay in urban corridor planning and border infrastructure development initiatives'
      ],
      regional_exposure: [
        'Coastal India (Odisha, Andhra Pradesh, Tamil Nadu, Gujarat)',
        'Urban Megacities (NCR, Mumbai MMR, Bengaluru)',
        'Himalayan landslide-vulnerable transport corridors'
      ],
      lead_time_to_impact_hours: 12,
      service_degradation_severity: 'SEVERE'
    },
    continuity_alternatives: [
      {
        norad_id: 51656,
        name: 'EOS-04 (RISAT-1A)',
        operator: 'ISRO',
        orbit_regime: 'LEO (529 km SSO)',
        sensor_type: 'Synthetic Aperture Radar (C-band SAR)',
        sensor_parity: 'PARTIAL',
        revisit_time_hours: 48,
        coverage_overlap_pct: 85,
        redundancy_gaps: [
          {
            parameter: 'Sensor Modality',
            target_value: 'High-Resolution Optical (0.28m PAN)',
            alternative_value: 'Active Microwave Radar (C-band SAR, 1-3m)',
            impact_assessment: 'SAR can image day/night through cloud cover, but cannot provide optical multi-band color discrimination.'
          },
          {
            parameter: 'Spatial Resolution',
            target_value: '0.28 meters ground resolution',
            alternative_value: '1.0 meter (High-resolution Spotlight mode)',
            impact_assessment: 'Noticeable drop in micro-structural detail; vehicle and individual building damage classification impaired.'
          }
        ],
        viability_verdict: 'Viable immediate backup for all-weather flood boundary and major infrastructure monitoring, but unable to substitute for optical cadastral photography.'
      },
      {
        norad_id: 40697,
        name: 'SENTINEL-2A',
        operator: 'ESA (European Space Agency / Copernicus)',
        orbit_regime: 'LEO (786 km SSO)',
        sensor_type: 'Multispectral Optical (13 Spectral Bands)',
        sensor_parity: 'PARTIAL',
        revisit_time_hours: 120,
        coverage_overlap_pct: 100,
        redundancy_gaps: [
          {
            parameter: 'Spatial Resolution',
            target_value: '0.28 meters ground resolution',
            alternative_value: '10 - 20 meters multispectral',
            impact_assessment: 'Coarse resolution unsuitable for detailed structural urban reconnaissance.'
          },
          {
            parameter: 'Revisit Frequency',
            target_value: '4 days (or rapid agile steering)',
            alternative_value: '5 days constellation revisit over tropics',
            impact_assessment: 'Longer latency for critical time-sensitive emergency updates.'
          }
        ],
        viability_verdict: 'Excellent supplementary regional vegetation and flood extent dataset, but cannot match sub-meter tactical resolution.'
      }
    ]
  },
  51656: {
    norad_id: 51656,
    name: 'EOS-04 (RISAT-1A)',
    operator: 'ISRO',
    country: 'India',
    launch_year: 2022,
    mission_category: 'DISASTER_MANAGEMENT',
    primary_mission_purpose: 'All-weather, day-and-night C-band Synthetic Aperture Radar (SAR) earth observation for flood inundation mapping, agricultural crop assessment, soil moisture monitoring, and cyclone tracking.',
    verified_operational_status: 'OPERATIONAL',
    sensors: [
      {
        sensor_name: 'C-band Synthetic Aperture Radar (SAR)',
        sensor_type: 'SYNTHETIC_APERTURE_RADAR',
        spatial_resolution_m: 1.0,
        swath_width_km: 25.0,
        spectral_bands: ['5.35 GHz (C-band)'],
        revisit_time_days: 12,
        primary_application: 'All-weather cloud-penetrating flood mapping and soil moisture monitoring'
      }
    ],
    criticality: {
      score: 95,
      tier: 'TIER_1_CRITICAL',
      rationale: 'Indispensable primary domestic radar asset. During monsoon seasons and severe tropical cyclones, heavy cloud cover renders optical satellites blind; EOS-04 provides the sole real-time radar flood maps for national disaster response.',
      breakdown: {
        life_safety_support: 95,
        disaster_management: 98,
        national_infrastructure: 90,
        commercial_scientific: 85
      },
      scoring_factors: [
        'Sole active domestic sovereign C-band SAR satellite',
        'Mandatory single-point lifeline during monsoon inundation and Bay of Bengal cyclones',
        'Direct feed into Ministry of Home Affairs Disaster Resource Network'
      ]
    },
    earth_impact: {
      norad_id: 51656,
      satellite_name: 'EOS-04 (RISAT-1A)',
      disrupted_sectors: [
        'Monsoon Flood Relief Operations (NDRF)',
        'Agricultural Crop Insurance Verification',
        'Cyclone Landfall Inundation Modeling',
        'National Water Resource Mapping'
      ],
      immediate_consequences: [
        'Near-total blackout of cloud-penetrating radar flood extent maps over India during monsoon cloud cover',
        'Delayed emergency evacuation orders in Brahmaputra and Godavari floodplains',
        'Dependency on international space charter activations with 24-48h coordination lag'
      ],
      regional_exposure: [
        'Assam & Brahmaputra river basin',
        'Odisha and West Bengal coastal deltas',
        'Bihar Kosi river flood-prone zones'
      ],
      lead_time_to_impact_hours: 6,
      service_degradation_severity: 'SEVERE'
    },
    continuity_alternatives: [
      {
        norad_id: 39634,
        name: 'SENTINEL-1A',
        operator: 'ESA (Copernicus)',
        orbit_regime: 'LEO (693 km SSO)',
        sensor_type: 'C-band Synthetic Aperture Radar',
        sensor_parity: 'PARTIAL',
        revisit_time_hours: 72,
        coverage_overlap_pct: 95,
        redundancy_gaps: [
          {
            parameter: 'Tasking Priority',
            target_value: 'Sovereign ISRO emergency steering',
            alternative_value: 'Pre-scheduled European baseline observation routine',
            impact_assessment: 'Indian civil defense cannot command immediate reactive angle steerings without International Disaster Charter invocation.'
          }
        ],
        viability_verdict: 'Highest technical parity alternative; excellent C-band radar quality, but subject to charter tasking latency.'
      }
    ]
  },
  41752: {
    norad_id: 41752,
    name: 'INSAT-3DR',
    operator: 'ISRO',
    country: 'India',
    launch_year: 2016,
    mission_category: 'METEOROLOGY',
    primary_mission_purpose: 'Geostationary dedicated meteorological satellite equipped with a 6-channel imager, 19-channel sounder, and Satellite-Aided Search & Rescue (SAS&R) transponder.',
    verified_operational_status: 'OPERATIONAL',
    sensors: [
      {
        sensor_name: '6-Channel Meteorological Multispectral Imager',
        sensor_type: 'THERMAL_INFRARED',
        spatial_resolution_m: 1000.0,
        spectral_bands: ['VIS (0.55-0.75 µm)', 'SWIR', 'MIR', 'TIR-1', 'TIR-2', 'WV (6.5-7.1 µm)'],
        revisit_time_days: 0.02, // 30-minute repeat continuous full-disk
        primary_application: 'Continuous cyclone tracking, cloud-top temperatures, atmospheric humidity profiles'
      },
      {
        sensor_name: 'Data Relay Transponder & SAS&R',
        sensor_type: 'RF_TRANSPONDER',
        primary_application: 'Distress alert beacon detection for Coast Guard and aircraft emergency locator transmitters'
      }
    ],
    criticality: {
      score: 96,
      tier: 'TIER_1_CRITICAL',
      rationale: 'Continuous geostationary sentinel over the Indian Ocean. Feeds India Meteorological Department (IMD) early cyclone warning systems protecting tens of millions of coastal residents.',
      breakdown: {
        life_safety_support: 100,
        disaster_management: 96,
        national_infrastructure: 92,
        commercial_scientific: 82
      },
      scoring_factors: [
        'Continuous 30-minute full-disk monitoring of Indian Ocean cyclone genesis',
        'Directly powers IMD early evacuation warning models',
        'Carries international Cospas-Sarsat maritime distress signal receiver'
      ]
    },
    earth_impact: {
      norad_id: 41752,
      satellite_name: 'INSAT-3DR',
      disrupted_sectors: [
        'National Cyclone Tracking & Early Warning (IMD)',
        'Aviation Meteorology & Jet Stream Turbulence Prediction',
        'Maritime Search and Rescue (Indian Coast Guard)',
        'Monsoon Onset & Rainfall Forecasting'
      ],
      immediate_consequences: [
        'Loss of half-hourly thermal infrared cloud-motion vector monitoring across the Arabian Sea and Bay of Bengal',
        'Severe degradation in 24-hour cyclone track and intensity landfall predictions',
        'Blind spot in automated distress beacon pick-up for Indian Ocean shipping routes'
      ],
      regional_exposure: [
        'Entire Indian Subcontinent',
        'North Indian Ocean maritime shipping corridors',
        'Bay of Bengal cyclone strike zones'
      ],
      lead_time_to_impact_hours: 1,
      service_degradation_severity: 'SEVERE'
    },
    continuity_alternatives: [
      {
        norad_id: 39532,
        name: 'INSAT-3D',
        operator: 'ISRO',
        orbit_regime: 'GEO (82°E)',
        sensor_type: '6-channel Imager & 19-channel Sounder',
        sensor_parity: 'FULL',
        revisit_time_hours: 0.5,
        coverage_overlap_pct: 95,
        redundancy_gaps: [
          {
            parameter: 'Operational Age & Redundancy',
            target_value: '2016 Launch (Nominal)',
            alternative_value: '2013 Launch (Aging orbital asset, beyond design lifespan)',
            impact_assessment: 'Sensor noise calibration slightly degraded; running on secondary propellant reserves.'
          }
        ],
        viability_verdict: 'Direct domestic sister satellite in adjacent orbital slot; provides immediate backup for meteorological observations.'
      }
    ]
  },
  41783: {
    norad_id: 41783,
    name: 'PRATHAM (IIT BOMBAY)',
    operator: 'IIT Bombay / ISRO',
    country: 'India',
    launch_year: 2016,
    mission_category: 'SCIENTIFIC',
    primary_mission_purpose: 'Academic student CubeSat mission measuring Total Electron Content (TEC) of the ionosphere to advance radio propagation research.',
    verified_operational_status: 'OPERATIONAL',
    sensors: [
      {
        sensor_name: 'Dual-Frequency Beacon Transmitter',
        sensor_type: 'OTHER',
        primary_application: 'Ionospheric electron density profiling & beacon signal absorption study'
      }
    ],
    criticality: {
      score: 48,
      tier: 'TIER_3_MODERATE',
      rationale: 'Scientific CubeSat payload. Data supports academic research and radio propagation calibration, but carries no direct civil life-safety dependency.',
      breakdown: {
        life_safety_support: 25,
        disaster_management: 20,
        national_infrastructure: 35,
        commercial_scientific: 75
      },
      scoring_factors: [
        'Academic research mission with non-critical life-safety support',
        'Abundant global GNSS TEC alternative datasets available',
        'Operational ground stations in Mumbai and Paris'
      ]
    },
    earth_impact: {
      norad_id: 41783,
      satellite_name: 'PRATHAM (IIT BOMBAY)',
      disrupted_sectors: [
        'Ionospheric Total Electron Content (TEC) Research',
        'Radio Signal Propagation Studies'
      ],
      immediate_consequences: [
        'Interruption of student-operated VHF/UHF beacon research passes',
        'Reliance on secondary GNSS occultation stations for ionospheric data'
      ],
      regional_exposure: [
        'IIT Bombay Ground Station Footprint',
        'European Ground Station Consortium'
      ],
      lead_time_to_impact_hours: 48,
      service_degradation_severity: 'LOW'
    },
    continuity_alternatives: []
  },
  54361: {
    norad_id: 54361,
    name: 'OCEANSAT-3 (EOS-06)',
    operator: 'ISRO',
    country: 'India',
    launch_year: 2022,
    mission_category: 'EARTH_OBSERVATION',
    primary_mission_purpose: 'Global oceanographic surveillance, sea surface temperature, ocean color monitoring, and sea-surface wind vector derivation.',
    verified_operational_status: 'OPERATIONAL',
    sensors: [
      {
        sensor_name: 'Ocean Color Monitor (OCM-3)',
        sensor_type: 'OPTICAL_PAN_MS',
        spatial_resolution_m: 360.0,
        swath_width_km: 1400.0,
        revisit_time_days: 2,
        primary_application: 'Phytoplankton bloom tracking and coastal sediment dynamics'
      },
      {
        sensor_name: 'Ku-Band Scatterometer (SCAT-3)',
        sensor_type: 'OTHER',
        spatial_resolution_m: 25000.0,
        primary_application: 'Ocean surface wind vectors for cyclone intensity forecasting'
      }
    ],
    criticality: {
      score: 84,
      tier: 'TIER_2_HIGH',
      rationale: 'Crucial oceanographic asset providing sea-surface wind vectors directly feeding IMD cyclone trajectory and storm surge modeling.',
      breakdown: {
        life_safety_support: 82,
        disaster_management: 85,
        national_infrastructure: 78,
        commercial_scientific: 90
      },
      scoring_factors: [
        'High-accuracy Ku-band scatterometer wind vector feeds for cyclone forecasts',
        'Sovereign coastal fishery zone potential fishing zone (PFZ) advisories',
        'Regional multi-spectral ocean color observations'
      ]
    },
    earth_impact: {
      norad_id: 54361,
      satellite_name: 'OCEANSAT-3 (EOS-06)',
      disrupted_sectors: [
        'Cyclone Track & Intensity Forecasting (IMD)',
        'Potential Fishing Zone (PFZ) Advisories (INCOIS)',
        'Coastal Sedimentation and Marine Ecology'
      ],
      immediate_consequences: [
        'Loss of high-cadence Indian Ocean surface wind vector measurements',
        'Degradation of 48-hour storm surge height estimates for Bay of Bengal cyclones',
        'Temporary suspension of coastal fishing fleet advisories'
      ],
      regional_exposure: [
        'Bay of Bengal Coastal Belt',
        'Arabian Sea Maritime EEZ',
        'Indian Ocean Island Territories'
      ],
      lead_time_to_impact_hours: 12,
      service_degradation_severity: 'HIGH'
    },
    continuity_alternatives: []
  }
};
