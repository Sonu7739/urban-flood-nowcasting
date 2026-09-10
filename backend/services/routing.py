"""
Routing Service — Dijkstra-based safe route planner.
Avoids roads with water_depth > 15 cm.
"""
import json
import math
from pathlib import Path
from typing import List, Optional, Tuple

import networkx as nx

PROJECT_ROOT = Path(__file__).parent.parent.parent


class RoutingService:
    def __init__(self):
        self.road_graph: Optional[nx.Graph] = None
        self._build_graph()

    def _build_graph(self):
        """Build road graph from GeoJSON."""
        road_path = PROJECT_ROOT / "datasets" / "roads" / "road_network.geojson"
        if not road_path.exists():
            self.road_graph = None
            return

        with open(road_path) as f:
            gj = json.load(f)

        G = nx.Graph()
        for feat in gj["features"]:
            coords = feat["geometry"]["coordinates"]
            props  = feat["properties"]
            # Add edges between consecutive points in LineString
            for i in range(len(coords) - 1):
                lon1, lat1 = coords[i]
                lon2, lat2 = coords[i + 1]
                dist = _haversine(lat1, lon1, lat2, lon2)
                speed_kmh = {"primary": 50, "secondary": 40, "tertiary": 30, "residential": 20}
                speed = speed_kmh.get(props.get("road_type", "tertiary"), 30)
                travel_time = dist / (speed * 1000 / 3600)   # seconds

                n1 = f"{lat1:.5f},{lon1:.5f}"
                n2 = f"{lat2:.5f},{lon2:.5f}"
                G.add_node(n1, lat=lat1, lon=lon1)
                G.add_node(n2, lat=lat2, lon=lon2)
                G.add_edge(n1, n2,
                           road_id    = props["road_id"],
                           dist_m     = dist,
                           travel_time= travel_time,
                           water_depth= 0.0,
                           weight     = travel_time)

        self.road_graph = G

    def update_flood_weights(self, flood_geojson: dict):
        """Update edge weights from current flood simulation."""
        if self.road_graph is None:
            return
        FLOOD_PENALTY  = 1000   # seconds per cm above 15 cm
        DEPTH_CUTOFF   = 15.0   # cm — avoid roads deeper than this
        depth_map = {}
        for feat in flood_geojson.get("features", []):
            rid   = feat["properties"].get("road_id")
            depth = feat["properties"].get("water_depth", 0)
            depth_map[rid] = depth

        for u, v, data in self.road_graph.edges(data=True):
            rid   = data.get("road_id", "")
            depth = depth_map.get(rid, 0.0)
            data["water_depth"] = depth
            if depth > DEPTH_CUTOFF:
                data["weight"] = data["travel_time"] + FLOOD_PENALTY * (depth - DEPTH_CUTOFF)
            else:
                data["weight"] = data["travel_time"]

    def find_route(
        self,
        start_lat: float, start_lon: float,
        end_lat:   float, end_lon:   float,
    ) -> dict:
        """Find safest route between two points."""
        if self.road_graph is None:
            return {"error": "Road graph not available"}

        # Find nearest graph nodes
        start_node = _nearest_node(self.road_graph, start_lat, start_lon)
        end_node   = _nearest_node(self.road_graph, end_lat,   end_lon)

        if start_node is None or end_node is None:
            return {"error": "Could not find nearby road nodes"}

        try:
            path = nx.dijkstra_path(self.road_graph, start_node, end_node, weight="weight")
        except nx.NetworkXNoPath:
            return {"error": "No safe route found"}

        # Build response
        coordinates = []
        avoided     = []
        total_time  = 0.0
        total_dist  = 0.0

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            data = self.road_graph[u][v]
            total_time += data["travel_time"]
            total_dist += data["dist_m"]
            if data["water_depth"] > 15:
                avoided.append(data["road_id"])
            node_data = self.road_graph.nodes[u]
            coordinates.append([node_data["lon"], node_data["lat"]])

        if path:
            last = self.road_graph.nodes[path[-1]]
            coordinates.append([last["lon"], last["lat"]])

        eta_min = round(total_time / 60, 1)

        return {
            "route": {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {
                    "distance_m":   round(total_dist, 0),
                    "eta_minutes":  eta_min,
                    "avoided_roads": list(set(avoided)),
                    "n_waypoints":  len(coordinates),
                },
            },
            "eta_minutes":   eta_min,
            "distance_m":    round(total_dist, 0),
            "avoided_roads": list(set(avoided)),
            "safe":          len(avoided) == 0,
        }


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_node(G: nx.Graph, lat: float, lon: float) -> Optional[str]:
    best, best_dist = None, float("inf")
    for nid, data in G.nodes(data=True):
        d = _haversine(lat, lon, data["lat"], data["lon"])
        if d < best_dist:
            best_dist = d
            best = nid
    return best
