"""
Location Router
GET /api/location/search  — Nominatim geocoding
GET /api/location/reverse — Reverse geocode lat/lon
"""
import httpx
from fastapi import APIRouter, Query, HTTPException

router = APIRouter()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
REVERSE_URL   = "https://nominatim.openstreetmap.org/reverse"

HEADERS = {"User-Agent": "UFNS/1.0 (ufns@sih2026.in)"}


@router.get("/location/search")
async def search_location(q: str = Query(..., min_length=2)):
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            NOMINATIM_URL,
            params={"q": q, "format": "json", "addressdetails": 1, "limit": 8},
            headers=HEADERS,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")
    data = resp.json()
    results = []
    for item in data:
        results.append({
            "display_name": item.get("display_name"),
            "lat": float(item.get("lat", 0)),
            "lon": float(item.get("lon", 0)),
            "type": item.get("type"),
            "address": item.get("address", {}),
        })
    return results


@router.get("/location/reverse")
async def reverse_location(lat: float = Query(...), lon: float = Query(...)):
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            REVERSE_URL,
            params={"lat": lat, "lon": lon, "format": "json", "addressdetails": 1},
            headers=HEADERS,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Reverse geocoding service unavailable")
    data = resp.json()
    addr = data.get("address", {})
    return {
        "display_name": data.get("display_name"),
        "city": addr.get("city") or addr.get("town") or addr.get("village"),
        "ward": addr.get("suburb") or addr.get("neighbourhood"),
        "state": addr.get("state"),
        "country": addr.get("country"),
        "lat": float(data.get("lat", lat)),
        "lon": float(data.get("lon", lon)),
    }
