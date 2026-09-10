"""
Urban Flood Nowcasting System — Flood Simulation Engine
=======================================================
Physics-inspired simulation pipeline:
  1. Surface runoff (rational method)
  2. Water accumulation (flow routing)
  3. Drain intake
  4. Pipe surcharge + backflow
  5. Street inundation

Output: GeoJSON with water_depth + risk per road segment.
Updates every 5 minutes (via background scheduler).

Usage:
    python simulation/flood_sim.py [--rainfall 80]
"""

import argparse
import json
import math
import os
import pickle
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent

# Risk thresholds (cm)
RISK_LEVELS = [
    (5,   "Green",  "Safe"),
    (15,  "Yellow", "Caution"),
    (30,  "Orange", "Warning"),
    (999, "Red",    "Critical"),
]

def classify_risk(depth_cm: float) -> tuple:
    for threshold, color, label in RISK_LEVELS:
        if depth_cm <= threshold:
            return color, label
    return "Red", "Critical"


# ═══════════════════════════════════════════════════════════════════════════════
# Load model
# ═══════════════════════════════════════════════════════════════════════════════

def load_model():
    """Load trained ML model from models/best_model.pkl."""
    model_path = PROJECT_ROOT / "models" / "best_model.pkl"
    if not model_path.exists():
        return None, None
    with open(model_path, "rb") as f:
        artifact = pickle.load(f)
    return artifact["model"], artifact["features"]


# ═══════════════════════════════════════════════════════════════════════════════
# Surface Runoff (Rational Method)
# ═══════════════════════════════════════════════════════════════════════════════

def compute_runoff(rainfall_mm_hr: float, impervious_ratio: float, area_m2: float = 1000) -> float:
    """
    Q = C * i * A   (rational method)
    Q  = peak discharge (L/s)
    C  = runoff coefficient (0–1)
    i  = rainfall intensity (mm/hr)
    A  = drainage area (m²)
    """
    i_m_s = rainfall_mm_hr / 3_600_000   # mm/hr → m/s
    Q = impervious_ratio * i_m_s * area_m2 * 1000  # → L/s
    return Q


# ═══════════════════════════════════════════════════════════════════════════════
# Core Simulation Step
# ═══════════════════════════════════════════════════════════════════════════════

def simulate_flood_step(
    roads_df: pd.DataFrame,
    rainfall_mm_hr: float,
    drain_overflow_probs: Dict[str, float],
    ml_model=None,
    feature_cols: Optional[List[str]] = None,
    dt_minutes: float = 5.0,
) -> pd.DataFrame:
    """
    Simulate one time step of flooding.

    Returns roads_df with columns added:
      - runoff_ls     : surface runoff (L/s)
      - drain_intake  : fraction drained
      - surcharge_adj : depth increase from pipe surcharge
      - water_depth_cm: final predicted depth
      - risk_color    : Green/Yellow/Orange/Red
      - risk_label    : Safe/Caution/Warning/Critical
    """
    df = roads_df.copy()

    # ── 1. Surface runoff ────────────────────────────────────────────────────
    df["runoff_ls"] = df.apply(
        lambda r: compute_runoff(
            rainfall_mm_hr,
            r.get("impervious_ratio", 0.7),
            r.get("road_width", 8) * 100,  # road length proxy = 100 m
        ),
        axis=1,
    )

    # ── 2. Drain intake reduction ────────────────────────────────────────────
    # Nearby drain overflow → less capacity available
    df["drain_intake"] = df.apply(
        lambda r: max(0.0, r.get("drain_capacity", 100) * (1 - drain_overflow_probs.get(
            _find_nearest_drain(r.get("road_id", ""), drain_overflow_probs), 0
        ))),
        axis=1,
    )

    # ── 3. Surcharge back-pressure adjustment ───────────────────────────────
    df["surcharge_adj"] = df.apply(
        lambda r: (
            drain_overflow_probs.get(
                _find_nearest_drain(r.get("road_id", ""), drain_overflow_probs), 0
            ) * 10   # up to +10 cm from backflow
        ),
        axis=1,
    )

    # ── 4. Water depth prediction ────────────────────────────────────────────
    if ml_model is not None and feature_cols is not None:
        # Use ML model
        df["rainfall_mm_hr"] = rainfall_mm_hr
        X = df[feature_cols].fillna(0).values
        depths = ml_model.predict(X)
        df["water_depth_cm"] = np.maximum(0, depths + df["surcharge_adj"]).round(1)
    else:
        # Physics fallback
        df["water_depth_cm"] = df.apply(
            lambda r: _physics_depth(r, rainfall_mm_hr), axis=1
        )
        df["water_depth_cm"] += df["surcharge_adj"]
        df["water_depth_cm"] = df["water_depth_cm"].clip(0).round(1)

    # ── 5. Risk classification ───────────────────────────────────────────────
    risk = df["water_depth_cm"].apply(classify_risk)
    df["risk_color"] = risk.apply(lambda x: x[0])
    df["risk_label"] = risk.apply(lambda x: x[1])

    return df


