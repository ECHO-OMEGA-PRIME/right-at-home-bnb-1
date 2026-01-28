# Right At Home BnB - Enhanced Database Schema Proposal

## Overview
This proposal adds 4 major systems to the existing SQLAlchemy models:
1. **Digital Liability Waivers** - Guest safety compliance
2. **Pool Tech Integration** - Specialized worker portal
3. **Financial Engine (Gross-to-Net)** - Expense automation
4. **Data Hardening** - JWT auth, audit logs, Zero Trust

---

## 1. NEW ENUMS

```python
class WaiverType(str, enum.Enum):
    POOL = "pool"
    HOT_TUB = "hot_tub"
    OUTDOOR_GRILL = "outdoor_grill"
    FIRE_PIT = "fire_pit"
    PET = "pet"
    GENERAL = "general"

class WaiverStatus(str, enum.Enum):
    PENDING = "pending"
    SIGNED = "signed"
    EXPIRED = "expired"
    DECLINED = "declined"

class WorkerType(str, enum.Enum):
    CLEANER = "cleaner"
    POOL_TECH = "pool_tech"
    LAWN_SERVICE = "lawn_service"
    MAINTENANCE = "maintenance"
    HVAC = "hvac"

class TaskPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class PoolStatus(str, enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    NEEDS_ATTENTION = "needs_attention"
    UNSAFE = "unsafe"
```

---

## 2. DIGITAL LIABILITY WAIVERS

### GuestWaiver Table
```python
class GuestWaiver(Base):
    """Digital liability waiver for guest compliance."""
    __tablename__ = "guest_waivers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False, index=True)
    guest_id = Column(String, ForeignKey("guests.id"), nullable=False, index=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Waiver content (auto-generated from property amenities)
    waiver_type = Column(Enum(WaiverType), nullable=False)
    waiver_version = Column(String(10), nullable=False, default="1.0")
    waiver_content = Column(Text, nullable=False)  # Full legal text

    # Signature
    status = Column(Enum(WaiverStatus), default=WaiverStatus.PENDING, index=True)
    signed_at = Column(DateTime, nullable=True)
    signature_hash = Column(String(256), nullable=True)  # SHA-256 of signature data
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(String(500), nullable=True)

    # Consent tracking
    acknowledged_risks = Column(JSON, nullable=True)  # List of acknowledged risks
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)  # Typically end of booking
```

