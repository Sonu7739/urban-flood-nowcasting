"""GET /api/rainfall — Returns rainfall grid."""
from fastapi import APIRouter, Request
from typing import List

router = APIRouter()


@router.get(
    "/rainfall",
    summary="Get current rainfall grid",
    response_description="List of rainfall cells with lat/lon and mm/hr values",
)
async def get_rainfall(request: Request) -> dict:
    """
    Returns the current rainfall intensity grid as a list of cells.
    Each cell has latitude, longitude, and rainfall in mm/hr.
    """
    svc = request.app.state.simulation_svc
    cells = svc.get_rainfall_grid()
    return {
        "status":     "ok",
        "count":      len(cells),
        "unit":       "mm/hr",
        "cells":      cells,
    }
