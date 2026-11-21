"""ASTRAVIGIL Orbital Risk Engine - Pydantic Response Models.

Matches the shared API contract specification:
  - Exact camelCase field names and types
  - Population by alias for cross-module compatibility
  - Strict absence of collision probability or pc fields
"""

from enum import Enum
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field


class OrbitRegime(str, Enum):
    LEO = "LEO"
    MEO = "MEO"
    GEO = "GEO"
    SSO = "SSO"
    HEO = "HEO"
    OTHER = "OTHER"


class ScreeningPriority(str, Enum):
    URGENT_INVESTIGATION = "URGENT_INVESTIGATION"
    WARNING = "WARNING"
    ADVISORY = "ADVISORY"
    INFORMATIONAL = "INFORMATIONAL"


class DataFidelity(str, Enum):
    REAL = "real"
    MOCK = "mock"


class OrbitalPosition(BaseModel):
    """Internal domain model for propagated point."""
    timestamp: datetime
    epoch_seconds: float
    lat: float
    lon: float
    alt_km: float
    eci_x_km: float
    eci_y_km: float
    eci_z_km: float
    vel_x_km_s: float
    vel_y_km_s: float
    vel_z_km_s: float
    speed_km_s: float


class PositionModel(BaseModel):
    """Geodetic and ECI position vector at a specific UTC timestamp matching contract."""
    model_config = ConfigDict(populate_by_name=True)

    timestampUtc: str = Field(..., description="UTC ISO-8601 timestamp of propagation")
    latitude: float = Field(..., description="WGS84 Geodetic Latitude in degrees (-90 to +90)")
    longitude: float = Field(..., description="WGS84 Geodetic Longitude in degrees (-180 to +180)")
    altitudeKm: float = Field(..., description="Altitude above WGS84 reference ellipsoid in km")
    eciX: float = Field(..., description="TEME ECI X coordinate in km")
    eciY: float = Field(..., description="TEME ECI Y coordinate in km")
    eciZ: float = Field(..., description="TEME ECI Z coordinate in km")
    speedKmS: float = Field(..., description="Orbital speed in km/s")


class SatelliteSummary(BaseModel):
    """Summary and current orbital state of a tracked satellite or debris object."""
    model_config = ConfigDict(populate_by_name=True)

    noradId: int = Field(..., description="NORAD Catalog Number")
    name: str = Field(..., description="Common object name")
    intlDesignator: Optional[str] = Field(None, description="COSPAR International Designator")
    type: str = Field(..., description="Object classification: 'payload', 'debris', 'rocket_body', 'unknown'")
    countryCode: Optional[str] = Field(None, description="Country or launching agency code (e.g. IND, CIS, CHN)")
    orbitRegime: Optional[str] = Field(None, description="Orbit regime: 'LEO', 'MEO', 'GEO', 'SSO', 'HEO'")
    perigeeKm: float = Field(..., description="Perigee altitude in km above Earth surface")
    apogeeKm: float = Field(..., description="Apogee altitude in km above Earth surface")
    inclinationDeg: float = Field(..., description="Orbital inclination in degrees")
    periodMin: float = Field(..., description="Orbital period in minutes")
    tleEpochUtc: str = Field(..., description="Epoch timestamp of the source TLE/GP element set")
    position: PositionModel = Field(..., description="Propagated current orbital position")
    isActive: bool = Field(..., description="Operational status flag")
    dataSource: str = Field(..., description="Data provenance: 'real' if fetched live, 'mock' if bundled/simulated")


class ConjunctionEvent(BaseModel):
    """Preliminary close-approach screening event between a priority satellite and a space object."""
    model_config = ConfigDict(populate_by_name=True)

    eventId: str = Field(..., description="Stable event identifier (format: CONJ-YYYY-NNNN)")
    primaryObject: SatelliteSummary = Field(..., description="Target operational satellite")
    secondaryObject: SatelliteSummary = Field(..., description="Encountering space object (debris or satellite)")
    tcaUtc: str = Field(..., description="Time of Closest Approach (TCA) in UTC ISO-8601")
    missDistanceKm: float = Field(..., description="Minimum Euclidean separation distance at TCA in km")
    relativeVelocityKmS: float = Field(..., description="Relative encounter velocity at TCA in km/s")
    altitudeAtTcaKm: float = Field(..., description="Altitude of the encounter above Earth in km")
    tleEpochUtc: str = Field(..., description="TLE epoch of primary object used in propagation")
    tleUncertaintyKm: float = Field(..., description="Estimated 1-sigma positional uncertainty based on TLE age and BSTAR")
    screeningNote: str = Field(..., description="Astrodynamics screening note explaining flagged close approach")
    dataSource: str = Field(..., description="'real' if derived from live TLEs, 'mock' if from bundled offline data")
    isPreliminaryScreening: bool = Field(True, description="Always true; SGP4 screening without covariance error ellipsoids")
    investigationStatus: str = Field("UNREVIEWED", description="'UNREVIEWED' | 'UNDER_EVALUATION' | 'MONITORING' | 'DISMISSED'")


class HealthResponse(BaseModel):
    """Engine operational health and catalog telemetry."""
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field("healthy", description="'healthy' | 'degraded'")
    service: str = Field("astravigil-orbital-backend", description="Service identifier")
    version: str = Field("1.0.0", description="Backend semantic version")
    timestampUtc: str = Field(..., description="Current UTC timestamp")
    tleSource: str = Field(..., description="'celestrak' if live, 'mock' if bundled seed data")
    objectsCount: int = Field(..., description="Total tracked objects currently loaded")


class ErrorDetail(BaseModel):
    """Standardized error details."""
    model_config = ConfigDict(populate_by_name=True)

    code: str = Field(..., description="Machine-readable error code, e.g. NOT_FOUND, VALIDATION_ERROR")
    message: str = Field(..., description="Human-readable error description")
    details: Optional[Any] = Field(None, description="Optional granular validation errors")


class ErrorResponse(BaseModel):
    """Standard error response envelope."""
    model_config = ConfigDict(populate_by_name=True)

    error: ErrorDetail
    detail: Optional[str] = Field(None, description="Backwards compatibility mirror of error.message")
