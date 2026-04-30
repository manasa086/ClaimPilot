const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const SESSION_KEY = 'cp_session';

function sessionId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw)?.sessionId ?? null) : null;
  } catch {
    return null;
  }
}

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const sid = sessionId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (sid) headers['x-session-id'] = sid;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
