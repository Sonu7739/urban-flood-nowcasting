"""
Urban Flood Nowcasting System — Data Pipeline
=============================================
Cleans raw datasets and engineers features for ML training.

Steps:
  1. Clean rainfall CSV (remove nulls, normalize)
  2. Clean DEM (fill voids, convert CRS)
  3. Validate drainage topology
  4. Build training_dataset.csv with 10 engineered features + target

Usage:
    python ai/data_pipeline.py [--city mumbai]
"""

import argparse
import json
import math
import os
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import KDTree

PROJECT_ROOT = Path(__file__).parent.parent
DATASETS_DIR  = PROJECT_ROOT / "datasets"
PROCESSED_DIR = DATASETS_DIR / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CLEAN RAINFALL
# ═══════════════════════════════════════════════════════════════════════════════

def clean_rainfall() -> pd.DataFrame:
    path = DATASETS_DIR / "rainfall" / "rainfall_grid.csv"
    df = pd.read_csv(path)

    before = len(df)
    df.dropna(subset=["rainfall_mm_hr", "latitude", "longitude"], inplace=True)
    df.drop_duplicates(subset=["timestamp", "latitude", "longitude"], inplace=True)

    # Clip extreme outliers (>500 mm/hr is physically impossible)
    df["rainfall_mm_hr"] = df["rainfall_mm_hr"].clip(0, 500)

    # Normalize to [0, 1] for ML (keep original for display)
    max_rain = df["rainfall_mm_hr"].max()
    df["rainfall_normalized"] = df["rainfall_mm_hr"] / max_rain if max_rain > 0 else 0

    out = PROCESSED_DIR / "rainfall_clean.csv"
    df.to_csv(out, index=False)
    print(f"  ✓ Rainfall: {before:,} → {len(df):,} rows | {out.name}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CLEAN DEM + COMPUTE SLOPE / CURVATURE
# ═══════════════════════════════════════════════════════════════════════════════

def compute_terrain_derivatives(df: pd.DataFrame) -> pd.DataFrame:
    """Compute slope, curvature, and flow accumulation from elevation grid."""
    df = df.copy().sort_values(["latitude", "longitude"]).reset_index(drop=True)

    elevs = df["elevation_m"].values
    lats  = df["latitude"].values
    lons  = df["longitude"].values

    # Approximate cell size in metres
    d_lat = abs(lats[1] - lats[0]) * 111000 if len(lats) > 1 else 500
    d_lon = abs(lons[1] - lons[0]) * 111000 if len(lons) > 1 else 500
    cell_size = (d_lat + d_lon) / 2

    n = len(df)
    slope  = np.zeros(n)
    curv   = np.zeros(n)

    # Finite differences on 1-D sorted array (approximate)
    for i in range(1, n - 1):
        dz_forward = elevs[i + 1] - elevs[i]
        dz_back    = elevs[i] - elevs[i - 1]
        slope[i]   = abs(dz_forward) / cell_size
        curv[i]    = (dz_forward - dz_back) / (cell_size ** 2)

    df["slope"]     = np.degrees(np.arctan(slope)).round(4)
    df["curvature"] = curv.round(6)

    # Simple D8 flow accumulation proxy — accumulate downstream
    df["flow_accumulation"] = (
        (df["elevation_m"].max() - df["elevation_m"]) * 10
    ).clip(0, 10000).round(1)

    return df


def clean_dem() -> pd.DataFrame:
    path = DATASETS_DIR / "dem" / "dem_grid.csv"
    df = pd.read_csv(path)

    before = len(df)
    df.dropna(subset=["latitude", "longitude", "elevation_m"], inplace=True)
    df.drop_duplicates(subset=["latitude", "longitude"], inplace=True)

    # Fill DEM voids (elevation = NaN or negative) with median
    void_mask = df["elevation_m"] < 0
    if void_mask.any():
        fill_val = df.loc[~void_mask, "elevation_m"].median()
        df.loc[void_mask, "elevation_m"] = fill_val

    df = compute_terrain_derivatives(df)

    out = PROCESSED_DIR / "dem_clean.csv"
    df.to_csv(out, index=False)
    print(f"  ✓ DEM: {before:,} → {len(df):,} rows | {out.name}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 3. CLEAN DRAINAGE + TOPOLOGY VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def clean_drainage() -> tuple:
    node_path = DATASETS_DIR / "drainage" / "drain_nodes.geojson"
    pipe_path = DATASETS_DIR / "drainage" / "drain_pipes.geojson"

    with open(node_path) as f:
        nodes_gj = json.load(f)
    with open(pipe_path) as f:
        pipes_gj = json.load(f)

    # Build node lookup
    node_ids = {
        feat["properties"]["id"] for feat in nodes_gj["features"]
    }

    # Validate pipes — both endpoints must exist
    valid_pipes = []
    orphaned   = 0
    for feat in pipes_gj["features"]:
        p = feat["properties"]
        if p["from_node"] in node_ids and p["to_node"] in node_ids:
            valid_pipes.append(feat)
        else:
            orphaned += 1

    pipes_gj["features"] = valid_pipes

    out_n = PROCESSED_DIR / "drain_nodes_clean.geojson"
    out_p = PROCESSED_DIR / "drain_pipes_clean.geojson"
    with open(out_n, "w") as f:
        json.dump(nodes_gj, f)
    with open(out_p, "w") as f:
        json.dump(pipes_gj, f)

    print(f"  ✓ Drainage nodes: {len(node_ids)} valid | {out_n.name}")
    print(f"  ✓ Drainage pipes: {len(valid_pipes)} valid, {orphaned} orphaned removed | {out_p.name}")

    # Build a flat DataFrame of nodes for distance lookups
    rows = []
    for feat in nodes_gj["features"]:
        lng, lat = feat["geometry"]["coordinates"]
        p = feat["properties"]
        rows.append({
            "node_id":     p["id"],
            "node_type":   p.get("type", "manhole"),
            "latitude":    lat,
            "longitude":   lng,
            "capacity_ls": p.get("capacity", 100),
        })
    df_nodes = pd.DataFrame(rows)
    df_nodes.to_csv(PROCESSED_DIR / "drain_nodes_flat.csv", index=False)
    return df_nodes, nodes_gj, pipes_gj


# ═══════════════════════════════════════════════════════════════════════════════
# 4. FEATURE ENGINEERING — BUILD TRAINING DATASET
# ═══════════════════════════════════════════════════════════════════════════════

def build_training_dataset(city: str = "mumbai") -> pd.DataFrame:
    """Join all cleaned datasets on spatial proximity → training_dataset.csv."""

    print("\n  Building training dataset ...")

    # Load cleaned sources
    rain_df  = pd.read_csv(PROCESSED_DIR / "rainfall_clean.csv")
    dem_df   = pd.read_csv(PROCESSED_DIR / "dem_clean.csv")
    drain_df = pd.read_csv(PROCESSED_DIR / "drain_nodes_flat.csv")
    flood_df = pd.read_csv(DATASETS_DIR / "flood_history" / "flood_events.csv")

    # Load road GeoJSON → flat DataFrame
    road_path = DATASETS_DIR / "roads" / "road_network.geojson"
    with open(road_path) as f:
        road_gj = json.load(f)

    roads = []
    for feat in road_gj["features"]:
        coords = feat["geometry"]["coordinates"]
        mid_pt = coords[len(coords) // 2]
        p = feat["properties"]
        roads.append({
            "road_id":    p["road_id"],
            "road_type":  p["road_type"],
            "road_width": p.get("road_width", 8),
            "ward":       p.get("ward", "Ward_1"),
            "latitude":   mid_pt[1],
            "longitude":  mid_pt[0],
        })
    road_df = pd.DataFrame(roads)

    # ── Spatial join: road → nearest DEM cell ──────────────────────
    dem_tree = KDTree(dem_df[["latitude", "longitude"]].values)
    road_coords = road_df[["latitude", "longitude"]].values
    _, dem_idx = dem_tree.query(road_coords, k=1)
    road_df["elevation"]        = dem_df["elevation_m"].values[dem_idx]
    road_df["slope"]            = dem_df["slope"].values[dem_idx]
    road_df["curvature"]        = dem_df["curvature"].values[dem_idx]
    road_df["flow_accumulation"] = dem_df["flow_accumulation"].values[dem_idx]

    # ── Spatial join: road → nearest drain node ────────────────────
    drain_tree = KDTree(drain_df[["latitude", "longitude"]].values)
    _, drain_idx = drain_tree.query(road_coords, k=1)

    def haversine(lat1, lon1, lat2, lon2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    road_df["distance_to_drain"] = [
        haversine(
            road_coords[i][0], road_coords[i][1],
            drain_df["latitude"].values[drain_idx[i]],
            drain_df["longitude"].values[drain_idx[i]],
        )
        for i in range(len(road_df))
    ]
    road_df["drain_capacity"] = drain_df["capacity_ls"].values[drain_idx]

    # ── Rainfall: use latest timestamp average per cell ────────────
    latest_rain = rain_df.groupby(["latitude", "longitude"])["rainfall_mm_hr"].mean().reset_index()
    rain_tree = KDTree(latest_rain[["latitude", "longitude"]].values)
    _, rain_idx = rain_tree.query(road_coords, k=1)
    road_df["rainfall_mm_hr"] = latest_rain["rainfall_mm_hr"].values[rain_idx]

    # ── Impervious ratio (proxy from road type) ────────────────────
    imp_map = {"primary": 0.95, "secondary": 0.85, "tertiary": 0.70, "residential": 0.55}
    road_df["impervious_ratio"] = road_df["road_type"].map(imp_map).fillna(0.70)

    # ── Historical flood score per road ───────────────────────────
    hist_scores = flood_df.groupby("road_id")["water_depth_cm"].mean().reset_index()
    hist_scores.columns = ["road_id", "historical_flood_score"]
    road_df = road_df.merge(hist_scores, on="road_id", how="left")
    road_df["historical_flood_score"] = road_df["historical_flood_score"].fillna(0)

    # ── Target: water_depth_cm ─────────────────────────────────────
    # Physics-inspired: depth = f(rainfall, elevation, slope, drain proximity, imperviousness)
    def compute_depth(row):
        rainfall_factor  = row["rainfall_mm_hr"] * 0.4
        slope_factor     = max(0, 10 - row["slope"] * 5)   # lower slope → more ponding
        drain_penalty    = min(20, row["distance_to_drain"] / 50)
        drain_relief     = row["drain_capacity"] / 50
        elevation_bonus  = max(0, 20 - row["elevation"] * 0.5)
        historic_bonus   = row["historical_flood_score"] * 0.3
        imperv_factor    = row["impervious_ratio"] * 10
        flow_factor      = row["flow_accumulation"] * 0.001

        depth = (rainfall_factor + slope_factor + drain_penalty + elevation_bonus
                 + historic_bonus + imperv_factor + flow_factor - drain_relief)
        depth = max(0, depth + np.random.normal(0, 2))
        return round(depth, 1)

    road_df["water_depth_cm"] = road_df.apply(compute_depth, axis=1)

    # ── Final feature set ──────────────────────────────────────────
    features = [
        "road_id", "ward",
        "rainfall_mm_hr", "elevation", "slope", "curvature",
        "flow_accumulation", "distance_to_drain", "drain_capacity",
        "impervious_ratio", "road_width", "historical_flood_score",
        "water_depth_cm",
    ]
    out_df = road_df[features].copy()

    out = PROCESSED_DIR / "training_dataset.csv"
    out_df.to_csv(out, index=False)
    print(f"  ✓ Training dataset: {len(out_df):,} rows × {len(features)} cols → {out.name}")
    return out_df


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="UFNS Data Pipeline")
    parser.add_argument("--city", default="mumbai")
    args = parser.parse_args()

    print("\n🔧 UFNS Data Pipeline")
    print("=" * 50)

    print("\n[1/4] Cleaning rainfall data ...")
    clean_rainfall()

    print("\n[2/4] Cleaning DEM + computing terrain derivatives ...")
    clean_dem()

    print("\n[3/4] Validating drainage topology ...")
    clean_drainage()

    print("\n[4/4] Engineering features ...")
    build_training_dataset(args.city)

    print("\n✅ Data pipeline complete! Outputs in datasets/processed/")


if __name__ == "__main__":
    main()