### PropertyWaiverTemplate Table
```python
class PropertyWaiverTemplate(Base):
    """Property-specific waiver templates based on amenities."""
    __tablename__ = "property_waiver_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False)
    waiver_type = Column(Enum(WaiverType), nullable=False)

    # Template content
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)  # Legal text with placeholders
    risks = Column(JSON, nullable=False)  # List of specific risks

    # Auto-inject rules
    trigger_amenities = Column(JSON, nullable=True)  # e.g., ["Pool", "Hot Tub"]
    is_required = Column(Boolean, default=True)

    # Version control
    version = Column(String(10), default="1.0")
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

---

## 3. POOL TECH WORKER PORTAL

### PoolTechnician Table (extends Worker)
```python
class Worker(Base):
    """Base worker table for all service providers."""
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)

    # Basic info
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, unique=True)
    phone = Column(String(20), nullable=True)

    # Worker type
    worker_type = Column(Enum(WorkerType), nullable=False, index=True)

    # Rates
    hourly_rate = Column(Numeric(10, 2), nullable=True)
    per_job_rate = Column(Numeric(10, 2), nullable=True)  # Flat rate per job

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Certifications (for pool techs)
    certifications = Column(JSON, nullable=True)  # ["CPO", "NSPF", etc.]
    certification_expiry = Column(Date, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

### PoolServiceJob Table
```python
class PoolServiceJob(Base):
    """Pool service job with chemical readings and photos."""
    __tablename__ = "pool_service_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False, index=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Priority (auto-elevated by weather)
    priority = Column(Enum(TaskPriority), default=TaskPriority.NORMAL, index=True)
    weather_elevated = Column(Boolean, default=False)  # True if elevated due to dust storm

    # Chemical readings (REQUIRED)
    ph_level = Column(Float, nullable=True)  # Target: 7.2-7.6
    chlorine_level = Column(Float, nullable=True)  # Target: 1-3 ppm
    alkalinity_level = Column(Float, nullable=True)  # Target: 80-120 ppm
    calcium_hardness = Column(Float, nullable=True)  # Target: 200-400 ppm
    cyanuric_acid = Column(Float, nullable=True)  # Target: 30-50 ppm

    # Pool status
    pool_status = Column(Enum(PoolStatus), nullable=True)
    water_temp = Column(Float, nullable=True)  # Fahrenheit

    # Equipment checks
    skimmer_status = Column(String(50), nullable=True)  # "clean", "clogged", "damaged"
    pump_status = Column(String(50), nullable=True)
    filter_status = Column(String(50), nullable=True)
    heater_status = Column(String(50), nullable=True)

    # Photos (REQUIRED: blue_water_photo)
    blue_water_photo = Column(String(500), nullable=True)  # MANDATORY
    before_photos = Column(JSON, nullable=True)
    after_photos = Column(JSON, nullable=True)

    # Service performed
    chemicals_added = Column(JSON, nullable=True)  # {"chlorine": "2lbs", "acid": "1qt"}
    tasks_completed = Column(JSON, nullable=True)  # ["brushed walls", "vacuumed", etc.]
    issues_found = Column(Text, nullable=True)

    # Billing
    service_fee = Column(Numeric(10, 2), nullable=False)  # e.g., $50
    chemicals_cost = Column(Numeric(10, 2), default=0)
    total_cost = Column(Numeric(10, 2), nullable=False)
    is_billed = Column(Boolean, default=False)

    # Notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

### WeatherAlert Table (for auto-priority)
```python
class WeatherAlert(Base):
    """Track West Texas weather for pool service priority."""
    __tablename__ = "weather_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Weather data
    recorded_at = Column(DateTime, nullable=False, index=True)
    wind_speed_mph = Column(Float, nullable=False)
    is_dust_storm = Column(Boolean, default=False)  # wind > 30 mph
    temperature = Column(Float, nullable=True)
    conditions = Column(String(100), nullable=True)

    # Source
    source = Column(String(50), default="openweathermap")
    raw_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
```

---

## 4. FINANCIAL ENGINE (GROSS-TO-NET)

### WorkerJobExpense Table (auto-logged)
```python
class WorkerJobExpense(Base):
    """Auto-logged expense when worker completes a job."""
    __tablename__ = "worker_job_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False, index=True)

    # Job reference
    job_type = Column(Enum(WorkerType), nullable=False)
    job_id = Column(Integer, nullable=True)  # Reference to cleaning_jobs or pool_service_jobs

    # Expense details
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String(500), nullable=False)
    expense_date = Column(Date, nullable=False)

    # Auto vs manual
    is_auto_logged = Column(Boolean, default=True)

    # Tax
    is_tax_deductible = Column(Boolean, default=True)
    tax_category = Column(String(100), default="Contractor Services")

    created_at = Column(DateTime, server_default=func.now())
```

### MonthlyPropertyFinancials Table
```python
class MonthlyPropertyFinancials(Base):
    """Pre-calculated monthly financials per property."""
    __tablename__ = "monthly_property_financials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)

    # GROSS INCOME
    booking_revenue = Column(Numeric(12, 2), default=0)  # From VRBO/Airbnb/Direct
    cleaning_fees_collected = Column(Numeric(10, 2), default=0)
    other_income = Column(Numeric(10, 2), default=0)
    total_gross = Column(Numeric(12, 2), default=0)

    # EXPENSES (Auto-deducted)
    cleaner_costs = Column(Numeric(10, 2), default=0)  # From WorkerJobExpense
    pool_service_costs = Column(Numeric(10, 2), default=0)
    lawn_service_costs = Column(Numeric(10, 2), default=0)
    maintenance_costs = Column(Numeric(10, 2), default=0)
    utility_costs = Column(Numeric(10, 2), default=0)  # From PropertyUtility
    supply_costs = Column(Numeric(10, 2), default=0)  # From PropertyExpense
    other_expenses = Column(Numeric(10, 2), default=0)
    total_expenses = Column(Numeric(12, 2), default=0)

    # NET PROFIT
    net_profit = Column(Numeric(12, 2), default=0)
    profit_margin = Column(Float, default=0)  # Percentage

    # Occupancy
    nights_booked = Column(Integer, default=0)
    nights_available = Column(Integer, default=30)  # Days in month
    occupancy_rate = Column(Float, default=0)

    # Calculations
    calculated_at = Column(DateTime, nullable=True)
    is_finalized = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('property_id', 'year', 'month', name='unique_property_month'),
    )
