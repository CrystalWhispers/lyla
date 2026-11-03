import test from 'node:test';
import assert from 'node:assert/strict';
import { findSurface, sentenceAround, excerptAround, makeCloze, checkAnswer, keyOf } from '../public/shared/text.js';
import { finalizeAnalysis, finalizeCorrection, AnalysisError } from '../public/shared/analysis.js';
import { createGemini, pickModels, GeminiError } from '../public/shared/gemini.js';
import { handle } from '../public/shared/handler.js';

const TEXT =
  "Face à la surenchère protectionniste, le Gouvernement n'entend nullement céder à l'attentisme. Il s'agit de sceller sans délai un pacte de souveraineté industrielle. Cette réindustrialisation ne saurait être un vœu pieux : elle exige la mobilisation de nos capitaux publics.";

test('findSurface: mot entier, insensible à la casse et à l’apostrophe typographique', () => {
  const i = TEXT.indexOf('surenchère protectionniste');
  assert.deepEqual(findSurface(TEXT, 'surenchère protectionniste'), { start: i, end: i + 'surenchère protectionniste'.length });
  assert.ok(findSurface(TEXT, "n’entend nullement"));
  assert.equal(findSurface(TEXT, 'attent'), null, 'pas de correspondance au milieu d’un mot');
  assert.equal(findSurface(TEXT, 'inexistant'), null);
});

test('findSurface: repli sans accents', () => {
  assert.ok(findSurface(TEXT, 'surenchere protectionniste'));
  assert.ok(findSurface('Un arbitrage budgétaire', 'arbitrage budgetaire'));
});

test('sentenceAround renvoie la vraie phrase', () => {
  const p = findSurface(TEXT, 'sceller sans délai');
  const s = sentenceAround(TEXT, p.start, p.end);
  assert.equal(s.sentence, 'Il s\'agit de sceller sans délai un pacte de souveraineté industrielle.');
});

test('excerptAround limite à 25 mots et garde la forme', () => {
  const long = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(' ') + ' arbitrage ' + Array.from({ length: 60 }, (_, i) => `fin${i}`).join(' ');
  const e = excerptAround(long, 'arbitrage', 25);
  assert.ok(e.split(/\s+/).length <= 27);
  assert.ok(e.includes('arbitrage'));
});

test('makeCloze et checkAnswer', () => {
  const c = makeCloze('Il faut sceller sans délai un pacte.', 'sceller');
  assert.equal(c.before, 'Il faut ');
  assert.equal(c.answer, 'sceller');
  assert.equal(checkAnswer('sceller', 'sceller'), 'exact');
  assert.equal(checkAnswer('Réindustrialisation', 'reindustrialisation'), 'accent');
  assert.equal(checkAnswer('sceler', 'sceller'), 'no');
  assert.equal(checkAnswer('', 'x'), 'no');
});

const RAW = {
  title: 'Souveraineté industrielle',
  summary: 'Deux phrases.',
  theme: 'Économie & finances publiques',
  vocabulaire: [
    { term: 'attentisme (m.)', surface: 'attentisme', usage: 'actif', definition_fr: 'Attitude qui consiste à attendre.', translation_cn: '观望主义', synonymes: ['immobilisme'], famille: ['attendre'], collocations: ['céder à l’attentisme'] },
    { term: 'inventé', surface: 'mot absent du texte', usage: 'actif', definition_fr: 'x', translation_cn: 'y' },
    { term: 'capitaux publics (m.)', surface: 'capitaux publics', usage: 'actif', definition_fr: 'Argent public.', translation_cn: '公共资本' },
  ],
  expressions: [{ term: 'sceller un pacte', surface: 'sceller sans délai un pacte', usage: 'actif', definition_fr: 'Conclure solennellement.', translation_cn: '缔结' }],
  connecteurs: [{ term: 'il s’agit de', surface: "Il s'agit de", usage: 'actif', definition_fr: 'Introduit un objectif.', translation_cn: '问题在于', fonction: 'but' }],
  syntaxe: [{ surface: 'ne saurait être un vœu pieux', structure: 'saurait (conditionnel de pouvoir, négation)', explication: 'Négation littéraire.' }, { surface: 'phrase introuvable', structure: 'a', explication: 'b' }],
  rhetorique: [{ surface: 'vœu pieux', figure: 'Lexicalisation', effet: 'Rejette l’idée de simple souhait.' }],
};

test('finalizeAnalysis: rejette les surfaces inventées, extrait le vrai contexte, applique known', () => {
  const a = finalizeAnalysis(RAW, TEXT, { known: ['les capitaux publics'] });
  assert.equal(a.vocabulaire.length, 1);
  assert.equal(a.vocabulaire[0].term, 'attentisme (m.)');
  assert.equal(a.vocabulaire[0].context.startsWith('Face à la surenchère'), true);
  assert.equal(typeof a.vocabulaire[0].start, 'number');
  assert.equal(a.expressions.length, 1);
  assert.equal(a.connecteurs[0].surface, "Il s'agit de");
  assert.equal(a.syntaxe.length, 1);
  assert.equal(a.dropped >= 2, true);
});

