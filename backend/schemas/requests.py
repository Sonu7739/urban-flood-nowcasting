"""Pydantic request/response schemas."""
from typing import List, Optional
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, example=19.076)
    lon: float = Field(..., ge=-180, le=180, example=72.877)
    rainfall: float = Field(..., ge=0, le=500, example=84.0)
    elevation: Optional[float] = Field(None, example=8.5)
    road_width: Optional[float] = Field(None, example=12.0)

    class Config:
        json_schema_extra = {
            "example": {"lat": 19.076, "lon": 72.877, "rainfall": 84.0}
        }


class PredictResponse(BaseModel):
    water_depth_cm: float
    risk: str
    risk_color: str
    confidence: float
    lat: float
    lon: float
    rainfall_mm_hr: float
    timestamp: str


class SimulateRequest(BaseModel):
    rainfall_mm_hr: float = Field(
        80.0, ge=0, le=500,
        description="Artificial rainfall to inject (mm/hr)"
    )
    duration_minutes: int = Field(60, ge=5, le=180)
    city: Optional[str] = "mumbai"


class RouteRequest(BaseModel):
    start_lat: float = Field(..., example=19.076)
    start_lon: float = Field(..., example=72.877)
    end_lat: float   = Field(..., example=19.120)
    end_lon: float   = Field(..., example=72.900)


class AlertResponse(BaseModel):
    alert_id: str
    severity: str
    message: str
    ward: Optional[str]
    lat: float
    lon: float
    water_depth_cm: float
    timestamp: str
    whatsapp_payload: Optional[dict]
