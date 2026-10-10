import os
import uuid
import shutil
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, Base, get_db
import models
import schemas
from clustering_engine import process_and_cluster_complaint

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Civic Complaints Aggregator & Routing Engine",
    description="Intelligent civic complaint ingestion, geospatial clustering, and canonical ranking system",
    version="1.0.0"
)

# Create uploads directory if it does not exist
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files to serve uploaded photos
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AI Civic Complaint Ingestion & Resolution Engine",
        "docs_url": "/docs"
    }

@app.post("/api/v1/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    Uploads a photo/image file captured from the camera or device.
    Saves to the uploads directory and returns the accessible URL.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]
    if file.content_type and not (file.content_type.startswith("image/") or file.content_type in allowed_types):
        raise HTTPException(status_code=400, detail="Only image files are permitted.")

    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext not in ["jpg", "jpeg", "png", "webp", "gif"]:
            ext = "jpg"

    unique_filename = f"{uuid.uuid4().hex}_{int(datetime.utcnow().timestamp())}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        return {
            "url": f"/uploads/{unique_filename}",
            "filename": unique_filename,
            "size": file_size,
            "content_type": file.content_type
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")

@app.post("/api/v1/complaints/submit", response_model=schemas.ComplaintOut)
def submit_complaint(complaint: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    """
    Submits an unstructured citizen complaint with geotagging.
    Automatically extracts skeleton attributes, checks for matching incidents within 500m,
    clubs if duplicate, and promotes if higher richness score.
    """
    try:
        new_complaint = process_and_cluster_complaint(
            db=db,
            raw_text=complaint.raw_text,
            latitude=complaint.latitude,
            longitude=complaint.longitude,
            user_name=complaint.user_name or "Anonymous Citizen",
            user_contact=complaint.user_contact,
            media_url=complaint.media_url,
            source=complaint.source or "web_portal"
        )
        return new_complaint
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/complaints/external-webhook", response_model=schemas.ComplaintOut)
def external_portal_webhook(payload: schemas.ExternalComplaintWebhook, db: Session = Depends(get_db)):
    """
    Webhook intake for complaints from external government portals, Twitter, or third-party apps.
    """
    try:
        new_complaint = process_and_cluster_complaint(
            db=db,
            raw_text=payload.raw_text,
            latitude=payload.latitude,
            longitude=payload.longitude,
            user_name=payload.user_name or "External Reporter",
            user_contact=payload.user_contact,
            media_url=payload.media_url,
            source=f"external_{payload.portal_name}",
            source_reference_id=payload.external_ticket_id
        )
        return new_complaint
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/incidents", response_model=List[schemas.IncidentOut])
def get_incidents(
    category: Optional[str] = None,
    status: Optional[str] = None,
    sort_by_priority: bool = True,
    db: Session = Depends(get_db)
):
    """
    Returns clustered incidents for the municipal officer dashboard.
    Populates the canonical complaint and list of supporting complaints.
    """
    query = db.query(models.Incident)
    
    if category and category != "all":
        query = query.filter(models.Incident.category == category)
    if status and status != "all":
        query = query.filter(models.Incident.status == status)

    if sort_by_priority:
        query = query.order_by(models.Incident.priority_score.desc())
    else:
        query = query.order_by(models.Incident.created_at.desc())

    incidents = query.all()

    result = []
    for inc in incidents:
        # Load all complaints for this incident
        all_complaints = db.query(models.Complaint).filter(models.Complaint.incident_id == inc.id).all()
        canonical = next((c for c in all_complaints if c.id == inc.canonical_complaint_id), None)
        supporting = [c for c in all_complaints if c.id != inc.canonical_complaint_id]

        inc_out = schemas.IncidentOut(
            id=inc.id,
            title=inc.title,
            category=inc.category,
            sub_category=inc.sub_category,
            latitude=inc.latitude,
            longitude=inc.longitude,
            status=inc.status,
            assigned_department=inc.assigned_department,
            priority_score=inc.priority_score,
            complaint_count=inc.complaint_count,
            canonical_complaint_id=inc.canonical_complaint_id,
            canonical_complaint=canonical,
            supporting_complaints=supporting,
            created_at=inc.created_at,
            updated_at=inc.updated_at
        )
        result.append(inc_out)

    return result

@app.get("/api/v1/incidents/{incident_id}", response_model=schemas.IncidentOut)
def get_incident_detail(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    all_complaints = db.query(models.Complaint).filter(models.Complaint.incident_id == inc.id).all()
    canonical = next((c for c in all_complaints if c.id == inc.canonical_complaint_id), None)
    supporting = [c for c in all_complaints if c.id != inc.canonical_complaint_id]

    return schemas.IncidentOut(
        id=inc.id,
        title=inc.title,
        category=inc.category,
        sub_category=inc.sub_category,
        latitude=inc.latitude,
        longitude=inc.longitude,
        status=inc.status,
        assigned_department=inc.assigned_department,
        priority_score=inc.priority_score,
        complaint_count=inc.complaint_count,
        canonical_complaint_id=inc.canonical_complaint_id,
        canonical_complaint=canonical,
        supporting_complaints=supporting,
        created_at=inc.created_at,
        updated_at=inc.updated_at
    )

@app.patch("/api/v1/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, update: schemas.IncidentStatusUpdate, db: Session = Depends(get_db)):
    inc = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = update.status
    if update.assigned_department:
        inc.assigned_department = update.assigned_department
    db.commit()
    return {"message": "Incident updated successfully", "status": inc.status, "assigned_department": inc.assigned_department}

@app.get("/api/v1/stats", response_model=schemas.StatsOut)
def get_analytics(db: Session = Depends(get_db)):
    """
    Analytics endpoint showing total raw complaints vs clustered master incidents,
    workload reduction percentage, and category breakdown.
    """
    total_complaints = db.query(models.Complaint).count()
    total_incidents = db.query(models.Incident).count()
    open_incidents = db.query(models.Incident).filter(models.Incident.status != "RESOLVED").count()
    resolved_incidents = db.query(models.Incident).filter(models.Incident.status == "RESOLVED").count()

    reduction_pct = 0.0
    if total_complaints > 0:
        reduction_pct = round(((total_complaints - total_incidents) / total_complaints) * 100.0, 1)

    # Categories breakdown
    categories = []
    cat_names = ["road_infrastructure", "water_supply", "electricity", "waste_management", "sewage", "other"]
    for cat in cat_names:
        c_count = db.query(models.Complaint).filter(models.Complaint.category == cat).count()
        i_count = db.query(models.Incident).filter(models.Incident.category == cat).count()
        if c_count > 0 or i_count > 0:
            categories.append(schemas.CategoryStat(
                category=cat,
                complaint_count=c_count,
                incident_count=i_count
            ))

    return schemas.StatsOut(
        total_complaints=total_complaints,
        total_incidents=total_incidents,
        clustering_reduction_percent=reduction_pct,
        open_incidents=open_incidents,
        resolved_incidents=resolved_incidents,
        categories=categories
    )

@app.post("/api/v1/seed-sample-data")
def seed_sample_data(db: Session = Depends(get_db)):
    """
    Seeds realistic sample complaints across multiple categories and locations,
    demonstrating multi-source ingestion, 500m clustering, and leader promotion.
    """
    # Clear existing data
    db.query(models.Complaint).delete()
    db.query(models.Incident).delete()
    db.commit()

    sample_complaints = [
        # Cluster 1: Road Cave-in near Metro Station (3 complaints within 80m)
        {
            "raw_text": "bad road near metro station please fix",
            "lat": 28.6139, "lng": 77.2090,
            "user": "Rohan Sharma",
            "source": "web_portal"
        },
        {
            "raw_text": "huge crater pothole opposite Metro Pillar 412 causing severe bike skids since 4 days. Very dangerous at night!",
            "lat": 28.6142, "lng": 77.2093,
            "user": "Ananya Roy",
            "source": "external_twitter"
        },
        {
            "raw_text": "broken road outside metro gate 2, traffic slowing down",
            "lat": 28.6140, "lng": 77.2091,
            "user": "Vikram Patel",
            "source": "external_cpgrams"
        },

        # Cluster 2: Water Pipe burst near City Hospital (2 complaints within 45m)
        {
            "raw_text": "water leaking on hospital road since morning",
            "lat": 28.6250, "lng": 77.2180,
            "user": "Sunil Verma",
            "source": "web_portal"
        },
        {
            "raw_text": "Main potable drinking water pipeline fractured outside City Hospital emergency wing. Massive flooding blocking ambulances for 8 hours!",
            "lat": 28.6252, "lng": 77.2183,
            "user": "Dr. Neha Gupta",
            "source": "web_portal"
        },

        # Single Issue 3: Garbage dump near Market (Distinct location)
        {
            "raw_text": "Overflowing garbage bin behind Main Market complex. Foul rotting smell and stray cattle blocking road for 1 week.",
            "lat": 28.6380, "lng": 77.2250,
            "user": "Suresh Raina",
            "source": "external_mcd"
        },

        # Single Issue 4: Sparking Electric Transformer
        {
            "raw_text": "Electric transformer sparking with loud noise near St. Mary School main gate. Urgent fire safety hazard!",
            "lat": 28.6010, "lng": 77.1950,
            "user": "Pooja Malhotra",
            "source": "web_portal"
        }
    ]

    for item in sample_complaints:
        process_and_cluster_complaint(
            db=db,
            raw_text=item["raw_text"],
            latitude=item["lat"],
            longitude=item["lng"],
            user_name=item["user"],
            source=item["source"]
        )

    return {"message": "Successfully seeded sample complaints and generated clusters"}
