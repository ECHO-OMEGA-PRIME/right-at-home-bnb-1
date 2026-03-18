"""
Seed Database with Steven Palma's 22 Midland TX Properties
Right at Home BnB - Initial Data Setup
"""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
import random
import string

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal, engine, Base
from database.models import (
    User, Property, Guest, Booking, CleaningJob, SmartLock,
    UserRole, PropertyType, PropertyStatus, Platform, VipTier,
    BookingStatus, CleaningType, CleaningStatus, LockBrand
)


def generate_id():
    """Generate a CUID-like ID"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=25))


def seed_users(db):
    """Create admin (Steven) and sample cleaners"""
    print("Seeding users...")

    users = [
        User(
            id=generate_id(),
            email="steven@rah-midland.com",
            name="Steven Palma",
            phone="+14325551234",
            role=UserRole.ADMIN,
            is_active=True
        ),
        User(
            id=generate_id(),
            email="maria@rah-midland.com",
            name="Maria Rodriguez",
            phone="+14325552345",
            role=UserRole.CLEANER,
            is_active=True
        ),
        User(
            id=generate_id(),
            email="james@rah-midland.com",
            name="James Walker",
            phone="+14325553456",
            role=UserRole.CLEANER,
            is_active=True
        ),
        User(
            id=generate_id(),
            email="sarah@rah-midland.com",
            name="Sarah Chen",
            phone="+14325554567",
            role=UserRole.CLEANER,
            is_active=True
        ),
        User(
            id=generate_id(),
            email="carlos@rah-midland.com",
            name="Carlos Martinez",
            phone="+14325555678",
            role=UserRole.CLEANER,
            is_active=True
        )
    ]

    for user in users:
        db.add(user)

    db.commit()
    print(f"  Created {len(users)} users")
    return users


def seed_properties(db):
    """Create Steven's 22 Midland TX properties"""
    print("Seeding properties...")

    # Midland TX street names and neighborhoods
    streets = [
        "Wadley Ave", "Midkiff Rd", "Garfield St", "Louisiana Ave", "Andrews Hwy",
        "Big Spring St", "Illinois Ave", "Michigan Ave", "Cuthbert Ave", "Golf Course Rd",
        "Loop 250", "Mockingbird Ln", "Neely Ave", "Princeton Ave", "Storey Ave"
    ]

    property_names = [
        "Castleford Estate", "Petroleum Plaza Suite", "Basin View Cottage",
        "Wildcatter's Retreat", "Oil Patch Paradise", "Desert Rose Villa",
        "Permian Basin Bungalow", "Sunset Heights Home", "Midland Executive Suite",
        "Prairie Dog Den", "Texas Star Lodge", "Bluebonnet Cottage",
        "Longhorn Landing", "Midland Modern Loft", "Heritage Heights House",
        "The Derrick Dwelling", "West Texas Welcome", "Dusty Trails Home",
        "Oasis on Garfield", "Lone Star Luxury", "The Palma Place",
        "Pump Jack Palace"
    ]

    properties = []
    for i in range(22):
        street = random.choice(streets)
        address = f"{random.randint(100, 9999)} {street}"

        prop = Property(
            id=generate_id(),
            name=property_names[i],
            address=address,
            city="Midland",
            state="TX",
            zip_code=f"797{random.randint(01, 07):02d}",
            latitude=31.9973 + random.uniform(-0.05, 0.05),
            longitude=-102.0779 + random.uniform(-0.05, 0.05),
            bedrooms=random.choice([2, 3, 3, 4, 4, 5]),
            bathrooms=random.choice([1.5, 2, 2.5, 3, 3.5]),
            max_guests=random.choice([4, 6, 6, 8, 8, 10]),
            square_feet=random.randint(1200, 3500),
            property_type=random.choice([PropertyType.HOUSE, PropertyType.HOUSE, PropertyType.APARTMENT, PropertyType.CONDO]),
            amenities=["WiFi", "Kitchen", "Washer/Dryer", "Parking", "TV", "AC"],
            wifi_network=f"RightAtHome_{i+1}",
            wifi_password=f"Welcome{random.randint(1000, 9999)}!",
            parking_info="Free parking in driveway",
            check_in_instr="Use the keypad code sent to your phone. Enter through the front door.",
            check_out_instr="Please strip beds, start dishwasher, and lock up. Leave keys on counter.",
            house_rules="No smoking. No parties. Quiet hours 10pm-8am. Max 2 pets with approval.",
            cleaning_checklist=[
                "Make all beds with fresh linens",
                "Clean all bathrooms thoroughly",
                "Vacuum all floors and carpets",
                "Mop hard floors",
                "Wipe down kitchen surfaces",
                "Clean appliances inside and out",
                "Take out trash",
                "Restock supplies",
                "Check for damages",
                "Take photos of each room"
            ],
            nightly_rate=Decimal(str(random.randint(120, 280))),
            cleaning_fee=Decimal(str(random.randint(75, 150))),
            security_deposit=Decimal("200.00"),
            airbnb_id=f"airbnb_{random.randint(100000, 999999)}",
            vrbo_id=f"vrbo_{random.randint(100000, 999999)}",
            status=PropertyStatus.ACTIVE
        )
        properties.append(prop)
        db.add(prop)

    db.commit()
    print(f"  Created {len(properties)} properties")
    return properties


