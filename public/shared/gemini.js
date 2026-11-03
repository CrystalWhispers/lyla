// Client Gemini : détection automatique du modèle, nouvelle tentative sur surcharge, repli entre modèles.
import { withoutSchema } from './prompts.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta'; const CALL_TIMEOUT_MS = 50000;

export class GeminiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code; // bad_key | quota | overload | blocked | bad_request | network | no_model
    this.status = status;
  }
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readError(res) {
  try {
    const j = await res.json();
    return j?.error?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function pickModels(models) {
  const stable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(n));
  const ver = (n) => parseFloat(n.match(/^gemini-(\d+(?:\.\d+)?)/)[1]);
  stable.sort((a, b) => ver(b) - ver(a) || Number(a.includes('lite')) - Number(b.includes('lite')));
  const names = models.map((m) => m.name.replace(/^models\//, ''));
  if (names.includes('gemini-flash-latest')) stable.push('gemini-flash-latest');
  return stable;
}

export function createGemini({ apiKey, fetchImpl = globalThis.fetch, sleep = defaultSleep, modelCache = { list: null, at: 0 }, ttlMs = 6 * 3600e3, now = Date.now } = {}) {
  if (!apiKey) throw new GeminiError('bad_key', 'Clé Gemini absente côté serveur.', 500);

  async function listModels() {
    if (modelCache.list && now() - modelCache.at < ttlMs) return modelCache.list;
    let res;
    try {
      res = await fetchImpl(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
    } catch (e) {
      throw new GeminiError('network', String(e?.message || e), 502);
    }
    if (!res.ok) {
      const msg = await readError(res);
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new GeminiError('bad_key', msg, res.status);
      throw new GeminiError('overload', msg, res.status);
    }
    const data = await res.json();
    const list = pickModels(data.models || []);
    if (!list.length) throw new GeminiError('no_model', 'Aucun modèle Gemini Flash stable disponible pour cette clé.', 404);
    modelCache.list = list;
    modelCache.at = now();
    return list;
  }

  function extractText(json) {
    if (json?.promptFeedback?.blockReason) throw new GeminiError('blocked', `Contenu bloqué : ${json.promptFeedback.blockReason}`, 422);
    const cand = json?.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
    if (!text) {
      if (cand?.finishReason && cand.finishReason !== 'STOP') throw new GeminiError('blocked', `Réponse interrompue : ${cand.finishReason}`, 422);
      throw new GeminiError('overload', 'Réponse vide du modèle.', 502);
    }
    return text;
  }

  // payload : corps Gemini ; schema : schéma de réponse (pour le repli sans schéma)
  async function generate(payload, schema) {
    const models = (await listModels()).slice(0, 4);
    let last;
    for (const model of models) {
      let body = payload;
      let schemaDropped = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        let res;
        try {
          res = await fetchImpl(`${BASE}/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body), signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
          });
        } catch (e) {
          last = new GeminiError('network', String(e?.message || e), 502);
          if (e?.name === 'TimeoutError') break; if (attempt === 0) await sleep(1500);
          continue;
        }
        if (res.ok) return { text: extractText(await res.json()), model };
        const msg = await readError(res);
        if (res.status === 400 && !schemaDropped && schema && /schema|response_schema|responseSchema|enum|properties/i.test(msg)) {
          body = withoutSchema(payload, schema);
          schemaDropped = true;
          attempt--; // ne consomme pas la tentative
          continue;
        }
        if (res.status === 400 && body.generationConfig?.thinkingConfig && /thinking/i.test(msg)) { const { thinkingConfig, ...gc } = body.generationConfig; body = { ...body, generationConfig: gc }; payload = { ...payload, generationConfig: gc }; attempt--; continue; } if (res.status === 400 && /api key/i.test(msg)) throw new GeminiError('bad_key', msg, 400);
        if (res.status === 401 || res.status === 403) throw new GeminiError('bad_key', msg, res.status);
        if (res.status === 400) throw new GeminiError('bad_request', msg, 400);
        if (res.status === 404) {
          last = new GeminiError('no_model', `${model} : ${msg}`, 404);
          break;
        }
        if (res.status === 429) {
          last = new GeminiError('quota', msg, 429);
          break; // chaque modèle a son propre quota : on passe au suivant
        }
        if (res.status >= 500) {
          last = new GeminiError('overload', msg, res.status);
          if (attempt === 0) {
            await sleep(2000);
            continue;
          }
          break;
        }
        throw new GeminiError('bad_request', msg, res.status);
      }
    }
    modelCache.list = null;
    throw last || new GeminiError('overload', 'Échec de l’appel Gemini.', 503);
  }

  return { generate, listModels };
}
