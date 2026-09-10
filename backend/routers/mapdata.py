"""GET /api/map — Returns current flood GeoJSON."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get(
    "/map",
    summary="Get current flood map as GeoJSON",
    response_description="GeoJSON FeatureCollection of road segments with flood data",
)
async def get_flood_map(request: Request):
    """
    Returns a GeoJSON FeatureCollection where each feature is a road segment
    enriched with:
    - `water_depth` (cm)
    - `risk` (Green/Yellow/Orange/Red)
    - `risk_label` (Safe/Caution/Warning/Critical)
    - `timestamp`
    """
    svc = request.app.state.simulation_svc
    gj  = svc.get_flood_geojson()
    return JSONResponse(content=gj, media_type="application/geo+json")


@router.get(
    "/summary",
    summary="Get simulation summary statistics",
)
async def get_summary(request: Request):
    """Returns latest simulation summary — road counts per risk level, avg depth, etc."""
    svc = request.app.state.simulation_svc
    return svc.latest_summary or {"status": "no simulation run yet"}


@router.get(
    "/metrics",
    summary="Get ML model training metrics",
)
async def get_metrics(request: Request):
    """Returns RMSE, MAE, R² for the trained model."""
    svc = request.app.state.prediction_svc
    return {
        "model_name": svc.model_name,
        "metrics":    svc.metrics,
    }


@router.get(
    "/alerts",
    summary="Get active flood alerts",
)
async def get_alerts(request: Request):
    """Returns list of active flood alerts with WhatsApp-ready payloads."""
    svc   = request.app.state.simulation_svc
    gj    = svc.get_flood_geojson()
    alerts = []

    for feat in gj.get("features", []):
        p = feat["properties"]
        depth = p.get("water_depth", 0)
        risk  = p.get("risk", "Green")

        if risk in ("Orange", "Red") and depth > 15:
            severity = "CRITICAL" if risk == "Red" else "WARNING"
            msg = (
                f"⚠️ Flood Alert ({severity}): {depth:.1f} cm water depth detected "
                f"on {p.get('name', p.get('road_id', 'Unknown Road'))}."
            )
            coords = feat["geometry"]["coordinates"]
            mid    = coords[len(coords) // 2] if coords else [72.877, 19.076]

            alerts.append({
                "alert_id":       p.get("road_id", ""),
                "severity":       severity,
                "message":        msg,
                "ward":           p.get("ward", "Unknown"),
                "lat":            mid[1],
                "lon":            mid[0],
                "water_depth_cm": depth,
                "risk":           risk,
                "timestamp":      p.get("timestamp", ""),
                "whatsapp_payload": {
                    "messaging_product": "whatsapp",
                    "to":                "{{phone}}",
                    "type":              "text",
                    "text":              {"body": msg + " Avoid travel in this area."},
                },
            })

    return {
        "total_alerts": len(alerts),
        "alerts":       alerts[:50],   # cap at 50
    }
