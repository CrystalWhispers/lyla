import { keyOf } from '../shared/text.js';
import { newCard } from './srs.js';

const KEY = 'lyla.v1';
const defaults = () => ({ v: 1, notebook: [], known: [], history: [], settings: { rate: 0.95, voice: '', code: '', showCn: false } });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const s = JSON.parse(raw);
    const d = defaults();
    return {
      ...d,
      notebook: Array.isArray(s.notebook) ? s.notebook : [],
      known: Array.isArray(s.known) ? s.known : [],
      history: Array.isArray(s.history) ? s.history : [],
      settings: { ...d.settings, ...(s.settings || {}) },
    };
  } catch {
    return defaults();
  }
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export const hasNote = (id) => state.notebook.some((n) => n.id === id);
export const getNote = (id) => state.notebook.find((n) => n.id === id);
export const isKnown = (term) => state.known.some((k) => keyOf(k) === keyOf(term));

export function toNote(item, meta = {}) {
  return {
    id: item.id,
    kind: item.kind,
    term: item.term,
    surface: item.surface || item.term,
    usage: item.usage || 'actif',
    definition_fr: item.definition_fr || '',
    translation_cn: item.translation_cn || '',
    synonymes: item.synonymes || [],
    famille: item.famille || [],
    collocations: item.collocations || [],
    exemple: item.exemple || '',
    note: item.note || '',
    fonction: item.fonction || '',
    context: item.context || '',
    ia: Boolean(item.ia),
    theme: meta.theme || '',
    source: { title: meta.title || '', url: meta.url || '' },
    added: new Date().toISOString(),
    srs: newCard(),
  };
}

export function addNote(item, meta) {
  if (hasNote(item.id)) return false;
  state.notebook.push(toNote(item, meta));
  state.known = state.known.filter((k) => keyOf(k) !== keyOf(item.term));
  return save();
}

export function removeNote(id) {
  state.notebook = state.notebook.filter((n) => n.id !== id);
  return save();
}

export function markKnown(term) {
  if (!isKnown(term)) state.known.push(term);
  state.notebook = state.notebook.filter((n) => keyOf(n.term) !== keyOf(term));
  return save();
}

export function unmarkKnown(term) {
  state.known = state.known.filter((k) => keyOf(k) !== keyOf(term));
  return save();
}

export const knownList = () => state.known.slice(-150);

export function pushHistory(entry) {
  state.history = [entry, ...state.history.filter((h) => h.id !== entry.id)].slice(0, 8);
  return save();
}

export function exportBackup() {
  return JSON.stringify({ app: 'lyla', version: 1, exported: new Date().toISOString(), notebook: state.notebook, known: state.known, history: state.history }, null, 1);
}

// Fusionne une sauvegarde : le carnet existant garde sa progression de révision.
export function importBackup(str) {
  let data;
  try {
    data = JSON.parse(str);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde valide.");
  }
  if (data?.app !== 'lyla' || !Array.isArray(data.notebook)) throw new Error("Ce fichier n'est pas une sauvegarde de Lyla.");
  let added = 0;
  for (const n of data.notebook) {
    if (n && typeof n.id === 'string' && typeof n.term === 'string' && !hasNote(n.id)) {
      state.notebook.push({ ...n, srs: { ...newCard(), ...(n.srs || {}) } });
      added++;
    }
  }
  for (const k of Array.isArray(data.known) ? data.known : []) if (typeof k === 'string' && !isKnown(k)) state.known.push(k);
  for (const h of Array.isArray(data.history) ? data.history : []) if (h && h.id && !state.history.some((x) => x.id === h.id)) state.history.push(h);
  state.history = state.history.slice(0, 8);
  save();
  return { added, total: data.notebook.length };
}
