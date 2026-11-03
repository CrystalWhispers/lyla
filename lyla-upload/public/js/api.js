import { state } from './store.js';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call(path, { method = 'GET', body, timeout = 100000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch('/api/' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-access-code': state.settings.code || '' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* corps non JSON */
    }
    if (!res.ok) throw new ApiError(data?.error || 'http', data?.message || `Erreur ${res.status}`, res.status);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError('timeout', "L'IA met trop de temps à répondre. Réessayez.", 0);
    throw new ApiError('network', 'Connexion impossible avec le serveur.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const health = () => call('health', { timeout: 8000 });
export const analyze = (text, known) => call('analyze', { method: 'POST', body: { text, known } });
export const correct = (text, targets) => call('correct', { method: 'POST', body: { text, targets } });
