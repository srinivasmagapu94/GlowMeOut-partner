from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALGO = os.environ.get('JWT_ALGO', 'HS256')
DEMO_OTP = os.environ.get('DEMO_OTP', '123456')

app = FastAPI(title="GlowMeOut API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Models ----------
class OTPRequest(BaseModel):
    phone: str
    role: Literal['customer', 'artist'] = 'customer'


class OTPVerify(BaseModel):
    phone: str
    otp: str
    role: Literal['customer', 'artist'] = 'customer'


class User(BaseModel):
    id: str
    phone: str
    role: str
    name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    city: Optional[str] = None
    created_at: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    city: Optional[str] = None


class Artist(BaseModel):
    id: str
    user_id: str
    name: str
    tagline: str
    avatar: str
    cover: str
    city: str
    rating: float
    reviews_count: int
    bookings_count: int
    experience_years: int
    starting_price: int
    specialties: List[str]
    bio: str
    verified: bool = True
    kyc_status: str = "verified"
    portfolio: List[str] = []
    services: List[Dict[str, Any]] = []


class Booking(BaseModel):
    id: str
    customer_id: str
    artist_id: str
    service_id: str
    service_name: str
    date: str
    time: str
    address: str
    price: int
    status: str  # pending | confirmed | in_progress | completed | cancelled | rejected
    payment_status: str  # unpaid | paid | refunded
    created_at: str
    notes: Optional[str] = None


class BookingCreate(BaseModel):
    artist_id: str
    service_id: str
    date: str
    time: str
    address: str
    notes: Optional[str] = None


class ChatMessage(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    text: str
    created_at: str


class ReviewCreate(BaseModel):
    artist_id: str
    rating: int
    text: str


# ---------- Auth helpers ----------
def make_token(uid: str, role: str) -> str:
    payload = {"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Auth endpoints ----------
@api_router.post("/auth/otp/request")
async def otp_request(body: OTPRequest):
    # In production, integrate with Twilio here. For demo, always accept universal OTP.
    logger.info(f"OTP requested for {body.phone} (role={body.role}) — use {DEMO_OTP}")
    return {"ok": True, "message": f"OTP sent to {body.phone}", "demo_otp": DEMO_OTP}


@api_router.post("/auth/otp/verify")
async def otp_verify(body: OTPVerify):
    if body.otp != DEMO_OTP:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    user = await db.users.find_one({"phone": body.phone, "role": body.role}, {"_id": 0})
    is_new = False
    if not user:
        is_new = True
        user = {
            "id": new_id(),
            "phone": body.phone,
            "role": body.role,
            "name": None,
            "email": None,
            "avatar": None,
            "city": None,
            "created_at": utcnow_iso(),
        }
        await db.users.insert_one(user.copy())
    token = make_token(user["id"], user["role"])
    user.pop("_id", None)
    return {"token": token, "user": user, "is_new": is_new}


@api_router.get("/me")
async def me(user=Depends(current_user)):
    return user


@api_router.patch("/me")
async def update_me(body: UserUpdate, user=Depends(current_user)):
    patch = {k: v for k, v in body.dict().items() if v is not None}
    if patch:
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return updated


# ---------- Categories / Services catalog ----------
CATEGORIES = [
    {"id": "bridal", "name": "Bridal Makeup", "image": "https://images.unsplash.com/photo-1610173827043-9db50e0d8ef9?w=800&q=80", "starting": 15000},
    {"id": "party", "name": "Party Makeup", "image": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80", "starting": 3500},
    {"id": "engagement", "name": "Engagement", "image": "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80", "starting": 8000},
    {"id": "reception", "name": "Reception", "image": "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=800&q=80", "starting": 10000},
    {"id": "hair", "name": "Hair Styling", "image": "https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?w=800&q=80", "starting": 2000},
    {"id": "saree", "name": "Saree Draping", "image": "https://images.unsplash.com/photo-1610030469668-8e4a7b0f3b1b?w=800&q=80", "starting": 1500},
    {"id": "nail", "name": "Nail Art", "image": "https://images.pexels.com/photos/4965824/pexels-photo-4965824.jpeg?auto=compress&cs=tinysrgb&w=800", "starting": 1200},
    {"id": "mehendi", "name": "Mehendi", "image": "https://images.pexels.com/photos/14825258/pexels-photo-14825258.jpeg?auto=compress&cs=tinysrgb&w=800", "starting": 2500},
    {"id": "photoshoot", "name": "Photoshoot", "image": "https://images.unsplash.com/photo-1619002117199-47c7f0427d21?w=800&q=80", "starting": 5000},
]


@api_router.get("/categories")
async def get_categories():
    return CATEGORIES


# ---------- Artists ----------
@api_router.get("/artists")
async def list_artists(category: Optional[str] = None, city: Optional[str] = None, q: Optional[str] = None):
    query: Dict[str, Any] = {}
    if category:
        query["specialties"] = category
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"tagline": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    artists = await db.artists.find(query, {"_id": 0}).to_list(200)
    return artists


@api_router.get("/artists/featured")
async def featured_artists():
    artists = await db.artists.find({"verified": True}, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)
    return artists


@api_router.get("/artists/{artist_id}")
async def artist_detail(artist_id: str):
    artist = await db.artists.find_one({"id": artist_id}, {"_id": 0})
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    reviews = await db.reviews.find({"artist_id": artist_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"artist": artist, "reviews": reviews}


@api_router.get("/artists/{artist_id}/availability")
async def artist_availability(artist_id: str):
    slots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30"]
    return {"slots": slots}


# ---------- Bookings ----------
@api_router.post("/bookings")
async def create_booking(body: BookingCreate, user=Depends(current_user)):
    if user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Only customers can book")
    artist = await db.artists.find_one({"id": body.artist_id}, {"_id": 0})
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    service = next((s for s in artist.get("services", []) if s.get("id") == body.service_id), None)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    booking = {
        "id": new_id(),
        "customer_id": user["id"],
        "artist_id": body.artist_id,
        "service_id": body.service_id,
        "service_name": service["name"],
        "date": body.date,
        "time": body.time,
        "address": body.address,
        "price": service["price"],
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": utcnow_iso(),
        "notes": body.notes,
    }
    await db.bookings.insert_one(booking.copy())
    booking.pop("_id", None)
    return booking


@api_router.get("/bookings")
async def list_bookings(user=Depends(current_user)):
    key = "customer_id" if user["role"] == "customer" else "artist_user_id"
    if user["role"] == "artist":
        artist = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
        if not artist:
            return []
        bookings = await db.bookings.find({"artist_id": artist["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        bookings = await db.bookings.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # attach artist snapshot
    result = []
    for b in bookings:
        a = await db.artists.find_one({"id": b["artist_id"]}, {"_id": 0, "name": 1, "avatar": 1, "city": 1, "id": 1})
        b["artist"] = a
        result.append(b)
    return result


@api_router.get("/bookings/{booking_id}")
async def booking_detail(booking_id: str, user=Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    a = await db.artists.find_one({"id": b["artist_id"]}, {"_id": 0})
    c = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0})
    b["artist"] = a
    b["customer"] = c
    return b


@api_router.post("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str = Query(...), user=Depends(current_user)):
    if status not in ("confirmed", "rejected", "in_progress", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": status}})
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return b


@api_router.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, user=Depends(current_user)):
    # Placeholder for Razorpay order creation. Returns a fake order for demo.
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    order = {
        "order_id": f"order_{new_id()[:12]}",
        "amount": b["price"] * 100,  # paise
        "currency": "INR",
        "key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_test_placeholder"),
    }
    return order


@api_router.post("/bookings/{booking_id}/pay/confirm")
async def confirm_payment(booking_id: str, user=Depends(current_user)):
    await db.bookings.update_one({"id": booking_id}, {"$set": {"payment_status": "paid", "status": "confirmed"}})
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return b


# ---------- Wishlist ----------
@api_router.post("/wishlist/{artist_id}")
async def toggle_wishlist(artist_id: str, user=Depends(current_user)):
    existing = await db.wishlist.find_one({"user_id": user["id"], "artist_id": artist_id})
    if existing:
        await db.wishlist.delete_one({"user_id": user["id"], "artist_id": artist_id})
        return {"wishlisted": False}
    await db.wishlist.insert_one({"user_id": user["id"], "artist_id": artist_id, "created_at": utcnow_iso()})
    return {"wishlisted": True}


@api_router.get("/wishlist")
async def get_wishlist(user=Depends(current_user)):
    entries = await db.wishlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    ids = [e["artist_id"] for e in entries]
    artists = await db.artists.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    return artists


# ---------- Reviews ----------
@api_router.post("/reviews")
async def add_review(body: ReviewCreate, user=Depends(current_user)):
    review = {
        "id": new_id(),
        "artist_id": body.artist_id,
        "user_id": user["id"],
        "user_name": user.get("name") or "Customer",
        "user_avatar": user.get("avatar") or "https://i.pravatar.cc/100",
        "rating": body.rating,
        "text": body.text,
        "created_at": utcnow_iso(),
    }
    await db.reviews.insert_one(review.copy())
    review.pop("_id", None)
    return review


# ---------- Chat (WebSocket) ----------
class ConnManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room, []).append(ws)

    def disconnect(self, room: str, ws: WebSocket):
        if room in self.rooms and ws in self.rooms[room]:
            self.rooms[room].remove(ws)

    async def broadcast(self, room: str, data: dict):
        for ws in list(self.rooms.get(room, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnManager()


def conv_id(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


@api_router.get("/conversations")
async def list_conversations(user=Depends(current_user)):
    # find distinct conversation partners
    query = {"$or": [{"sender_id": user["id"]}, {"receiver_id": user["id"]}]}
    msgs = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    seen = {}
    for m in msgs:
        other = m["receiver_id"] if m["sender_id"] == user["id"] else m["sender_id"]
        if other not in seen:
            seen[other] = m
    convs = []
    for other, last in seen.items():
        u = await db.users.find_one({"id": other}, {"_id": 0})
        a = await db.artists.find_one({"user_id": other}, {"_id": 0})
        name = (a["name"] if a else (u["name"] if u else "User"))
        avatar = (a["avatar"] if a else (u.get("avatar") if u else "https://i.pravatar.cc/100"))
        convs.append({
            "other_id": other,
            "name": name,
            "avatar": avatar,
            "last": last["text"],
            "last_at": last["created_at"],
        })
    return convs


@api_router.get("/messages/{other_id}")
async def get_messages(other_id: str, user=Depends(current_user)):
    cid = conv_id(user["id"], other_id)
    msgs = await db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


@app.websocket("/api/ws/chat")
async def ws_chat(ws: WebSocket, token: str = Query(...), other: str = Query(...)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
    except Exception:
        await ws.close(code=4401)
        return
    room = conv_id(uid, other)
    await manager.connect(room, ws)
    try:
        while True:
            data = await ws.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue
            msg = {
                "id": new_id(),
                "conversation_id": room,
                "sender_id": uid,
                "receiver_id": other,
                "text": text,
                "created_at": utcnow_iso(),
            }
            await db.messages.insert_one(msg.copy())
            msg.pop("_id", None)
            await manager.broadcast(room, msg)
    except WebSocketDisconnect:
        manager.disconnect(room, ws)
    except Exception as e:
        logger.exception(e)
        manager.disconnect(room, ws)


# ---------- Notifications (simple stub) ----------
@api_router.get("/notifications")
async def notifications(user=Depends(current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    if not items:
        # seed a few sample
        items = [
            {"id": new_id(), "user_id": user["id"], "title": "Welcome to GlowMeOut",
             "body": "Discover verified beauty professionals near you.", "created_at": utcnow_iso(), "read": False},
        ]
    return items


# ---------- Artist Analytics / Earnings ----------
@api_router.get("/artist/dashboard")
async def artist_dashboard(user=Depends(current_user)):
    if user["role"] != "artist":
        raise HTTPException(status_code=403, detail="Artist only")
    artist = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not artist:
        return {"artist": None, "metrics": {}, "bookings": []}
    bookings = await db.bookings.find({"artist_id": artist["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    earnings = sum(b["price"] for b in bookings if b["payment_status"] == "paid")
    pending = sum(1 for b in bookings if b["status"] == "pending")
    completed = sum(1 for b in bookings if b["status"] == "completed")
    upcoming = [b for b in bookings if b["status"] in ("confirmed", "pending", "in_progress")][:10]
    return {
        "artist": artist,
        "metrics": {
            "earnings": earnings,
            "pending_requests": pending,
            "completed": completed,
            "rating": artist["rating"],
            "bookings_count": artist["bookings_count"],
        },
        "upcoming": upcoming,
    }


# ---------- Partner (Artist) App ----------
class PartnerOTPRequest(BaseModel):
    phone: str

class PartnerOTPVerify(BaseModel):
    phone: str
    otp: str

class PartnerRegistration(BaseModel):
    # step 1
    profile_picture: Optional[str] = None
    full_name: str
    email: str
    address: str
    city: str
    state: str
    pincode: str
    # step 2
    service_categories: List[str] = []
    # step 3 (optional)
    certificates: List[Dict[str, Any]] = []
    # step 4
    kyc_type: str  # 'aadhaar' | 'pan'
    kyc_number: str
    kyc_file: Optional[str] = None
    # step 5
    bank_name: str
    account_holder: str
    ifsc: str
    account_number: str
    passbook_file: Optional[str] = None
    upi_id: Optional[str] = None


class PartnerService(BaseModel):
    category: str
    name: str
    pricing_mode: str  # 'fixed' | 'package' | 'custom'
    fixed_price: Optional[int] = None
    packages: Optional[List[Dict[str, Any]]] = None
    custom_starting_price: Optional[int] = None
    custom_questions: Optional[List[Dict[str, Any]]] = None
    duration_min: Optional[int] = 60
    description: Optional[str] = None


class PartnerAddon(BaseModel):
    name: str
    price: int
    description: Optional[str] = None


class PartnerAvailability(BaseModel):
    working_days: List[str] = []
    working_hours_start: str = "09:00"
    working_hours_end: str = "20:00"
    blocked_dates: List[str] = []
    vacation_mode: bool = False
    max_per_day: int = 3
    travel_radius_km: int = 15
    cities: List[str] = []


class PartnerPortfolioItem(BaseModel):
    type: str  # 'image' | 'video' | 'before_after'
    url: str  # base64 or remote
    caption: Optional[str] = None


class PartnerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    profile_picture: Optional[str] = None
    cover_picture: Optional[str] = None
    tagline: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    languages: Optional[List[str]] = None
    awards: Optional[List[str]] = None
    instagram: Optional[str] = None


async def current_partner(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    user = await current_user(authorization)
    if user.get("role") != "partner":
        raise HTTPException(status_code=403, detail="Partner access only")
    return user


@api_router.post("/partner/auth/otp/request")
async def partner_otp_request(body: PartnerOTPRequest):
    logger.info(f"[Partner] OTP requested for {body.phone} — demo {DEMO_OTP}")
    return {"ok": True, "message": f"OTP sent to {body.phone}", "demo_otp": DEMO_OTP}


@api_router.post("/partner/auth/otp/verify")
async def partner_otp_verify(body: PartnerOTPVerify):
    if body.otp != DEMO_OTP:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    user = await db.users.find_one({"phone": body.phone, "role": "partner"}, {"_id": 0})
    is_new = False
    if not user:
        is_new = True
        user = {
            "id": new_id(),
            "phone": body.phone,
            "role": "partner",
            "artist_status": "unregistered",
            "created_at": utcnow_iso(),
        }
        await db.users.insert_one(user.copy())
        user.pop("_id", None)
    token = make_token(user["id"], "partner")
    partner = await db.partners.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"token": token, "user": user, "partner": partner, "is_new": is_new}


@api_router.get("/partner/me")
async def partner_me(user=Depends(current_partner)):
    partner = await db.partners.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"user": user, "partner": partner}


@api_router.post("/partner/register")
async def partner_register(body: PartnerRegistration, user=Depends(current_partner)):
    existing = await db.partners.find_one({"user_id": user["id"]}, {"_id": 0})
    payload = {
        "id": existing["id"] if existing else new_id(),
        "user_id": user["id"],
        "profile_picture": body.profile_picture,
        "full_name": body.full_name,
        "email": body.email,
        "phone": user["phone"],
        "address": body.address,
        "city": body.city,
        "state": body.state,
        "pincode": body.pincode,
        "service_categories": body.service_categories,
        "certificates": body.certificates,
        "kyc": {"type": body.kyc_type, "number": body.kyc_number, "file": body.kyc_file},
        "bank": {
            "bank_name": body.bank_name, "account_holder": body.account_holder,
            "ifsc": body.ifsc, "account_number": body.account_number,
            "passbook_file": body.passbook_file, "upi_id": body.upi_id,
        },
        "submitted_at": utcnow_iso(),
        "verified_at": None,
        "tagline": None, "bio": None, "cover_picture": None,
        "experience_years": None, "languages": [], "awards": [], "instagram": None,
    }
    if existing:
        await db.partners.update_one({"user_id": user["id"]}, {"$set": payload})
    else:
        await db.partners.insert_one(payload.copy())
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "artist_status": "pending_verification",
        "name": body.full_name,
        "email": body.email,
        "city": body.city,
        "avatar": body.profile_picture,
    }})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    partner = await db.partners.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"user": updated, "partner": partner}


@api_router.post("/partner/approve")
async def partner_approve(user=Depends(current_partner)):
    """Demo helper: approve self so the artist can access the dashboard immediately."""
    partner = await db.partners.find_one({"user_id": user["id"]}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=400, detail="Complete registration first")
    await db.users.update_one({"id": user["id"]}, {"$set": {"artist_status": "approved"}})
    await db.partners.update_one({"user_id": user["id"]}, {"$set": {"verified_at": utcnow_iso()}})
    # sync into public artists collection
    existing_artist = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
    art_doc = {
        "user_id": user["id"],
        "name": partner["full_name"],
        "tagline": partner.get("tagline") or "New Beauty Professional",
        "avatar": partner.get("profile_picture") or "https://i.pravatar.cc/300",
        "cover": partner.get("cover_picture") or "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80",
        "city": partner["city"],
        "rating": 5.0, "reviews_count": 0, "bookings_count": 0,
        "experience_years": partner.get("experience_years") or 1,
        "starting_price": 1000,
        "specialties": partner["service_categories"],
        "bio": partner.get("bio") or f"Professional beauty services by {partner['full_name']}.",
        "verified": True, "kyc_status": "verified",
        "portfolio": [], "services": [],
    }
    if existing_artist:
        await db.artists.update_one({"user_id": user["id"]}, {"$set": art_doc})
    else:
        art_doc["id"] = new_id()
        await db.artists.insert_one(art_doc.copy())
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": updated}


@api_router.patch("/partner/profile")
async def partner_update_profile(body: PartnerProfileUpdate, user=Depends(current_partner)):
    patch = {k: v for k, v in body.dict().items() if v is not None}
    if patch:
        await db.partners.update_one({"user_id": user["id"]}, {"$set": patch})
        # mirror common fields to artist directory
        artist_patch: Dict[str, Any] = {}
        if "full_name" in patch: artist_patch["name"] = patch["full_name"]
        if "profile_picture" in patch: artist_patch["avatar"] = patch["profile_picture"]
        if "cover_picture" in patch: artist_patch["cover"] = patch["cover_picture"]
        if "tagline" in patch: artist_patch["tagline"] = patch["tagline"]
        if "bio" in patch: artist_patch["bio"] = patch["bio"]
        if "city" in patch: artist_patch["city"] = patch["city"]
        if "experience_years" in patch: artist_patch["experience_years"] = patch["experience_years"]
        if artist_patch:
            await db.artists.update_one({"user_id": user["id"]}, {"$set": artist_patch})
    partner = await db.partners.find_one({"user_id": user["id"]}, {"_id": 0})
    return partner


# ----- Services (partner-side pricing) -----
@api_router.get("/partner/services")
async def partner_list_services(user=Depends(current_partner)):
    items = await db.partner_services.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    return items

@api_router.post("/partner/services")
async def partner_create_service(body: PartnerService, user=Depends(current_partner)):
    doc = {"id": new_id(), "user_id": user["id"], **body.dict(), "created_at": utcnow_iso()}
    await db.partner_services.insert_one(doc.copy())
    # keep public artist services in sync (compact form for customer display)
    starting = doc.get("fixed_price") or doc.get("custom_starting_price") or (
        min((p.get("price") or 0) for p in (doc.get("packages") or [{"price": 0}])) if doc.get("packages") else 0
    )
    art = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
    if art:
        await db.artists.update_one({"user_id": user["id"]}, {"$push": {"services": {
            "id": doc["id"], "category": doc["category"], "name": doc["name"],
            "price": starting, "duration_min": doc.get("duration_min") or 60,
            "description": doc.get("description") or "",
            "pricing_mode": doc["pricing_mode"],
        }}})
    doc.pop("_id", None)
    return doc

@api_router.patch("/partner/services/{sid}")
async def partner_update_service(sid: str, body: PartnerService, user=Depends(current_partner)):
    await db.partner_services.update_one({"id": sid, "user_id": user["id"]}, {"$set": body.dict()})
    return await db.partner_services.find_one({"id": sid}, {"_id": 0})

@api_router.delete("/partner/services/{sid}")
async def partner_delete_service(sid: str, user=Depends(current_partner)):
    await db.partner_services.delete_one({"id": sid, "user_id": user["id"]})
    await db.artists.update_one({"user_id": user["id"]}, {"$pull": {"services": {"id": sid}}})
    return {"ok": True}


# ----- Add-ons -----
@api_router.get("/partner/addons")
async def partner_list_addons(user=Depends(current_partner)):
    items = await db.partner_addons.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return items

@api_router.post("/partner/addons")
async def partner_create_addon(body: PartnerAddon, user=Depends(current_partner)):
    doc = {"id": new_id(), "user_id": user["id"], **body.dict()}
    await db.partner_addons.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api_router.delete("/partner/addons/{aid}")
async def partner_delete_addon(aid: str, user=Depends(current_partner)):
    await db.partner_addons.delete_one({"id": aid, "user_id": user["id"]})
    return {"ok": True}


# ----- Availability -----
@api_router.get("/partner/availability")
async def partner_get_availability(user=Depends(current_partner)):
    a = await db.partner_availability.find_one({"user_id": user["id"]}, {"_id": 0})
    if not a:
        a = {"user_id": user["id"], "working_days": ["mon","tue","wed","thu","fri","sat"],
             "working_hours_start": "09:00", "working_hours_end": "20:00",
             "blocked_dates": [], "vacation_mode": False,
             "max_per_day": 3, "travel_radius_km": 15, "cities": []}
    return a

@api_router.patch("/partner/availability")
async def partner_update_availability(body: PartnerAvailability, user=Depends(current_partner)):
    await db.partner_availability.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], **body.dict()}},
        upsert=True,
    )
    return await db.partner_availability.find_one({"user_id": user["id"]}, {"_id": 0})


# ----- Portfolio -----
@api_router.get("/partner/portfolio")
async def partner_get_portfolio(user=Depends(current_partner)):
    items = await db.partner_portfolio.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api_router.post("/partner/portfolio")
async def partner_add_portfolio(body: PartnerPortfolioItem, user=Depends(current_partner)):
    doc = {"id": new_id(), "user_id": user["id"], **body.dict(), "created_at": utcnow_iso()}
    await db.partner_portfolio.insert_one(doc.copy())
    if body.type == "image":
        await db.artists.update_one({"user_id": user["id"]}, {"$push": {"portfolio": body.url}})
    doc.pop("_id", None)
    return doc

@api_router.delete("/partner/portfolio/{pid}")
async def partner_delete_portfolio(pid: str, user=Depends(current_partner)):
    item = await db.partner_portfolio.find_one({"id": pid, "user_id": user["id"]}, {"_id": 0})
    await db.partner_portfolio.delete_one({"id": pid, "user_id": user["id"]})
    if item and item.get("type") == "image":
        await db.artists.update_one({"user_id": user["id"]}, {"$pull": {"portfolio": item["url"]}})
    return {"ok": True}


# ----- Bookings (partner-side) -----
@api_router.get("/partner/bookings")
async def partner_list_bookings(status: Optional[str] = None, user=Depends(current_partner)):
    artist = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not artist:
        return []
    q: Dict[str, Any] = {"artist_id": artist["id"]}
    if status:
        q["status"] = status
    bookings = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    out = []
    for b in bookings:
        c = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0})
        b["customer"] = {"name": (c or {}).get("name") or "Customer", "phone": (c or {}).get("phone"), "avatar": (c or {}).get("avatar")}
        out.append(b)
    return out


@api_router.post("/partner/bookings/{bid}/accept")
async def partner_accept(bid: str, user=Depends(current_partner)):
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "confirmed"}})
    return await db.bookings.find_one({"id": bid}, {"_id": 0})

@api_router.post("/partner/bookings/{bid}/decline")
async def partner_decline(bid: str, user=Depends(current_partner)):
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "rejected"}})
    return await db.bookings.find_one({"id": bid}, {"_id": 0})

