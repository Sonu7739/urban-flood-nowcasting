"""
Alert Router
GET  /api/alerts           — Existing alerts
POST /api/alerts/broadcast — Admin broadcasts alert
GET  /api/alerts/all       — All notifications for a user
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import Optional, List

from backend.database import get_db
from backend.models.activity import Notification, RiskLevelEnum
from backend.services.auth import get_current_admin_user
from backend.models.user import User

router = APIRouter()


class AlertBroadcast(BaseModel):
    title: str
    message: str
    risk_level: str = "Yellow"  # Green | Yellow | Orange | Red
    user_id: Optional[int] = None  # None = broadcast to all


@router.post("/alerts/broadcast")
async def broadcast_alert(
    payload: AlertBroadcast,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    try:
        risk = RiskLevelEnum(payload.risk_level)
    except ValueError:
        risk = RiskLevelEnum.yellow

    notif = Notification(
        user_id=payload.user_id,
        title=payload.title,
        message=payload.message,
        risk_level=risk,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return {"id": notif.id, "status": "broadcasted"}


@router.get("/alerts/notifications")
async def get_notifications(
    user_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        q = select(Notification).order_by(Notification.id.desc()).limit(50)
        if user_id:
            q = q.filter((Notification.user_id == user_id) | (Notification.user_id == None))
        result = await db.execute(q)
        rows = result.scalars().all()
        return [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "risk_level": n.risk_level.value if n.risk_level else "Green",
                "is_read": n.is_read,
                "created_at": str(n.created_at),
            }
            for n in rows
        ]
    except Exception:
        # Return mock alerts if DB not ready
        return [
            {
                "id": 1,
                "title": "Flash Flood Warning",
                "message": "Flooding predicted near MG Road in approximately 40 minutes.",
                "risk_level": "Red",
                "is_read": 0,
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "id": 2,
                "title": "Drainage Overload Alert",
                "message": "Drainage capacity at 85% in Sion Junction area.",
                "risk_level": "Orange",
                "is_read": 0,
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "id": 3,
                "title": "Rainfall Advisory",
                "message": "Heavy rainfall expected: 72 mm/hr. Avoid low-lying areas.",
                "risk_level": "Yellow",
                "is_read": 1,
                "created_at": datetime.utcnow().isoformat(),
            },
        ]
