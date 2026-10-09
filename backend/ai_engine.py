import os
import json
import re
from typing import Optional
from dotenv import load_dotenv
from schemas import ExtractionResult, SimilarityJudgeResult

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Initialize client if key is available
genai_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Google GenAI Client: {e}")

CATEGORIES = [
    "road_infrastructure",
    "water_supply",
    "electricity",
    "waste_management",
    "sewage",
    "other"
]

DEPARTMENT_MAP = {
    "road_infrastructure": "Public Works Department (PWD)",
    "water_supply": "Municipal Water Supply & Jal Board",
    "electricity": "Electricity & Power Distribution Authority",
    "waste_management": "Sanitation & Solid Waste Management",
    "sewage": "Drainage & Sewerage Board",
    "other": "General Municipal Services"
}

def extract_complaint_info(raw_text: str) -> ExtractionResult:
    """
    Extracts structured skeleton information and information richness score
    from unstructured civic complaints.
    """
    if genai_client:
        try:
            return _extract_with_gemini(raw_text)
        except Exception as e:
            print(f"Gemini API error in extract_complaint_info: {e}. Falling back to internal engine.")

    return _extract_heuristic(raw_text)

def judge_similarity(summary_a: str, summary_b: str, category: str, distance_meters: float) -> SimilarityJudgeResult:
    """
    Determines if two complaints within 500m of the same category describe
    the exact same physical issue.
    """
    if genai_client:
        try:
            return _judge_with_gemini(summary_a, summary_b, category, distance_meters)
        except Exception as e:
            print(f"Gemini API error in judge_similarity: {e}. Falling back to internal engine.")

    return _judge_heuristic(summary_a, summary_b, distance_meters)

# --- Gemini 1.5 Flash Implementations ---