@api_router.post("/partner/bookings/{bid}/complete")
async def partner_complete(bid: str, user=Depends(current_partner)):
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "completed"}})
    return await db.bookings.find_one({"id": bid}, {"_id": 0})

class QuoteBody(BaseModel):
    price: int
    note: Optional[str] = None

@api_router.post("/partner/bookings/{bid}/quote")
async def partner_send_quote(bid: str, body: QuoteBody, user=Depends(current_partner)):
    await db.bookings.update_one({"id": bid}, {"$set": {"quoted_price": body.price, "quote_note": body.note, "status": "quoted"}})
    return await db.bookings.find_one({"id": bid}, {"_id": 0})


# ----- Earnings -----
@api_router.get("/partner/earnings")
async def partner_earnings(user=Depends(current_partner)):
    artist = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not artist:
        return {"today": 0, "week": 0, "month": 0, "year": 0, "pending_payout": 0, "completed_payout": 0, "transactions": []}
    bookings = await db.bookings.find({"artist_id": artist["id"], "payment_status": "paid"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    now = datetime.now(timezone.utc)
    today = 0; week = 0; month = 0; year = 0
    for b in bookings:
        d = datetime.fromisoformat(b["created_at"].replace("Z", "+00:00")) if isinstance(b["created_at"], str) else b["created_at"]
        p = b["price"]
        if d.date() == now.date(): today += p
        if (now - d).days <= 7: week += p
        if d.month == now.month and d.year == now.year: month += p
        if d.year == now.year: year += p
    transactions = [{"id": b["id"], "amount": b["price"], "service": b["service_name"], "customer": b["customer_id"][:6], "date": b["created_at"], "status": b["status"]} for b in bookings[:20]]
    return {"today": today, "week": week, "month": month, "year": year,
            "pending_payout": int(week * 0.1), "completed_payout": int(month * 0.9),
            "transactions": transactions}


# ----- Dashboard (new namespace) -----
@api_router.get("/partner/dashboard")
async def partner_dashboard(user=Depends(current_partner)):
    artist = await db.artists.find_one({"user_id": user["id"]}, {"_id": 0})
    if not artist:
        return {"artist": None, "metrics": {}, "upcoming": []}
    bookings = await db.bookings.find({"artist_id": artist["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    now = datetime.now(timezone.utc)
    today_earn = sum(b["price"] for b in bookings if b["payment_status"] == "paid" and b["created_at"].startswith(now.date().isoformat()))
    total = sum(b["price"] for b in bookings if b["payment_status"] == "paid")
    pending = sum(1 for b in bookings if b["status"] == "pending")
    upcoming = [b for b in bookings if b["status"] in ("confirmed", "in_progress")][:8]
    for b in upcoming:
        c = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0})
        b["customer"] = {"name": (c or {}).get("name") or "Customer", "phone": (c or {}).get("phone")}
    return {
        "artist": artist,
        "metrics": {
            "today_earnings": today_earn,
            "total_earnings": total,
            "pending_requests": pending,
            "upcoming_count": len(upcoming),
            "rating": artist["rating"],
            "bookings_count": artist["bookings_count"],
        },
        "upcoming": upcoming,
    }


# ---------- Seed ----------
SEED_ARTISTS = [
    {
        "name": "Ananya Kapoor", "tagline": "Bridal Couture Specialist",
        "avatar": "https://images.unsplash.com/photo-1619002117199-47c7f0427d21?w=400&q=80",
        "cover": "https://images.unsplash.com/photo-1610173827043-9db50e0d8ef9?w=1200&q=80",
        "city": "Mumbai", "rating": 4.9, "reviews_count": 218, "bookings_count": 342, "experience_years": 9, "starting_price": 15000,
        "specialties": ["bridal", "engagement", "reception"],
        "bio": "Couture-inspired bridal artistry with a focus on radiant, camera-ready looks. Trained in Paris; served brides across India and UAE.",
        "portfolio": [
            "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=800&q=80",
            "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80",
            "https://images.unsplash.com/photo-1610030469668-8e4a7b0f3b1b?w=800&q=80",
            "https://images.pexels.com/photos/30809480/pexels-photo-30809480.jpeg?w=800",
            "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
            "https://images.unsplash.com/photo-1519415387722-a1c3bbef716c?w=800&q=80",
        ],
    },
    {
        "name": "Riya Malhotra", "tagline": "Editorial & Party Glam",
        "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
        "cover": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80",
        "city": "Delhi", "rating": 4.8, "reviews_count": 156, "bookings_count": 230, "experience_years": 6, "starting_price": 4500,
        "specialties": ["party", "photoshoot", "engagement"],
        "bio": "Editorial makeup artist known for luminous skin and bold, modern looks.",
        "portfolio": [
            "https://images.unsplash.com/photo-1512257151-5c1f61cb1eb6?w=800&q=80",
            "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=800&q=80",
            "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
        ],
    },
    {
        "name": "Sneha Reddy", "tagline": "Hair Couture & Saree Draping",
        "avatar": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80",
        "cover": "https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3?w=1200&q=80",
        "city": "Bangalore", "rating": 4.9, "reviews_count": 184, "bookings_count": 270, "experience_years": 8, "starting_price": 2500,
        "specialties": ["hair", "saree", "bridal"],
        "bio": "Signature hair sculpting and effortlessly draped sarees for weddings and events.",
        "portfolio": [
            "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&q=80",
            "https://images.unsplash.com/photo-1580618864194-3f68b3f6f5b0?w=800&q=80",
            "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=800&q=80",
            "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80",
        ],
    },
    {
        "name": "Aditi Sharma", "tagline": "Mehendi Artist & Nail Couture",
        "avatar": "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&q=80",
        "cover": "https://images.pexels.com/photos/14825258/pexels-photo-14825258.jpeg?w=1200",
        "city": "Jaipur", "rating": 4.7, "reviews_count": 102, "bookings_count": 168, "experience_years": 5, "starting_price": 2000,
        "specialties": ["mehendi", "nail"],
        "bio": "Traditional Rajasthani mehendi with a modern minimal twist.",
        "portfolio": [
            "https://images.pexels.com/photos/14825258/pexels-photo-14825258.jpeg?w=800",
            "https://images.pexels.com/photos/4965824/pexels-photo-4965824.jpeg?w=800",
            "https://images.unsplash.com/photo-1610030469668-8e4a7b0f3b1b?w=800&q=80",
            "https://images.pexels.com/photos/6621334/pexels-photo-6621334.jpeg?w=800",
        ],
    },
    {
        "name": "Ishita Verma", "tagline": "Contemporary Bridal & Reception",
        "avatar": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80",
        "cover": "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=1200&q=80",
        "city": "Mumbai", "rating": 4.85, "reviews_count": 141, "bookings_count": 210, "experience_years": 7, "starting_price": 12000,
        "specialties": ["bridal", "reception", "engagement", "photoshoot"],
        "bio": "Soft glam and contemporary bridal signatures with a modern editorial edge.",
        "portfolio": [
            "https://images.unsplash.com/photo-1519415387722-a1c3bbef716c?w=800&q=80",
            "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=800&q=80",
            "https://images.unsplash.com/photo-1512257151-5c1f61cb1eb6?w=800&q=80",
            "https://images.unsplash.com/photo-1610173827043-9db50e0d8ef9?w=800&q=80",
        ],
    },
    {
        "name": "Meera Iyer", "tagline": "Photoshoot & Party Specialist",
        "avatar": "https://images.unsplash.com/photo-1523419409543-a5e549c1c9bc?w=400&q=80",
        "cover": "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=1200&q=80",
        "city": "Chennai", "rating": 4.75, "reviews_count": 88, "bookings_count": 130, "experience_years": 4, "starting_price": 3500,
        "specialties": ["party", "photoshoot", "hair"],
        "bio": "Editorial and campaign work with a signature dewy glow.",
        "portfolio": [
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
            "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80",
            "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
        ],
    },
]


SAMPLE_REVIEWS = [
    ("Wedding of my dreams. Ananya was calm, professional and made me feel like royalty.", 5, "Priya S."),
    ("The team arrived on time and the makeup lasted all night. Highly recommend.", 5, "Nisha M."),
    ("Loved the soft glam! Perfect for my reception.", 5, "Kavya D."),
    ("Beautiful mehendi work, exactly the pattern I wanted.", 4, "Anjali R."),
    ("Great skill, punctual, and very sweet person.", 5, "Divya K."),
]


async def seed_if_empty():
    count = await db.artists.count_documents({})
    if count > 0:
        return
    for a in SEED_ARTISTS:
        artist_id = new_id()
        user_id = new_id()
        phone = f"+9199{str(abs(hash(a['name'])))[:8]}"
        await db.users.insert_one({
            "id": user_id, "phone": phone, "role": "artist", "name": a["name"],
            "email": None, "avatar": a["avatar"], "city": a["city"], "created_at": utcnow_iso(),
        })
        services = []
        for cat in a["specialties"]:
            catObj = next((c for c in CATEGORIES if c["id"] == cat), None)
            if catObj:
                price = max(catObj["starting"], a["starting_price"]) if cat in ("bridal", "reception", "engagement") else catObj["starting"]
                services.append({
                    "id": new_id(),
                    "category": cat,
                    "name": catObj["name"],
                    "price": price,
                    "duration_min": 120 if cat in ("bridal", "reception", "engagement") else 60,
                    "description": f"Professional {catObj['name']} by {a['name']}, at your home.",
                })
        doc = {"id": artist_id, "user_id": user_id, **a, "verified": True, "kyc_status": "verified", "services": services}
        await db.artists.insert_one(doc)
        # reviews
        import random
        for i in range(6):
            r = random.choice(SAMPLE_REVIEWS)
            await db.reviews.insert_one({
                "id": new_id(),
                "artist_id": artist_id,
                "user_id": new_id(),
                "user_name": r[2],
                "user_avatar": f"https://i.pravatar.cc/100?u={r[2]}",
                "rating": r[1],
                "text": r[0],
                "created_at": utcnow_iso(),
            })
    logger.info("Seeded artists.")


@api_router.get("/")
async def root():
    return {"message": "GlowMeOut API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await seed_if_empty()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
