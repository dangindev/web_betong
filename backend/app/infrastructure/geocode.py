from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass
class GeocodeResult:
    address: str
    latitude: float
    longitude: float
    source: str


class StubGeocodeAdapter:
    def geocode(self, address: str) -> GeocodeResult:
        digest = hashlib.sha256(address.encode("utf-8")).hexdigest()
        lat_seed = int(digest[:8], 16)
        lng_seed = int(digest[8:16], 16)

        latitude = 8.0 + (lat_seed % 900000) / 100000.0
        longitude = 102.0 + (lng_seed % 800000) / 100000.0

        return GeocodeResult(
            address=address,
            latitude=round(latitude, 6),
            longitude=round(longitude, 6),
            source="stub",
        )


geocode_adapter = StubGeocodeAdapter()
