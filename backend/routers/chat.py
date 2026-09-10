"""
FloodAssist AI Chatbot Router
POST /api/chat  — Context-aware flood assistant
"""
import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.database import get_db
from backend.models.activity import ChatHistory

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class ChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    history: Optional[List[ChatMessage]] = []


# ── Rule-based flood assistant ──────────────────────────────────────────────────
RESPONSES = {
    "safe": [
        "🟢 Based on current predictions, your area shows **low flood risk**. Water depth is estimated at 3–5 cm. Stay alert and monitor local updates.",
        "✅ Your location appears **safe** at the moment. Rainfall intensity is below critical threshold. Continue monitoring.",
    ],
    "flood": [
        "🔴 **Flooding is predicted** in your area within the next 40–90 minutes. Predicted water depth: 28 cm. Please move to higher ground immediately.",
        "⚠️ Current data shows **elevated flood risk**. Water depth predictions range from 15–30 cm. Avoid low-lying roads.",
    ],
    "shelter": [
        "🏠 Nearest flood shelter: **Community Relief Center Alpha** — 1.2 km away. Capacity: 500 people. Phone: 1800-111-001.\n\nUse the Emergency Services tab to see all shelters on the map.",
        "🏠 The closest shelter is **Municipal Flood Shelter Beta**, 2.1 km from your location. Phone: 1800-111-002.",
    ],
    "hospital": [
        "🏥 **City General Hospital** is 1.5 km away. Phone: 1800-222-001. For emergencies, dial **108**.",
        "🏥 Nearest hospital: **District Medical Center** — 2.3 km. Emergency: **108**.",
    ],
    "route": [
        "🗺️ Use the **Safe Route Planner** to get a flood-aware route. It avoids roads with water depth > 15 cm and calculates the safest path.",
        "🗺️ Open the Route Planner tab, enter your destination, and I'll find a route avoiding flooded roads for you.",
    ],
    "rain": [
        "🌧️ Current rainfall intensity: **72 mm/hr** (Heavy). This is above the flood threshold. Drain capacity at 78%. Expect waterlogging in low-lying areas.",
        "🌧️ Rainfall is at **45 mm/hr** — moderate intensity. Keep an eye on water depth predictions for your ward.",
    ],
    "depth": [
        "📊 Water depth is measured in centimetres. **< 5 cm** = Safe, **5–15 cm** = Caution (affects vehicles), **15–30 cm** = Warning (dangerous), **> 30 cm** = Critical (evacuate).",
    ],
    "emergency": [
        "🚨 Emergency Numbers:\n- **Police**: 100\n- **Fire Brigade**: 101\n- **Ambulance**: 108\n- **NDRF**: 011-24363260\n- **Flood Control**: 1800-111-100",
    ],
    "evacuate": [
        "🚶 Evacuation guidance:\n1. Move to the **nearest shelter** on higher ground\n2. Avoid flooded roads\n3. Use the **Safe Route Planner**\n4. Call NDRF: 011-24363260\n5. Take essentials: documents, medicines, phone charger",
    ],
    "risk": [
        "🎯 Risk levels:\n- 🟢 **Green** — Safe, water depth < 5 cm\n- 🟡 **Yellow** — Caution, 5–15 cm\n- 🟠 **Orange** — Warning, 15–30 cm\n- 🔴 **Red** — Critical, > 30 cm — evacuate immediately",
    ],
    "default": [
        "I'm **FloodAssist AI**, your flood safety assistant. I can help you with:\n- Is my area safe?\n- Nearest shelter or hospital\n- Safe evacuation route\n- Rainfall and flood depth info\n- Emergency contacts\n\nWhat would you like to know?",
        "I have access to real-time flood predictions, rainfall data, and emergency services. Ask me anything about flood safety!",
    ],
}


def _classify_intent(msg: str) -> str:
    msg = msg.lower()
    if any(w in msg for w in ["safe", "danger", "flood my area", "my location"]):
        return "safe"
    if any(w in msg for w in ["flood", "water", "submerge", "inundation"]):
        return "flood"
    if any(w in msg for w in ["shelter", "camp", "refuge", "evacuat"]):
        return "shelter"
    if any(w in msg for w in ["hospital", "doctor", "medical", "ambulance", "108"]):
        return "hospital"
    if any(w in msg for w in ["route", "path", "navigate", "direction", "road"]):
        return "route"
    if any(w in msg for w in ["rain", "rainfall", "mm/hr", "weather"]):
        return "rain"
    if any(w in msg for w in ["depth", "cm", "centimetre", "level"]):
        return "depth"
    if any(w in msg for w in ["emergency", "number", "contact", "police", "fire", "ndrf"]):
        return "emergency"
    if any(w in msg for w in ["evacuat", "leave", "go", "escape", "run"]):
        return "evacuate"
    if any(w in msg for w in ["risk", "level", "color", "colour", "red", "orange", "yellow", "green"]):
        return "risk"
    return "default"


@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    intent = _classify_intent(req.message)
    responses = RESPONSES.get(intent, RESPONSES["default"])
    reply = random.choice(responses)

    # Append location context if provided
    if req.lat and req.lon and intent in ("safe", "flood", "shelter", "route"):
        reply += f"\n\n📍 *Based on your location: {req.lat:.4f}°N, {req.lon:.4f}°E*"

    # Persist to DB if user is logged in
    if req.user_id:
        try:
            user_msg = ChatHistory(user_id=req.user_id, role="user", content=req.message)
            bot_msg  = ChatHistory(user_id=req.user_id, role="assistant", content=reply)
            db.add(user_msg)
            db.add(bot_msg)
            await db.commit()
        except Exception:
            pass  # Don't fail chat if DB write fails

    return {
        "reply": reply,
        "intent": intent,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/chat/history/{user_id}")
async def chat_history(user_id: int, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(ChatHistory).filter(ChatHistory.user_id == user_id).order_by(ChatHistory.id)
        )
        rows = result.scalars().all()
        return [{"role": r.role, "content": r.content, "timestamp": str(r.created_at)} for r in rows]
    except Exception:
        return []