def _physics_depth(row, rainfall_mm_hr: float) -> float:
    """Simplified physics-based depth estimate."""
    runoff   = compute_runoff(rainfall_mm_hr, row.get("impervious_ratio", 0.7))
    drain    = row.get("drain_capacity", 100)
    excess   = max(0, runoff - drain)
    elev_pen = max(0, 20 - row.get("elevation", 10)) * 0.5
    slope_pen = max(0, 5 - row.get("slope", 1)) * 2
    depth    = (excess / 50 + elev_pen + slope_pen) * (1 + row.get("historical_flood_score", 0) / 100)
    return max(0, depth + np.random.normal(0, 1))


def _find_nearest_drain(road_id: str, probs: Dict[str, float]) -> str:
    """Simple hash-based assignment of drain node to road."""
    if not probs:
        return ""
    keys = list(probs.keys())
    idx = hash(road_id) % len(keys)
    return keys[idx]


# ═══════════════════════════════════════════════════════════════════════════════
# GeoJSON Output
# ═══════════════════════════════════════════════════════════════════════════════

def export_flood_geojson(
    roads_df: pd.DataFrame,
    road_geojson_path: Path,
    output_path: Path,
    timestamp: Optional[str] = None,
):
    """Merge simulation results with road geometry → GeoJSON."""
    if timestamp is None:
        timestamp = datetime.utcnow().isoformat() + "Z"

    with open(road_geojson_path) as f:
        road_gj = json.load(f)

    depth_map = dict(zip(roads_df["road_id"], roads_df["water_depth_cm"]))
    risk_map  = dict(zip(roads_df["road_id"], roads_df["risk_color"]))
    label_map = dict(zip(roads_df["road_id"], roads_df["risk_label"]))

    for feat in road_gj["features"]:
        rid = feat["properties"]["road_id"]
        depth = depth_map.get(rid, 0.0)
        feat["properties"].update({
            "water_depth": round(float(depth), 1),
            "risk":        risk_map.get(rid, "Green"),
            "risk_label":  label_map.get(rid, "Safe"),
            "timestamp":   timestamp,
        })

    road_gj["simulation_time"] = timestamp
    road_gj["rainfall_mm_hr"]  = roads_df.get("rainfall_mm_hr", pd.Series([0])).mean()

    with open(output_path, "w") as f:
        json.dump(road_gj, f, separators=(",", ":"))

    critical = (roads_df["risk_color"] == "Red").sum()
    warning  = (roads_df["risk_color"] == "Orange").sum()
    print(f"  [+] Flood GeoJSON: {len(road_gj['features'])} roads | "
          f"[C] {critical} Critical | [W] {warning} Warning -> {output_path.name}")
    return road_gj


# ═══════════════════════════════════════════════════════════════════════════════
# Main Simulation Runner
# ═══════════════════════════════════════════════════════════════════════════════

