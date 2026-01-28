"""
Digital Liability Waiver Models - Right at Home BnB
SQLAlchemy models for guest waivers and property templates.

Part of the ECHO OMEGA PRIME system build.
"""

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    Text, ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .connection import Base


# ============================================
# ENUMS
# ============================================

class WaiverType(str, enum.Enum):
    """Types of liability waivers based on property amenities."""
    POOL = "pool"
    HOT_TUB = "hot_tub"
    OUTDOOR_GRILL = "outdoor_grill"
    FIRE_PIT = "fire_pit"
    PET = "pet"
    GENERAL = "general"


class WaiverStatus(str, enum.Enum):
    """Status of a guest waiver."""
    PENDING = "pending"
    SIGNED = "signed"
    EXPIRED = "expired"
    DECLINED = "declined"


# ============================================
# MODELS
# ============================================

class GuestWaiver(Base):
    """
    Digital liability waiver for guest compliance.
    Auto-generated based on property amenities (pool, hot tub, fire pit, etc.)
    """
    __tablename__ = "guest_waivers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False, index=True)
    guest_id = Column(String, ForeignKey("guests.id"), nullable=False, index=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=False, index=True)

    # Waiver content (auto-generated from property amenities)
    waiver_type = Column(Enum(WaiverType), nullable=False, index=True)
    waiver_version = Column(String(10), nullable=False, default="1.0")
    waiver_content = Column(Text, nullable=False)  # Full legal text

    # Signature
    status = Column(Enum(WaiverStatus), default=WaiverStatus.PENDING, index=True)
    signed_at = Column(DateTime, nullable=True)
    signature_hash = Column(String(256), nullable=True)  # SHA-256 of signature data
    signature_data = Column(Text, nullable=True)  # Base64 encoded signature image
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(String(500), nullable=True)

    # Consent tracking
    acknowledged_risks = Column(JSON, nullable=True)  # List of acknowledged risks
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relationship = Column(String(100), nullable=True)

    # Additional fields
    guest_initials = Column(String(10), nullable=True)
    minor_guests_acknowledged = Column(Boolean, default=False)
    number_of_minors = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)  # Typically end of booking
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    booking = relationship("Booking", backref="waivers")
    guest = relationship("Guest", backref="waivers")
    property = relationship("Property", backref="waivers")


class PropertyWaiverTemplate(Base):
    """
    Property-specific waiver templates based on amenities.
    Templates are auto-selected based on property features.
    """
    __tablename__ = "property_waiver_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    property_id = Column(String, ForeignKey("properties.id"), nullable=True)  # NULL = global template
    waiver_type = Column(Enum(WaiverType), nullable=False, index=True)

    # Template content
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)  # Legal text with placeholders
    risks = Column(JSON, nullable=False)  # List of specific risks to acknowledge

    # Auto-inject rules
    trigger_amenities = Column(JSON, nullable=True)  # e.g., ["Pool", "Hot Tub"]
    is_required = Column(Boolean, default=True)

    # Version control
    version = Column(String(10), default="1.0")
    is_active = Column(Boolean, default=True, index=True)
    is_global = Column(Boolean, default=False)  # True for system-wide templates

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    property = relationship("Property", backref="waiver_templates")


# ============================================
# DEFAULT WAIVER TEMPLATES
# ============================================

