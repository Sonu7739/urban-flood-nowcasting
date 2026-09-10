"""
Urban Flood Nowcasting System — Synthetic Dataset Generator
===========================================================
Generates statistically realistic datasets for:
  - Rainfall grids (temporal radar-style)
  - Digital Elevation Model (DEM) raster
  - Road network (GeoJSON)
  - Underground drainage network (GeoJSON)
  - Historical flood records (CSV)

Usage:
    python ai/dataset_generator.py [--city mumbai] [--seed 42]
"""

import argparse
import json
import math
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

# ─── Root paths ────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
DATASETS_DIR = PROJECT_ROOT / "datasets"

# City bounding boxes (lat_min, lat_max, lon_min, lon_max)
CITIES = {
    "mumbai":   (18.87, 19.27,  72.77,  73.00),
    "chennai":  (12.90, 13.20,  80.18,  80.32),
    "delhi":    (28.40, 28.90,  76.84,  77.35),
    "kolkata":  (22.45, 22.70,  88.25,  88.50),
    "bangalore": (12.85, 13.10, 77.45,  77.75),
}

random.seed(42)
np.random.seed(42)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Rainfall Grid Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_rainfall_grid(city: str = "mumbai", hours: int = 72) -> pd.DataFrame:
    """Generate hourly rainfall grid (lat/lon cells × time)."""
    lat_min, lat_max, lon_min, lon_max = CITIES[city]

    # 0.01° resolution ≈ 1 km
    lats = np.arange(lat_min, lat_max, 0.01)
    lons = np.arange(lon_min, lon_max, 0.01)

    records = []
    base_time = datetime(2024, 7, 1, 0, 0, 0)

    # Simulate a monsoon rainfall event with spatial correlation
    for h in range(hours):
        t = base_time + timedelta(hours=h)
        # Storm intensity profile — Gaussian peak around hour 24
        storm_intensity = 80 * np.exp(-0.5 * ((h - 24) / 8) ** 2)

        for lat in lats[::2]:   # subsample for speed
            for lon in lons[::2]:
                # Spatial variation — higher rainfall near coast (low lon)
                spatial_factor = 1.0 + 0.5 * np.exp(-5 * (lon - lon_min))
                noise = np.random.gamma(2, 1)
                mm_hr = max(0, storm_intensity * spatial_factor * noise / 10)
                records.append({
                    "timestamp":    t.isoformat(),
                    "latitude":     round(lat, 4),
                    "longitude":    round(lon, 4),
                    "rainfall_mm_hr": round(mm_hr, 2),
                })

    df = pd.DataFrame(records)
    out = DATASETS_DIR / "rainfall" / "rainfall_grid.csv"
    df.to_csv(out, index=False)
    print(f"  ✓ Rainfall grid: {len(df):,} rows → {out}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 2. DEM Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_dem(city: str = "mumbai") -> pd.DataFrame:
    """Generate a synthetic DEM for the city bounding box."""
    lat_min, lat_max, lon_min, lon_max = CITIES[city]

    lats = np.arange(lat_min, lat_max, 0.005)
    lons = np.arange(lon_min, lon_max, 0.005)

    records = []
    # Simulate terrain: sloping toward coast + random hills
    for lat in lats:
        for lon in lons:
            # Base slope toward coast
            base_elev = 40 * (lon - lon_min) / (lon_max - lon_min)
            # Add Perlin-like hills
            hill = 20 * math.sin(lat * 80) * math.cos(lon * 80)
            hill2 = 10 * math.sin(lat * 150 + 1) * math.cos(lon * 120 + 2)
            elev = max(0, base_elev + hill + hill2 + np.random.normal(0, 2))
            records.append({
                "latitude":  round(lat, 5),
                "longitude": round(lon, 5),
                "elevation_m": round(elev, 2),
            })

    df = pd.DataFrame(records)
    out = DATASETS_DIR / "dem" / "dem_grid.csv"
    df.to_csv(out, index=False)
    print(f"  ✓ DEM grid: {len(df):,} rows → {out}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Road Network Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_roads(city: str = "mumbai", n_roads: int = 500) -> dict:
    """Generate synthetic road network as GeoJSON."""
    lat_min, lat_max, lon_min, lon_max = CITIES[city]

    features = []
    road_types = ["primary", "secondary", "tertiary", "residential"]
    widths = {"primary": 20, "secondary": 12, "tertiary": 8, "residential": 5}

    for i in range(n_roads):
        rtype = random.choice(road_types)
        # Random road segment (2–5 points)
        n_pts = random.randint(2, 5)
        start_lat = random.uniform(lat_min, lat_max - 0.02)
        start_lon = random.uniform(lon_min, lon_max - 0.02)
        coords = []
        lat, lon = start_lat, start_lon
        for _ in range(n_pts):
            coords.append([round(lon, 6), round(lat, 6)])
            lat += random.uniform(-0.005, 0.005)
            lon += random.uniform(-0.005, 0.005)
            lat = max(lat_min, min(lat_max, lat))
            lon = max(lon_min, min(lon_max, lon))

        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "road_id":    f"R{i:04d}",
                "road_type":  rtype,
                "road_width": widths[rtype] + random.randint(-2, 2),
                "name":       f"{rtype.title()} Road {i}",
                "ward":       f"Ward_{random.randint(1, 24)}",
            }
        })

    geojson = {"type": "FeatureCollection", "features": features}
    out = DATASETS_DIR / "roads" / "road_network.geojson"
    with open(out, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"  ✓ Road network: {n_roads} segments → {out}")
    return geojson


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Drainage Network Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_drainage(city: str = "mumbai", n_nodes: int = 200) -> dict:
    """Generate underground drainage network as GeoJSON."""
    lat_min, lat_max, lon_min, lon_max = CITIES[city]

    node_types = ["manhole", "inlet", "junction"]
    pipe_diameters = [0.3, 0.45, 0.6, 0.9, 1.2]

    # Generate nodes
    nodes = []
    for i in range(n_nodes):
        ntype = random.choice(node_types)
        lat = random.uniform(lat_min, lat_max)
        lon = random.uniform(lon_min, lon_max)
        capacity = random.uniform(50, 500)  # liters/second
        nodes.append({
            "id":       f"N{i:04d}",
            "type":     ntype,
            "lat":      round(lat, 6),
            "lon":      round(lon, 6),
            "capacity": round(capacity, 1),
            "depth_m":  round(random.uniform(1.5, 5.0), 2),
        })

    # Generate edges (pipes)
    features_nodes = []
    features_edges = []

    for n in nodes:
        features_nodes.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [n["lon"], n["lat"]]},
            "properties": {k: v for k, v in n.items() if k not in ("lat", "lon")},
        })

    # Connect nearby nodes
    for i, src in enumerate(nodes):
        # Connect to 1-3 nearest nodes downstream (lower elevation proxy = lower lat)
        candidates = [
            (j, n) for j, n in enumerate(nodes)
            if j != i and n["lat"] < src["lat"] and
            abs(n["lat"] - src["lat"]) < 0.03 and
            abs(n["lon"] - src["lon"]) < 0.03
        ]
        candidates.sort(key=lambda x: (x[1]["lat"] - src["lat"]) ** 2 + (x[1]["lon"] - src["lon"]) ** 2)
        for j, dst in candidates[:random.randint(1, 2)]:
            diameter = random.choice(pipe_diameters)
            length = math.sqrt(
                (dst["lat"] - src["lat"]) ** 2 + (dst["lon"] - src["lon"]) ** 2
            ) * 111000  # approx metres
            capacity = math.pi * (diameter / 2) ** 2 * random.uniform(0.5, 2.0)  # m³/s

            features_edges.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [src["lon"], src["lat"]],
                        [dst["lon"], dst["lat"]],
                    ],
                },
                "properties": {
                    "pipe_id":    f"P{i:04d}_{j:04d}",
                    "from_node":  src["id"],
                    "to_node":    dst["id"],
                    "diameter_m": diameter,
                    "length_m":   round(length, 1),
                    "capacity_m3s": round(capacity, 4),
                    "material":   random.choice(["RCC", "PVC", "Cast Iron"]),
                    "age_years":  random.randint(5, 60),
                },
            })

    geojson_nodes = {"type": "FeatureCollection", "features": features_nodes}
    geojson_edges = {"type": "FeatureCollection", "features": features_edges}

    out_n = DATASETS_DIR / "drainage" / "drain_nodes.geojson"
    out_e = DATASETS_DIR / "drainage" / "drain_pipes.geojson"
    with open(out_n, "w") as f:
        json.dump(geojson_nodes, f, indent=2)
    with open(out_e, "w") as f:
        json.dump(geojson_edges, f, indent=2)
    print(f"  ✓ Drainage nodes: {n_nodes} → {out_n}")
    print(f"  ✓ Drainage pipes: {len(features_edges)} → {out_e}")
    return {"nodes": geojson_nodes, "edges": geojson_edges}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Historical Flood Records Generator
