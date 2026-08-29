"""Partner (Artist) app backend tests for GlowMeOut API.

Covers Partner-only endpoints introduced in this iteration:
  - Partner OTP request/verify (universal 123456)
  - Partner me / register / approve / profile
  - Services CRUD (fixed/package/custom) + public artist mirror
  - Add-ons CRUD
  - Availability GET/PATCH
  - Portfolio POST/GET/DELETE (+ mirror)
  - Bookings list & lifecycle (accept/decline/complete)
  - Earnings aggregation
  - Role guard: customer token rejected on partner endpoints
  - Dashboard metrics + non-partner 403
"""
import os
import time
import uuid
import random
import requests
import pytest

BASE_URL = "https://glowmeout-mobile.preview.emergentagent.com"
API = f"{BASE_URL}/api"
OTP = "123456"


def _uniq_phone():
    return f"+9199{random.randint(10000000, 99999999)}"


@pytest.fixture(scope="session")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def partner_ctx(s):
    """Register + approve one partner used across tests."""
    phone = _uniq_phone()
    r = s.post(f"{API}/partner/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True and data.get("demo_otp") == OTP

    r = s.post(f"{API}/partner/auth/otp/verify", json={"phone": phone, "otp": OTP})
    assert r.status_code == 200, r.text
    v = r.json()
    assert v.get("is_new") is True
    assert "token" in v and "user" in v
    assert v["user"]["role"] == "partner"
    assert v["user"]["artist_status"] == "unregistered"
    token = v["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # /partner/me before registration -> partner is null
    r = s.get(f"{API}/partner/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "partner"
    assert body["partner"] is None

    reg_payload = {
        "profile_picture": "https://i.pravatar.cc/300",
        "full_name": "TEST Partner",
        "email": "test_partner@example.com",
        "address": "123 Test Street",
        "city": "Mumbai",
        "state": "MH",
        "pincode": "400001",
        "service_categories": ["bridal", "party"],
        "certificates": [],
        "kyc_type": "aadhaar",
        "kyc_number": "1234 5678 9012",
        "kyc_file": None,
        "bank_name": "HDFC",
        "account_holder": "TEST Partner",
        "ifsc": "HDFC0000123",
        "account_number": "1234567890",
        "passbook_file": None,
        "upi_id": "test@upi",
    }
    r = s.post(f"{API}/partner/register", json=reg_payload, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["artist_status"] == "pending_verification"
    assert body["partner"]["full_name"] == "TEST Partner"
    assert body["partner"]["city"] == "Mumbai"

    # Approve
    r = s.post(f"{API}/partner/approve", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["artist_status"] == "approved"

    # Fetch artist id (public mirror)
    r = s.get(f"{API}/partner/me", headers=headers)
    assert r.status_code == 200
    user_id = r.json()["user"]["id"]

    # public artist list -> find one with matching user_id
    r = s.get(f"{API}/artists")
    assert r.status_code == 200
    artists = r.json()
    art = next((a for a in artists if a.get("user_id") == user_id), None)
    assert art is not None, "Approved partner should appear in /artists"

    return {
        "phone": phone,
        "token": token,
        "headers": headers,
        "user_id": user_id,
        "artist_id": art["id"],
    }


@pytest.fixture(scope="session")
def customer_headers(s):
    phone = _uniq_phone()
    r = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": OTP, "role": "customer"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- Auth ----------
class TestPartnerAuth:
    def test_invalid_otp(self, s):
        r = s.post(f"{API}/partner/auth/otp/verify", json={"phone": _uniq_phone(), "otp": "000000"})
        assert r.status_code == 400

    def test_existing_user_is_new_false(self, s):
        phone = _uniq_phone()
        s.post(f"{API}/partner/auth/otp/verify", json={"phone": phone, "otp": OTP})
        r = s.post(f"{API}/partner/auth/otp/verify", json={"phone": phone, "otp": OTP})
        assert r.status_code == 200
        assert r.json()["is_new"] is False


# ---------- Role Guard ----------
class TestRoleGuard:
    def test_customer_cannot_access_partner_me(self, s, customer_headers):
        r = s.get(f"{API}/partner/me", headers=customer_headers)
        assert r.status_code == 403

    def test_customer_cannot_access_partner_dashboard(self, s, customer_headers):
        r = s.get(f"{API}/partner/dashboard", headers=customer_headers)
        assert r.status_code == 403

    def test_missing_token(self, s):
        r = s.get(f"{API}/partner/me")
        assert r.status_code == 401


# ---------- Profile ----------
class TestPartnerProfile:
    def test_patch_profile_mirrors_to_artist(self, s, partner_ctx):
        r = s.patch(f"{API}/partner/profile", headers=partner_ctx["headers"], json={
            "tagline": "Luxury Bridal Specialist",
            "bio": "Premium looks",
            "experience_years": 8,
        })
        assert r.status_code == 200
        p = r.json()
        assert p["tagline"] == "Luxury Bridal Specialist"
        # Verify mirror
        r = s.get(f"{API}/artists/{partner_ctx['artist_id']}")
        assert r.status_code == 200
        art = r.json()["artist"]
        assert art["tagline"] == "Luxury Bridal Specialist"
        assert art["experience_years"] == 8


# ---------- Dashboard ----------
class TestPartnerDashboard:
    def test_dashboard_metrics(self, s, partner_ctx):
        r = s.get(f"{API}/partner/dashboard", headers=partner_ctx["headers"])
        assert r.status_code == 200
        d = r.json()
        assert "metrics" in d
        m = d["metrics"]
        for k in ("today_earnings", "total_earnings", "pending_requests", "upcoming_count", "rating"):
            assert k in m, f"missing metric key {k}"
        assert isinstance(d.get("upcoming"), list)


# ---------- Services ----------
class TestPartnerServices:
    def test_create_fixed_service(self, s, partner_ctx):
        payload = {"category": "bridal", "name": "Signature Bridal", "pricing_mode": "fixed",
                   "fixed_price": 25000, "duration_min": 180, "description": "HD bridal"}
        r = s.post(f"{API}/partner/services", headers=partner_ctx["headers"], json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["pricing_mode"] == "fixed"
        assert d["fixed_price"] == 25000
        partner_ctx["fixed_id"] = d["id"]

    def test_create_package_service(self, s, partner_ctx):
        payload = {"category": "party", "name": "Party Glam", "pricing_mode": "package",
                   "packages": [
                       {"tier": "silver", "price": 3500},
                       {"tier": "gold", "price": 5500},
                       {"tier": "platinum", "price": 8500},
                   ], "duration_min": 90}
        r = s.post(f"{API}/partner/services", headers=partner_ctx["headers"], json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["pricing_mode"] == "package"
        assert len(d["packages"]) == 3
        partner_ctx["pkg_id"] = d["id"]

    def test_create_custom_service(self, s, partner_ctx):
        payload = {"category": "photoshoot", "name": "Custom Shoot", "pricing_mode": "custom",
                   "custom_starting_price": 5000, "duration_min": 120}
        r = s.post(f"{API}/partner/services", headers=partner_ctx["headers"], json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["pricing_mode"] == "custom"
        assert d["custom_starting_price"] == 5000
        partner_ctx["cust_id"] = d["id"]

    def test_list_services(self, s, partner_ctx):
        r = s.get(f"{API}/partner/services", headers=partner_ctx["headers"])
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_public_artist_reflects_services(self, s, partner_ctx):
        r = s.get(f"{API}/artists/{partner_ctx['artist_id']}")
        assert r.status_code == 200
        svcs = r.json()["artist"]["services"]
        ids = {sv["id"] for sv in svcs}
        assert partner_ctx["fixed_id"] in ids
        assert partner_ctx["pkg_id"] in ids
        assert partner_ctx["cust_id"] in ids

    def test_update_service(self, s, partner_ctx):
        sid = partner_ctx["fixed_id"]
        r = s.patch(f"{API}/partner/services/{sid}", headers=partner_ctx["headers"], json={
            "category": "bridal", "name": "Signature Bridal Updated", "pricing_mode": "fixed",
            "fixed_price": 27000, "duration_min": 180,
        })
        assert r.status_code == 200
        assert r.json()["fixed_price"] == 27000

    def test_delete_service(self, s, partner_ctx):
        sid = partner_ctx["cust_id"]
        r = s.delete(f"{API}/partner/services/{sid}", headers=partner_ctx["headers"])
        assert r.status_code == 200
        r = s.get(f"{API}/partner/services", headers=partner_ctx["headers"])
        assert sid not in [x["id"] for x in r.json()]


# ---------- Add-ons ----------
class TestPartnerAddons:
    def test_addon_crud(self, s, partner_ctx):
        r = s.post(f"{API}/partner/addons", headers=partner_ctx["headers"],
                   json={"name": "Draping", "price": 500, "description": "Saree draping"})
        assert r.status_code == 200
        aid = r.json()["id"]
        r = s.get(f"{API}/partner/addons", headers=partner_ctx["headers"])
        assert r.status_code == 200
        assert aid in [x["id"] for x in r.json()]
        r = s.delete(f"{API}/partner/addons/{aid}", headers=partner_ctx["headers"])
        assert r.status_code == 200
        r = s.get(f"{API}/partner/addons", headers=partner_ctx["headers"])
        assert aid not in [x["id"] for x in r.json()]


# ---------- Availability ----------
class TestPartnerAvailability:
    def test_defaults(self, s, partner_ctx):
        r = s.get(f"{API}/partner/availability", headers=partner_ctx["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d["working_hours_start"] == "09:00"
        assert d["working_hours_end"] == "20:00"

    def test_patch_persists(self, s, partner_ctx):
        r = s.patch(f"{API}/partner/availability", headers=partner_ctx["headers"], json={
            "working_days": ["mon", "wed", "fri"],
            "working_hours_start": "10:00",
            "working_hours_end": "18:00",
            "blocked_dates": ["2026-02-14"],
            "vacation_mode": False,
            "max_per_day": 2,
            "travel_radius_km": 10,
            "cities": ["Mumbai"],
        })
        assert r.status_code == 200
        r = s.get(f"{API}/partner/availability", headers=partner_ctx["headers"])
        d = r.json()
        assert d["working_hours_start"] == "10:00"
        assert d["max_per_day"] == 2
        assert "2026-02-14" in d["blocked_dates"]


# ---------- Portfolio ----------
class TestPartnerPortfolio:
    def test_add_image_mirrors(self, s, partner_ctx):
        url = f"https://images.unsplash.com/photo-1519415387722-a1c3bbef716c?w=800&q=80&x={uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/partner/portfolio", headers=partner_ctx["headers"],
                   json={"type": "image", "url": url, "caption": "Bridal look"})
        assert r.status_code == 200
        pid = r.json()["id"]
        partner_ctx["portfolio_id"] = pid
        partner_ctx["portfolio_url"] = url
        # mirror check
        r = s.get(f"{API}/artists/{partner_ctx['artist_id']}")
        assert url in r.json()["artist"]["portfolio"]

    def test_delete_portfolio_removes_mirror(self, s, partner_ctx):
        pid = partner_ctx["portfolio_id"]
        url = partner_ctx["portfolio_url"]
        r = s.delete(f"{API}/partner/portfolio/{pid}", headers=partner_ctx["headers"])
        assert r.status_code == 200
        r = s.get(f"{API}/artists/{partner_ctx['artist_id']}")
        assert url not in r.json()["artist"]["portfolio"]


# ---------- Bookings + Earnings ----------
class TestPartnerBookingsFlow:
    def test_full_lifecycle_and_earnings(self, s, partner_ctx, customer_headers):
        # Customer creates a booking against this partner-artist
        artist_id = partner_ctx["artist_id"]
        r = s.get(f"{API}/artists/{artist_id}")
        art = r.json()["artist"]
        assert art["services"], "artist should have services from partner sync"
        service_id = art["services"][0]["id"]
        r = s.post(f"{API}/bookings", headers=customer_headers, json={
            "artist_id": artist_id, "service_id": service_id,
            "date": "2026-02-20", "time": "10:00",
            "address": "TEST address", "notes": "Please arrive on time",
        })
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        # Partner sees the booking with customer info
        r = s.get(f"{API}/partner/bookings", headers=partner_ctx["headers"])
        assert r.status_code == 200
        bookings = r.json()
        b = next((x for x in bookings if x["id"] == bid), None)
        assert b is not None
        assert "customer" in b

        # accept
        r = s.post(f"{API}/partner/bookings/{bid}/accept", headers=partner_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["status"] == "confirmed"

        # simulate payment (as customer)
        r = s.post(f"{API}/bookings/{bid}/pay/confirm", headers=customer_headers)
        assert r.status_code == 200
        assert r.json()["payment_status"] == "paid"

        # complete
        r = s.post(f"{API}/partner/bookings/{bid}/complete", headers=partner_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

        # Earnings should reflect
        r = s.get(f"{API}/partner/earnings", headers=partner_ctx["headers"])
        assert r.status_code == 200
        e = r.json()
        for k in ("today", "week", "month", "year", "pending_payout", "completed_payout", "transactions"):
            assert k in e
        assert e["month"] >= 0
        assert isinstance(e["transactions"], list)
        # transactions should include our booking id
        assert any(t["id"] == bid for t in e["transactions"])

    def test_decline_flow(self, s, partner_ctx, customer_headers):
        artist_id = partner_ctx["artist_id"]
        r = s.get(f"{API}/artists/{artist_id}")
        service_id = r.json()["artist"]["services"][0]["id"]
        r = s.post(f"{API}/bookings", headers=customer_headers, json={
            "artist_id": artist_id, "service_id": service_id,
            "date": "2026-03-15", "time": "12:00", "address": "TEST addr 2",
        })
        bid = r.json()["id"]
        r = s.post(f"{API}/partner/bookings/{bid}/decline", headers=partner_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
