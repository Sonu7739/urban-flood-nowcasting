"""POST /api/predict — Single-point flood prediction."""
from fastapi import APIRouter, Request, HTTPException
from backend.schemas.requests import PredictRequest, PredictResponse

router = APIRouter()


@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Predict flood depth at a location",
)
async def predict_flood(body: PredictRequest, request: Request) -> PredictResponse:
    """
    Predicts water depth (cm) and risk level for a given lat/lon point
    given the current rainfall intensity.

    **Risk levels:**
    - 🟢 Green  : 0–5 cm   (Safe)
    - 🟡 Yellow : 5–15 cm  (Caution)
    - 🟠 Orange : 15–30 cm (Warning)
    - 🔴 Red    : 30+ cm   (Critical)
    """
    svc = request.app.state.prediction_svc
    try:
        result = svc.predict(body.lat, body.lon, body.rainfall)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return PredictResponse(**result)
