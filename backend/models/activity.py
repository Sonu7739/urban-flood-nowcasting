import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.database import Base
from backend.models.user import User

class RiskLevelEnum(str, enum.Enum):
    green = "Green"
    yellow = "Yellow"
    orange = "Orange"
    red = "Red"

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Nullable for broadcast alerts
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    risk_level = Column(Enum(RiskLevelEnum), default=RiskLevelEnum.green)
    is_read = Column(Integer, default=0) # 0 for False, 1 for True for simplicity if boolean issues occur
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

class SavedLocation(Base):
    __tablename__ = "saved_locations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
