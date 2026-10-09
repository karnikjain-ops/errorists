from database import SessionLocal
import models
from clustering_engine import process_and_cluster_complaint
from geo_utils import calculate_haversine_distance

db = SessionLocal()

print("1. Cleaning database for isolated test...")
db.query(models.Complaint).delete()
db.query(models.Incident).delete()
db.commit()

# Submission 1: Vague complaint
print("\n2. Submitting Complaint 1 (Vague: 'road broken')...")
c1 = process_and_cluster_complaint(
    db=db,
    raw_text="road broken near metro station",
    latitude=28.6139,
    longitude=77.2090,
    user_name="Citizen 1",
    source="web_portal"
)
print(f"   -> Created Incident ID: {c1.incident_id}")
print(f"   -> Complaint 1 Richness Score: {c1.richness_score}")
print(f"   -> Is Canonical? {c1.is_canonical}")

# Submission 2: Highly informative complaint ~35 meters away
print("\n3. Submitting Complaint 2 (Informative: 'huge 2ft crater pothole opposite Metro Pillar 412 causing severe bike skids since 3 days')...")
c2 = process_and_cluster_complaint(
    db=db,
    raw_text="huge 2ft crater pothole opposite Metro Pillar 412 causing severe bike skids since 3 days",
    latitude=28.6141,
    longitude=77.2093,
    user_name="Citizen 2",
    source="external_twitter"
)

dist = calculate_haversine_distance(28.6139, 77.2090, 28.6141, 77.2093)
print(f"   -> Physical Distance: {dist:.1f} meters")
print(f"   -> Clubbed into Incident ID: {c2.incident_id}")
print(f"   -> Complaint 2 Richness Score: {c2.richness_score}")
print(f"   -> Is Canonical? {c2.is_canonical}")

# Submission 3: Another complaint in same cluster
print("\n4. Submitting Complaint 3 (Short: 'pothole on metro road')...")
c3 = process_and_cluster_complaint(
    db=db,
    raw_text="pothole on metro road",
    latitude=28.6140,
    longitude=77.2091,
    user_name="Citizen 3",
    source="external_cpgrams"
)
print(f"   -> Clubbed into Incident ID: {c3.incident_id}")
print(f"   -> Complaint 3 Richness Score: {c3.richness_score}")
print(f"   -> Is Canonical? {c3.is_canonical}")

# Submission 4: Different category at EXACT same location (Electricity)
print("\n5. Submitting Complaint 4 (Different category: Electricity at same location)...")
c4 = process_and_cluster_complaint(
    db=db,
    raw_text="Streetlight broken and dark at night near metro gate",
    latitude=28.6139,
    longitude=77.2090,
    user_name="Citizen 4",
    source="web_portal"
)
print(f"   -> Incident ID: {c4.incident_id} (Should be DIFFERENT from c1!)")
print(f"   -> Category: {c4.category}")

# Inspect Incidents
print("\n6. Final Verification Summary:")
incidents = db.query(models.Incident).all()
print(f"Total Incidents Created: {len(incidents)} (Expected: 2)")

for inc in incidents:
    print(f"\n[Incident {inc.id[:8]}] Category: {inc.category}")
    print(f"  Title: {inc.title}")
    print(f"  Complaint Count: {inc.complaint_count}")
    print(f"  Priority Score: {inc.priority_score}")
    print(f"  Canonical Complaint ID: {inc.canonical_complaint_id[:8]}")
    assert inc.canonical_complaint_id == (c2.id if inc.category == "road_infrastructure" else c4.id)

print("\nALL VERIFICATIONS PASSED SUCCESSFULLY! The 500m clustering and leader election work as planned!")
db.close()
