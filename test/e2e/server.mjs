// Serveur de test : fichiers statiques + /api/* via le vrai handler, avec un faux Gemini.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handle } from '../../public/shared/handler.js';

const ROOT = path.resolve(new URL('../../public/', import.meta.url).pathname);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const MODELS = { models: [{ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] };

export const mode = { gemini: 'ok', quota: false };
const TEXT_ANALYSIS = (text) => ({
  title: 'Texte collé', summary: 'Résumé.', theme: 'Commerce international',
  vocabulaire: [{ term: 'engrenage (m.)', surface: 'engrenage', usage: 'actif', definition_fr: 'Enchaînement dont on ne s’échappe plus.', translation_cn: '连锁升级', exemple: 'Un engrenage de représailles.' }, { term: 'inventé', surface: 'motabsent', usage: 'actif', definition_fr: 'x', translation_cn: 'y' }],
  expressions: [{ term: 'en dernier recours', surface: 'en dernier recours', usage: 'actif', definition_fr: 'Quand tout a échoué.', translation_cn: '最后手段' }],
  connecteurs: [{ term: 'reste que', surface: 'Reste que', usage: 'actif', definition_fr: 'Restriction.', translation_cn: '问题是', fonction: 'restriction' }],
  syntaxe: [], rhetorique: [],
});
const CORR = { corrige: 'Le gouvernement a décidé de réduire les dépenses.', fautes: [{ original: 'decidé', correction: 'décidé', explication: 'Accent aigu.' }], version_soignee: 'Le gouvernement a arrêté un plan de réduction des dépenses.', version_experte: 'L’exécutif a acté une trajectoire de maîtrise de la dépense publique.', retenir: [{ term: 'maîtrise de la dépense (f.)', definition_fr: 'Contrôle des dépenses publiques.', translation_cn: '支出管控', exemple: 'La maîtrise de la dépense est un impératif.' }], commentaire: 'Bonne base, travaillez les collocations.' };

const fakeFetch = async (url, opt) => {
  const J = (st, b) => ({ ok: st < 300, status: st, json: async () => b });
  if (url.includes('/models?')) return J(200, MODELS);
  if (mode.gemini === 'quota') return J(429, { error: { message: 'quota' } });
  const body = JSON.parse(opt.body);
  const prompt = body.contents[0].parts[0].text;
  const out = prompt.includes('TEXTE DE L') ? CORR : TEXT_ANALYSIS(prompt);
  await new Promise((r) => setTimeout(r, 400));
  return J(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] }, finishReason: 'STOP' }] });
};

const kvm = new Map();
export const env = { GEMINI_API_KEY: 'K', ACCESS_CODE: 'sesame', DAILY_CAP: '50', QUOTA: { get: async (k) => kvm.get(k) ?? null, put: async (k, v) => void kvm.set(k, v) } };

export function start(port = 8788) {
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), env, { fetch: fakeFetch, sleep: async () => {} });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(await r.text());
    }
    let p = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!p.startsWith(ROOT) || /\/(site|worker|node_modules)\//.test(p) && !p.includes('/shared/')) { res.writeHead(404); return res.end(); }
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
