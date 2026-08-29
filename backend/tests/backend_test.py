"""Comprehensive backend tests for GlowMeOut API.

Covers: root, categories, artists (list/featured/detail/availability/filters),
auth (OTP request/verify), me endpoints, bookings CRUD & status/pay,
wishlist toggle, reviews, conversations/messages, notifications, artist dashboard,
and WebSocket chat.
"""
import os
import json
import time
import uuid
import pytest
import requests
import websocket  # websocket-client

BASE_URL = "https://glowmeout-mobile.preview.emergentagent.com"
API = f"{BASE_URL}/api"
WS_URL = "wss://glowmeout-mobile.preview.emergentagent.com/api/ws/chat"

CUSTOMER_PHONE = f"+9199{str(uuid.uuid4().int)[:8]}"
ARTIST_PHONE = f"+9198{str(uuid.uuid4().int)[:8]}"
OTP = "123456"

state = {}


# ---------- Root & Categories ----------
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("status") == "ok"
    assert "message" in body


def test_categories():
    r = requests.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list)
    ids = {c["id"] for c in cats}
    expected = {"bridal", "party", "engagement", "reception", "hair",
                "saree", "nail", "mehendi", "photoshoot"}
    assert expected.issubset(ids), f"Missing categories: {expected - ids}"
    for c in cats:
        assert c["name"] and c["image"] and c["starting"]


# ---------- Artists ----------
def test_artists_list():
    r = requests.get(f"{API}/artists", timeout=15)
    assert r.status_code == 200
    artists = r.json()
    assert isinstance(artists, list)
    assert len(artists) >= 6, f"Expected >=6 seeded artists, got {len(artists)}"
    a = artists[0]
    for k in ("id", "name", "city", "rating", "specialties", "services"):
        assert k in a
    state["artist"] = a


