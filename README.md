# GlowMeOut — Partner (Artist)

Business-facing mobile app for freelance beauty professionals — onboarding, KYC, portfolio, services (fixed / package / custom-quote), availability, bookings, and earnings.

**Package name:** `glowmeout-partner`
**App name:** GlowMeOut Partner
**Design:** Deep Charcoal + Champagne Gold · system sans throughout (no serif) · business-luxe

## Quick start

```bash
yarn install
yarn start   # scan the QR code in Expo Go
```

## Backend

Shared GlowMeOut backend — Partner endpoints live at `/api/partner/*`. Configure in `.env`:

```
EXPO_PUBLIC_BACKEND_URL=https://your-backend.example.com
```

## Session persistence

Firebase Authentication is the source of truth for the signed-in session and restores authentication across app launches. The splash gate (`app/index.tsx`) checks Firebase auth state, then loads partner profile status to route:

- **Approved** partner → `/(tabs)/dashboard`
- **Pending / rejected** → `/verification-pending`
- **Unregistered** → `/register`
- **No session** → `/landing`

No OTP re-prompt unless the user signs out or the token becomes invalid (identical to WhatsApp / Uber Driver).

## Route map

- `/` — splash / session gate
- `/landing` · `/login` · `/otp` · `/register` · `/verification-pending`
- `/(tabs)/dashboard` · `/jobs` · `/services` · `/earnings` · `/profile` — bottom tabs
- `/service/[id]` — service editor (Fixed / Packages / Custom quote)
- `/booking/[id]` — job detail with Accept / Decline / Complete / Chat / Call / Navigate
- `/availability` · `/portfolio` · `/addons`
- `/edit-profile` · `/certificates` · `/kyc-status` · `/bank` · `/notifications`

## Test credentials

Universal OTP for demo: `123456`. Any Indian mobile number works. On the Verification Pending screen tap **"Approve now (demo)"** to instantly unlock the dashboard.
