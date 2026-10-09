import math
from typing import List, Tuple
from sqlalchemy.orm import Session
import models

EARTH_RADIUS_METERS = 6371000.0

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Returns geodesic distance in meters between two lat/lon coordinates.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c

def find_candidate_incidents(
    db: Session,
    latitude: float,
    longitude: float,
    category: str,
    max_radius_meters: float = 500.0
) -> List[Tuple[models.Incident, float]]:
    """
    Efficiently searches for active incidents with the exact same category
    within max_radius_meters (default 500m).
    
    Uses a fast bounding-box pre-filter in SQL, then exact Haversine check.
    Returns list of tuples: (Incident, distance_in_meters), sorted by distance.
    """
    # 1 degree of latitude is ~111,000 meters
    lat_delta = max_radius_meters / 111000.0
    # 1 degree of longitude is ~111,000 * cos(lat) meters
    lon_delta = max_radius_meters / (111000.0 * math.cos(math.radians(latitude)) + 1e-9)

    min_lat = latitude - lat_delta
    max_lat = latitude + lat_delta
    min_lon = longitude - abs(lon_delta)
    max_lon = longitude + abs(lon_delta)

    # Fast indexed bounding box query on SQLite/PostgreSQL
    potential_matches = (
        db.query(models.Incident)
        .filter(
            models.Incident.category == category,
            models.Incident.status != "RESOLVED",
            models.Incident.latitude >= min_lat,
            models.Incident.latitude <= max_lat,
            models.Incident.longitude >= min_lon,
            models.Incident.longitude <= max_lon,
        )
        .all()
    )

    candidates = []
    for inc in potential_matches:
        dist = calculate_haversine_distance(latitude, longitude, inc.latitude, inc.longitude)
        if dist <= max_radius_meters:
            candidates.append((inc, dist))

    # Sort closest first
    candidates.sort(key=lambda x: x[1])
    return candidates
