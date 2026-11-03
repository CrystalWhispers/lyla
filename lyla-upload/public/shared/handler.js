// Logique de l'API (/api/*), indépendante de la plateforme : testable en Node, appelée par la Pages Function.
import { createGemini, GeminiError } from './gemini.js';
import { ANALYZE_SCHEMA, CORRECT_SCHEMA, buildAnalyzePayload, buildCorrectPayload } from './prompts.js';
import { finalizeAnalysis, finalizeCorrection, parseModelJson, AnalysisError } from './analysis.js';

const MAX_ANALYZE_CHARS = 9000;
const MAX_CORRECT_CHARS = 2500;
const MAX_BODY_BYTES = 60_000;

const modelCache = { list: null, at: 0 };

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const err = (status, error, message) => json(status, { error, message });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const today = (now) => new Date(now()).toISOString().slice(0, 10);

async function readQuota(env, now) {
  const cap = Number(env.DAILY_CAP || 120);
  if (!env.QUOTA) return { cap, used: 0, tracked: false };
  const used = Number((await env.QUOTA.get(`cap:${today(now)}`)) || 0);
  return { cap, used, tracked: true };
}

const STATUS_FOR = { bad_key: 502, quota: 429, overload: 503, blocked: 422, bad_request: 502, network: 502, no_model: 502 };
const MESSAGE_FOR = {
  bad_key: "La clé Gemini configurée sur le serveur est invalide ou n'a pas accès à l'API.",
  quota: "Le quota gratuit de l'IA est épuisé pour le moment. La bibliothèque du jour et les révisions restent disponibles.",
  overload: "Le service Gemini est surchargé. Réessayez dans une minute.",
  blocked: "Le texte a été refusé par les filtres de l'IA.",
  bad_request: "Requête refusée par l'IA.",
  network: "Le service Gemini est injoignable. Réessayez dans une minute.",
  no_model: "Aucun modèle Gemini disponible pour la clé configurée.",
};

export async function handle(request, env = {}, deps = {}) {
  const now = deps.now || Date.now;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  const origin = request.headers.get('Origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* origine invalide */
    }
    if (host !== url.host) return err(403, 'forbidden', 'Origine non autorisée.');
  }

  if (route === 'health' && request.method === 'GET') {
    const q = await readQuota(env, now);
    return json(200, {
      ok: true,
      ai: Boolean(env.GEMINI_API_KEY),
      needsCode: Boolean(env.ACCESS_CODE),
      remaining: q.tracked ? Math.max(0, q.cap - q.used) : null,
    });
  }

  if (route !== 'analyze' && route !== 'correct') return err(404, 'not_found', 'Route inconnue.');
  if (request.method !== 'POST') return err(405, 'method', 'Méthode non autorisée.');

  if (env.ACCESS_CODE && !safeEqual(request.headers.get('x-access-code') || '', String(env.ACCESS_CODE))) {
    return err(401, 'code', "Code d'accès manquant ou incorrect.");
  }
  if (!env.GEMINI_API_KEY) return err(503, 'no_key', "L'IA n'est pas encore configurée sur ce site.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return err(413, 'too_large', 'Requête trop volumineuse.');
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return err(400, 'bad_json', 'Requête invalide.');
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 40) return err(400, 'too_short', 'Texte trop court.');
  if (text.length > (route === 'analyze' ? MAX_ANALYZE_CHARS : MAX_CORRECT_CHARS)) {
    return err(413, 'too_long', `Texte trop long (maximum ${route === 'analyze' ? MAX_ANALYZE_CHARS : MAX_CORRECT_CHARS} caractères).`);
  }

  const q = await readQuota(env, now);
  if (q.tracked && q.used >= q.cap) return err(429, 'quota_daily', "La limite quotidienne du site est atteinte. Revenez demain.");
  if (q.tracked) await env.QUOTA.put(`cap:${today(now)}`, String(q.used + 1), { expirationTtl: 172800 });

  try {
    const gemini = createGemini({ apiKey: env.GEMINI_API_KEY, fetchImpl: deps.fetch || globalThis.fetch, sleep: deps.sleep, modelCache, now });
    if (route === 'analyze') {
      const known = Array.isArray(body.known) ? body.known.filter((x) => typeof x === 'string').slice(0, 150) : [];
      const payload = buildAnalyzePayload(text, known);
      const { text: out, model } = await gemini.generate(payload, ANALYZE_SCHEMA);
      const analysis = finalizeAnalysis(parseModelJson(out), text, { known });
      return json(200, { text, analysis, model });
    }
    const targets = Array.isArray(body.targets) ? body.targets.filter((x) => typeof x === 'string').slice(0, 6) : [];
    const payload = buildCorrectPayload(text, targets);
    const { text: out, model } = await gemini.generate(payload, CORRECT_SCHEMA);
    return json(200, { result: finalizeCorrection(parseModelJson(out)), model });
  } catch (e) {
    if (e instanceof GeminiError) {
      const base = MESSAGE_FOR[e.code] || e.message;
      const detail = e.code === 'bad_request' || e.code === 'bad_key' ? ` (${String(e.message).slice(0, 160)})` : '';
      return err(STATUS_FOR[e.code] || 502, e.code, base + detail);
    }
    if (e instanceof AnalysisError) return err(502, e.code, e.message);
    return err(500, 'internal', 'Erreur interne.');
  }
}