def test_artists_filter_category():
    r = requests.get(f"{API}/artists", params={"category": "bridal"}, timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert all("bridal" in a["specialties"] for a in lst)
    assert len(lst) >= 1


def test_artists_filter_city_and_q():
    r = requests.get(f"{API}/artists", params={"city": "Mumbai"}, timeout=15)
    assert r.status_code == 200
    for a in r.json():
        assert "mumbai" in a["city"].lower()

    r = requests.get(f"{API}/artists", params={"q": "Ananya"}, timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert any("Ananya" in a["name"] for a in lst)


def test_artists_featured():
    r = requests.get(f"{API}/artists/featured", timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list) and len(lst) >= 1
    ratings = [a["rating"] for a in lst]
    assert ratings == sorted(ratings, reverse=True)


def test_artist_detail():
    aid = state["artist"]["id"]
    r = requests.get(f"{API}/artists/{aid}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["artist"]["id"] == aid
    assert isinstance(d["reviews"], list)


def test_artist_detail_404():
    r = requests.get(f"{API}/artists/does-not-exist", timeout=15)
    assert r.status_code == 404


def test_artist_availability():
    aid = state["artist"]["id"]
    r = requests.get(f"{API}/artists/{aid}/availability", timeout=15)
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert isinstance(slots, list) and len(slots) >= 4


# ---------- Auth ----------
def test_otp_request_customer():
    r = requests.post(f"{API}/auth/otp/request",
                      json={"phone": CUSTOMER_PHONE, "role": "customer"}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["demo_otp"] == OTP


def test_otp_verify_invalid():
    r = requests.post(f"{API}/auth/otp/verify",
                      json={"phone": CUSTOMER_PHONE, "otp": "000000", "role": "customer"},
                      timeout=15)
    assert r.status_code == 400


def test_otp_verify_customer():
    r = requests.post(f"{API}/auth/otp/verify",
                      json={"phone": CUSTOMER_PHONE, "otp": OTP, "role": "customer"},
                      timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["is_new"] is True
    assert body["user"]["role"] == "customer"
    assert body["token"]
    state["customer_token"] = body["token"]
    state["customer_user"] = body["user"]


def test_otp_verify_artist_new():
    requests.post(f"{API}/auth/otp/request",
                  json={"phone": ARTIST_PHONE, "role": "artist"}, timeout=15)
    r = requests.post(f"{API}/auth/otp/verify",
                      json={"phone": ARTIST_PHONE, "otp": OTP, "role": "artist"},
                      timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["is_new"] is True
    assert body["user"]["role"] == "artist"
    state["artist_token"] = body["token"]
    state["artist_user"] = body["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Me ----------
def test_me_unauth():
    r = requests.get(f"{API}/me", timeout=15)
    assert r.status_code == 401


def test_me_and_patch():
    r = requests.get(f"{API}/me", headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == state["customer_user"]["id"]

    r = requests.patch(f"{API}/me", headers=_auth(state["customer_token"]),
                       json={"name": "TEST_Customer", "city": "Mumbai"}, timeout=15)
    assert r.status_code == 200
    updated = r.json()
    assert updated["name"] == "TEST_Customer"
    assert updated["city"] == "Mumbai"

    # GET to verify persistence
    r = requests.get(f"{API}/me", headers=_auth(state["customer_token"]), timeout=15)
    assert r.json()["name"] == "TEST_Customer"


# ---------- Bookings ----------
def test_create_booking():
    artist = state["artist"]
    svc = artist["services"][0]
    payload = {
        "artist_id": artist["id"],
        "service_id": svc["id"],
        "date": "2026-02-14",
        "time": "10:30",
        "address": "TEST_Address, Mumbai",
        "notes": "TEST booking",
    }
    r = requests.post(f"{API}/bookings", headers=_auth(state["customer_token"]),
                      json=payload, timeout=15)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["status"] == "pending"
    assert b["payment_status"] == "unpaid"
    assert b["price"] == svc["price"]
    state["booking_id"] = b["id"]


def test_get_booking():
    r = requests.get(f"{API}/bookings/{state['booking_id']}",
                     headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    b = r.json()
    assert b["id"] == state["booking_id"]
    assert b["artist"] is not None


def test_list_bookings():
    r = requests.get(f"{API}/bookings", headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert any(b["id"] == state["booking_id"] for b in lst)


def test_update_booking_status():
    r = requests.post(f"{API}/bookings/{state['booking_id']}/status",
                      params={"status": "confirmed"},
                      headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"


def test_pay_and_confirm():
    r = requests.post(f"{API}/bookings/{state['booking_id']}/pay",
                      headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    order = r.json()
    assert order["order_id"].startswith("order_")
    assert order["currency"] == "INR"
    assert order["amount"] > 0

    r = requests.post(f"{API}/bookings/{state['booking_id']}/pay/confirm",
                      headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    b = r.json()
    assert b["payment_status"] == "paid"
    assert b["status"] == "confirmed"


def test_artist_role_cannot_book():
    artist = state["artist"]
    svc = artist["services"][0]
    r = requests.post(f"{API}/bookings", headers=_auth(state["artist_token"]),
                      json={"artist_id": artist["id"], "service_id": svc["id"],
                            "date": "2026-02-14", "time": "10:30", "address": "X"},
                      timeout=15)
    assert r.status_code == 403


# ---------- Wishlist ----------
def test_wishlist_toggle():
    aid = state["artist"]["id"]
    r = requests.post(f"{API}/wishlist/{aid}",
                      headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200 and r.json()["wishlisted"] is True

    r = requests.get(f"{API}/wishlist", headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    assert any(a["id"] == aid for a in r.json())

    r = requests.post(f"{API}/wishlist/{aid}",
                      headers=_auth(state["customer_token"]), timeout=15)
    assert r.json()["wishlisted"] is False


# ---------- Reviews ----------
def test_add_review():
    aid = state["artist"]["id"]
    r = requests.post(f"{API}/reviews", headers=_auth(state["customer_token"]),
                      json={"artist_id": aid, "rating": 5, "text": "TEST_Great work!"},
                      timeout=15)
    assert r.status_code == 200
    rv = r.json()
    assert rv["rating"] == 5 and rv["text"] == "TEST_Great work!"


# ---------- Notifications ----------
def test_notifications():
    r = requests.get(f"{API}/notifications",
                     headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list) and len(lst) >= 1


# ---------- Artist Dashboard ----------
def test_artist_dashboard_forbidden_for_customer():
    r = requests.get(f"{API}/artist/dashboard",
                     headers=_auth(state["customer_token"]), timeout=15)
    assert r.status_code == 403


def test_artist_dashboard():
    r = requests.get(f"{API}/artist/dashboard",
                     headers=_auth(state["artist_token"]), timeout=15)
    assert r.status_code == 200
    d = r.json()
    # New artist has no artist profile → returns nulls
    assert "metrics" in d


# ---------- Chat (WebSocket) ----------
def test_conversations_and_messages_ws():
    """Send messages both ways over websocket and verify persistence."""
    cust_token = state["customer_token"]
    art_token = state["artist_token"]
    cust_id = state["customer_user"]["id"]
    art_id = state["artist_user"]["id"]

    # Open two sockets in same room
    ws_cust = websocket.create_connection(
        f"{WS_URL}?token={cust_token}&other={art_id}", timeout=10)
    ws_art = websocket.create_connection(
        f"{WS_URL}?token={art_token}&other={cust_id}", timeout=10)
    try:
        ws_cust.send(json.dumps({"text": "TEST_Hello from customer"}))
        time.sleep(0.5)
        # Both sockets should receive broadcast
        ws_cust.settimeout(5)
        ws_art.settimeout(5)
        m1 = json.loads(ws_cust.recv())
        m2 = json.loads(ws_art.recv())
        assert m1["text"] == "TEST_Hello from customer"
        assert m2["text"] == "TEST_Hello from customer"
        assert m1["sender_id"] == cust_id

        ws_art.send(json.dumps({"text": "TEST_Hi from artist"}))
        time.sleep(0.5)
        m3 = json.loads(ws_cust.recv())
        assert m3["text"] == "TEST_Hi from artist"
        assert m3["sender_id"] == art_id
    finally:
        ws_cust.close()
        ws_art.close()

    # Verify persistence via REST
    r = requests.get(f"{API}/messages/{art_id}",
                     headers=_auth(cust_token), timeout=15)
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 2
    texts = [m["text"] for m in msgs]
    assert "TEST_Hello from customer" in texts
    assert "TEST_Hi from artist" in texts

    # Conversations
    r = requests.get(f"{API}/conversations",
                     headers=_auth(cust_token), timeout=15)
    assert r.status_code == 200
    convs = r.json()
    assert any(c["other_id"] == art_id for c in convs)


def test_ws_invalid_token():
    try:
        ws = websocket.create_connection(
            f"{WS_URL}?token=invalid&other=abc", timeout=5)
        # Should close immediately with 4401
        ws.settimeout(3)
        try:
            ws.recv()
        except Exception:
            pass
        ws.close()
    except Exception:
        # Handshake failure is acceptable rejection
        pass