test('finalizeAnalysis: mode extrait, pas d’indices ni de contexte long', () => {
  const a = finalizeAnalysis(RAW, TEXT, { excerptOnly: true });
  assert.equal(a.vocabulaire[0].start, undefined);
  assert.ok(a.vocabulaire[0].context.split(/\s+/).length <= 27);
});

test('finalizeAnalysis: résultat trop faible => erreur', () => {
  assert.throws(() => finalizeAnalysis({ title: 't', vocabulaire: [{ term: 'x', surface: 'zzz' }] }, TEXT), (e) => e instanceof AnalysisError && e.code === 'weak_result');
});

test('finalizeAnalysis: JSON entouré de balises', () => {
  const a = finalizeAnalysis('```json\n' + JSON.stringify(RAW) + '\n```', TEXT);
  assert.equal(a.title, 'Souveraineté industrielle');
});

test('finalizeCorrection', () => {
  const c = finalizeCorrection({ corrige: 'ok', fautes: [{ original: 'a', correction: 'b', explication: 'c' }, { original: '', correction: 'b' }], version_soignee: 's', version_experte: 'e', retenir: [{ term: 't', definition_fr: 'd', translation_cn: 'z', exemple: 'x' }], commentaire: 'k' });
  assert.equal(c.fautes.length, 1);
  assert.equal(c.retenir.length, 1);
});

// ---- Gemini ----
const MODELS = {
  models: [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
  ],
};

test('pickModels: stable uniquement, plus récent d’abord, lite après, alias en dernier', () => {
  assert.deepEqual(pickModels(MODELS.models), ['gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']);
});

function fakeFetch(script) {
  const calls = [];
  const f = async (url, opt) => {
    calls.push(url.replace('https://generativelanguage.googleapis.com/v1beta', ''));
    const r = script(url, opt, calls);
    return { ok: r.status < 300, status: r.status, json: async () => r.body };
  };
  f.calls = calls;
  return f;
}
const OKBODY = { candidates: [{ content: { parts: [{ text: '{"ok":1}' }] }, finishReason: 'STOP' }] };
const mk = (f) => createGemini({ apiKey: 'K', fetchImpl: f, sleep: async () => {}, modelCache: { list: null, at: 0 } });

test('gemini: cas nominal', async () => {
  const f = fakeFetch((u) => (u.includes('/models?') ? { status: 200, body: MODELS } : { status: 200, body: OKBODY }));
  const r = await mk(f).generate({}, null);
  assert.equal(r.model, 'gemini-3-flash');
});

test('gemini: 503 => réessaie puis passe au modèle suivant', async () => {
  const f = fakeFetch((u) => {
    if (u.includes('/models?')) return { status: 200, body: MODELS };
    if (u.includes('gemini-3-flash:')) return { status: 503, body: { error: { message: 'high demand' } } };
    return { status: 200, body: OKBODY };
  });
  const r = await mk(f).generate({}, null);
  assert.equal(r.model, 'gemini-2.5-flash');
  assert.equal(f.calls.filter((c) => c.includes('gemini-3-flash:')).length, 2);
});

test('gemini: 429 => modèle suivant sans réessayer; quota partout => erreur quota', async () => {
  const f = fakeFetch((u) => (u.includes('/models?') ? { status: 200, body: MODELS } : { status: 429, body: { error: { message: 'quota' } } }));
  await assert.rejects(mk(f).generate({}, null), (e) => e instanceof GeminiError && e.code === 'quota');
  assert.equal(f.calls.length, 1 + 4);
});

test('gemini: clé invalide => erreur immédiate', async () => {
  const f = fakeFetch((u) => (u.includes('/models?') ? { status: 200, body: MODELS } : { status: 400, body: { error: { message: 'API key not valid' } } }));
  await assert.rejects(mk(f).generate({}, null), (e) => e.code === 'bad_key');
  assert.equal(f.calls.length, 2);
});

test('gemini: schéma refusé => repli sans schéma sur le même modèle', async () => {
  const bodies = [];
  const f = fakeFetch((u, opt) => {
    if (u.includes('/models?')) return { status: 200, body: MODELS };
    const b = JSON.parse(opt.body);
    bodies.push(b);
    if (b.generationConfig?.responseSchema) return { status: 400, body: { error: { message: 'Invalid JSON payload: responseSchema' } } };
    return { status: 200, body: OKBODY };
  });
  const payload = { contents: [{ parts: [{ text: 'x' }] }], generationConfig: { responseSchema: { type: 'OBJECT', properties: { a: { type: 'STRING' } } } } };
  const r = await mk(f).generate(payload, payload.generationConfig.responseSchema);
  assert.equal(r.model, 'gemini-3-flash');
  assert.equal(bodies.length, 2);
  assert.ok(bodies[1].contents[0].parts[0].text.includes('JSON valide'));
});

