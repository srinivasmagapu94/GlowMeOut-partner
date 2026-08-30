import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Partner uses its own namespace so customer & partner sessions never collide.
const TOKEN_KEY = 'partner_token';
const USER_KEY = 'partner_user';
const PHONE_KEY = 'partner_phone';
const PARTNER_UUID_KEY = 'partner_uuid';

export function normalizePartnerMobileNumber(phone: string) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length > 10) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export async function partnerApi(path: string, opts: RequestInit = {}) {
  // Temporarily disabled token auth for the partner login flow.
  // const t = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      // ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) { await clearPartnerSession(); }
    throw new Error(text || `HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return null;
}

export async function partnerLogin(mobileNumber: string) {
  const normalized = normalizePartnerMobileNumber(mobileNumber);
  const payload = { mobileNumber: normalized };

  try {
    const result = await partnerApi('/partner/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (result && (result.token || result.user || result.data)) {
      return result;
    }

    return { ok: true, mobileNumber: normalized };
  } catch (error) {
    if (normalized) {
      const fallback = await partnerApi('/partner/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: normalized }),
      });
      return { ...fallback, mobileNumber: normalized, fallback: true };
    }
    throw error;
  }
}

export async function savePartnerSession(token: string, user: any) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function savePartnerPhone(phone: string) {
  await AsyncStorage.setItem(PHONE_KEY, phone);
}
export async function loadPartnerPhone() {
  return AsyncStorage.getItem(PHONE_KEY);
}
export async function savePartnerProfileId(uuid: string) {
  await AsyncStorage.setItem(PARTNER_UUID_KEY, uuid);
}
export async function loadPartnerProfileId() {
  return AsyncStorage.getItem(PARTNER_UUID_KEY);
}
export async function loadPartnerUser() {
  const s = await AsyncStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}
export async function loadPartnerToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function updatePartnerUser(user: any) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function clearPartnerSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, PHONE_KEY, PARTNER_UUID_KEY]);
}
