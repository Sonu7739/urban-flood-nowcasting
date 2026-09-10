"""
Urban Flood Nowcasting System — Drainage Graph Engine
=====================================================
Converts underground drainage GeoJSON into a directed NetworkX graph.

Features:
  - Node types: manhole, inlet, junction
  - Edge attributes: diameter, capacity, flow_speed, direction
  - Algorithms: Dijkstra, BFS, overflow propagation
  - Hydraulic capacity (Manning's equation)
  - Output: overflow probability per node

Usage:
    python graph/drain_graph.py [--input datasets/processed/drain_nodes_clean.geojson]
"""

import argparse
import json
import math
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import networkx as nx
import numpy as np

PROJECT_ROOT = Path(__file__).parent.parent


# ═══════════════════════════════════════════════════════════════════════════════
# Graph Construction
# ═══════════════════════════════════════════════════════════════════════════════

def build_drainage_graph(
    nodes_path: Path,
    pipes_path: Path,
) -> nx.DiGraph:
    """Build a directed NetworkX graph from GeoJSON drainage data."""

    with open(nodes_path) as f:
        nodes_gj = json.load(f)
    with open(pipes_path) as f:
        pipes_gj = json.load(f)

    G = nx.DiGraph()

    # ── Add nodes ─────────────────────────────────────────────────────────────
    for feat in nodes_gj["features"]:
        lng, lat = feat["geometry"]["coordinates"]
        p = feat["properties"]
        node_id = p["id"]
        G.add_node(
            node_id,
            node_type   = p.get("type", "manhole"),
            lat         = lat,
            lon         = lng,
            capacity_ls = float(p.get("capacity", 100)),
            depth_m     = float(p.get("depth_m", 2.0)),
            current_flow= 0.0,          # runtime: current incoming flow (L/s)
            overflow    = 0.0,          # runtime: overflow volume (L)
            surcharge   = False,        # runtime: under surcharge?
        )

    # ── Add edges (pipes) ─────────────────────────────────────────────────────
    for feat in pipes_gj["features"]:
        p = feat["properties"]
        src, dst = p.get("from_node"), p.get("to_node")
        if src not in G or dst not in G:
            continue

        diameter   = float(p.get("diameter_m", 0.6))
        length     = float(p.get("length_m", 100))
        capacity   = float(p.get("capacity_m3s", 0.05))
        age_years  = int(p.get("age_years", 20))

        # Manning's equation: Q = (1/n) * A * R^(2/3) * S^(1/2)
        # Roughness factor degrades with age
        n_manning  = 0.013 + age_years * 0.0002   # PVC = 0.013, old RCC = 0.025
        area       = math.pi * (diameter / 2) ** 2
        hydraulic_r = diameter / 4   # circular pipe full flow
        # Assume mild slope of 1:500
        slope_m_m  = 0.002
        q_full     = (1 / n_manning) * area * (hydraulic_r ** (2/3)) * math.sqrt(slope_m_m)
        flow_speed = q_full / area if area > 0 else 0

        G.add_edge(
            src, dst,
            pipe_id      = p.get("pipe_id", f"{src}_{dst}"),
            diameter_m   = diameter,
            length_m     = length,
            capacity_m3s = capacity,
            q_full_m3s   = round(q_full, 5),
            flow_speed   = round(flow_speed, 3),
            age_years    = age_years,
            material     = p.get("material", "RCC"),
            # Dijkstra weight = travel time (s) through pipe
            weight       = length / max(flow_speed, 0.01),
        )

    print(f"  ✓ Drainage graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


# ═══════════════════════════════════════════════════════════════════════════════
# Hydraulic Analysis
# ═══════════════════════════════════════════════════════════════════════════════

def compute_overflow_probability(
    G: nx.DiGraph,
    inflow_rates: Dict[str, float],   # node_id → inflow L/s
) -> Dict[str, float]:
    """
    Propagate flows through the network using BFS from inlet nodes.
    Returns dict of node_id → overflow_probability [0, 1].
    """

    # Reset runtime state
    for nid in G.nodes:
        G.nodes[nid]["current_flow"] = inflow_rates.get(nid, 0.0)
        G.nodes[nid]["overflow"]     = 0.0
        G.nodes[nid]["surcharge"]    = False

    # Topological BFS propagation (upstream → downstream)
    try:
        topo_order = list(nx.topological_sort(G))
    except nx.NetworkXUnfeasible:
        # Cycle in graph — use BFS from zero-in-degree nodes
        roots = [n for n in G.nodes if G.in_degree(n) == 0]
        topo_order = list(nx.bfs_tree(G, roots[0]).nodes) if roots else list(G.nodes)

    for nid in topo_order:
        node     = G.nodes[nid]
        cap_ls   = node["capacity_ls"]
        flow_in  = node["current_flow"]

        # Check surcharge
        if flow_in > cap_ls:
            node["surcharge"] = True
            excess = flow_in - cap_ls
            node["overflow"]  = excess
            # Backflow: distribute excess to upstream nodes (simplified)
            preds = list(G.predecessors(nid))
            if preds:
                per_pred = excess * 0.3 / len(preds)
                for pred in preds:
                    G.nodes[pred]["current_flow"] += per_pred

            flow_out = cap_ls   # capped
        else:
            flow_out = flow_in

        # Propagate to downstream nodes weighted by pipe capacity
        succs = list(G.successors(nid))
        if succs:
            total_cap = sum(G[nid][s]["capacity_m3s"] for s in succs)
            for succ in succs:
                pipe_cap = G[nid][succ]["capacity_m3s"]
                fraction = pipe_cap / max(total_cap, 1e-9)
                G.nodes[succ]["current_flow"] += flow_out * fraction * 1000  # m³/s → L/s

    # Compute overflow probability per node
    probs = {}
    for nid in G.nodes:
        node = G.nodes[nid]
        cap  = node["capacity_ls"]
        flow = node["current_flow"]
        # Sigmoid-based probability
        ratio = flow / max(cap, 1e-9)
        prob  = 1 / (1 + math.exp(-8 * (ratio - 1)))
        probs[nid] = round(prob, 4)

    return probs


# ═══════════════════════════════════════════════════════════════════════════════
# Dijkstra Path Finding (Drainage Flow)
# ═══════════════════════════════════════════════════════════════════════════════

def find_flow_path(
    G: nx.DiGraph,
    source: str,
    target: str,
) -> Tuple[List[str], float]:
    """Find the fastest drainage path from source to target (Dijkstra)."""
    try:
        path   = nx.dijkstra_path(G, source, target, weight="weight")
        length = nx.dijkstra_path_length(G, source, target, weight="weight")
        return path, round(length, 2)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return [], float("inf")


def bfs_reachable(G: nx.DiGraph, source: str, max_depth: int = 5) -> List[str]:
    """BFS to find all nodes reachable within max_depth steps."""
    visited = []
    bfs_iter = nx.bfs_edges(G, source, depth_limit=max_depth)
    for u, v in bfs_iter:
        visited.append(v)
    return visited


# ═══════════════════════════════════════════════════════════════════════════════
# Summary Export
# ═══════════════════════════════════════════════════════════════════════════════

def export_overflow_geojson(
    G: nx.DiGraph,
    probs: Dict[str, float],
    out_path: Path,
):
    """Export overflow probabilities as GeoJSON."""
    features = []
    for nid, prob in probs.items():
        node = G.nodes[nid]
        risk = (
            "Critical" if prob > 0.8 else
            "High"     if prob > 0.5 else
            "Medium"   if prob > 0.2 else
            "Low"
        )
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [node["lon"], node["lat"]],
            },
            "properties": {
                "node_id":             nid,
                "node_type":           node["node_type"],
                "overflow_probability": prob,
                "risk":                risk,
                "current_flow_ls":     round(node["current_flow"], 2),
                "capacity_ls":         node["capacity_ls"],
                "surcharge":           node["surcharge"],
            },
        })
    gj = {"type": "FeatureCollection", "features": features}
    with open(out_path, "w") as f:
        json.dump(gj, f, indent=2)
    print(f"  ✓ Overflow GeoJSON → {out_path.name}")


