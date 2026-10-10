import math
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
import models
import schemas
from ai_engine import extract_complaint_info, judge_similarity, DEPARTMENT_MAP
from geo_utils import find_candidate_incidents

SEVERITY_WEIGHTS = {
    "LOW": 10.0,
    "MEDIUM": 25.0,
    "HIGH": 45.0,
    "CRITICAL": 70.0
}

def calculate_priority_score(severity: str, complaint_count: int, created_at: datetime) -> float:
    """
    Calculates dynamic municipal priority score (0-100+):
    Severity Base (10-70) + Citizen Count Multiplier (12 * log2(count)) + Aging Bonus
    """
    base = SEVERITY_WEIGHTS.get(severity.upper(), 25.0)
    
    # Citizen count boost: 1 person -> 0 bonus, 2 people -> 12 bonus, 4 people -> 24 bonus, 8 people -> 36 bonus
    volume_bonus = 12.0 * math.log2(max(1, complaint_count))
    
    # Aging bonus: 2 points per 24 hours open
    hours_open = (datetime.utcnow() - created_at).total_seconds() / 3600.0
    aging_bonus = min(15.0, (hours_open / 24.0) * 2.0)
    
    return round(base + volume_bonus + aging_bonus, 1)

def process_and_cluster_complaint(
    db: Session,
    raw_text: str,
    latitude: float,
    longitude: float,
    user_name: str = "Anonymous Citizen",
    user_contact: str = None,
    media_url: str = None,
    source: str = "web_portal",
    source_reference_id: str = None
) -> models.Complaint:
    """
    Core AI Pipeline:
    1. Single-pass LLM structured extraction (category, summary, richness_score, severity)
    2. 500m & Same-Category Database spatial filter
    3. LLM semantic judge only if candidate in 500m found
    4. Clubbing & Canonical Leader Election
    5. Dynamic Priority re-scoring
    """
    # Step 1: AI Skeleton Extraction
    extraction = extract_complaint_info(raw_text, has_media=bool(media_url))

    # Step 2: Spatial & Category Filter (<= 500 meters)
    candidates = find_candidate_incidents(
        db=db,
        latitude=latitude,
        longitude=longitude,
        category=extraction.category,
        max_radius_meters=500.0
    )

    matched_incident = None

    # Step 3: Targeted Similarity Check
    for candidate_incident, dist_meters in candidates:
        judge = judge_similarity(
            summary_a=candidate_incident.title,
            summary_b=extraction.summary,
            category=extraction.category,
            distance_meters=dist_meters
        )
        if judge.is_same_incident:
            matched_incident = candidate_incident
            break

    # Generate UUID upfront
    complaint_id = str(uuid.uuid4())
    new_complaint = models.Complaint(
        id=complaint_id,
        source=source,
        source_reference_id=source_reference_id,
        user_name=user_name,
        user_contact=user_contact,
        raw_text=raw_text,
        summary=extraction.summary,
        category=extraction.category,
        sub_category=extraction.sub_category,
        richness_score=extraction.richness_score,
        severity_level=extraction.severity_level,
        duration_mentioned=extraction.duration_mentioned,
        latitude=latitude,
        longitude=longitude,
        landmark=extraction.landmark,
        media_url=media_url,
        is_canonical=False
    )

    if matched_incident:
        # Step 4A: Club into Existing Incident
        new_complaint.incident_id = matched_incident.id
        matched_incident.complaint_count += 1
        
        # Check current canonical complaint's richness score
        current_canonical = (
            db.query(models.Complaint)
            .filter(models.Complaint.id == matched_incident.canonical_complaint_id)
            .first()
        )
        
        current_score = current_canonical.richness_score if current_canonical else 0

        # Step 4B: Leader Election (Promote higher informative complaint to top!)
        if extraction.richness_score > current_score:
            if current_canonical:
                current_canonical.is_canonical = False
            new_complaint.is_canonical = True
            matched_incident.canonical_complaint_id = new_complaint.id
            matched_incident.title = extraction.summary
            if extraction.sub_category:
                matched_incident.sub_category = extraction.sub_category
        else:
            new_complaint.is_canonical = False

        # Update priority score
        matched_incident.priority_score = calculate_priority_score(
            severity=matched_incident.complaints[0].severity_level if matched_incident.complaints else extraction.severity_level,
            complaint_count=matched_incident.complaint_count,
            created_at=matched_incident.created_at
        )
        matched_incident.updated_at = datetime.utcnow()

        db.add(new_complaint)
        db.commit()
        db.refresh(new_complaint)
        db.refresh(matched_incident)

    else:
        # Step 5: Create brand new Incident
        incident_id = str(uuid.uuid4())
        dept = DEPARTMENT_MAP.get(extraction.category, "General Municipal Services")
        new_incident = models.Incident(
            id=incident_id,
            title=extraction.summary,
            category=extraction.category,
            sub_category=extraction.sub_category,
            latitude=latitude,
            longitude=longitude,
            status="OPEN",
            assigned_department=dept,
            complaint_count=1,
            canonical_complaint_id=new_complaint.id,
            priority_score=calculate_priority_score(
                severity=extraction.severity_level,
                complaint_count=1,
                created_at=datetime.utcnow()
            )
        )
        new_complaint.incident_id = new_incident.id
        new_complaint.is_canonical = True

        db.add(new_incident)
        db.add(new_complaint)
        db.commit()
        db.refresh(new_complaint)
        db.refresh(new_incident)

    return new_complaint

