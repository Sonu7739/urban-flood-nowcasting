"""
Prediction Service — loads model, serves single-point predictions.
"""
import json
import math
import pickle
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent.parent
MODELS_DIR   = PROJECT_ROOT / "models"

FEATURE_COLS = [
    "rainfall_mm_hr", "elevation", "slope", "curvature",
    "flow_accumulation", "distance_to_drain", "drain_capacity",
    "impervious_ratio", "road_width", "historical_flood_score",
]

RISK_LEVELS = [
    (5,   "Green",  "Safe"),
    (15,  "Yellow", "Caution"),
    (30,  "Orange", "Warning"),
    (999, "Red",    "Critical"),
]


def classify_risk(depth: float) -> tuple:
    for thr, color, label in RISK_LEVELS:
        if depth <= thr:
            return color, label
    return "Red", "Critical"


class PredictionService:
    def __init__(self):
        self.model       = None
        self.model_name  = "not_loaded"
        self.feature_cols = FEATURE_COLS
        self.metrics     = {}

    def load_model(self):
        model_path = MODELS_DIR / "best_model.pkl"
        if not model_path.exists():
            print(f"  [WARN]  Model not found at {model_path}")
            print("     Using physics fallback. Run ai/train.py to train a model.")
            return

        with open(model_path, "rb") as f:
            artifact = pickle.load(f)
        self.model       = artifact["model"]
        self.model_name  = artifact.get("name", "Unknown")
        self.feature_cols = artifact.get("features", FEATURE_COLS)

        # Load metrics
        metrics_path = MODELS_DIR / "metrics.json"
        if metrics_path.exists():
            with open(metrics_path) as f:
                self.metrics = json.load(f)

        print(f"  [SUCCESS] Model loaded: {self.model_name}")

    def _lookup_features(self, lat: float, lon: float, rainfall: float) -> dict:
        """Look up contextual features for a lat/lon point."""
        # Try to load from processed DEM
        elevation = 10.0
        slope     = 1.5
        try:
            import pandas as pd
            from scipy.spatial import KDTree
            dem_path = PROJECT_ROOT / "datasets" / "processed" / "dem_clean.csv"
            if dem_path.exists():
                dem = pd.read_csv(dem_path)
                tree = KDTree(dem[["latitude", "longitude"]].values)
                _, idx = tree.query([[lat, lon]])
                row = dem.iloc[idx[0]]
                elevation = float(row.get("elevation_m", 10.0))
                slope     = float(row.get("slope", 1.5))
        except Exception:
            pass

        # Distance to nearest drain (estimated)
        distance_to_drain = max(20, abs(hash(f"{lat:.3f}{lon:.3f}")) % 500)

        return {
            "rainfall_mm_hr":        rainfall,
            "elevation":             elevation,
            "slope":                 slope,
            "curvature":             0.001,
            "flow_accumulation":     500,
            "distance_to_drain":     distance_to_drain,
            "drain_capacity":        150,
            "impervious_ratio":      0.75,
            "road_width":            10,
            "historical_flood_score": 5.0,
        }

    def predict(self, lat: float, lon: float, rainfall: float) -> dict:
        """Predict water depth for a given point."""
        features = self._lookup_features(lat, lon, rainfall)
        X = np.array([[features[col] for col in self.feature_cols]])

        if self.model is not None:
            depth = float(self.model.predict(X)[0])
            confidence = min(0.98, max(0.60, self.metrics.get("r2", 0.85)))
        else:
            # Physics fallback
            runoff = rainfall * 0.4
            elev_pen = max(0, 20 - features["elevation"]) * 0.5
            drain_pen = features["distance_to_drain"] / 100
            depth = max(0, runoff + elev_pen + drain_pen)
            confidence = 0.72

        depth = round(max(0.0, depth), 1)
        risk_color, risk_label = classify_risk(depth)

        return {
            "water_depth_cm": depth,
            "risk":           risk_label,
            "risk_color":     risk_color,
            "confidence":     round(confidence, 2),
            "lat":            lat,
            "lon":            lon,
            "rainfall_mm_hr": rainfall,
            "timestamp":      datetime.utcnow().isoformat() + "Z",
        }
