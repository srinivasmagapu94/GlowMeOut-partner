import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Partner uses its own namespace so customer & partner sessions never collide.
const TOKEN_KEY = 'partner_token';
const USER_KEY = 'partner_user';

export async function partnerApi(path: string, opts: RequestInit = {}) {
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) { await clearPartnerSession(); }
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function savePartnerSession(token: string, user: any) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
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
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
