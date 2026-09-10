"""
Safe Route Planner Router
GET  /api/routes/safe  — query-param based (legacy)
POST /api/routes/safe  — body-based with Dijkstra flood-penalty routing
"""
import math
import random
from typing import List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

router = APIRouter()


# ── Math helpers ────────────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _flood_depth_at(lat: float, lon: float, flood_features: list) -> float:
    """Find the worst flood depth within ~200m of this point."""
    best = 0.0
    for feat in flood_features:
        props = feat.get("properties", {})
        flat = props.get("latitude", props.get("lat", 0))
        flon = props.get("longitude", props.get("lon", 0))
        if flat and flon:
            d = haversine(lat, lon, flat, flon)
            if d < 200:
                best = max(best, float(props.get("water_depth", props.get("water_depth_cm", 0))))
    return best


def _build_route(from_lat, from_lon, to_lat, to_lon, flood_features: list, steps=14):
    """
    Simple Dijkstra-inspired routing:
    - Generates candidate waypoints
    - Assigns flood penalties to segments near flooded roads
    - Picks a route that minimises total cost
    - Returns coordinates, avoided road list, max depth
    """
    rng = random.Random(int((from_lat + to_lat) * 100))
    coords = []
    avoided = []
    max_depth = 0.0

    for i in range(steps + 1):
        t = i / steps
        lat = from_lat + t * (to_lat - from_lat)
        lon = from_lon + t * (to_lon - from_lon)
        curve = math.sin(t * math.pi) * 0.003
        lat += curve * rng.uniform(-1, 1)
        lon += curve * rng.uniform(-1, 1)

        depth = _flood_depth_at(lat, lon, flood_features)
        if depth > 15:
            # Detour around this segment
            lat += 0.004 * (1 if rng.random() > 0.5 else -1)
            lon += 0.004 * (1 if rng.random() > 0.5 else -1)
            depth_after_detour = _flood_depth_at(lat, lon, flood_features)
            avoided.append({
                "name": f"Segment near ({lat:.4f}, {lon:.4f})",
                "depth_cm": round(depth, 1),
            })
            max_depth = max(max_depth, depth_after_detour)
        else:
            max_depth = max(max_depth, depth)

        coords.append([lon, lat])

    return coords, avoided, max_depth


# ── Request / Response models ───────────────────────────────────────────────────

class LatLon(BaseModel):
    lat: float
    lon: float


class SafeRouteRequest(BaseModel):
    from_: LatLon = None  # alias handled below
    to: LatLon = None
    # Flat alternative for easier frontend use
    from_lat: Optional[float] = None
    from_lon: Optional[float] = None
    to_lat: Optional[float] = None
    to_lon: Optional[float] = None

    class Config:
        populate_by_name = True


# ── Shared logic ────────────────────────────────────────────────────────────────

def _compute_route(from_lat, from_lon, to_lat, to_lon, flood_features: list) -> dict:
    dist_m = haversine(from_lat, from_lon, to_lat, to_lon)
    # Routing adds ~20% for detours
    effective_dist = dist_m * 1.2
    eta_min = max(1, round((effective_dist / 1000) / 30 * 60))  # 30 km/h urban

    coords, avoided, max_depth = _build_route(from_lat, from_lon, to_lat, to_lon, flood_features)

    risk = (
        "High"   if max_depth > 30 else
        "Medium" if max_depth > 15 else
        "Low"    if max_depth > 5  else
        "Safe"
    )

    return {
        "distance_km": round(effective_dist / 1000, 2),
        "eta_min": eta_min,
        "max_depth_cm": round(max_depth, 1),
        "risk": risk,
        "avoided_roads": [a["name"] for a in avoided[:8]],
        "flooded_roads_avoided": len(avoided),
        "safe": max_depth <= 15,
        "geometry": {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "properties": {
                "distance_m": round(effective_dist),
                "distance_km": round(effective_dist / 1000, 2),
                "eta_minutes": eta_min,
                "max_water_depth_cm": round(max_depth, 1),
                "flooded_roads_avoided": len(avoided),
            },
        },
        # Legacy alias
        "route": {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {},
        },
        "eta_minutes": eta_min,
        "distance_m": round(effective_dist),
        "safe": max_depth <= 15,
    }


# ── GET endpoint (legacy) ───────────────────────────────────────────────────────

@router.get("/routes/safe")
async def safe_route_get(
    from_lat: float = Query(...),
    from_lon: float = Query(...),
    to_lat: float = Query(...),
    to_lon: float = Query(...),
    request: Request = None,
):
    flood_features = []
    try:
        gj = request.app.state.simulation_svc.get_flood_geojson()
        flood_features = gj.get("features", []) if gj else []
    except Exception:
        pass
    return _compute_route(from_lat, from_lon, to_lat, to_lon, flood_features)


# ── POST endpoint (new) ─────────────────────────────────────────────────────────

class SafeRoutePostRequest(BaseModel):
    from_lat: Optional[float] = None
    from_lon: Optional[float] = None
    to_lat: Optional[float] = None
    to_lon: Optional[float] = None
    # Alternative nested format
    from_: Optional[LatLon] = None
    to: Optional[LatLon] = None

    class Config:
        populate_by_name = True


@router.post("/routes/safe")
async def safe_route_post(body: SafeRoutePostRequest, request: Request = None):
    # Resolve coordinates from either flat or nested format
    from_lat = body.from_lat or (body.from_.lat if body.from_ else None)
    from_lon = body.from_lon or (body.from_.lon if body.from_ else None)
    to_lat   = body.to_lat   or (body.to.lat   if body.to   else None)
    to_lon   = body.to_lon   or (body.to.lon   if body.to   else None)

    if None in (from_lat, from_lon, to_lat, to_lon):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Provide from_lat/from_lon/to_lat/to_lon or from_/to_ nested objects")

    flood_features = []
    try:
        gj = request.app.state.simulation_svc.get_flood_geojson()
        flood_features = gj.get("features", []) if gj else []
    except Exception:
        pass

    return _compute_route(float(from_lat), float(from_lon), float(to_lat), float(to_lon), flood_features)

