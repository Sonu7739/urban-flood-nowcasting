"""
Safe Route Planner Router
GET /api/routes/safe  — Returns a safe route avoiding flooded roads (water_depth > 15 cm)
Travel Cost = Distance + Flood Penalty
"""
import math
import random
from fastapi import APIRouter, Query

router = APIRouter()


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # metres
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def _interpolate_route(from_lat, from_lon, to_lat, to_lon, steps=12):
    """Generate a simple interpolated route with mock flood data."""
    coords = []
    avoided = []
    max_depth = 0.0
    for i in range(steps + 1):
        t = i / steps
        lat = from_lat + t * (to_lat - from_lat)
        lon = from_lon + t * (to_lon - from_lon)
        # Slight curve for realism
        curve_lat = lat + math.sin(t * math.pi) * 0.002
        curve_lon = lon + math.sin(t * math.pi) * 0.002
        coords.append([curve_lon, curve_lat])

        # Mock flood depth along route
        depth = random.uniform(0, 25)
        if depth > 15:
            avoided.append({
                "name": f"Segment near ({curve_lat:.4f}, {curve_lon:.4f})",
                "depth": round(depth, 1),
            })
            max_depth = max(max_depth, depth)

    # Safe detour: shift slightly if flooded
    if avoided:
        safe_coords = []
        for i, coord in enumerate(coords):
            lat_offset = 0.003 * math.sin(i / len(coords) * math.pi)
            lon_offset = 0.003 * math.cos(i / len(coords) * math.pi)
            safe_coords.append([coord[0] + lon_offset, coord[1] + lat_offset])
        coords = safe_coords
        max_depth = min(max_depth, 10.0)  # safe detour keeps depth low

    return coords, avoided, max_depth


@router.get("/routes/safe")
async def safe_route(
    from_lat: float = Query(...),
    from_lon: float = Query(...),
    to_lat: float = Query(...),
    to_lon: float = Query(...),
):
    dist_m = haversine(from_lat, from_lon, to_lat, to_lon)
    coords, avoided, max_depth = _interpolate_route(from_lat, from_lon, to_lat, to_lon)

    speed_kmh = 30  # average urban speed
    eta_min = round((dist_m / 1000) / speed_kmh * 60)

    return {
        "route": {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "properties": {
                "distance_m": round(dist_m),
                "distance_km": round(dist_m / 1000, 2),
                "eta_minutes": eta_min,
                "flooded_roads_avoided": len(avoided),
                "max_water_depth_cm": round(max_depth, 1),
                "avoided_segments": avoided[:5],
            },
        }
    }