def _extract_with_gemini(raw_text: str) -> ExtractionResult:
    prompt = f"""
    You are an AI for a Municipal Corporation. Analyze the following civic complaint text and extract structured information.
    Categories allowed: {CATEGORIES}
    
    Calculate an 'information_richness_score' between 0 and 100 based on:
    - Landmark/location precision mentioned (up to 30 pts)
    - Specific consequence / severity / hazard details (up to 25 pts)
    - Temporal details, e.g. how long it has existed (up to 20 pts)
    - Clarity and completeness of the description (up to 25 pts)

    Raw Complaint: "{raw_text}"

    Respond with ONLY a JSON object matching this schema:
    {{
        "category": "<one of {CATEGORIES}>",
        "sub_category": "<pothole, broken_pipe, streetlight, garbage_dump, etc.>",
        "summary": "<one sentence clear summary of the physical problem>",
        "richness_score": <integer 0-100>,
        "severity_level": "<LOW, MEDIUM, HIGH, CRITICAL>",
        "duration_mentioned": "<e.g. 3 days, since yesterday, or null>",
        "landmark": "<specific landmark or null>",
        "reasoning": "<why this richness score was given>"
    }}
    """
    response = genai_client.models.generate_content(
        model="gemini-1.5-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    data = json.loads(response.text)
    return ExtractionResult(**data)

def _judge_with_gemini(summary_a: str, summary_b: str, category: str, distance_meters: float) -> SimilarityJudgeResult:
    prompt = f"""
    Two civic complaints in category '{category}' were reported {distance_meters:.1f} meters apart:
    Complaint A: "{summary_a}"
    Complaint B: "{summary_b}"

    Do these two complaints refer to the EXACT SAME physical defect/incident (e.g. the same pothole, same pipe leak, same garbage pile)?
    
    Respond with ONLY a JSON object:
    {{
        "is_same_incident": true/false,
        "confidence": <float between 0.0 and 1.0>,
        "reasoning": "<brief explanation>"
    }}
    """
    response = genai_client.models.generate_content(
        model="gemini-1.5-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    data = json.loads(response.text)
    return SimilarityJudgeResult(**data)

# --- Fallback Heuristic Implementation ---

def _extract_heuristic(raw_text: str) -> ExtractionResult:
    text_lower = raw_text.lower()
    
    # 1. Category Detection
    category = "other"
    sub_category = "general_civic_issue"
    
    if any(k in text_lower for k in ["water", "pipe", "leak", "jal", "tap", "pipeline", "overflow", "drinking water"]):
        category = "water_supply"
        sub_category = "pipeline_leakage" if "leak" in text_lower or "pipe" in text_lower else "no_water_supply"
    elif any(k in text_lower for k in ["road", "pothole", "gaddha", "sadak", "tarmac", "asphalt", "crater", "divider", "sidewalk", "footpath"]):
        category = "road_infrastructure"
        sub_category = "pothole" if "pothole" in text_lower or "gaddha" in text_lower else "damaged_road"
    elif any(k in text_lower for k in ["light", "electricity", "pole", "wire", "spark", "dark", "streetlight", "power", "transformer"]):
        category = "electricity"
        sub_category = "broken_streetlight" if "light" in text_lower else "power_hazard"
    elif any(k in text_lower for k in ["garbage", "trash", "waste", "dustbin", "kachra", "dump", "litter", "smell", "rotting"]):
        category = "waste_management"
        sub_category = "garbage_accumulation"
    elif any(k in text_lower for k in ["sewage", "gutter", "drain", "manhole", "nala", "drainage"]):
        category = "sewage"
        sub_category = "open_manhole" if "manhole" in text_lower else "sewer_overflow"

    # 2. Richness Scoring
    score = 30  # Baseline
    reasoning_parts = ["Baseline complaint (30 pts)"]
    
    # Landmark precision
    landmark = None
    landmark_match = re.search(r"(?:near|opposite|opp|behind|at|outside|front of|beside)\s+([A-Za-z0-9\s,-]{4,35})", raw_text, re.IGNORECASE)
    if landmark_match:
        landmark = landmark_match.group(1).strip()
        score += 25
        reasoning_parts.append("Found specific landmark (+25 pts)")
        
    # Duration Mentioned
    duration = None
    duration_match = re.search(r"(\d+\s*(?:day|days|week|weeks|hour|hours|month|months|year|years|since\s+\w+))", text_lower)
    if duration_match:
        duration = duration_match.group(1).strip()
        score += 15
        reasoning_parts.append(f"Specified duration '{duration}' (+15 pts)")
        
    # Consequence / Impact
    if any(k in text_lower for k in ["accident", "fall", "injury", "danger", "flooding", "risk", "damage", "severe", "skid", "broken", "blocked", "hospital", "school"]):
        score += 20
        reasoning_parts.append("Describes safety/hazard consequence (+20 pts)")
        
    # Detail / Length
    if len(raw_text.split()) > 15:
        score += 10
        reasoning_parts.append("Detailed description (>15 words) (+10 pts)")

    score = min(score, 100)

    # 3. Severity Level
    if any(k in text_lower for k in ["accident", "sparking", "open manhole", "hazard", "fatal", "urgent", "critical", "live wire"]):
        severity = "CRITICAL"
    elif any(k in text_lower for k in ["flooding", "burst", "skid", "blocked", "severe", "major", "hospital"]):
        severity = "HIGH"
    elif any(k in text_lower for k in ["leak", "pothole", "dark", "garbage", "smell", "broken"]):
        severity = "MEDIUM"
    else:
        severity = "LOW"

    # Clean summary
    summary = raw_text.strip()
    if len(summary) > 90:
        summary = summary[:87] + "..."

    return ExtractionResult(
        category=category,
        sub_category=sub_category,
        summary=summary,
        richness_score=score,
        severity_level=severity,
        duration_mentioned=duration,
        landmark=landmark,
        reasoning="; ".join(reasoning_parts)
    )

def _judge_heuristic(summary_a: str, summary_b: str, distance_meters: float) -> SimilarityJudgeResult:
    # If very close (< 60 meters), high probability of same physical issue
    words_a = set(re.findall(r"\w+", summary_a.lower()))
    words_b = set(re.findall(r"\w+", summary_b.lower()))
    
    # Filter stopwords
    stopwords = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "to", "for", "of", "near"}
    words_a -= stopwords
    words_b -= stopwords
    
    overlap = len(words_a.intersection(words_b))
    
    if distance_meters <= 60:
        return SimilarityJudgeResult(
            is_same_incident=True,
            confidence=0.88,
            reasoning=f"Within {distance_meters:.1f}m proximity with matching category"
        )
    elif distance_meters <= 200 and overlap >= 2:
        return SimilarityJudgeResult(
            is_same_incident=True,
            confidence=0.75,
            reasoning=f"Within {distance_meters:.1f}m with overlapping descriptive keywords"
        )
    else:
        return SimilarityJudgeResult(
            is_same_incident=False,
            confidence=0.70,
            reasoning=f"Issues separated by {distance_meters:.1f}m without strong specific feature overlap"
        )
