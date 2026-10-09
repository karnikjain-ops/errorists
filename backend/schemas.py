from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class ComplaintCreate(BaseModel):
    raw_text: str = Field(..., min_length=3, description="Unstructured description of the problem")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Geotagged latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Geotagged longitude")
    user_name: Optional[str] = "Anonymous Citizen"
    user_contact: Optional[str] = None
    media_url: Optional[str] = None
    source: Optional[str] = "web_portal"

class ExternalComplaintWebhook(BaseModel):
    portal_name: str = Field(..., description="Name of external system, e.g. 'cpgrams', 'mcd_portal', 'twitter'")
    external_ticket_id: Optional[str] = None
    raw_text: str
    latitude: float
    longitude: float
    user_name: Optional[str] = "External Reporter"
    user_contact: Optional[str] = None
    media_url: Optional[str] = None
    timestamp: Optional[datetime] = None

class ExtractionResult(BaseModel):
    category: str = Field(..., description="Main category: water_supply, road_infrastructure, electricity, waste_management, sewage, other")
    sub_category: Optional[str] = Field(None, description="Specific defect, e.g. pothole, pipe_burst, street_light")
    summary: str = Field(..., description="Clear 1-sentence synopsis of the physical problem")
    richness_score: int = Field(..., ge=0, le=100, description="Score based on detail, landmarks, impact, duration")
    severity_level: str = Field(..., description="LOW, MEDIUM, HIGH, CRITICAL")
    duration_mentioned: Optional[str] = Field(None, description="How long the issue has persisted, if mentioned")
    landmark: Optional[str] = Field(None, description="Landmarks or street mentions")
    reasoning: Optional[str] = Field(None, description="Brief rationale for the assigned richness score")

class SimilarityJudgeResult(BaseModel):
    is_same_incident: bool = Field(..., description="True if both complaints describe the exact same physical issue")
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: Optional[str] = None

class ComplaintOut(BaseModel):
    id: str
    incident_id: Optional[str]
    source: str
    user_name: str
    raw_text: str
    summary: str
    category: str
    sub_category: Optional[str]
    richness_score: int
    severity_level: str
    duration_mentioned: Optional[str]
    latitude: float
    longitude: float
    landmark: Optional[str]
    media_url: Optional[str]
    is_canonical: bool
    created_at: datetime

    class Config:
        from_attributes = True

class IncidentOut(BaseModel):
    id: str
    title: str
    category: str
    sub_category: Optional[str]
    latitude: float
    longitude: float
    status: str
    assigned_department: str
    priority_score: float
    complaint_count: int
    canonical_complaint_id: Optional[str]
    canonical_complaint: Optional[ComplaintOut] = None
    supporting_complaints: List[ComplaintOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class IncidentStatusUpdate(BaseModel):
    status: str = Field(..., description="OPEN, ASSIGNED, IN_PROGRESS, RESOLVED")
    assigned_department: Optional[str] = None

class CategoryStat(BaseModel):
    category: str
    complaint_count: int
    incident_count: int

class StatsOut(BaseModel):
    total_complaints: int
    total_incidents: int
    clustering_reduction_percent: float
    open_incidents: int
    resolved_incidents: int
    categories: List[CategoryStat]
