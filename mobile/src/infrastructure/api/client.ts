import * as SecureStore from 'expo-secure-store';
import type {
  ActivationKeyDto,
  LicenseProjectionDto,
  OrderDto,
  PublicLicenseVerificationDto,
} from './generated';

const SESSION_KEY = 'emukey_mobile_session_v1';
const API_URL =
  (globalThis as typeof globalThis & {
    process?: { env?: { EXPO_PUBLIC_API_URL?: string } };
  }).process?.env?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const REQUEST_TIMEOUT_MS = 8_000;

export type MobileOrderSummary = OrderDto;
export type MobileOrderDetail = OrderDto;
export type MobileLicense = LicenseProjectionDto;
export type MobileLicenseVerification = PublicLicenseVerificationDto;
export interface MobileUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
}
export interface MobileSession {
  accessToken: string;
  user: MobileUser;
}

let activeSession: MobileSession | null = null;

export class MobileApiError extends Error {
  constructor(readonly status: number, message = 'Yêu cầu API thất bại.') {
    super(message);
    this.name = 'MobileApiError';
  }
}

export async function restoreSession(): Promise<MobileSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MobileSession;
    if (!parsed.accessToken || parsed.user?.role !== 'CUSTOMER') return null;
    activeSession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function saveSession(session: MobileSession | null): Promise<void> {
  activeSession = session;
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function request(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (authenticated && activeSession?.accessToken) {
    headers.set('authorization', `Bearer ${activeSession.accessToken}`);
  }
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
    if (authenticated && response.status === 401) await saveSession(null);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      message = body.error?.message ?? body.message;
    } catch {
      // The presentation layer provides a status-based fallback.
    }
    throw new MobileApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<MobileSession> {
  const session = await json<MobileSession>(
    await request(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) },
      false,
    ),
  );
  if (session.user.role !== 'CUSTOMER') {
    throw new MobileApiError(403, 'Ứng dụng này dành cho tài khoản người mua.');
  }
  await saveSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    await saveSession(null);
  }
}

export async function listOrders(): Promise<MobileOrderSummary[]> {
  return json(await request('/orders'));
}

export async function getOrder(id: string): Promise<MobileOrderDetail> {
  return json(await request(`/orders/${encodeURIComponent(id)}`));
}

export async function listLicenses(): Promise<MobileLicense[]> {
  return json(await request('/licenses'));
}

export async function retrieveActivationKey(id: string): Promise<ActivationKeyDto> {
  return json(
    await request(`/licenses/${encodeURIComponent(id)}/activation-key/retrieve`, {
      method: 'POST',
    }),
  );
}

export async function verifyPublicLicense(
  publicId: string,
): Promise<PublicLicenseVerificationDto> {
  return json(
    await request(`/public/licenses/${encodeURIComponent(publicId)}/verify`, {}, false),
  );
}