DEFAULT_WAIVER_TEMPLATES = [
    {
        "waiver_type": WaiverType.POOL,
        "title": "Swimming Pool Liability Waiver & Safety Agreement",
        "trigger_amenities": ["Pool", "Swimming Pool", "pool"],
        "risks": [
            "Risk of drowning or near-drowning incidents",
            "Risk of slip and fall injuries on wet surfaces",
            "Risk of diving injuries including paralysis",
            "Risk of chemical exposure (chlorine)",
            "Risk of injury from pool equipment",
            "Risk of waterborne illness",
            "Risk of injuries to children without supervision"
        ],
        "content": """
SWIMMING POOL LIABILITY WAIVER AND SAFETY AGREEMENT

Property: {property_name}
Address: {property_address}
Guest: {guest_name}
Booking Period: {check_in} to {check_out}

PLEASE READ CAREFULLY BEFORE SIGNING

1. ASSUMPTION OF RISK

I, the undersigned guest, acknowledge that swimming and related aquatic activities involve inherent risks that cannot be eliminated regardless of the care taken to avoid injuries. I understand that these risks include, but are not limited to:

- Drowning or near-drowning incidents
- Slip and fall injuries on wet surfaces around the pool area
- Diving injuries, including but not limited to paralysis and death
- Chemical exposure from pool treatment chemicals
- Injury from pool equipment including pumps, filters, and drains
- Waterborne illness from contaminated water
- Injuries to children due to lack of supervision

2. SAFETY RULES

I agree to follow these mandatory safety rules:
- NO diving in shallow areas
- NO running on pool deck
- NO glass containers in pool area
- Children under 14 MUST be supervised by an adult at all times
- NO swimming alone
- NO swimming while intoxicated
- Pool hours: Dawn to Dusk only
- Emergency equipment location noted and understood

3. MINOR CHILDREN

If minors are present during my stay, I accept full responsibility for their safety and supervision in and around the pool area at all times.

4. RELEASE AND WAIVER

In consideration of being permitted to use the swimming pool and related facilities, I hereby RELEASE, WAIVE, DISCHARGE, AND COVENANT NOT TO SUE Right at Home BnB, Steven Palma, property owners, managers, employees, and agents from any and all liability, claims, demands, actions, and causes of action whatsoever arising out of or related to any loss, damage, or injury that may be sustained by me or my guests, while using the swimming pool or pool area.

5. INDEMNIFICATION

I agree to INDEMNIFY AND HOLD HARMLESS Right at Home BnB and all related parties from any loss, liability, damage, or cost that may incur due to my use of the pool facilities.

6. MEDICAL AUTHORIZATION

In the event of a medical emergency, I authorize Right at Home BnB staff to seek emergency medical treatment on my behalf if I am unable to do so.

7. ACKNOWLEDGMENT

I have read this waiver, fully understand its terms, and sign it freely and voluntarily. No oral representations, statements, or inducements have been made apart from the foregoing written agreement.

I am at least 18 years of age and legally competent to sign this agreement.
"""
    },
    {
        "waiver_type": WaiverType.HOT_TUB,
        "title": "Hot Tub/Spa Liability Waiver & Safety Agreement",
        "trigger_amenities": ["Hot Tub", "Spa", "Jacuzzi", "hot_tub"],
        "risks": [
            "Risk of drowning or loss of consciousness",
            "Risk of heat-related illness (hyperthermia)",
            "Risk of slip and fall injuries",
            "Risk of skin irritation from chemicals",
            "Risk of bacterial infections",
            "Risk of cardiovascular stress",
            "Risk to pregnant women and those with medical conditions"
        ],
        "content": """
HOT TUB/SPA LIABILITY WAIVER AND SAFETY AGREEMENT

Property: {property_name}
Address: {property_address}
Guest: {guest_name}
Booking Period: {check_in} to {check_out}

1. HEALTH WARNINGS

I acknowledge that hot tub use poses additional health risks including:
- Hyperthermia (overheating) - DO NOT stay in water above 104F for extended periods
- Cardiovascular stress - those with heart conditions should consult a physician
- Pregnancy risks - pregnant women should consult a physician before use
- Risk of fainting or loss of consciousness
- Risk of infection from improperly maintained water

2. SAFETY RULES

- Maximum water temperature: 104F (40C)
- Maximum soak time: 15 minutes
- NO alcohol consumption while using hot tub
- NO glass containers near hot tub
- Keep head above water at all times
- Exit immediately if feeling dizzy or unwell
- NO children under age 5 in hot tub
- Children under 14 must be supervised by adult
- NO hot tub use if you have open wounds
- Shower before entering

3. MEDICAL CONDITIONS

I certify that I do not have any of the following conditions, OR I have consulted my physician:
- Heart disease or cardiovascular conditions
- High or low blood pressure
- Diabetes
- Pregnancy
- Epilepsy or seizure disorders
- Infectious diseases

4. RELEASE OF LIABILITY

I hereby release Right at Home BnB, Steven Palma, and all associated parties from any liability for injuries, illness, or damages arising from my use of the hot tub facilities.

5. ACKNOWLEDGMENT

I have read and understand the risks associated with hot tub use and voluntarily assume all risks.
"""
    },
    {
        "waiver_type": WaiverType.FIRE_PIT,
        "title": "Fire Pit/Outdoor Fire Liability Waiver & Safety Agreement",
        "trigger_amenities": ["Fire Pit", "Firepit", "Outdoor Fireplace", "fire_pit"],
        "risks": [
            "Risk of burns from open flame",
            "Risk of smoke inhalation",
            "Risk of fire spreading",
            "Risk of clothing/hair catching fire",
            "Risk of injury from hot embers",
            "Risk to children near open flame"
        ],
        "content": """
FIRE PIT/OUTDOOR FIRE LIABILITY WAIVER AND SAFETY AGREEMENT

Property: {property_name}
Address: {property_address}
Guest: {guest_name}
Booking Period: {check_in} to {check_out}

1. FIRE SAFETY RULES

- NEVER leave fire unattended
- Keep children at least 10 feet from fire pit at all times
- Keep flammable materials away from fire
- Have water source or fire extinguisher nearby
- Fully extinguish fire before leaving or sleeping
- Do not use accelerants (gasoline, lighter fluid, etc.)
- Check wind conditions before lighting
- Keep chairs and seating at safe distance
- Avoid loose clothing near fire
- Do not burn trash, plastics, or treated wood

2. PROHIBITED ACTIVITIES

- No fire pit use during burn bans
- No use during high wind conditions (over 15 mph)
- No use while intoxicated
- No leaving children unattended near fire

3. ASSUMPTION OF RISK

I acknowledge that use of the fire pit involves risk of burns, smoke inhalation, and fire-related injuries. I voluntarily assume all such risks.

4. LIABILITY RELEASE

I release Right at Home BnB and all associated parties from liability for any injuries, damages, or property loss arising from my use of the fire pit.

5. DAMAGE RESPONSIBILITY

I agree to pay for any property damage caused by improper fire pit use or failure to follow safety guidelines.
"""
    },
    {
        "waiver_type": WaiverType.OUTDOOR_GRILL,
        "title": "Outdoor Grill/BBQ Liability Waiver & Safety Agreement",
        "trigger_amenities": ["Grill", "BBQ", "Outdoor Grill", "Barbecue", "outdoor_grill"],
        "risks": [
            "Risk of burns from hot surfaces and flames",
            "Risk of fire from grease flare-ups",
            "Risk of gas leaks (propane grills)",
            "Risk of carbon monoxide exposure",
            "Risk of food contamination"
        ],
        "content": """
OUTDOOR GRILL/BBQ LIABILITY WAIVER AND SAFETY AGREEMENT

Property: {property_name}
Address: {property_address}
Guest: {guest_name}
Booking Period: {check_in} to {check_out}

1. SAFETY RULES

- Use grill outdoors only - NEVER indoors
- Keep grill away from structures and overhangs
- Check gas connections before use (propane grills)
- Never leave grill unattended while in use
- Keep children and pets away from hot grill
- Have fire extinguisher accessible
- Allow grill to cool completely before covering
- Clean grease traps regularly to prevent flare-ups

2. PROPANE GRILL SPECIFIC

- Check for gas leaks with soapy water before lighting
- Open lid before lighting
- If grill doesn't light within 5 seconds, turn off gas and wait 5 minutes
- Turn off gas at tank when not in use

3. CHARCOAL GRILL SPECIFIC

- Use only approved charcoal lighter fluid
- Never add lighter fluid to burning coals
- Dispose of ashes properly (cool, then metal container)

4. LIABILITY RELEASE

I release Right at Home BnB and all associated parties from liability for burns, injuries, or property damage arising from grill use.
"""
    },
    {
        "waiver_type": WaiverType.PET,
        "title": "Pet Policy Agreement & Liability Waiver",
        "trigger_amenities": ["Pet Friendly", "Pets Allowed", "Dog Friendly", "pet"],
        "risks": [
            "Risk of pet-related property damage",
            "Risk of noise complaints from pets",
            "Risk of allergic reactions for future guests",
            "Risk of pet injuries on property",
            "Responsibility for pet waste cleanup"
        ],
        "content": """
PET POLICY AGREEMENT AND LIABILITY WAIVER

Property: {property_name}
Address: {property_address}
Guest: {guest_name}
Booking Period: {check_in} to {check_out}

1. PET INFORMATION REQUIRED

I agree to provide accurate information about my pet(s):
- Species and breed
- Weight and age
- Vaccination records (rabies, distemper)
- Behavioral history

2. PET RULES

- Maximum 2 pets allowed
- Pets must be house-trained
- Pets must not be left unattended in property
- Pets must be leashed when outdoors
- Clean up all pet waste immediately
- Do not allow pets on furniture or beds
- Do not allow pets in pool or hot tub area
- Pets must not disturb neighbors (excessive barking)
- Pet owners must bring own pet supplies (food, bowls, bedding)

3. PROHIBITED PETS

- Aggressive breeds as determined by insurance
- Exotic animals
- Farm animals
- Pets with history of aggression

4. DAMAGE RESPONSIBILITY

I agree to:
- Pay for any property damage caused by my pet(s)
- Pay additional cleaning fee if excessive pet hair/odor
- Pay for any required pest treatment due to fleas/ticks

5. LIABILITY WAIVER

I accept full responsibility for my pet(s) and release Right at Home BnB from any liability for:
- Injuries to my pet on the property
- Injuries caused by my pet to others
- Any claims arising from my pet's actions
"""
    },
    {
        "waiver_type": WaiverType.GENERAL,
        "title": "General Property Liability Waiver & Guest Agreement",
        "trigger_amenities": [],  # Always included
        "risks": [
            "Risk of slip and fall injuries",
            "Risk of injuries from property features",
            "Risk of allergic reactions",
            "Risk of theft or property loss",
            "Understanding of house rules"
        ],
        "content": """
GENERAL PROPERTY LIABILITY WAIVER AND GUEST AGREEMENT

Property: {property_name}
Address: {property_address}
Guest: {guest_name}
Booking Period: {check_in} to {check_out}

1. PROPERTY USE AGREEMENT

I, the undersigned guest, agree to:
- Treat the property with care and respect
- Follow all house rules provided
- Not exceed the maximum guest count
- Not host parties or events without permission
- Respect quiet hours (10 PM - 8 AM)
- Keep the property secure (lock doors)
- Report any damage or maintenance issues promptly
- Leave the property in reasonable condition

2. ASSUMPTION OF RISK

I acknowledge that vacation rental properties may present risks including:
- Stairs and uneven surfaces
- Kitchen appliances and equipment
- Outdoor areas and landscaping
- Unfamiliar surroundings
- Weather-related hazards

3. PERSONAL PROPERTY

I understand that Right at Home BnB is not responsible for:
- Theft of personal belongings
- Damage to vehicles
- Loss of valuables

I am encouraged to secure valuables and use available safes.

4. MEDICAL EMERGENCIES

Emergency services: 911
Nearest hospital: {nearest_hospital}
Property address for emergency services: {property_address}

5. LIABILITY RELEASE

I hereby release Right at Home BnB, Steven Palma, property owners, and all associated parties from any liability for injuries, illness, death, or property damage occurring during my stay, except where caused by gross negligence.

6. INDEMNIFICATION

I agree to indemnify and hold harmless Right at Home BnB for any claims arising from my actions or the actions of my guests during the stay.

7. DAMAGE POLICY

I agree to pay for any damage to the property beyond normal wear and tear. A security deposit may be held and applied to damages.

8. AGREEMENT

By signing below, I confirm that:
- I am at least 18 years old
- I am the primary guest on the reservation
- I have read and understand all terms
- I agree to be bound by this agreement
- I have provided accurate contact information
"""
    }
]