def seed_guests(db):
    """Create sample guests with realistic data"""
    print("Seeding guests...")

    first_names = ["John", "Emily", "Michael", "Sarah", "David", "Jessica", "Chris", "Amanda",
                   "Robert", "Jennifer", "William", "Ashley", "James", "Stephanie", "Daniel",
                   "Nicole", "Matthew", "Melissa", "Anthony", "Lauren"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
                  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas"]

    guests = []
    for i in range(50):
        first = random.choice(first_names)
        last = random.choice(last_names)
        total_stays = random.randint(1, 15)

        guest = Guest(
            id=generate_id(),
            email=f"{first.lower()}.{last.lower()}{random.randint(1, 99)}@email.com",
            name=f"{first} {last}",
            phone=f"+1{random.randint(200, 999)}{random.randint(100, 999)}{random.randint(1000, 9999)}",
            platform=random.choice([Platform.AIRBNB, Platform.AIRBNB, Platform.VRBO, Platform.DIRECT]),
            first_stay=datetime.now() - timedelta(days=random.randint(30, 730)),
            total_stays=total_stays,
            total_spent=Decimal(str(total_stays * random.randint(400, 1200))),
            avg_rating=round(random.uniform(4.2, 5.0), 2),
            tags=random.sample(["Business", "Family", "Pet Owner", "Repeat Guest", "Quiet", "Long Stay"], k=random.randint(1, 3)),
            is_vip=random.random() > 0.85,
            vip_tier=random.choice([VipTier.SILVER, VipTier.GOLD, VipTier.PLATINUM]) if random.random() > 0.7 else None
        )
        guests.append(guest)
        db.add(guest)

    db.commit()
    print(f"  Created {len(guests)} guests")
    return guests


def seed_bookings(db, properties, guests):
    """Create sample bookings"""
    print("Seeding bookings...")

    bookings = []
    for prop in properties:
        # Create 3-8 bookings per property
        num_bookings = random.randint(3, 8)
        for j in range(num_bookings):
            guest = random.choice(guests)
            check_in = datetime.now() + timedelta(days=random.randint(-60, 60))
            nights = random.randint(2, 7)
            check_out = check_in + timedelta(days=nights)
            nightly = float(prop.nightly_rate)

            booking = Booking(
                id=generate_id(),
                property_id=prop.id,
                guest_id=guest.id,
                check_in=check_in,
                check_out=check_out,
                guest_count=random.randint(1, prop.max_guests),
                platform=guest.platform,
                confirm_code=f"RAH{random.randint(10000, 99999)}",
                nightly_rate=prop.nightly_rate,
                total_nights=nights,
                subtotal=Decimal(str(nightly * nights)),
                cleaning_fee=prop.cleaning_fee,
                service_fee=Decimal(str(round(nightly * nights * 0.12, 2))),
                taxes=Decimal(str(round(nightly * nights * 0.08, 2))),
                total_price=Decimal(str(round(nightly * nights * 1.2 + float(prop.cleaning_fee or 0), 2))),
                access_code=f"{random.randint(100000, 999999)}",
                code_expires_at=check_out + timedelta(minutes=30),
                status=BookingStatus.CONFIRMED if check_in > datetime.now() else BookingStatus.CHECKED_OUT
            )
            bookings.append(booking)
            db.add(booking)

    db.commit()
    print(f"  Created {len(bookings)} bookings")
    return bookings


def seed_smart_locks(db, properties):
    """Create smart locks for properties"""
    print("Seeding smart locks...")

    locks = []
    for prop in properties:
        lock = SmartLock(
            id=generate_id(),
            property_id=prop.id,
            brand=random.choice([LockBrand.SCHLAGE, LockBrand.YALE, LockBrand.AUGUST]),
            model=random.choice(["Encode Plus", "Assure Lock 2", "Smart Lock Pro"]),
            device_id=f"LOCK-{random.randint(10000, 99999)}",
            serial_number=f"SN{random.randint(100000000, 999999999)}",
            current_code=f"{random.randint(100000, 999999)}",
            code_expires_at=datetime.now() + timedelta(days=random.randint(1, 14)),
            battery_level=random.randint(60, 100),
            last_activity=datetime.now() - timedelta(hours=random.randint(1, 48)),
            is_online=random.random() > 0.05,
            access_log=[]
        )
        locks.append(lock)
        db.add(lock)

    db.commit()
    print(f"  Created {len(locks)} smart locks")
    return locks


def seed_cleaning_jobs(db, properties, users, bookings):
    """Create cleaning jobs"""
    print("Seeding cleaning jobs...")

    cleaners = [u for u in users if u.role == UserRole.CLEANER]
    jobs = []

    for booking in bookings[:50]:  # Create jobs for first 50 bookings
        job = CleaningJob(
            id=generate_id(),
            property_id=booking.property_id,
            cleaner_id=random.choice(cleaners).id,
            booking_id=booking.id,
            scheduled_at=booking.check_out,
            job_type=CleaningType.TURNOVER,
            status=CleaningStatus.COMPLETED if booking.check_out < datetime.now() else CleaningStatus.SCHEDULED,
            score=random.randint(85, 100) if booking.check_out < datetime.now() else None,
            duration_mins=random.randint(90, 180) if booking.check_out < datetime.now() else None
        )
        jobs.append(job)
        db.add(job)

    db.commit()
    print(f"  Created {len(jobs)} cleaning jobs")
    return jobs


def run_seed():
    """Main seed function"""
    print("\n" + "="*60)
    print("RIGHT AT HOME BNB - DATABASE SEEDER")
    print("Steven Palma | Midland, TX | 22 Properties")
    print("="*60 + "\n")

    # Create tables
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("  Tables created!\n")

    # Open session
    db = SessionLocal()

    try:
        # Seed data
        users = seed_users(db)
        properties = seed_properties(db)
        guests = seed_guests(db)
        bookings = seed_bookings(db, properties, guests)
        locks = seed_smart_locks(db, properties)
        jobs = seed_cleaning_jobs(db, properties, users, bookings)

        print("\n" + "="*60)
        print("SEEDING COMPLETE!")
        print("="*60)
        print(f"""
Summary:
  - Users: {len(users)} (1 admin, {len(users)-1} cleaners)
  - Properties: {len(properties)}
  - Guests: {len(guests)}
  - Bookings: {len(bookings)}
  - Smart Locks: {len(locks)}
  - Cleaning Jobs: {len(jobs)}
        """)

    except Exception as e:
        print(f"\nError during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
