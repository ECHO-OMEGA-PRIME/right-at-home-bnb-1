"""
Guest CRM API Routes
Track guest profiles, stays, preferences, and loyalty
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

router = APIRouter()

class GuestBase(BaseModel):
    name: str
    email: str
    phone: str
    platform: str  # airbnb, vrbo, direct

class Guest(GuestBase):
    id: int
    first_stay: date
    last_stay: Optional[date]
    total_stays: int
    avg_rating: float
    tags: List[str]
    notes: Optional[str]
    vip: bool = False

# Mock guest data
GUESTS = [
    {"id": 1, "name": "Sarah Mitchell", "email": "sarah@email.com", "phone": "555-0101", "platform": "airbnb", "first_stay": "2024-03-15", "last_stay": "2024-12-10", "total_stays": 4, "avg_rating": 4.9, "tags": ["VIP", "Wine Lover", "Repeat"], "notes": "Prefers late checkout", "vip": True},
    {"id": 2, "name": "John Davis", "email": "john@email.com", "phone": "555-0102", "platform": "vrbo", "first_stay": "2024-06-20", "last_stay": "2024-11-05", "total_stays": 2, "avg_rating": 4.7, "tags": ["Business", "Repeat"], "notes": "Oil industry exec", "vip": False},
    {"id": 3, "name": "Emily Chen", "email": "emily@email.com", "phone": "555-0103", "platform": "airbnb", "first_stay": "2024-08-01", "last_stay": None, "total_stays": 1, "avg_rating": 5.0, "tags": ["First Timer"], "notes": None, "vip": False},
]

@router.get("/")
async def list_guests(vip_only: bool = False, repeat_only: bool = False):
    """Get all guests with optional filters"""
    results = GUESTS
    if vip_only:
        results = [g for g in results if g["vip"]]
    if repeat_only:
        results = [g for g in results if g["total_stays"] >= 2]
    return results

@router.get("/stats")
async def guest_stats():
    """Get guest CRM statistics"""
    total = len(GUESTS)
    repeat = len([g for g in GUESTS if g["total_stays"] >= 2])
    vip = len([g for g in GUESTS if g["vip"]])
    avg_rating = sum(g["avg_rating"] for g in GUESTS) / total
    return {
        "total_guests": total,
        "repeat_guests": repeat,
        "vip_guests": vip,
        "repeat_rate": repeat / total,
        "avg_guest_rating": round(avg_rating, 2)
    }

@router.get("/{guest_id}")
async def get_guest(guest_id: int):
    """Get guest profile"""
    for guest in GUESTS:
        if guest["id"] == guest_id:
            return guest
    raise HTTPException(status_code=404, detail="Guest not found")

@router.get("/{guest_id}/stays")
async def get_guest_stays(guest_id: int):
    """Get all stays for a guest"""
    return {
        "guest_id": guest_id,
        "stays": [
            {"property": "Castleford Estate", "checkin": "2024-03-15", "checkout": "2024-03-20", "rating": 5.0},
            {"property": "Basin View Cottage", "checkin": "2024-07-10", "checkout": "2024-07-15", "rating": 4.8}
        ]
    }

@router.post("/{guest_id}/tag")
async def add_guest_tag(guest_id: int, tag: str):
    """Add tag to guest"""
    for guest in GUESTS:
        if guest["id"] == guest_id:
            if tag not in guest["tags"]:
                guest["tags"].append(tag)
            return guest
    raise HTTPException(status_code=404, detail="Guest not found")

@router.put("/{guest_id}/vip")
async def toggle_vip(guest_id: int, vip: bool):
    """Set VIP status"""
    for guest in GUESTS:
        if guest["id"] == guest_id:
            guest["vip"] = vip
            return guest
    raise HTTPException(status_code=404, detail="Guest not found")
