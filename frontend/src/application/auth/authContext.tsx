import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CustomerType = 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
export type AuthUser = { id: string; email: string; displayName: string; role: string; status: string; customerType?: CustomerType | null; emailVerifiedAt?: string | null; phone?: string | null; address?: string | null; organizationName?: string | null };
export type RegisterInput = { customerType: CustomerType; displayName: string; email: string; password: string };
const API_URL = (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api/v1';
const REQUEST_TIMEOUT_MS = 3000;
let accessToken: string | null = null;

export class ApiRequestError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `API request failed (${status})`);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

export async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include', signal: init.signal ?? controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 && retry && path !== '/auth/refresh') { const refreshed = await api('/auth/refresh', { method: 'POST' }, false); if (refreshed.ok) { accessToken = (await refreshed.json() as { accessToken: string }).accessToken; return api(path, init, false); } accessToken = null; }
  return response;
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await api(path, init);
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const envelope = body && typeof body === 'object' && 'error' in body
      ? (body as { error?: unknown }).error
      : body;
    const error = envelope && typeof envelope === 'object'
      ? envelope as { code?: unknown; message?: unknown }
      : {};
    throw new ApiRequestError(
      response.status,
      typeof error.code === 'string' ? error.code : undefined,
      typeof error.message === 'string' ? error.message : undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function describeApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback;
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (error.status === 400) return error.message || 'Dữ liệu chưa hợp lệ.';
  if (error.status === 409) return error.message || 'Thao tác xung đột với trạng thái hiện tại.';
  return error.message || fallback;
}
type AuthValue = { user: AuthUser | null; loading: boolean; login: (email: string, password: string) => Promise<AuthUser>; register: (input: RegisterInput) => Promise<void>; verifyEmail: (token: string) => Promise<void>; resendVerification: (email: string) => Promise<void>; forgotPassword: (email: string) => Promise<void>; resetPassword: (token: string, password: string) => Promise<void>; logout: () => Promise<void>; setUser: (user: AuthUser | null) => void };
const Context = createContext<AuthValue | null>(null);
interface AuthProviderProps {
  readonly children: ReactNode;
  readonly initialUser?: AuthUser | null;
  readonly skipBootstrap?: boolean;
}

export function AuthProvider({ children, initialUser, skipBootstrap = false }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null); const [loading, setLoading] = useState(!skipBootstrap);
  useEffect(() => {
    if (skipBootstrap) return;
    void api('/auth/refresh', { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { accessToken?: string; user?: AuthUser };
        if (typeof result.accessToken === 'string' && result.user) {
          accessToken = result.accessToken;
          setUser(result.user);
        }
      })
      .catch(() => {
        accessToken = null;
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [skipBootstrap]);
  const post = async (path: string, body: object) => { const response = await api(path, { method: 'POST', body: JSON.stringify(body) }, false); if (!response.ok) throw new Error('AUTH_REQUEST_FAILED'); };
  const login = async (email: string, password: string) => { const response = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }, false); if (!response.ok) throw new Error('AUTH_REQUEST_FAILED'); const result = await response.json() as { accessToken: string; user: AuthUser }; accessToken = result.accessToken; setUser(result.user); return result.user; };
  const register = (input: RegisterInput) => post('/auth/register', {
    customerType: input.customerType,
    displayName: input.displayName,
    email: input.email.trim(),
    password: input.password,
  });
  const verifyEmail = (token: string) => post('/auth/verify-email', { token });
  const resendVerification = (email: string) => post('/auth/resend-verification', { email: email.trim() });
  const forgotPassword = (email: string) => post('/auth/forgot-password', { email });
  const resetPassword = (token: string, password: string) => post('/auth/reset-password', { token, password });
  const logout = async () => { await api('/auth/logout', { method: 'POST' }, false); accessToken = null; setUser(null); };
  return <Context.Provider value={{ user, loading, login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, logout, setUser }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is required'); return value; }
export function useOptionalAuth() { return useContext(Context); }