# ═══════════════════════════════════════════════════════════════════════════════

def generate_flood_history(city: str = "mumbai", n_events: int = 1000) -> pd.DataFrame:
    """Generate historical flood event records."""
    lat_min, lat_max, lon_min, lon_max = CITIES[city]

    records = []
    base = datetime(2015, 6, 1)
    for i in range(n_events):
        lat = random.uniform(lat_min, lat_max)
        lon = random.uniform(lon_min, lon_max)
        # Higher flood depth for low-elevation coastal areas
        coastal_factor = 1.0 - (lon - lon_min) / (lon_max - lon_min)
        depth = max(0, np.random.gamma(2, 10) * coastal_factor)
        rainfall_trigger = depth * 3 + np.random.normal(0, 10)
        t = base + timedelta(days=random.randint(0, 365 * 9))

        records.append({
            "event_id":       f"EVT{i:05d}",
            "timestamp":      t.strftime("%Y-%m-%d %H:%M"),
            "latitude":       round(lat, 5),
            "longitude":      round(lon, 5),
            "water_depth_cm": round(max(0, depth), 1),
            "rainfall_mm":    round(max(0, rainfall_trigger), 1),
            "duration_hrs":   round(random.uniform(1, 24), 1),
            "road_id":        f"R{random.randint(0, 499):04d}",
            "ward":           f"Ward_{random.randint(1, 24)}",
            "affected_area_sqm": round(random.uniform(100, 50000), 0),
        })

    df = pd.DataFrame(records)
    out = DATASETS_DIR / "flood_history" / "flood_events.csv"
    df.to_csv(out, index=False)
    print(f"  ✓ Flood history: {n_events:,} events → {out}")
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# CLI Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="UFNS Dataset Generator")
    parser.add_argument("--city",  default="mumbai", choices=list(CITIES.keys()))
    parser.add_argument("--seed",  type=int, default=42)
    parser.add_argument("--hours", type=int, default=72, help="Rainfall time steps")
    parser.add_argument("--roads", type=int, default=500)
    parser.add_argument("--drain-nodes", type=int, default=200)
    parser.add_argument("--flood-events", type=int, default=2000)
    args = parser.parse_args()

    np.random.seed(args.seed)
    random.seed(args.seed)

    print(f"\n🌧  UFNS Dataset Generator — City: {args.city.upper()}")
    print("=" * 55)

    generate_rainfall_grid(args.city, args.hours)
    generate_dem(args.city)
    generate_roads(args.city, args.roads)
    generate_drainage(args.city, args.drain_nodes)
    generate_flood_history(args.city, args.flood_events)

    print("\n✅ All datasets generated successfully!")


if __name__ == "__main__":
    main()
