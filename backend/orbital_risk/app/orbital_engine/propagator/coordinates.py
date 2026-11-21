"""Coordinate transformations between TEME (True Equator, Mean Equinox) ECI and WGS84 geodetic frames.

SGP4 outputs positions and velocities in the True Equator, Mean Equinox (TEME) of date frame.
This module provides fast, mathematically rigorous conversions to geodetic coordinates
(Latitude, Longitude, Altitude above WGS84 ellipsoid).
"""

import math
from datetime import datetime, timezone
from typing import Tuple

# WGS84 Ellipsoid Constants
WGS84_A = 6378.137          # Semi-major axis (km)
WGS84_F = 1.0 / 298.257223563 # Flattening
WGS84_B = WGS84_A * (1.0 - WGS84_F) # Semi-minor axis (km)
WGS84_E2 = 2.0 * WGS84_F - WGS84_F ** 2 # First eccentricity squared


def datetime_to_julian(dt: datetime) -> Tuple[float, float]:
    """Convert a UTC datetime to Julian Date components (jd_high, jd_low)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    year = dt.year
    month = dt.month
    day = dt.day

    if month <= 2:
        year -= 1
        month += 12

    a = math.floor(year / 100)
    b = 2 - a + math.floor(a / 4)

    jd_day = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5
    day_fraction = (dt.hour + dt.minute / 60.0 + dt.second / 3600.0 + dt.microsecond / 3.6e9) / 24.0

    return jd_day, day_fraction


def gmst_radians(jd_day: float, day_fraction: float) -> float:
    """Compute Greenwich Mean Sidereal Time (GMST) in radians."""
    jd = jd_day + day_fraction
    t = (jd - 2451545.0) / 36525.0
    # IAU 1982 GMST polynomial (in seconds of time)
    gmst_sec = 24110.54841 + 8640184.812866 * t + 0.093104 * (t ** 2) - 6.2e-6 * (t ** 3)
    # Add Earth rotation fraction
    gmst_sec += day_fraction * 86400.0 * 1.002737909350795
    # Convert seconds to radians (86400 seconds = 2 * pi radians)
    theta = (gmst_sec % 86400.0) * (2.0 * math.pi / 86400.0)
    return theta % (2.0 * math.pi)


def teme_to_ecef(x: float, y: float, z: float, gmst: float) -> Tuple[float, float, float]:
    """Rotate TEME ECI position vector to Earth-Centered Earth-Fixed (ECEF) using GMST."""
    cos_g = math.cos(gmst)
    sin_g = math.sin(gmst)
    x_ecef = cos_g * x + sin_g * y
    y_ecef = -sin_g * x + cos_g * y
    z_ecef = z
    return x_ecef, y_ecef, z_ecef


def ecef_to_geodetic(x: float, y: float, z: float) -> Tuple[float, float, float]:
    """Convert ECEF coordinates (km) to WGS84 Geodetic Latitude (deg), Longitude (deg), Altitude (km).

    Uses Bowring's closed-form algorithm (accurate to millimeters for satellite altitudes).
    """
    p = math.sqrt(x * x + y * y)
    if p < 1e-6:
        # Near poles
        lat = 90.0 if z > 0 else -90.0
        lon = 0.0
        alt = abs(z) - WGS84_B
        return lat, lon, alt

    lon_rad = math.atan2(y, x)
    lon_deg = math.degrees(lon_rad)

    # Bowring's iterative method
    e_prime2 = (WGS84_A ** 2 - WGS84_B ** 2) / (WGS84_B ** 2)
    theta = math.atan2(z * WGS84_A, p * WGS84_B)

    lat_rad = math.atan2(
        z + e_prime2 * WGS84_B * (math.sin(theta) ** 3),
        p - WGS84_E2 * WGS84_A * (math.cos(theta) ** 3)
    )

    # Normal radius of curvature
    sin_lat = math.sin(lat_rad)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    alt_km = (p / math.cos(lat_rad)) - n

    lat_deg = math.degrees(lat_rad)
    return lat_deg, lon_deg, alt_km


def teme_to_geodetic(x: float, y: float, z: float, dt: datetime) -> Tuple[float, float, float]:
    """Convert TEME position vector (km) at a given UTC datetime to (lat, lon, alt_km)."""
    jd_day, day_fraction = datetime_to_julian(dt)
    gmst = gmst_radians(jd_day, day_fraction)
    x_ecef, y_ecef, z_ecef = teme_to_ecef(x, y, z, gmst)
    return ecef_to_geodetic(x_ecef, y_ecef, z_ecef)
