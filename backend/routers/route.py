"""GET /api/route — Safe route planner."""
from fastapi import APIRouter, Request, Query
from backend.services.routing import RoutingService

router = APIRouter()

# Lazy singleton
_routing_svc = None

def get_routing_svc() -> RoutingService:
    global _routing_svc
    if _routing_svc is None:
        _routing_svc = RoutingService()
    return _routing_svc


@router.get(
    "/route",
    summary="Find flood-safe route",
)
async def safe_route(
    request:   Request,
    start_lat: float = Query(..., example=19.076, description="Start latitude"),
    start_lon: float = Query(..., example=72.877, description="Start longitude"),
    end_lat:   float = Query(..., example=19.120, description="End latitude"),
    end_lon:   float = Query(..., example=72.900, description="End longitude"),
):
    """
    Returns the safest driving route between two points, avoiding roads with
    water depth > 15 cm.

    Returns:
    - `route`: GeoJSON LineString
    - `eta_minutes`: estimated travel time
    - `distance_m`: total distance
    - `avoided_roads`: roads skipped due to flooding
    - `safe`: true if route is completely flood-free
    """
    rsvc = get_routing_svc()

    # Update weights from current simulation
    sim_svc = request.app.state.simulation_svc
    gj = sim_svc.get_flood_geojson()
    rsvc.update_flood_weights(gj)

    result = rsvc.find_route(start_lat, start_lon, end_lat, end_lon)
    return result
