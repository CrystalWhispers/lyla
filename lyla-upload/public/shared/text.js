// Utilitaires texte partagés (navigateur, Pages Function, scripts Node).
// Toutes les fonctions de recherche travaillent sur un texte normalisé 1 caractère -> 1 caractère,
// ce qui garantit que les indices trouvés valent aussi pour le texte original.

function normUnit(c, loose) {
  if (/\s/.test(c)) return ' ';
  if (c === '’' || c === '‘' || c === 'ʼ' || c === '`') return "'";
  let l = c.toLowerCase();
  if (l.length !== 1) l = c;
  if (loose) {
    const d = l.normalize('NFD');
    if (d.length > 0) l = d[0];
  }
  return l;
}

export function norm(text, loose = false) {
  let out = '';
  for (let i = 0; i < text.length; i++) out += normUnit(text[i], loose);
  return out;
}

const isLetter = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

// Cherche `surface` dans `text` comme mot(s) entier(s). Retourne {start,end} ou null.
export function findSurface(text, surface, from = 0) {
  const s = String(surface || '').trim();
  if (s.length < 2 || !text) return null;
  for (const loose of [false, true]) {
    const T = norm(text, loose);
    const S = norm(s, loose);
    let i = T.indexOf(S, from);
    while (i >= 0) {
      const before = i > 0 ? T[i - 1] : '';
      const after = i + S.length < T.length ? T[i + S.length] : '';
      if (!isLetter(before) && !isLetter(after)) return { start: i, end: i + S.length };
      i = T.indexOf(S, i + 1);
    }
  }
  return null;
}

const TERMINATORS = new Set(['.', '!', '?', '…', '\n']);

// Phrase du texte qui contient [start,end[.
export function sentenceAround(text, start, end) {
  let a = start;
  while (a > 0 && !TERMINATORS.has(text[a - 1])) a--;
  let b = end;
  while (b < text.length && !TERMINATORS.has(text[b])) b++;
  if (b < text.length) b++;
  let sentence = text.slice(a, b);
  const lead = sentence.length - sentence.trimStart().length;
  a += lead;
  sentence = sentence.trim();
  if (sentence.length > 360) {
    const ws = Math.max(a, start - 150);
    const we = Math.min(text.length, end + 150);
    sentence = '… ' + text.slice(ws, we).trim() + ' …';
    return { sentence, start: ws, end: we };
  }
  return { sentence, start: a, end: a + sentence.length };
}

// Extrait court (en mots) autour de la forme, pour les sources non réutilisables en intégralité.
export function excerptAround(sentence, surface, maxWords = 25) {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return sentence;
  const pos = findSurface(sentence, surface);
  const idx = pos ? sentence.slice(0, pos.start).split(/\s+/).filter(Boolean).length : 0;
  let from = Math.max(0, idx - Math.floor((maxWords - 3) / 2));
  let to = Math.min(words.length, from + maxWords);
  from = Math.max(0, to - maxWords);
  return (from > 0 ? '… ' : '') + words.slice(from, to).join(' ') + (to < words.length ? ' …' : '');
}

// Texte à trou : remplace la première occurrence de `surface` dans `context`.
export function makeCloze(context, surface) {
  const pos = findSurface(context, surface);
  if (!pos) return null;
  return {
    before: context.slice(0, pos.start),
    answer: context.slice(pos.start, pos.end),
    after: context.slice(pos.end),
  };
}

export function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function cleanAnswer(s) {
  return String(s)
    .toLowerCase()
    .replace(/[’‘ʼ`]/g, "'")
    .replace(/[.,;:!?«»"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 'exact' | 'accent' (juste, mais accents/ligature différents) | 'no'
export function checkAnswer(given, ...expected) {
  const g = cleanAnswer(given);
  if (!g) return 'no';
  const variants = expected.filter(Boolean).map(cleanAnswer);
  if (variants.includes(g)) return 'exact';
  const loose = (x) => stripAccents(x).replace(/œ/g, 'oe');
  if (variants.some((v) => loose(v) === loose(g))) return 'accent';
  return 'no';
}

export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function keyOf(term) {
  let s = String(term).replace(/\((?:m|f|m\.|f\.|m\/f|nm|nf|pl\.?)\)/gi, ' ');
  s = cleanAnswer(s).replace(/^(?:(?:un|une|le|la|les|des|du)\s+|l')/, '');
  return stripAccents(s).replace(/\s+/g, ' ').trim();
}

export function countWords(text) {
  return (String(text).match(/[\p{L}\p{N}'’-]+/gu) || []).length;
}
