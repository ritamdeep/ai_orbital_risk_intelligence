"""ASTRAVIGIL Core Configuration Settings."""

import os
from pathlib import Path
from typing import List
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseModel):
    PROJECT_NAME: str = "ASTRAVIGIL Orbital Risk Engine"
    VERSION: str = "1.0.0"
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]
    
    # Caching and Offline Data Paths
    CACHE_DIR: Path = BASE_DIR / "app" / "orbital_engine" / "cache"
    DATA_DIR: Path = BASE_DIR / "data"
    SAMPLE_TLES_FILE: Path = BASE_DIR / "data" / "sample_tles.txt"
    CACHE_EXPIRATION_HOURS: int = 4
    CONJUNCTION_CACHE_TTL_SECONDS: int = 60
    
    # CelesTrak Configuration
    CELESTRAK_BASE_URL: str = "https://celestrak.org/NORAD/elements/gp.php"
    
    # Screening Defaults
    DEFAULT_WINDOW_HOURS: float = 48.0
    DEFAULT_MAX_SEPARATION_KM: float = 15.0
    COARSE_STEP_SECONDS: int = 60
    FINE_STEP_SECONDS: int = 2
    
    # Earth Physical Constants (WGS84)
    EARTH_RADIUS_KM: float = 6378.137
    EARTH_FLATTENING: float = 1.0 / 298.257223563


settings = Settings()
os.makedirs(settings.CACHE_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
