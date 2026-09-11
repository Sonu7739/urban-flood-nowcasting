"""
UFNS FastAPI Backend — Main Application
========================================
Async REST API for the Urban Flood Nowcasting System.

Endpoints:
  GET  /api/rainfall         — Rainfall grid
  POST /api/predict          — Single-point prediction
  GET  /api/map              — Flood GeoJSON
  GET  /api/route            — Safe route
  POST /api/admin/simulate   — Demo rainfall injection
  GET  /api/metrics          — Model metrics
  GET  /api/alerts           — Active alerts
  WS   /ws/live              — WebSocket live updates

Run:
    uvicorn backend.main:app --reload --port 8000
"""

import asyncio
import json
import os
import pickle
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import uvicorn
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# ─── Path setup ────────────────────────────────────────────────────────────────
BACKEND_DIR  = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.routers import rainfall, predict, mapdata, route, admin, auth
from backend.routers import emergency, location, saferoute, chat, alertrouter, flood_predict
from backend.database import engine, Base
import backend.models.user        # noqa – register ORM models
import backend.models.emergency   # noqa
import backend.models.activity    # noqa
from backend.schemas.requests import PredictRequest, SimulateRequest
from backend.services.prediction import PredictionService
from backend.services.simulation_service import SimulationService

# ─── Singleton services (initialised at startup) ───────────────────────────────
prediction_svc: Optional[PredictionService] = None
simulation_svc: Optional[SimulationService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    global prediction_svc, simulation_svc

    print("\n[INFO] UFNS Backend starting ...")

    # ── Auto-create new tables (does NOT drop existing ones) ─────────────────
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("  [SUCCESS] DB tables synced")
    except Exception as e:
        print(f"  [WARN]  DB init skipped (no connection): {e}")

    print("  Loading ML model ...")
    prediction_svc = PredictionService()
    prediction_svc.load_model()

    print("  Initialising simulation engine ...")
    simulation_svc = SimulationService()
    await simulation_svc.initialise()

    # Start background simulation loop (every 5 minutes)
    asyncio.create_task(simulation_svc.background_loop())

    # Store in app state for router access
    app.state.prediction_svc = prediction_svc
    app.state.simulation_svc = simulation_svc

    print("  [SUCCESS] Backend ready!\n")
    yield

    print("[INFO] UFNS Backend shutting down ...")


# ═══════════════════════════════════════════════════════════════════════════════
# App Factory
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Urban Flood Nowcasting System API",
    description=(
        "Real-time street-level flood prediction API.\n\n"
        "Predicts water depth (cm) and risk level for every road segment "
        "0–3 hours before flooding occurs.\n\n"
        "**SIH Problem Statement 26085**"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    contact={
        "name":  "Team wallBreakers",
        "email": "ufns@sih2026.in",
    },
    license_info={"name": "MIT"},
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Auth uses JWT Bearer tokens (not cookies) so allow_origins=["*"] is safe here.
# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/auth",  tags=["Auth"])
app.include_router(rainfall.router,    prefix="/api",       tags=["Rainfall"])
app.include_router(predict.router,     prefix="/api",       tags=["Prediction"])
app.include_router(mapdata.router,     prefix="/api",       tags=["Map"])
app.include_router(route.router,       prefix="/api",       tags=["Routing"])
app.include_router(admin.router,       prefix="/api",       tags=["Admin"])
app.include_router(emergency.router,   prefix="/api",       tags=["Emergency"])
app.include_router(location.router,    prefix="/api",       tags=["Location"])
app.include_router(saferoute.router,   prefix="/api",       tags=["SafeRoute"])
app.include_router(chat.router,        prefix="/api",       tags=["Chat"])
app.include_router(alertrouter.router, prefix="/api",       tags=["Alerts"])
app.include_router(flood_predict.router, prefix="/api",     tags=["FloodPredict"])


# ═══════════════════════════════════════════════════════════════════════════════
# WebSocket — Live Updates
# ═══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """WebSocket endpoint for live flood updates (push every 30 s)."""
    await manager.connect(ws)
    try:
        while True:
            svc: SimulationService = app.state.simulation_svc
            summary = svc.latest_summary or {}
            await ws.send_json({
                "type":    "flood_update",
                "payload": summary,
                "time":    datetime.utcnow().isoformat() + "Z",
            })
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ═══════════════════════════════════════════════════════════════════════════════
# Root
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "Urban Flood Nowcasting System",
        "version": "1.0.0",
        "status":  "operational",
        "docs":    "/docs",
        "sih":     "Problem Statement 26085",
    }


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "status":    "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "model":     app.state.prediction_svc.model_name if prediction_svc else "not loaded",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Dev runner
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