test('gemini: ignore les parties "thought"', async () => {
  const f = fakeFetch((u) => (u.includes('/models?') ? { status: 200, body: MODELS } : { status: 200, body: { candidates: [{ content: { parts: [{ thought: true, text: 'réflexion' }, { text: '{"a":1}' }] }, finishReason: 'STOP' }] } }));
  const r = await mk(f).generate({}, null);
  assert.equal(r.text, '{"a":1}');
});

// ---- Handler ----
const req = (path, { method = 'POST', body, headers = {} } = {}) =>
  new Request('https://lyla.pages.dev' + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });

const geminiOk = (payload) =>
  fakeFetch((u) => (u.includes('/models?') ? { status: 200, body: MODELS } : { status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] } }));

function kv() {
  const m = new Map();
  return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), m };
}

test('handler: health', async () => {
  const r = await handle(req('/api/health', { method: 'GET' }), { GEMINI_API_KEY: 'K', ACCESS_CODE: 'abc' });
  const j = await r.json();
  assert.deepEqual([j.ai, j.needsCode], [true, true]);
});

test('handler: code d’accès requis', async () => {
  const env = { GEMINI_API_KEY: 'K', ACCESS_CODE: 'abc' };
  const r = await handle(req('/api/analyze', { body: { text: TEXT } }), env, { fetch: geminiOk(RAW) });
  assert.equal(r.status, 401);
  const r2 = await handle(req('/api/analyze', { body: { text: TEXT }, headers: { 'x-access-code': 'abc' } }), env, { fetch: geminiOk(RAW) });
  assert.equal(r2.status, 200);
  const j = await r2.json();
  assert.equal(j.analysis.vocabulaire[0].term, 'attentisme (m.)');
});

test('handler: origine étrangère refusée', async () => {
  const r = await handle(req('/api/analyze', { body: { text: TEXT }, headers: { Origin: 'https://evil.example' } }), { GEMINI_API_KEY: 'K' }, { fetch: geminiOk(RAW) });
  assert.equal(r.status, 403);
});

test('handler: plafond quotidien', async () => {
  const env = { GEMINI_API_KEY: 'K', DAILY_CAP: '2', QUOTA: kv() };
  const f = geminiOk(RAW);
  assert.equal((await handle(req('/api/analyze', { body: { text: TEXT } }), env, { fetch: f })).status, 200);
  assert.equal((await handle(req('/api/analyze', { body: { text: TEXT } }), env, { fetch: f })).status, 200);
  const r = await handle(req('/api/analyze', { body: { text: TEXT } }), env, { fetch: f });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'quota_daily');
});

test('handler: validations d’entrée', async () => {
  const env = { GEMINI_API_KEY: 'K' };
  assert.equal((await handle(req('/api/analyze', { body: { text: 'court' } }), env)).status, 400);
  assert.equal((await handle(req('/api/analyze', { body: { text: 'x'.repeat(9500) } }), env)).status, 413);
  assert.equal((await handle(req('/api/correct', { body: { text: 'x'.repeat(2600) } }), env)).status, 413);
  assert.equal((await handle(req('/api/nope', { body: {} }), env)).status, 404);
  assert.equal((await handle(req('/api/analyze', { body: { text: TEXT } }), {})).status, 503);
});

test('handler: erreurs Gemini converties en messages français', async () => {
  const f = fakeFetch((u) => (u.includes('/models?') ? { status: 200, body: MODELS } : { status: 429, body: { error: { message: 'quota' } } }));
  const r = await handle(req('/api/analyze', { body: { text: TEXT } }), { GEMINI_API_KEY: 'K' }, { fetch: f, sleep: async () => {} });
  assert.equal(r.status, 429);
  assert.match((await r.json()).message, /quota gratuit/);
});

test('handler: correction', async () => {
  const f = geminiOk({ corrige: 'Texte.', fautes: [], version_soignee: 'a', version_experte: 'b', retenir: [], commentaire: 'c' });
  const r = await handle(req('/api/correct', { body: { text: 'Le gouvernement a decidé de réduire les dépenses.', targets: ['arbitrage'] } }), { GEMINI_API_KEY: 'K' }, { fetch: f });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).result.corrige, 'Texte.');
});

test('handler: Gemini injoignable (liste des modèles) => 502 réseau, pas 500', async () => {
  const f = async () => { throw new TypeError('fetch failed'); };
  const r = await handle(req('/api/analyze', { body: { text: TEXT } }), { GEMINI_API_KEY: 'K' }, { fetch: f, sleep: async () => {} });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error, 'network');
});

test('keyOf', () => {
  assert.equal(keyOf('Attentisme (m.)'), keyOf('l’attentisme'));
  assert.equal(keyOf('un arbitrage (m.)'), 'arbitrage');
});
