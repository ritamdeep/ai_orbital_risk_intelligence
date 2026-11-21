"""Startup-loaded, Pydantic-validated Mission Database repository."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from .schemas import SatelliteRecord

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "mission_db.json"


class MissionDatabase:
    """Loads mission_db.json once at startup and validates every record with Pydantic."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        self._by_primary_id: dict[int, SatelliteRecord] = {}
        self._lookup_index: dict[int, SatelliteRecord] = {}
        self.metadata: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        with self.db_path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)

        self.metadata = {
            "schemaVersion": str(raw.get("schemaVersion", "2.0.0")),
            "catalogName": str(raw.get("catalogName", "ASTRAVIGIL Mission Database")),
            "lastVerifiedUtc": str(raw.get("lastVerifiedUtc", "")),
        }

        primary: dict[int, SatelliteRecord] = {}
        index: dict[int, SatelliteRecord] = {}
        for item in raw.get("satellites", []):
            record = SatelliteRecord.model_validate(item)
            primary[record.noradId] = record
            index[record.noradId] = record
            if record.verifiedNoradId is not None:
                index[record.verifiedNoradId] = record
            for alt_id in record.alternateNoradIds:
                index[alt_id] = record

        self._by_primary_id = primary
        self._lookup_index = index

    def count(self) -> int:
        return len(self._by_primary_id)

    def get_by_norad_id(self, norad_id: int) -> Optional[SatelliteRecord]:
        """Resolve a satellite by primary contract NORAD ID or verified alias ID."""
        return self._lookup_index.get(norad_id)

    def list_all(self) -> list[SatelliteRecord]:
        return sorted(
            self._by_primary_id.values(),
            key=lambda s: (s.country != "India", s.name),
        )

    def filter_satellites(
        self,
        *,
        category: Optional[str] = None,
        operator: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[SatelliteRecord]:
        results = self.list_all()
        if category and category.strip().lower() != "all":
            cat_norm = category.strip().lower()
            results = [s for s in results if s.category.lower() == cat_norm]
        if operator:
            op_norm = operator.strip().lower()
            results = [s for s in results if op_norm in s.operator.lower()]
        if status:
            st_norm = status.strip().lower()
            results = [s for s in results if s.status.lower() == st_norm]
        if search:
            q = search.strip().lower()
            results = [
                s
                for s in results
                if q in s.name.lower()
                or q in str(s.noradId)
                or (s.verifiedNoradId is not None and q in str(s.verifiedNoradId))
                or any(q in alt.lower() for alt in s.alternateNames)
                or q in s.operator.lower()
            ]
        return results


@lru_cache(maxsize=1)
def get_mission_db() -> MissionDatabase:
    """Return the singleton startup-validated MissionDatabase."""
    return MissionDatabase()
