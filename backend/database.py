import os
import math
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "complaints.db").replace("\\", "/")
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in meters between two points
    on the earth (specified in decimal degrees) using Haversine formula.
    """
    if None in (lat1, lon1, lat2, lon2):
        return None
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def create_configured_engine(db_url: str):
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    eng = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True if not db_url.startswith("sqlite") else False
    )
    if db_url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def on_connect(dbapi_con, connection_record):
            dbapi_con.create_function("haversine", 4, haversine_distance)
    return eng

# Verify database connectivity, falling back to local SQLite if remote database is unreachable
try:
    engine = create_configured_engine(DATABASE_URL)
    with engine.connect() as test_conn:
        pass
    print(f"[Database] Successfully connected to {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
except Exception as e:
    print(f"[Database Warning] Failed to connect to {DATABASE_URL}: {e}")
    if not DATABASE_URL.startswith("sqlite"):
        print(f"[Database] Gracefully falling back to local SQLite database at {DEFAULT_SQLITE_URL}...")
        DATABASE_URL = DEFAULT_SQLITE_URL
        engine = create_configured_engine(DATABASE_URL)
        with engine.connect() as test_conn:
            pass
        print("[Database] Successfully connected to fallback local SQLite database.")
    else:
        raise

# Register haversine function with SQLite for native spatial querying if SQLite is used
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def on_connect(dbapi_con, connection_record):
        dbapi_con.create_function("haversine", 4, haversine_distance)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
