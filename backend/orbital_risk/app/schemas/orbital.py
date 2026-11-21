"""Orbital Risk Engine Pydantic Schemas.

Defines the data contracts for orbital telemetry, tracked objects,
ephemeris calculations, preliminary screening alerts, and conjunction events.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ObjectType(str, Enum):
    PAYLOAD = "PAYLOAD"
    ROCKET_BODY = "ROCKET_BODY"
    DEBRIS = "DEBRIS"
    UNKNOWN = "UNKNOWN"


class OrbitRegime(str, Enum):
    LEO = "LEO"  # Low Earth Orbit (< 2000 km)
    MEO = "MEO"  # Medium Earth Orbit (2000 - 35786 km)
    GEO = "GEO"  # Geostationary Earth Orbit (~35786 km)
    SSO = "SSO"  # Sun-Synchronous Orbit
    HEO = "HEO"  # Highly Elliptical Orbit
    OTHER = "OTHER"


class ScreeningPriority(str, Enum):
    URGENT_INVESTIGATION = "URGENT_INVESTIGATION"  # Miss distance < 1.0 km
    WARNING = "WARNING"                            # Miss distance 1.0 - 5.0 km
    ADVISORY = "ADVISORY"                          # Miss distance 5.0 - 15.0 km
    INFORMATIONAL = "INFORMATIONAL"                # Screened, within monitoring threshold


class CalculationStatus(str, Enum):
    COMPLETED = "COMPLETED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    DECAYED = "DECAYED"
    CALCULATION_ERROR = "CALCULATION_ERROR"


class DataFidelity(str, Enum):
    REAL_CELESTRAK = "REAL_CELESTRAK"
    REAL_CACHED = "REAL_CACHED"
    SYNTHETIC_SCENARIO = "SYNTHETIC_SCENARIO"
    BENCHMARK_MOCK = "BENCHMARK_MOCK"


# ============================================================================
# Core Position & Trajectory Models
# ============================================================================

class OrbitalPosition(BaseModel):
    """Position and velocity vector at a specific timestamp."""
    timestamp: datetime = Field(..., description="UTC timestamp of the orbital state")
    epoch_seconds: float = Field(..., description="Unix timestamp in seconds")
    lat: float = Field(..., description="WGS84 Geodetic Latitude in degrees (-90 to +90)")
    lon: float = Field(..., description="WGS84 Geodetic Longitude in degrees (-180 to +180)")
    alt_km: float = Field(..., description="Altitude above WGS84 reference ellipsoid in km")
    eci_x_km: float = Field(..., description="TEME ECI X coordinate in km")
    eci_y_km: float = Field(..., description="TEME ECI Y coordinate in km")
    eci_z_km: float = Field(..., description="TEME ECI Z coordinate in km")
    vel_x_km_s: float = Field(..., description="TEME ECI X velocity in km/s")
    vel_y_km_s: float = Field(..., description="TEME ECI Y velocity in km/s")
    vel_z_km_s: float = Field(..., description="TEME ECI Z velocity in km/s")
    speed_km_s: float = Field(..., description="Orbital speed in km/s")


class EphemerisResponse(BaseModel):
    """Orbital trajectory ephemeris over a forward time window."""
    norad_id: int = Field(..., description="NORAD Satellite Catalog number")
    name: str = Field(..., description="Common object name")
    orbit_regime: OrbitRegime = Field(..., description="Classified orbital regime")
    data_source: DataFidelity = Field(..., description="Data provenance")
    generated_at_utc: datetime = Field(..., description="Time this ephemeris was computed")
    step_size_seconds: int = Field(..., description="Propagation time step in seconds")
    trajectory: List[OrbitalPosition] = Field(..., description="Time-series position points")


# ============================================================================
# Tracked Object Catalog Models
# ============================================================================

class TrackedObject(BaseModel):
    """Catalogued orbital object (operational satellite, rocket body, or debris)."""
    norad_id: int = Field(..., description="NORAD Catalog number")
    name: str = Field(..., description="Common satellite or object name")
    intl_des: Optional[str] = Field(None, description="International Designator (COSPAR ID)")
    object_type: ObjectType = Field(ObjectType.UNKNOWN, description="Object classification")
    country: Optional[str] = Field(None, description="State of ownership or launch authority")
    epoch: datetime = Field(..., description="Epoch timestamp of the orbital element set")
    epoch_age_hours: float = Field(..., description="Hours elapsed since element set epoch")
    inclination_deg: float = Field(..., description="Orbital inclination in degrees")
    period_min: float = Field(..., description="Orbital period in minutes")
    apogee_km: float = Field(..., description="Apogee altitude in km above Earth surface")
    perigee_km: float = Field(..., description="Perigee altitude in km above Earth surface")
    eccentricity: float = Field(..., description="Orbital eccentricity")
    mean_motion: float = Field(..., description="Revolutions per day")
    rcs_size: Optional[str] = Field("UNKNOWN", description="Radar Cross Section size: SMALL, MEDIUM, LARGE")
    orbit_regime: OrbitRegime = Field(OrbitRegime.LEO, description="Classified regime")
    data_source: DataFidelity = Field(DataFidelity.REAL_CELESTRAK, description="Data provenance")
    tle_line1: Optional[str] = Field(None, description="TLE Line 1 if available")
    tle_line2: Optional[str] = Field(None, description="TLE Line 2 if available")


class DebrisObject(BaseModel):
    """Catalogued debris or derelict object."""
    norad_id: int
    name: str
    intl_des: Optional[str] = None
    origin_event: Optional[str] = Field(None, description="Parent event, e.g. 'Cosmos 2251 Collision', 'Fengyun-1C ASAT'")
    rcs_size: Optional[str] = "UNKNOWN"
    apogee_km: float
    perigee_km: float
    inclination_deg: float
    data_source: DataFidelity = DataFidelity.REAL_CELESTRAK


# ============================================================================
# Conjunction & Preliminary Close-Approach Models
# ============================================================================

class CloseApproachEvent(BaseModel):
    """Preliminary close-approach screening event between two orbital objects."""
    event_id: str = Field(..., description="Unique deterministic event identifier")
    primary_norad_id: int = Field(..., description="Target / operational satellite NORAD ID")
    primary_name: str = Field(..., description="Target satellite name")
    secondary_norad_id: int = Field(..., description="Encountering object NORAD ID")
    secondary_name: str = Field(..., description="Encountering object name")
    secondary_type: ObjectType = Field(..., description="Type of encountering object")
    tca_utc: datetime = Field(..., description="Time of Closest Approach (TCA) in UTC")
    miss_distance_km: float = Field(..., description="Minimum Euclidean distance at TCA in km")
    radial_miss_km: Optional[float] = Field(None, description="Relative distance component along radial axis")
    in_track_miss_km: Optional[float] = Field(None, description="Relative distance component along in-track axis")
    cross_track_miss_km: Optional[float] = Field(None, description="Relative distance component along cross-track axis")
    relative_velocity_km_s: float = Field(..., description="Relative encounter speed at TCA in km/s")
    screening_priority: ScreeningPriority = Field(..., description="Triage priority based on miss distance")
    calculation_status: CalculationStatus = Field(CalculationStatus.COMPLETED, description="Status of computation")
    data_fidelity: DataFidelity = Field(..., description="Whether event is derived from live or synthetic data")
    time_window_hours: float = Field(..., description="Lookahead window for which screening was computed")
    disclaimer: str = Field(
        default="PRELIMINARY_SCREENING_ONLY: Deterministic SGP4 propagation from mean orbital elements. "
                "This is NOT a validated Conjunction Assessment and does NOT calculate collision probability (Pc). "
                "No covariance error ellipsoids are modeled in TLE data.",
        description="Scientific limitation disclaimer required by space-safety rules."
    )


class ScreeningRequest(BaseModel):
    """Parameters to trigger an on-demand conjunction screening."""
    target_norad_id: int = Field(..., description="Primary satellite to screen")
    time_window_hours: float = Field(default=48.0, ge=1.0, le=168.0, description="Forward prediction window in hours (1-168)")
    threshold_km: float = Field(default=15.0, ge=0.1, le=100.0, description="Maximum miss distance to trigger an alert (km)")
    include_operational: bool = Field(default=True, description="Whether to include other operational satellites")
    include_debris: bool = Field(default=True, description="Whether to include catalogued debris and rocket bodies")


class ScreeningResponse(BaseModel):
    """Result of an orbital close-approach screening run."""
    screening_id: str
    target_norad_id: int
    target_name: str
    executed_at_utc: datetime
    time_window_hours: float
    threshold_km: float
    objects_in_catalog: int
    objects_screened_after_geometric_filter: int
    potential_encounters_count: int
    encounters: List[CloseApproachEvent]
    execution_time_ms: float
    disclaimer: str = (
        "PRELIMINARY_SCREENING_ONLY: Close approaches do not imply confirmed collision. "
        "Intended for decision support and triage prioritization."
    )


# ============================================================================
# Engine Health & Status
# ============================================================================

class EngineHealthResponse(BaseModel):
    """Operational health and data telemetry of the orbital risk engine."""
    status: str = "ONLINE"
    module: str = "Orbital Risk & Debris Engine (ASTRAVIGIL - Member 2)"
    version: str = "1.0.0"
    current_time_utc: datetime
    objects_cached_count: int
    debris_cached_count: int
    cache_last_updated_utc: Optional[datetime] = None
    propagation_engine: str = "SGP4 (Standard NORAD Model)"
    active_branch: str = "feature/orbital-risk"