class FloodSimulator:
    """Stateful simulator — call .step() every 5 minutes."""

    def __init__(self):
        self.roads_df       = None
        self.model          = None
        self.feature_cols   = None
        self.drain_graph    = None
        self.flood_geojson  = None
        self._load_resources()

    def _load_resources(self):
        # Load roads
        road_path = PROJECT_ROOT / "datasets" / "roads" / "road_network.geojson"
        if road_path.exists():
            with open(road_path) as f:
                rg = json.load(f)
            rows = []
            for feat in rg["features"]:
                coords = feat["geometry"]["coordinates"]
                mid = coords[len(coords) // 2]
                p = feat["properties"]
                rows.append({
                    "road_id":    p["road_id"],
                    "road_width": p.get("road_width", 8),
                    "ward":       p.get("ward", "Ward_1"),
                    "latitude":   mid[1],
                    "longitude":  mid[0],
                    "elevation":  10.0,
                    "slope":      1.0,
                    "curvature":  0.0,
                    "flow_accumulation": 500,
                    "distance_to_drain": 100,
                    "drain_capacity":    150,
                    "impervious_ratio":  0.75,
                    "historical_flood_score": 0.0,
                })
            self.roads_df = pd.DataFrame(rows)

        # Try to load DEM data to enrich roads_df
        dem_path = PROJECT_ROOT / "datasets" / "processed" / "dem_clean.csv"
        if dem_path.exists() and self.roads_df is not None:
            try:
                from scipy.spatial import KDTree
                dem_df = pd.read_csv(dem_path)
                dem_tree = KDTree(dem_df[["latitude", "longitude"]].values)
                road_coords = self.roads_df[["latitude", "longitude"]].values
                _, idx = dem_tree.query(road_coords)
                self.roads_df["elevation"] = dem_df["elevation_m"].values[idx]
                self.roads_df["slope"]     = dem_df["slope"].values[idx]
                self.roads_df["curvature"] = dem_df["curvature"].values[idx]
                self.roads_df["flow_accumulation"] = dem_df["flow_accumulation"].values[idx]
            except Exception:
                pass

        # Load ML model
        self.model, self.feature_cols = load_model()

        # Load drainage graph
        try:
            import sys
            sys.path.insert(0, str(PROJECT_ROOT))
            from graph.drain_graph import get_drain_graph
            self.drain_graph = get_drain_graph()
        except Exception:
            self.drain_graph = None

    def step(self, rainfall_mm_hr: float = 50.0, inject_demo: bool = False) -> dict:
        """Run one simulation step. Returns summary dict."""
        if inject_demo:
            rainfall_mm_hr = min(rainfall_mm_hr + np.random.uniform(5, 20), 200)

        # Compute drain overflow probs
        drain_probs = {}
        if self.drain_graph is not None:
            try:
                from graph.drain_graph import compute_overflow_probability
                inflow_factor = rainfall_mm_hr / 10
                inflows = {
                    nid: inflow_factor * np.random.uniform(0.8, 1.5)
                    for nid, data in self.drain_graph.nodes(data=True)
                    if data.get("node_type") in ("inlet", "manhole")
                }
                drain_probs = compute_overflow_probability(self.drain_graph, inflows)
            except Exception:
                pass

        if self.roads_df is None:
            return {"error": "Roads data not loaded"}

        result_df = simulate_flood_step(
            self.roads_df,
            rainfall_mm_hr,
            drain_probs,
            self.model,
            self.feature_cols,
        )

        # Export GeoJSON
        road_geo_path = PROJECT_ROOT / "datasets" / "roads" / "road_network.geojson"
        output_path   = PROJECT_ROOT / "datasets" / "processed" / "flood_current.geojson"
        gj = export_flood_geojson(result_df, road_geo_path, output_path)
        self.flood_geojson = gj

        summary = {
            "timestamp":       datetime.utcnow().isoformat() + "Z",
            "rainfall_mm_hr":  round(rainfall_mm_hr, 1),
            "total_roads":     len(result_df),
            "critical_roads":  int((result_df["risk_color"] == "Red").sum()),
            "warning_roads":   int((result_df["risk_color"] == "Orange").sum()),
            "caution_roads":   int((result_df["risk_color"] == "Yellow").sum()),
            "safe_roads":      int((result_df["risk_color"] == "Green").sum()),
            "avg_depth_cm":    round(float(result_df["water_depth_cm"].mean()), 2),
            "max_depth_cm":    round(float(result_df["water_depth_cm"].max()), 2),
        }
        return summary


# Global singleton
_SIMULATOR: Optional[FloodSimulator] = None

def get_simulator() -> FloodSimulator:
    global _SIMULATOR
    if _SIMULATOR is None:
        _SIMULATOR = FloodSimulator()
    return _SIMULATOR


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="UFNS Flood Simulator")
    parser.add_argument("--rainfall",   type=float, default=60.0)
    parser.add_argument("--steps",      type=int,   default=3)
    parser.add_argument("--interval",   type=int,   default=5, help="Minutes per step")
    args = parser.parse_args()

    print("\n🌊 UFNS Flood Simulation Engine")
    print("=" * 50)
    sim = get_simulator()

    for step in range(args.steps):
        print(f"\n  ▶ Step {step + 1}/{args.steps} @ {args.rainfall} mm/hr ...")
        summary = sim.step(args.rainfall)
        for k, v in summary.items():
            print(f"    {k}: {v}")
        if step < args.steps - 1:
            time.sleep(1)

    print("\n✅ Simulation complete!")


if __name__ == "__main__":
    main()
