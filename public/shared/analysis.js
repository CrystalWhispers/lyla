import { THEMES } from './prompts.js';
import { findSurface, sentenceAround, excerptAround, hash, keyOf } from './text.js';

export class AnalysisError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, n = 6, max = 80) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

export function parseModelJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(s);
  } catch {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(s.slice(a, b + 1));
      } catch {
        /* tombe sur l'erreur ci-dessous */
      }
    }
    throw new AnalysisError('bad_json', "La réponse de l'IA n'est pas un JSON valide.");
  }
}

// Valide l'analyse brute du modèle contre le texte réel : toute "surface" absente du texte est rejetée,
// et le contexte affiché est la phrase RÉELLE du texte (jamais une phrase inventée).
export function finalizeAnalysis(rawInput, text, { known = [], excerptOnly = false } = {}) {
  const raw = parseModelJson(rawInput);
  const knownKeys = new Set(known.map(keyOf));
  let dropped = 0;

  const locate = (e) => {
    return findSurface(text, e.surface) || (e.term && findSurface(text, e.term)) || null;
  };

  const ctxOf = (pos, surface) => {
    const s = sentenceAround(text, pos.start, pos.end);
    return excerptOnly ? excerptAround(s.sentence, surface, 25) : s.sentence;
  };

  const lexical = (kind, items) => {
    const seen = new Set();
    const out = [];
    for (const e of Array.isArray(items) ? items : []) {
      const term = str(e.term, 120);
      const surfaceIn = str(e.surface, 160);
      if (!term || !surfaceIn) {
        dropped++;
        continue;
      }
      const k = keyOf(term);
      if (seen.has(k) || knownKeys.has(k)) continue;
      const pos = locate({ term, surface: surfaceIn });
      if (!pos) {
        dropped++;
        continue;
      }
      seen.add(k);
      const surface = text.slice(pos.start, pos.end);
      const item = {
        id: hash(kind + '|' + k),
        kind,
        term,
        surface,
        usage: e.usage === 'passif' ? 'passif' : 'actif',
        definition_fr: str(e.definition_fr, 300),
        translation_cn: str(e.translation_cn, 200),
        exemple: str(e.exemple, 300),
        note: str(e.note, 300),
        context: ctxOf(pos, surface),
      };
      if (!excerptOnly) {
        item.start = pos.start;
        item.end = pos.end;
      }
      if (kind === 'vocab') {
        item.synonymes = list(e.synonymes, 3);
        item.famille = list(e.famille, 4);
        item.collocations = list(e.collocations, 3, 120);
      }
      if (kind === 'expression') item.collocations = list(e.collocations, 3, 120);
      if (kind === 'connecteur') item.fonction = str(e.fonction, 60);
      if (item.definition_fr) out.push(item);
      else dropped++;
    }
    return out;
  };

  const quoted = (items, fields) => {
    const out = [];
    for (const e of Array.isArray(items) ? items : []) {
      const pos = findSurface(text, str(e.surface, 300));
      if (!pos) {
        dropped++;
        continue;
      }
      let surface = text.slice(pos.start, pos.end);
      if (excerptOnly) surface = excerptAround(surface, surface, 25);
      const o = { surface };
      for (const f of fields) o[f] = str(e[f], 400);
      out.push(o);
    }
    return out;
  };

  const vocabulaire = lexical('vocab', raw.vocabulaire);
  const expressions = lexical('expression', raw.expressions);
  const connecteurs = lexical('connecteur', raw.connecteurs);
  const syntaxe = quoted(raw.syntaxe, ['structure', 'explication', 'modele']).filter((x) => x.structure && x.explication);
  const rhetorique = quoted(raw.rhetorique, ['figure', 'effet']).filter((x) => x.figure && x.effet);

  if (vocabulaire.length + expressions.length + connecteurs.length < 3) {
    throw new AnalysisError('weak_result', "L'analyse n'a pas produit assez d'éléments vérifiables dans le texte. Réessayez ou changez de texte.");
  }

  return {
    title: str(raw.title, 140) || 'Analyse',
    summary: str(raw.summary, 500),
    theme: THEMES.includes(raw.theme) ? raw.theme : 'Politique intérieure',
    vocabulaire,
    expressions,
    connecteurs,
    syntaxe,
    rhetorique,
    dropped,
  };
}

export function finalizeCorrection(rawInput) {
  const raw = parseModelJson(rawInput);
  const corrige = str(raw.corrige, 3000);
  if (!corrige) throw new AnalysisError('bad_json', "La correction est vide.");
  return {
    corrige,
    fautes: (Array.isArray(raw.fautes) ? raw.fautes : [])
      .map((f) => ({ original: str(f.original, 300), correction: str(f.correction, 300), explication: str(f.explication, 400) }))
      .filter((f) => f.original && f.correction)
      .slice(0, 6),
    version_soignee: str(raw.version_soignee, 3000),
    version_experte: str(raw.version_experte, 3000),
    retenir: (Array.isArray(raw.retenir) ? raw.retenir : [])
      .map((r) => ({
        term: str(r.term, 120),
        definition_fr: str(r.definition_fr, 300),
        translation_cn: str(r.translation_cn, 200),
        exemple: str(r.exemple, 300),
      }))
      .filter((r) => r.term && r.definition_fr)
      .slice(0, 4),
    commentaire: str(raw.commentaire, 400),
  };
}
