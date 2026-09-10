"""
Simulation Service — wraps flood_sim.FloodSimulator for async use.
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).parent.parent.parent


class SimulationService:
    def __init__(self):
        self.simulator       = None
        self.latest_summary  = None
        self.current_rainfall = 45.0   # default baseline
        self.demo_mode       = False
        self._loop_running   = False

    async def initialise(self):
        """Load simulator in thread pool to avoid blocking startup."""
        loop = asyncio.get_event_loop()
        self.simulator = await loop.run_in_executor(None, self._load_sim)
        if self.simulator:
            await self._run_step()

    def _load_sim(self):
        try:
            import sys
            sys.path.insert(0, str(PROJECT_ROOT))
            from simulation.flood_sim import FloodSimulator
            return FloodSimulator()
        except Exception as e:
            print(f"  ⚠  Simulator load error: {e}")
            return None

    async def _run_step(self):
        if self.simulator is None:
            self.latest_summary = self._mock_summary()
            return
        loop = asyncio.get_event_loop()
        rainfall = self.current_rainfall
        summary  = await loop.run_in_executor(
            None, lambda: self.simulator.step(rainfall, self.demo_mode)
        )
        self.latest_summary = summary

    def _mock_summary(self) -> dict:
        """Return realistic mock summary if simulator not available."""
        import random
        r = self.current_rainfall
        return {
            "timestamp":       datetime.utcnow().isoformat() + "Z",
            "rainfall_mm_hr":  r,
            "total_roads":     500,
            "critical_roads":  int(r * 1.2),
            "warning_roads":   int(r * 2.5),
            "caution_roads":   int(r * 4),
            "safe_roads":      max(0, 500 - int(r * 7.7)),
            "avg_depth_cm":    round(r * 0.35, 2),
            "max_depth_cm":    round(r * 0.85, 2),
        }

    async def background_loop(self):
        """Run simulation every 5 minutes."""
        self._loop_running = True
        while self._loop_running:
            await asyncio.sleep(300)   # 5 minutes
            try:
                await self._run_step()
            except Exception as e:
                print(f"  ⚠  Simulation step error: {e}")

    async def inject_rainfall(self, rainfall_mm_hr: float, duration_minutes: int = 60):
        """Admin: inject artificial rainfall."""
        self.current_rainfall = rainfall_mm_hr
        self.demo_mode = True
        await self._run_step()

    def get_flood_geojson(self) -> Optional[dict]:
        path = PROJECT_ROOT / "datasets" / "processed" / "flood_current.geojson"
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return self._mock_geojson()

    def _mock_geojson(self) -> dict:
        """Mock GeoJSON if no real data exists."""
        import random
        features = []
        for i in range(100):
            lat = 18.87 + random.uniform(0, 0.4)
            lon = 72.77 + random.uniform(0, 0.23)
            depth = random.uniform(0, 60)
            risk = "Red" if depth > 30 else "Orange" if depth > 15 else "Yellow" if depth > 5 else "Green"
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [
                    [lon, lat], [lon + 0.002, lat + 0.001]
                ]},
                "properties": {
                    "road_id": f"R{i:04d}",
                    "water_depth": round(depth, 1),
                    "risk": risk,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
            })
        return {"type": "FeatureCollection", "features": features}

    def get_rainfall_grid(self) -> list:
        """Return current rainfall grid cells."""
        import random
        cells = []
        for lat_off in range(0, 20):
            for lon_off in range(0, 12):
                lat = round(18.87 + lat_off * 0.02, 4)
                lon = round(72.77 + lon_off * 0.02, 4)
                rf  = max(0, self.current_rainfall + random.uniform(-15, 15))
                cells.append({
                    "lat": lat, "lon": lon,
                    "rainfall_mm_hr": round(rf, 1),
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                })
        return cells