```

### PropertyServiceFees Table (preset fees)
```python
class PropertyServiceFees(Base):
    """Pre-set service fees per property for auto-expense logging."""
    __tablename__ = "property_service_fees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, unique=True)

    # Per-service fees
    cleaning_fee = Column(Numeric(10, 2), default=150)  # Per turnover
    deep_clean_fee = Column(Numeric(10, 2), default=300)
    pool_service_fee = Column(Numeric(10, 2), default=50)  # Per visit
    lawn_service_fee = Column(Numeric(10, 2), default=75)

    # Monthly estimates
    estimated_utilities = Column(Numeric(10, 2), default=200)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

---

## 5. DATA HARDENING & SECURITY

### UserSession Table (JWT tracking)
```python
class UserSession(Base):
    """Track JWT sessions for security."""
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # Session info
    session_token = Column(String(256), nullable=False, unique=True)
    refresh_token = Column(String(256), nullable=True)

    # Device info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    device_fingerprint = Column(String(256), nullable=True)

    # Cloudflare Zero Trust
    cf_access_token = Column(String(500), nullable=True)
    cf_identity = Column(JSON, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String(200), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, nullable=True)
```

### AuditLog Table
```python
class AuditLog(Base):
    """Track all sensitive operations."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=True, index=True)

    # Action
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False)  # "booking", "waiver", etc.
    resource_id = Column(String, nullable=True)

    # Details
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)

    # Request info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    cf_ray = Column(String(100), nullable=True)  # Cloudflare Ray ID

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
```

---

## 6. PROPERTY.JSON SCHEMA UPDATE

Add these fields to the existing property.json files:

```json
{
  "id": "Golf Course-3209",
  "vrboId": "3005111",
  "// ... existing fields ...",

  "serviceFees": {
    "cleaningFee": 150,
    "deepCleanFee": 300,
    "poolServiceFee": 50,
    "lawnServiceFee": 75
  },
  "waiverRequirements": {
    "pool": true,
    "hotTub": false,
    "firePit": true,
    "general": true
  },
  "hasPool": true,
  "hasHotTub": false,
  "hasFirePit": true
}
```

---

## MIGRATION STEPS

1. **Create new tables** - Run SQLAlchemy migrations
2. **Seed PropertyServiceFees** - Set $50 pool, $150 cleaning defaults
3. **Create waiver templates** - Pool, Hot Tub, Fire Pit, General
4. **Update property.json files** - Add serviceFees and waiverRequirements
5. **Deploy JWT middleware** - Wrap internal routes
6. **Configure Cloudflare Tunnel** - Add Zero Trust headers

---

## API ROUTES TO CREATE

| Route | Purpose | Auth |
|-------|---------|------|
| `GET /legal/waiver/:bookingId` | Generate waiver for booking | Guest |
| `POST /legal/waiver/:bookingId/sign` | Sign waiver | Guest |
| `GET /worker/pool-tech/jobs` | List pool tech jobs | Worker |
| `POST /worker/pool-tech/jobs/:id/complete` | Submit job with readings | Worker |
| `GET /admin/finance/net-profit` | Net profit report | Admin |
| `GET /admin/finance/property/:id/monthly` | Monthly financials | Admin |

---

*Generated by ECHO OMEGA PRIME | Authority 11.0*
