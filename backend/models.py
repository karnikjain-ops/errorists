import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    sub_category = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String(50), default="OPEN", index=True)  # OPEN, ASSIGNED, IN_PROGRESS, RESOLVED
    assigned_department = Column(String(150), default="Unassigned")
    priority_score = Column(Float, default=10.0)  # Calculated score: severity + log(count) + aging
    complaint_count = Column(Integer, default=1)
    canonical_complaint_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    complaints = relationship("Complaint", back_populates="incident", foreign_keys="Complaint.incident_id")

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=True, index=True)
    source = Column(String(50), default="web_portal")  # web_portal, external_portal, email, twitter, whatsapp
    source_reference_id = Column(String(100), nullable=True)
    user_name = Column(String(100), default="Anonymous Citizen")
    user_contact = Column(String(100), nullable=True)
    raw_text = Column(Text, nullable=False)
    
    # AI-extracted fields
    summary = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    sub_category = Column(String(100), nullable=True)
    richness_score = Column(Integer, default=50)  # 0 to 100 based on detail, landmarks, impact
    severity_level = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    duration_mentioned = Column(String(100), nullable=True)
    
    # Geospatial
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    landmark = Column(String(255), nullable=True)
    
    # Media & Status
    media_url = Column(String(500), nullable=True)
    is_canonical = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="complaints", foreign_keys=[incident_id])
