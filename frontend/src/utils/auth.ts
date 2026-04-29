const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const SESSION_KEY = 'cp_session';

export interface AuthSession {
  sessionId: string;
  userName: string;
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export async function login(
  username: string,
  password: string,
): Promise<{ session: AuthSession | null; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { session: null, error: (err as any).error ?? 'Login failed.' };
    }
    const data = await res.json();
    const session: AuthSession = { sessionId: data.sessionId, userName: data.userName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { session };
  } catch {
    return { session: null, error: 'Cannot reach server. Is the backend running?' };
  }
}

export async function verifySession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export async function logout(sessionId: string): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch { /* ignore */ }
}
