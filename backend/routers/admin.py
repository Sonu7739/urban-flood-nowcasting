"""POST /api/admin/simulate — Demo rainfall injection."""
from fastapi import APIRouter, Request
from backend.schemas.requests import SimulateRequest

router = APIRouter()


@router.post(
    "/admin/simulate",
    summary="[Admin] Inject artificial rainfall for demo",
)
async def inject_simulation(body: SimulateRequest, request: Request):
    """
    Injects an artificial rainfall event for demonstration purposes.
    Triggers an immediate simulation step with the specified rainfall intensity.

    ⚠️ This endpoint is for demo/judging purposes only.
    """
    svc = request.app.state.simulation_svc
    await svc.inject_rainfall(body.rainfall_mm_hr, body.duration_minutes)
    summary = svc.latest_summary or {}
    return {
        "status":          "simulation_triggered",
        "rainfall_mm_hr":  body.rainfall_mm_hr,
        "duration_minutes": body.duration_minutes,
        "summary":         summary,
    }


@router.post(
    "/admin/reset",
    summary="[Admin] Reset simulation to baseline",
)
async def reset_simulation(request: Request):
    """Reset rainfall to baseline (45 mm/hr) and re-run simulation."""
    svc = request.app.state.simulation_svc
    svc.current_rainfall = 45.0
    svc.demo_mode = False
    await svc._run_step()
    return {"status": "reset_ok", "rainfall_mm_hr": 45.0}
