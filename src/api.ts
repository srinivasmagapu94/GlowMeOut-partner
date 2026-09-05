import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, signOutFromFirebase } from '@/src/auth';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080/ws_glowmeout_partner_services';

// Partner uses its own namespace so customer & partner sessions never collide.
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

export async function authenticatedFetch(input: RequestInfo | URL, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers);
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (!headers.has('Content-Type') && !isFormData) headers.set('Content-Type', 'application/json');

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Firebase authentication is required');
  }

  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }

  const response = await fetch(input, { ...opts, headers });
  if (response.status !== 401) return response;

  const retryHeaders = new Headers(headers);
  retryHeaders.set('Authorization', 'Bearer ' + await auth.currentUser!.getIdToken(true));
  return fetch(input, { ...opts, headers: retryHeaders });
}

export async function partnerApi(path: string, opts: RequestInit = {}) {
  const res = await authenticatedFetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      // ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      await signOutFromFirebase();
      await clearPartnerSession();
    }
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
export async function updatePartnerUser(user: any) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function clearPartnerSession() {
  await AsyncStorage.multiRemove([USER_KEY, PHONE_KEY, PARTNER_UUID_KEY]);
}
