"""
Emergency Services Router
GET /api/shelters/nearest
GET /api/hospitals/nearest
GET /api/police/nearest
GET /api/fire/nearest
"""
import math
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from backend.database import get_db
from backend.models.emergency import Shelter, Hospital, PoliceStation, FireStation

router = APIRouter()


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in km between two lat/lon points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def _sort_by_distance(records, lat: float, lon: float, limit: int = 5):
    results = []
    for r in records:
        dist = haversine(lat, lon, r.latitude, r.longitude)
        results.append({
            "id": r.id,
            "name": r.name,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "phone": getattr(r, "phone", None),
            "capacity": getattr(r, "capacity", None),
            "distance_km": round(dist, 2),
        })
    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]


# ── Mock fallback data ──────────────────────────────────────────────────────────
MOCK_SHELTERS = [
    {"id":1,"name":"Community Relief Center Alpha","latitude":19.0760,"longitude":72.8777,"phone":"1800-111-001","capacity":500,"distance_km":0},
    {"id":2,"name":"Municipal Flood Shelter Beta","latitude":19.0400,"longitude":72.8490,"phone":"1800-111-002","capacity":300,"distance_km":0},
    {"id":3,"name":"Govt High School Emergency Camp","latitude":19.1000,"longitude":72.8680,"phone":"1800-111-003","capacity":800,"distance_km":0},
]
MOCK_HOSPITALS = [
    {"id":1,"name":"City General Hospital","latitude":19.0760,"longitude":72.8777,"phone":"1800-222-001","capacity":300,"distance_km":0},
    {"id":2,"name":"District Medical Center","latitude":19.0540,"longitude":72.8350,"phone":"1800-222-002","capacity":200,"distance_km":0},
]
MOCK_POLICE = [
    {"id":1,"name":"Central Police Station","latitude":19.0760,"longitude":72.8777,"phone":"100","capacity":None,"distance_km":0},
    {"id":2,"name":"North Division HQ","latitude":19.1200,"longitude":72.9050,"phone":"100","capacity":None,"distance_km":0},
]
MOCK_FIRE = [
    {"id":1,"name":"Fire Brigade Station 1","latitude":19.0760,"longitude":72.8777,"phone":"101","capacity":None,"distance_km":0},
    {"id":2,"name":"Fire Brigade Station 2","latitude":19.0400,"longitude":72.8490,"phone":"101","capacity":None,"distance_km":0},
]


def _mock_nearest(data, lat, lon, limit=5):
    results = []
    for r in data:
        d = haversine(lat, lon, r["latitude"], r["longitude"])
        results.append({**r, "distance_km": round(d, 2)})
    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]


@router.get("/shelters/nearest")
async def nearest_shelters(
    lat: float = Query(...), lon: float = Query(...), limit: int = 5,
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(Shelter))
        records = result.scalars().all()
        if records:
            return _sort_by_distance(records, lat, lon, limit)
    except Exception:
        pass
    return _mock_nearest(MOCK_SHELTERS, lat, lon, limit)


@router.get("/hospitals/nearest")
async def nearest_hospitals(
    lat: float = Query(...), lon: float = Query(...), limit: int = 5,
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(Hospital))
        records = result.scalars().all()
        if records:
            return _sort_by_distance(records, lat, lon, limit)
    except Exception:
        pass
    return _mock_nearest(MOCK_HOSPITALS, lat, lon, limit)


@router.get("/police/nearest")
async def nearest_police(
    lat: float = Query(...), lon: float = Query(...), limit: int = 5,
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(PoliceStation))
        records = result.scalars().all()
        if records:
            return _sort_by_distance(records, lat, lon, limit)
    except Exception:
        pass
    return _mock_nearest(MOCK_POLICE, lat, lon, limit)


@router.get("/fire/nearest")
async def nearest_fire(
    lat: float = Query(...), lon: float = Query(...), limit: int = 5,
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(FireStation))
        records = result.scalars().all()
        if records:
            return _sort_by_distance(records, lat, lon, limit)
    except Exception:
        pass
    return _mock_nearest(MOCK_FIRE, lat, lon, limit)