# ═══════════════════════════════════════════════════════════════════════════════
# Singleton accessor (used by simulation + backend)
# ═══════════════════════════════════════════════════════════════════════════════

_GRAPH_CACHE: Optional[nx.DiGraph] = None

def get_drain_graph() -> nx.DiGraph:
    """Return cached drainage graph (lazy-load)."""
    global _GRAPH_CACHE
    if _GRAPH_CACHE is None:
        nodes_p = PROJECT_ROOT / "datasets" / "processed" / "drain_nodes_clean.geojson"
        pipes_p = PROJECT_ROOT / "datasets" / "processed" / "drain_pipes_clean.geojson"
        if not nodes_p.exists():
            raise FileNotFoundError(
                "Processed drainage data not found. Run ai/data_pipeline.py first."
            )
        _GRAPH_CACHE = build_drainage_graph(nodes_p, pipes_p)
    return _GRAPH_CACHE


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="UFNS Drainage Graph Engine")
    parser.add_argument("--rainfall", type=float, default=50.0,
                        help="Simulated rainfall (mm/hr) for inflow calculation")
    args = parser.parse_args()

    print("\n🕸  UFNS Drainage Graph Engine")
    print("=" * 50)

    G = get_drain_graph()

    # Simulate uniform inflow (proportional to rainfall)
    inflow_factor = args.rainfall / 10   # litres per second per inlet
    inflows = {
        nid: (inflow_factor * np.random.uniform(0.5, 1.5))
        for nid, data in G.nodes(data=True)
        if data["node_type"] in ("inlet", "manhole")
    }

    print(f"\n  Simulating inflows @ {args.rainfall} mm/hr rainfall ...")
    probs = compute_overflow_probability(G, inflows)

    critical = [(nid, p) for nid, p in probs.items() if p > 0.5]
    print(f"  ✓ {len(critical)} nodes at high overflow risk (prob > 0.5)")

    # Sample Dijkstra path
    nodes_list = list(G.nodes)
    if len(nodes_list) >= 2:
        src, tgt = nodes_list[0], nodes_list[-1]
        path, dist = find_flow_path(G, src, tgt)
        print(f"  ✓ Dijkstra {src} → {tgt}: {len(path)} hops, {dist:.1f}s travel time")

    out_path = PROJECT_ROOT / "datasets" / "processed" / "overflow_map.geojson"
    export_overflow_geojson(G, probs, out_path)

    print("\n✅ Drainage graph analysis complete!")


if __name__ == "__main__":
    main()
