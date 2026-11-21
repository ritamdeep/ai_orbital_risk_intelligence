"""ASTRAVIGIL Core Configuration Settings."""

import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseModel):
    PROJECT_NAME: str = "ASTRAVIGIL Orbital Risk Engine"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/orbital"
    
    # Caching
    CACHE_DIR: Path = BASE_DIR / "app" / "orbital_engine" / "cache"
    CACHE_EXPIRATION_HOURS: int = 4
    
    # CelesTrak Endpoints
    CELESTRAK_BASE_URL: str = "https://celestrak.org/NORAD/elements/gp.php"
    
    # Default Screening Configuration
    DEFAULT_TIME_WINDOW_HOURS: float = 48.0
    DEFAULT_MISS_DISTANCE_THRESHOLD_KM: float = 15.0
    COARSE_STEP_SECONDS: int = 60
    FINE_STEP_SECONDS: int = 2
    
    # Earth Parameters (WGS84)
    EARTH_RADIUS_KM: float = 6378.137
    EARTH_FLATTENING: float = 1.0 / 298.257223563


settings = Settings()
os.makedirs(settings.CACHE_DIR, exist_ok=True)
