import { state, save, hasNote, getNote, addNote, removeNote, markKnown, unmarkKnown, isKnown, knownList, pushHistory, exportBackup, importBackup } from './store.js';
import { today, gradeCard, dueNotes, nextDue, dueLabel, isMastered, isDue, isNew } from './srs.js';
import * as api from './api.js';
import * as speech from './speech.js';
import { findSurface, makeCloze, checkAnswer, keyOf, hash, norm, stripAccents } from '../shared/text.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const KIND_LABEL = { vocab: 'Vocabulaire', expression: 'Expression', connecteur: 'Connecteur', libre: 'Atelier' };
const USAGE_LABEL = { actif: 'À utiliser', passif: 'À reconnaître' };
const TOPICS = [
  "Expliquez en quelques phrases pourquoi une banque centrale relève ses taux d'intérêt.",
  'Résumez les arguments pour et contre une hausse des impôts en période de déficit.',
  "Présentez, comme dans une revue de presse, la position d'un gouvernement face à une grève.",
  "Décrivez les risques d'une guerre commerciale entre deux grandes puissances.",
  "Expliquez ce qu'implique la dégradation de la note souveraine d'un pays.",
  "Commentez l'idée que l'Europe doit parler d'une seule voix sur la scène internationale.",
  "Expliquez pourquoi la transition énergétique est à la fois une contrainte et une opportunité.",
  "Racontez un sommet international comme si vous le présentiez à la radio.",
];

const macaron = (x, y, shell, dome) => `<g transform="translate(${x} ${y})" stroke="#2b2745" stroke-opacity=".14" stroke-width="2" stroke-linejoin="round">
    <path d="M-92 0C-92-50 92-50 92 0z" fill="${dome}"/>
    <path d="M-92 0h184" stroke="none"/>
    <path d="M-92 20C-92 52 92 52 92 20z" fill="${shell}"/>
    <rect x="-86" y="0" width="172" height="20" rx="10" fill="#fffaf2"/>
    <path d="M-60-22C-40-36-10-40 10-38" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>
  </g>`;
const MACARONS = `<svg class="macarons" viewBox="0 0 320 300" aria-hidden="true" focusable="false">${macaron(150, 250, '#f7cfe0', '#fbdbe8')}${macaron(176, 168, '#cde5f8', '#dcedfb')}${macaron(140, 86, '#e4dbf8', '#eee8fb')}</svg>`;

const ui = {
  tab: 'jour',
  prevTab: 'jour',
  ai: { state: 'checking', remaining: null },
  daily: [],
  dailyError: false,
  jourTheme: 'tous',
  analyserText: '',
  busy: '',
  reader: null,
  usageFilter: 'tous',
  shadow: { on: false, idx: 0 },
  listening: false,
  review: null,
  atelier: { text: '', targets: [], result: null, input: '' },
  carnet: { kind: 'tous', theme: 'tous', q: '' },
};

// ───────────────────────── Utilitaires ─────────────────────────
const cleanTerm = (t) => String(t).replace(/\s*\([^)]*\)/g, '').trim();
const fmtDate = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts);
};

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}

function boldIn(context, surface) {
  const pos = findSurface(context, surface);
  if (!pos) return esc(context);
  return esc(context.slice(0, pos.start)) + '<b>' + esc(context.slice(pos.start, pos.end)) + '</b>' + esc(context.slice(pos.end));
}

const ICON = {
  speaker: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 19 12h-2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
};
const speakBtn = (text, label = 'Écouter') => `<button class="icon" data-action="speak" data-text="${esc(text)}" aria-label="${label}" title="${label}">${ICON.speaker}</button>`;

// ───────────────────────── Navigation ─────────────────────────
const TABS = [
  ['jour', 'Du jour'],
  ['analyser', 'Analyser'],
  ['atelier', 'Atelier'],
  ['reviser', 'Réviser'],
  ['carnet', 'Carnet'],
];

function renderNav() {
  const due = dueNotes(state.notebook).length;
  $('#tabs').innerHTML = TABS.map(([id, label], i) => {
    const active = ui.tab === id || (ui.tab === 'lecture' && id === ui.prevTab);
    const badge = id === 'reviser' && due ? `<span class="badge" aria-label="${due} à réviser">${due}</span>` : '';
    return `<button class="tab${active ? ' on' : ''}" data-action="tab" data-tab="${id}" title="Alt+${i + 1}" ${active ? 'aria-current="page"' : ''}>${label}${badge}</button>`;
  }).join('');
  const pill = $('#ai-pill');
  const map = {
    ok: ['IA prête', 'ok'],
    code: ["Code d'accès requis", 'warn'],
    quota: ['Quota du jour épuisé', 'warn'],
    off: ['IA non configurée', 'warn'],
    offline: ['IA hors ligne', 'warn'],
    checking: ['Connexion…', ''],
  };
  const [label, cls] = map[ui.ai.state] || map.checking;
  pill.textContent = label;
  pill.className = `pill ${cls}`;
  pill.title = ui.ai.remaining != null && ui.ai.state === 'ok' ? `${ui.ai.remaining} analyses restantes aujourd'hui` : '';
}

function go(tab) {
  if (tab !== 'lecture') ui.prevTab = tab;
  else if (ui.tab !== 'lecture') ui.prevTab = ui.tab;
  speech.stop();
  ui.shadow = { on: false, idx: 0 };
  ui.tab = tab;
  render();
  window.scrollTo({ top: 0 });
  $('#main').focus({ preventScroll: true });
}

const VIEWS = {
  jour: jourView,
  analyser: analyserView,
  lecture: lectureView,
  atelier: atelierView,
  reviser: reviserView,
  carnet: carnetView,
};

function render() {
  renderNav();
  $('#main').innerHTML = VIEWS[ui.tab]();
  afterRender();
}

function afterRender() {
  if (ui.tab === 'lecture') syncReaderStates();
  if (ui.tab === 'analyser') {
    const t = $('#src');
    if (t) t.addEventListener('input', () => { ui.analyserText = t.value; $('#count').textContent = `${t.value.length} / 9000`; });
  }
  if (ui.tab === 'atelier') {
    const t = $('#atelier-text');
    if (t) t.addEventListener('input', () => { ui.atelier.text = t.value; });
  }
  if (ui.tab === 'reviser' && ui.review?.phase === 'ask') $('#answer')?.focus();
  if (ui.tab === 'reviser' && ui.review?.phase === 'revealed') $('#grade-default')?.focus();
  if (ui.tab === 'carnet') bindCarnetFilters();
}

const emptyBlock = (title, body) => `<section class="empty"><h2>${title}</h2><p>${body}</p></section>`;

// ───────────────────────── Du jour ─────────────────────────
function jourView() {
  if (ui.dailyError) return emptyBlock('La bibliothèque est introuvable', "Ouvrez le site depuis son adresse en ligne : la bibliothèque ne se charge pas depuis un fichier ouvert directement sur l'ordinateur.");
  const list = ui.daily;
  if (!list.length) return emptyBlock('La bibliothèque se remplit chaque matin', 'Le premier texte arrive demain matin. En attendant, collez un texte dans « Analyser ».');
  const first = list[0];
  const themes = [...new Set(list.map((e) => e.theme))];
  const rows = (ui.jourTheme === 'tous' ? list.slice(1) : list.filter((e) => e.theme === ui.jourTheme))
    .map(
      (e) => `<li><button class="row" data-action="open-daily" data-id="${esc(e.id)}">
        <span class="row-date">${esc(fmtDate(e.date, { day: 'numeric', month: 'short' }))}</span>
        <span class="row-title">${esc(e.title)}</span>
        <span class="row-src">${esc(e.source)}</span>
        <span class="chip">${esc(e.theme)}</span>
        <span class="row-count">${e.count} éléments</span></button></li>`,
    )
    .join('');
  return `
  <section class="hero">
    ${MACARONS}
    <div class="hero-text">
      <p class="hero-date">${esc(fmtDate(first.date))}</p>
      <h2>${esc(first.title)}</h2>
      <p class="lead">${esc(first.summary)}</p>
      <div class="hero-actions">
        <button class="primary" data-action="open-daily" data-id="${esc(first.id)}">Lire et analyser</button>
        <span class="hero-src">${esc(first.source)} — ${esc(first.theme)}, ${first.words} mots</span>
      </div>
    </div>
  </section>
  <section class="library">
    <div class="library-head">
      <h3>Dans la bibliothèque</h3>
      <div class="chips" role="group" aria-label="Filtrer par thème">
        <button class="chip-btn${ui.jourTheme === 'tous' ? ' on' : ''}" data-action="jour-filter" data-theme="tous">Tous</button>
        ${themes.map((t) => `<button class="chip-btn${ui.jourTheme === t ? ' on' : ''}" data-action="jour-filter" data-theme="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>
    ${rows ? `<ul class="rows">${rows}</ul>` : '<p class="muted">Aucun texte pour ce thème pour le moment.</p>'}
  </section>`;
}

async function loadDaily() {
  try {
    const res = await fetch('data/daily/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    ui.daily = await res.json();
    ui.dailyError = false;
  } catch {
    ui.dailyError = true;
  }
  if (ui.tab === 'jour') render();
}

async function openDaily(id) {
  try {
    const res = await fetch(`data/daily/${encodeURIComponent(id)}.json`);
    if (!res.ok) throw new Error(res.status);
    const e = await res.json();
    openReader({ id: e.id, kind: 'daily', date: e.date, title: e.title, theme: e.analysis.theme, text: e.text || '', analysis: e.analysis, source: e.source });
  } catch {
    toast("Impossible de charger ce texte.", 'error');
  }
}

// ───────────────────────── Analyser ─────────────────────────
function aiNote() {
  const m = {
    code: "Saisissez le code d'accès dans les réglages pour utiliser l'IA.",
    quota: "Le quota gratuit de l'IA est épuisé pour aujourd'hui. Les textes du jour et les révisions restent disponibles.",
    off: "L'IA n'est pas encore configurée sur ce site.",
    offline: "L'IA est injoignable pour le moment. Les textes du jour et les révisions restent disponibles.",
  };
  return m[ui.ai.state] ? `<p class="note-warn">${m[ui.ai.state]}</p>` : '';
}

function analyserView() {
  const busy = ui.busy === 'analyse';
  const hist = state.history.length
    ? `<ul class="rows compact">${state.history
        .map((h) => `<li><button class="row" data-action="open-history" data-id="${esc(h.id)}"><span class="row-date">${esc(fmtDate(h.date, { day: 'numeric', month: 'short' }))}</span><span class="row-title">${esc(h.title)}</span><span class="chip">${esc(h.theme)}</span></button></li>`)
        .join('')}</ul>`
    : '<p class="muted">Vos analyses apparaîtront ici.</p>';
  return `
  <section class="split">
    <div class="compose">
      <h2>Analyser un texte</h2>
      <p class="lead">Collez un extrait d'article, de discours ou de communiqué, de 200 à 800 mots. Le texte est envoyé à l'IA pour l'analyse ; rien d'autre ne quitte votre navigateur.</p>
      <label class="sr" for="src">Texte à analyser</label>
      <textarea id="src" rows="14" maxlength="9000" placeholder="Collez ici un texte en français…" ${busy ? 'disabled' : ''}>${esc(ui.analyserText)}</textarea>
      <div class="bar">
        <span id="count" class="muted">${ui.analyserText.length} / 9000</span>
        <button class="primary" data-action="analyze" ${busy || ui.ai.state !== 'ok' ? 'disabled' : ''}>${busy ? 'Analyse en cours…' : 'Analyser le texte'}</button>
      </div>
      ${busy ? '<p class="muted" role="status">L\'analyse prend en général entre 10 et 40 secondes.</p>' : ''}
      ${aiNote()}
    </div>
    <aside class="history"><h3>Analyses récentes</h3>${hist}</aside>
  </section>`;
}

async function doAnalyze() {
  const text = ($('#src')?.value ?? ui.analyserText).trim();
  ui.analyserText = text;
  if (text.length < 40) return toast('Collez un texte plus long (au moins quelques phrases).', 'error');
  ui.busy = 'analyse';
  render();
  try {
    const r = await api.analyze(text, knownList());
    const entry = { id: 'own-' + hash(String(Date.now()) + text.slice(0, 40)), kind: 'own', date: today(), title: r.analysis.title, theme: r.analysis.theme, text: r.text, analysis: r.analysis, source: { name: 'Texte collé', url: '', mode: 'full' } };
    if (!pushHistory(entry)) toast("L'espace de stockage du navigateur est plein : cette analyse ne sera pas conservée.", 'error');
    ui.busy = '';
    openReader(entry);
    refreshHealth();
  } catch (e) {
    ui.busy = '';
    handleApiError(e);
    render();
  }
}

function handleApiError(e) {
  if (e.code === 'code') {
    ui.ai.state = 'code';
    openSettings(true);
    toast("Code d'accès manquant ou incorrect.", 'error');
  } else {
    if (e.code === 'quota' || e.code === 'quota_daily') ui.ai.state = 'quota';
    toast(e.message || 'Erreur inattendue.', 'error');
  }
}

// ───────────────────────── Lecture ─────────────────────────
function openReader(entry) {
  ui.reader = entry;
  ui.usageFilter = 'tous';
  go('lecture');
}

function allItems(a) {
  return [...a.vocabulaire, ...a.expressions, ...a.connecteurs];
}

function splitSentences(text) {
  const out = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    if (i >= n) break;
    let j = i;
    while (j < n) {
      const c = text[j];
      if (c === '\n') break;
      j++;
      if ('.!?…'.includes(c)) {
        while (j < n && /["»”)]/.test(text[j])) j++;
        if (j >= n || /\s/.test(text[j])) break;
      }
    }
    out.push({ start: i, end: j });
    i = j;
  }
  return out;
}

function sheetHTML(text, items) {
  const sents = splitSentences(text);
  const marks = items.filter((m) => Number.isInteger(m.start)).sort((a, b) => a.start - b.start || b.end - a.end);
  const clean = [];
  let last = -1;
  for (const m of marks) if (m.start >= last) (clean.push(m), (last = m.end));
  let html = '<p>';
  let prevEnd = 0;
  let mi = 0;
  sents.forEach((s, idx) => {
    const gap = text.slice(prevEnd, s.start);
    if (idx > 0) html += gap.includes('\n') ? '</p><p>' : ' ';
    html += `<span class="s" data-s="${idx}">`;
    let pos = s.start;
    while (mi < clean.length && clean[mi].start < s.end) {
      const m = clean[mi++];
      if (m.start < pos) continue;
      const end = Math.min(m.end, s.end);
      html += `${esc(text.slice(pos, m.start))}<mark class="m kind-${m.kind}" data-action="focus-note" data-id="${esc(m.id)}" tabindex="0">${esc(text.slice(m.start, end))}</mark>`;
      pos = end;
    }
    html += esc(text.slice(pos, s.end)) + '</span>';
    prevEnd = s.end;
  });
  return html + '</p>';
}

function noteHTML(it) {
  const col = it.collocations?.length ? `<p class="meta"><span>Souvent avec</span> ${it.collocations.map(esc).join(' ; ')}</p>` : '';
  const syn = it.synonymes?.length ? `<p class="meta"><span>Synonymes</span> ${it.synonymes.map(esc).join(', ')}</p>` : '';
  const fam = it.famille?.length ? `<p class="meta"><span>Famille</span> ${it.famille.map(esc).join(', ')}</p>` : '';
  const fn = it.fonction ? `<span class="chip soft">${esc(it.fonction)}</span>` : '';
  return `
  <article class="note kind-${it.kind}" data-id="${esc(it.id)}" data-usage="${it.usage}">
    <header>
      <button class="term" data-action="focus-mark" data-id="${esc(it.id)}">${esc(it.term)}</button>
      ${fn}<span class="usage ${it.usage}">${USAGE_LABEL[it.usage]}</span>
      ${speakBtn(it.surface, 'Écouter ' + esc(it.surface))}
    </header>
    <p class="def">${esc(it.definition_fr)}</p>
    <p class="cnrow"><button class="link" data-action="cn" aria-expanded="${state.settings.showCn}">中文</button><span class="cn"${state.settings.showCn ? '' : ' hidden'}>${esc(it.translation_cn)}</span></p>
    ${col}${syn}${fam}
    <p class="ctx">« ${boldIn(it.context, it.surface)} » ${speakBtn(it.context, 'Écouter la phrase')}</p>
    ${it.exemple ? `<p class="ex"><span>Exemple (IA)</span> ${esc(it.exemple)} ${speakBtn(it.exemple, "Écouter l'exemple")}</p>` : ''}
    ${it.note ? `<p class="warn">${esc(it.note)}</p>` : ''}
    <footer>
      <button class="chip-btn" data-action="note-save" data-id="${esc(it.id)}" aria-pressed="false">Ajouter au carnet</button>
      <button class="chip-btn" data-action="note-known" data-id="${esc(it.id)}" aria-pressed="false">Je connaissais</button>
    </footer>
  </article>`;
}

function lectureView() {
  const r = ui.reader;
  if (!r) return emptyBlock('Aucun texte ouvert', 'Choisissez un texte dans « Du jour » ou collez-en un dans « Analyser ».');
  const a = r.analysis;
  const items = allItems(a);
  const hasText = Boolean(r.text);
  const src = r.source?.url ? `<a href="${esc(r.source.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source.name)}</a>` : esc(r.source?.name || '');
  const lic = r.source?.license ? `<span class="muted"> — ${esc(r.source.license)}</span>` : '';
  const sheet = hasText
    ? `<div class="sheet-body" id="sheet">${sheetHTML(r.text, items)}</div>`
    : `<div class="sheet-body" id="sheet"><p class="muted">Le texte intégral n'est pas reproduit ici : lisez-le sur la source${r.source?.url ? ` (<a href="${esc(r.source.url)}" target="_blank" rel="noopener noreferrer">ouvrir l'article</a>)` : ''}. Les extraits ci-contre viennent de cet article.</p></div>`;
  const section = (title, arr, extra = '') => (arr.length ? `<section class="notes"><h3>${title}</h3>${extra}${arr.map(noteHTML).join('')}</section>` : '');
  const syntax = a.syntaxe.length
    ? `<details class="notes" open><summary><h3>Constructions à imiter</h3></summary>${a.syntaxe
        .map((s) => `<article class="note kind-syntaxe"><p class="term-plain">${esc(s.structure)}</p><p class="ctx">« ${esc(s.surface)} » ${speakBtn(s.surface, 'Écouter')}</p><p class="def">${esc(s.explication)}</p>${s.modele ? `<p class="ex"><span>À imiter</span> ${esc(s.modele)} ${speakBtn(s.modele, 'Écouter')}</p>` : ''}</article>`)
        .join('')}</details>`
    : '';
  const rhet = a.rhetorique.length
    ? `<details class="notes"><summary><h3>Procédés d'écriture</h3></summary>${a.rhetorique.map((x) => `<article class="note kind-rhet"><p class="term-plain">${esc(x.figure)}</p><p class="ctx">« ${esc(x.surface)} »</p><p class="def">${esc(x.effet)}</p></article>`).join('')}</details>`
    : '';
  const shadowBar = ui.shadow.on
    ? `<div class="shadowbar"><button class="chip-btn" data-action="shadow-prev">Précédente</button><button class="primary small" data-action="shadow-play">Écouter la phrase ${ui.shadow.idx + 1}</button><button class="chip-btn" data-action="shadow-next">Suivante</button><span class="muted">Écoutez, répétez à voix haute, puis passez à la suivante (← → Espace).</span></div>`
    : '';
  return `
  <section class="reader">
    <div class="reader-head">
      <button class="link back" data-action="back">Retour</button>
      <h2>${esc(r.title)}</h2>
      <p class="lead">${esc(a.summary)}</p>
      <p class="muted">${esc(a.theme)} — ${src}${lic}</p>
    </div>
    <div class="reader-grid">
      <div class="sheet">
        <div class="sheet-tools">
          <button class="chip-btn" data-action="listen-all" ${hasText ? '' : 'disabled'}>${ui.listening ? 'Arrêter la lecture' : 'Écouter le texte'}</button>
          <button class="chip-btn${ui.shadow.on ? ' on' : ''}" data-action="shadow-toggle" ${hasText ? '' : 'disabled'}>Phrase par phrase</button>
          <button class="chip-btn" data-action="copy-fiche">Copier la fiche</button>
        </div>
        ${shadowBar}
        ${sheet}
        <p class="legend"><span class="m kind-vocab">vocabulaire</span> <span class="m kind-expression">expression</span> <span class="m kind-connecteur">connecteur</span></p>
      </div>
      <div class="margin" data-usage-filter="${ui.usageFilter}">
        <div class="margin-tools" role="group" aria-label="Filtrer les entrées">
          ${[['tous', 'Tout'], ['actif', 'À utiliser'], ['passif', 'À reconnaître']].map(([v, l]) => `<button class="chip-btn${ui.usageFilter === v ? ' on' : ''}" data-action="usage-filter" data-v="${v}">${l}</button>`).join('')}
        </div>
        ${section('Vocabulaire', a.vocabulaire)}
        ${section('Expressions et collocations', a.expressions)}
        ${section('Connecteurs', a.connecteurs)}
        ${syntax}${rhet}
      </div>
    </div>
  </section>`;
}

function itemById(id) {
  return ui.reader ? allItems(ui.reader.analysis).find((i) => i.id === id) : null;
}

function syncReaderStates() {
  $$('.note[data-id]').forEach((n) => {
    const it = itemById(n.dataset.id);
    if (!it) return;
    const saved = hasNote(it.id);
    const known = isKnown(it.term);
    n.classList.toggle('is-saved', saved);
    n.classList.toggle('is-known', known);
    const b1 = $('[data-action="note-save"]', n);
    const b2 = $('[data-action="note-known"]', n);
    b1.textContent = saved ? 'Dans le carnet' : 'Ajouter au carnet';
    b1.setAttribute('aria-pressed', saved);
    b1.classList.toggle('on', saved);
    b2.textContent = known ? 'Déjà connu' : 'Je connaissais';
    b2.setAttribute('aria-pressed', known);
    b2.classList.toggle('on', known);
  });
  $$('mark.m[data-id]').forEach((m) => {
    const it = itemById(m.dataset.id);
    if (!it) return;
    m.classList.toggle('is-saved', hasNote(it.id));
    m.classList.toggle('is-known', isKnown(it.term));
  });
}

function flash(el) {
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

function noteMeta() {
  const r = ui.reader;
  return { theme: r.analysis.theme, title: r.title, url: r.source?.url || '' };
}

function ficheText() {
  const r = ui.reader;
  const a = r.analysis;
  const L = [`${r.title}`, a.summary, ''];
  const sec = (name, arr) => {
    if (!arr.length) return;
    L.push(name.toUpperCase());
    arr.forEach((i) => L.push(`• ${i.term} — ${i.definition_fr} (${i.translation_cn})\n  « ${i.context} »`));
    L.push('');
  };
  sec('Vocabulaire', a.vocabulaire);
  sec('Expressions', a.expressions);
  sec('Connecteurs', a.connecteurs);
  if (a.syntaxe.length) {
    L.push('CONSTRUCTIONS');
    a.syntaxe.forEach((s) => L.push(`• ${s.structure} : « ${s.surface} »\n  ${s.explication}`));
  }
  return L.join('\n');
}

function listenAll() {
  if (ui.listening) {
    speech.stop();
    ui.listening = false;
    $$('.s.reading').forEach((s) => s.classList.remove('reading'));
    return render();
  }
  if (!speech.canSpeak) return toast('La lecture à voix haute n’est pas disponible dans ce navigateur.', 'error');
  const sents = splitSentences(ui.reader.text);
  ui.listening = true;
  speech.speakQueue(
    sents.map((s) => ui.reader.text.slice(s.start, s.end)),
    {
      rate: state.settings.rate,
      voice: state.settings.voice,
      onPart: (i) => {
        $$('.s.reading').forEach((s) => s.classList.remove('reading'));
        const el = $(`.s[data-s="${i}"]`);
        el?.classList.add('reading');
        el?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      },
      onEnd: () => {
        ui.listening = false;
        if (ui.tab === 'lecture') render();
      },
    },
  );
  render();
}

function shadowGo(delta) {
  const n = splitSentences(ui.reader.text).length;
  ui.shadow.idx = Math.max(0, Math.min(n - 1, ui.shadow.idx + delta));
  markShadow();
  shadowPlay();
}
function markShadow() {
  $$('.s.current').forEach((s) => s.classList.remove('current'));
  const el = $(`.s[data-s="${ui.shadow.idx}"]`);
  el?.classList.add('current');
  el?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  const btn = $('[data-action="shadow-play"]');
  if (btn) btn.textContent = `Écouter la phrase ${ui.shadow.idx + 1}`;
}
function shadowPlay() {
  const s = splitSentences(ui.reader.text)[ui.shadow.idx];
  if (!s) return;
  if (!speech.canSpeak) return toast('La lecture à voix haute n’est pas disponible dans ce navigateur.', 'error');
  speech.speak(ui.reader.text.slice(s.start, s.end), { rate: state.settings.rate, voice: state.settings.voice });
}

// ───────────────────────── Atelier ─────────────────────────
function suggestTargets() {
  const due = dueNotes(state.notebook).filter((n) => n.kind !== 'libre' || true);
  const rest = [...state.notebook].sort((a, b) => (a.added < b.added ? 1 : -1));
  const seen = new Set();
  return [...due, ...rest].filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))).slice(0, 6);
}

function atelierView() {
  const A = ui.atelier;
  const busy = ui.busy === 'atelier';
  const sugg = suggestTargets();
  const targets = sugg.length
    ? `<div class="targets"><p class="muted">Mots de votre carnet à placer dans le texte (facultatif) :</p><div class="chips">${sugg.map((n) => `<button class="chip-btn${A.targets.includes(n.id) ? ' on' : ''}" data-action="atelier-target" data-id="${esc(n.id)}" aria-pressed="${A.targets.includes(n.id)}">${esc(cleanTerm(n.term))}</button>`).join('')}</div></div>`
    : '<p class="muted">Quand votre carnet contiendra des mots, vous pourrez choisir ici ceux à placer dans votre texte.</p>';
  return `
  <section class="split">
    <div class="compose">
      <h2>Atelier d'expression</h2>
      <p class="lead">Écrivez ou dictez quelques phrases sur un sujet d'actualité. L'IA les corrige, puis les reformule à deux niveaux de langue. Vous comparez avec votre propre version, c'est là que les expressions s'ancrent.</p>
      <label class="sr" for="atelier-text">Votre texte</label>
      <textarea id="atelier-text" rows="8" maxlength="2500" placeholder="${esc(A.input || 'Choisissez un sujet ci-dessous ou écrivez librement…')}" ${busy ? 'disabled' : ''}>${esc(A.text)}</textarea>
      <div class="bar">
        <button class="chip-btn mic${ui.listeningMic ? ' on' : ''}" data-action="atelier-mic" ${speech.canListen ? '' : 'disabled title="La dictée vocale demande Chrome ou Edge"'}>${ICON.mic} ${ui.listeningMic ? 'Arrêter la dictée' : 'Dicter'}</button>
        <button class="chip-btn" data-action="atelier-topic">Proposer un sujet</button>
        <button class="primary" data-action="atelier-correct" ${busy || ui.ai.state !== 'ok' ? 'disabled' : ''}>${busy ? 'Correction en cours…' : 'Corriger et enrichir'}</button>
      </div>
      ${A.input ? `<p class="topic">Sujet : ${esc(A.input)}</p>` : ''}
      ${targets}
      ${aiNote()}
    </div>
    <div class="result" id="atelier-result">${A.result ? atelierResult() : '<p class="muted">La correction s\'affichera ici.</p>'}</div>
  </section>`;
}

function atelierResult() {
  const { r, used } = ui.atelier.result;
  const fautes = r.fautes.length
    ? `<ul class="fixes">${r.fautes.map((f) => `<li><s>${esc(f.original)}</s> <b>${esc(f.correction)}</b><span>${esc(f.explication)}</span></li>`).join('')}</ul>`
    : '<p class="muted">Aucune faute relevée.</p>';
  const usedHtml = used.length ? `<p class="muted">Mots du carnet : ${used.map((u) => `<span class="chip ${u.ok ? 'okc' : ''}">${esc(u.term)} ${u.ok ? '— présent' : '— absent'}</span>`).join(' ')}</p>` : '';
  const ret = r.retenir.length
    ? `<h3>À retenir</h3>${r.retenir.map((x, i) => `<article class="note kind-libre"><header><span class="term-plain">${esc(x.term)}</span>${speakBtn(cleanTerm(x.term), 'Écouter')}</header><p class="def">${esc(x.definition_fr)}</p><p class="cnrow"><button class="link" data-action="cn" aria-expanded="${state.settings.showCn}">中文</button><span class="cn"${state.settings.showCn ? '' : ' hidden'}>${esc(x.translation_cn)}</span></p><p class="ex"><span>Exemple (IA)</span> ${esc(x.exemple)} ${speakBtn(x.exemple, 'Écouter')}</p><footer><button class="chip-btn${hasNote(retenirId(x)) ? ' on' : ''}" data-action="atelier-save" data-i="${i}">${hasNote(retenirId(x)) ? 'Dans le carnet' : 'Ajouter au carnet'}</button></footer></article>`).join('')}`
    : '';
  return `
    <p class="verdict">${esc(r.commentaire)}</p>
    ${usedHtml}
    <h3>Votre texte corrigé</h3>
    <p class="serif-block">${esc(r.corrige)} ${speakBtn(r.corrige, 'Écouter')}</p>
    ${fautes}
    <h3>Version soignée</h3>
    <p class="serif-block">${esc(r.version_soignee)} ${speakBtn(r.version_soignee, 'Écouter')}</p>
    <h3>Version experte</h3>
    <p class="serif-block">${esc(r.version_experte)} ${speakBtn(r.version_experte, 'Écouter')}</p>
    ${ret}`;
}

const retenirId = (x) => hash('libre|' + keyOf(x.term));

async function doCorrect() {
  const text = ($('#atelier-text')?.value ?? ui.atelier.text).trim();
  ui.atelier.text = text;
  if (text.length < 40) return toast('Écrivez au moins deux ou trois phrases.', 'error');
  stopMic();
  ui.busy = 'atelier';
  render();
  const targetNotes = ui.atelier.targets.map(getNote).filter(Boolean);
  try {
    const { result } = await api.correct(text, targetNotes.map((n) => cleanTerm(n.term)));
    const used = targetNotes.map((n) => {
      const t = cleanTerm(n.term);
      const stem = norm(stripAccents(t.split(' ')[0]), true).slice(0, Math.max(4, t.split(' ')[0].length - 3));
      return { term: t, ok: Boolean(findSurface(text, t)) || norm(stripAccents(text), true).includes(stem) };
    });
    ui.atelier.result = { r: result, used };
    ui.busy = '';
    render();
    refreshHealth();
  } catch (e) {
    ui.busy = '';
    handleApiError(e);
    render();
  }
}

let mic = null;
function stopMic() {
  if (mic) {
    try {
      mic.stop();
    } catch {
      /* déjà arrêté */
    }
    mic = null;
  }
  ui.listeningMic = false;
}
function toggleMic() {
  if (ui.listeningMic) {
    stopMic();
    return render();
  }
  const ta = $('#atelier-text');
  const base = ta.value ? ta.value.trimEnd() + ' ' : '';
  ui.listeningMic = true;
  mic = speech.listen({
    onText: (fin, interim) => {
      const t = $('#atelier-text');
      if (t) {
        t.value = base + fin + interim;
        ui.atelier.text = t.value;
      }
    },
    onEnd: () => {
      if (ui.listeningMic) {
        ui.listeningMic = false;
        mic = null;
        if (ui.tab === 'atelier') render();
      }
    },
    onError: (err) => {
      toast(err === 'not-allowed' ? "Autorisez l'accès au micro dans le navigateur." : `Dictée interrompue (${err}).`, 'error');
    },
  });
  render();
}

// ───────────────────────── Réviser ─────────────────────────
function reviserView() {
  const R = ui.review;
  const due = dueNotes(state.notebook);
  if (!R) {
    if (!state.notebook.length) return emptyBlock('Votre carnet est vide', "Ouvrez un texte dans « Du jour », puis ajoutez au carnet les mots et expressions que vous voulez retenir. Ils reviendront ici au bon moment.");
    if (!due.length) {
      const nd = nextDue(state.notebook);
      return emptyBlock('Rien à réviser pour le moment', nd ? `Prochaine révision : ${dueLabel(nd)}. Profitez-en pour lire un nouveau texte.` : 'Revenez demain.');
    }
    const nNew = due.filter(isNew).length;
    return `<section class="review-start"><h2>${due.length} à réviser</h2><p class="lead">${nNew} nouveau${nNew > 1 ? 'x' : ''}, ${due.length - nNew} à revoir. Chaque carte est une phrase du texte d'origine avec un trou : écrivez le mot, puis évaluez-vous honnêtement.</p><button class="primary" data-action="review-start">Commencer (${Math.min(20, due.length)} cartes)</button><p class="muted">Clavier : Entrée pour valider, 1 / 2 / 3 pour évaluer.</p></section>`;
  }
  if (R.phase === 'done') {
    const nd = nextDue(state.notebook);
    return `<section class="review-start"><h2>Séance terminée</h2><p class="lead">${R.stats.good} retenu${R.stats.good > 1 ? 's' : ''}, ${R.stats.again} à revoir sur ${R.total} cartes.${nd ? ` Prochaine révision : ${dueLabel(nd)}.` : ''}</p><button class="primary" data-action="review-end">Terminer</button></section>`;
  }
  return `<section class="review" id="review-stage">${reviewCard()}</section>`;
}

function reviewAnswers(n, cz) {
  return [cz?.answer, n.surface, cleanTerm(n.term)].filter(Boolean);
}

function reviewCard() {
  const R = ui.review;
  const n = getNote(R.queue[R.idx]);
  const cz = n.context ? makeCloze(n.context, n.surface) : null;
  const answer = (cz?.answer || cleanTerm(n.term));
  const asked = R.phase === 'ask';
  const progress = `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${R.total}" aria-valuenow="${R.done}"><i style="width:${(R.done / R.total) * 100}%"></i></div><p class="muted">Carte ${Math.min(R.done + 1, R.total)} sur ${R.total}, ${KIND_LABEL[n.kind] || ''}</p>`;
  let q;
  if (cz) {
    const blank = asked ? `<span class="blank" style="min-width:${Math.max(4, answer.length)}ch"></span>` : `<span class="filled ${R.result === 'no' ? 'bad' : 'good'}">${esc(answer)}</span>`;
    q = `<p class="cloze">${esc(cz.before)}${blank}${esc(cz.after)}</p>`;
  } else {
    q = `<p class="cloze">${asked ? '<span class="blank" style="min-width:12ch"></span>' : `<span class="filled ${R.result === 'no' ? 'bad' : 'good'}">${esc(answer)}</span>`}</p>`;
  }
  const hint = `<p class="hint">${esc(n.definition_fr)} <span class="muted">(${answer.length} lettres, commence par « ${esc(answer[0] || '')} »)</span></p>`;
  if (asked) {
    return `${progress}${q}${hint}
      <form data-form="review-check"><label class="sr" for="answer">Votre réponse</label><input id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Écrivez le mot ou l'expression"><button class="primary" type="submit">Valider</button></form>
      <p class="muted">Entrée sans réponse pour voir la solution.</p>`;
  }
  const msg = { exact: 'Exact.', accent: `Juste, mais vérifiez l'orthographe : « ${esc(answer)} ».`, no: `Réponse attendue : « ${esc(answer)} ».` }[R.result];
  const defGrade = R.result === 'no' ? 1 : 2;
  const gl = [[1, 'Encore'], [2, 'Bien'], [3, 'Facile']];
  return `${progress}${q}
    <p class="verdict ${R.result}">${msg}</p>
    <p class="def">${esc(n.definition_fr)} ${speakBtn(n.context || answer, 'Écouter')}</p>
    <p class="cnrow"><button class="link" data-action="cn" aria-expanded="${state.settings.showCn}">中文</button><span class="cn"${state.settings.showCn ? '' : ' hidden'}>${esc(n.translation_cn)}</span></p>
    ${n.exemple ? `<p class="ex"><span>Exemple (IA)</span> ${esc(n.exemple)}</p>` : ''}
    <div class="grades">${gl.map(([g, l]) => `<button class="grade${g === defGrade ? ' default' : ''}" ${g === defGrade ? 'id="grade-default"' : ''} data-action="review-grade" data-g="${g}"><b>${l}</b><span>${g} — ${g === 1 ? "aujourd'hui" : dueLabel(gradeCard(n.srs, g).due)}</span></button>`).join('')}</div>`;
}

function startReview() {
  const queue = dueNotes(state.notebook).slice(0, 20).map((n) => n.id);
  ui.review = { queue, idx: 0, phase: 'ask', result: '', done: 0, total: queue.length, stats: { good: 0, again: 0 }, requeued: {} };
  render();
}

function checkReview(value) {
  const R = ui.review;
  const n = getNote(R.queue[R.idx]);
  const cz = n.context ? makeCloze(n.context, n.surface) : null;
  R.result = checkAnswer(value, ...reviewAnswers(n, cz));
  R.phase = 'revealed';
  render();
}

function gradeReview(g) {
  const R = ui.review;
  const n = getNote(R.queue[R.idx]);
  n.srs = gradeCard(n.srs, g);
  if (g === 1) {
    R.stats.again++;
    const k = (R.requeued[n.id] = (R.requeued[n.id] || 0) + 1);
    if (k <= 2) R.queue.push(n.id);
    else R.done++;
  } else {
    R.stats.good++;
    R.done++;
  }
  save();
  R.idx++;
  R.phase = R.idx >= R.queue.length ? 'done' : 'ask';
  R.result = '';
  if (R.phase === 'done') R.done = R.total;
  render();
}

// ───────────────────────── Carnet ─────────────────────────
function filteredNotes() {
  const { kind, theme, q } = ui.carnet;
  const needle = stripAccents(q.toLowerCase());
  return [...state.notebook]
    .filter((n) => (kind === 'tous' || n.kind === kind) && (theme === 'tous' || n.theme === theme))
    .filter((n) => !needle || stripAccents(`${n.term} ${n.definition_fr} ${n.translation_cn}`.toLowerCase()).includes(needle))
    .sort((a, b) => (a.added < b.added ? 1 : -1));
}

function carnetList() {
  const list = filteredNotes();
  if (!list.length) return '<p class="muted">Aucun élément ne correspond.</p>';
  return `<ul class="entries">${list
    .map(
      (n) => `<li class="entry kind-${n.kind}">
      <div class="entry-main">
        <p class="entry-term">${esc(n.term)} <span class="chip soft">${KIND_LABEL[n.kind] || ''}</span></p>
        <p class="def">${esc(n.definition_fr)}</p>
        <p class="cnrow"><button class="link" data-action="cn" aria-expanded="${state.settings.showCn}">中文</button><span class="cn"${state.settings.showCn ? '' : ' hidden'}>${esc(n.translation_cn)}</span></p>
        ${n.context ? `<p class="ctx">« ${boldIn(n.context, n.surface)} »</p>` : ''}
      </div>
      <div class="entry-side"><span class="muted">Révision : ${dueLabel(n.srs.due)}</span>${speakBtn(n.surface || n.term, 'Écouter')}<button class="link danger" data-action="carnet-delete" data-id="${esc(n.id)}" aria-label="Retirer ${esc(n.term)}">Retirer</button></div>
    </li>`,
    )
    .join('')}</ul>`;
}

function carnetView() {
  const nb = state.notebook;
  if (!nb.length) return emptyBlock('Votre carnet est vide', `Dans un texte, utilisez « Ajouter au carnet » sur les entrées à retenir. Si vous avez une sauvegarde, importez-la depuis les <button class="link" data-action="settings-open">réglages</button>.`);
  const mastered = nb.filter(isMastered).length;
  const due = nb.filter((n) => isDue(n)).length;
  const themes = [...new Set(nb.map((n) => n.theme).filter(Boolean))];
  return `
  <section class="carnet">
    <div class="carnet-head">
      <div><h2>Carnet</h2><p class="lead">${nb.length} élément${nb.length > 1 ? 's' : ''}, dont ${mastered} bien installé${mastered > 1 ? 's' : ''} en mémoire et ${due} à réviser aujourd'hui.</p></div>
      <div class="carnet-actions"><button class="chip-btn" data-action="export-csv">Exporter en CSV</button><button class="chip-btn" data-action="backup-export">Sauvegarde</button></div>
    </div>
    <div class="filters">
      <label class="sr" for="carnet-q">Rechercher</label>
      <input id="carnet-q" type="search" placeholder="Rechercher un mot, une définition…" value="${esc(ui.carnet.q)}">
      <select id="carnet-kind" aria-label="Type">${[['tous', 'Tous les types'], ['vocab', 'Vocabulaire'], ['expression', 'Expressions'], ['connecteur', 'Connecteurs'], ['libre', 'Atelier']].map(([v, l]) => `<option value="${v}"${ui.carnet.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select id="carnet-theme" aria-label="Thème"><option value="tous">Tous les thèmes</option>${themes.map((t) => `<option${ui.carnet.theme === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
    </div>
    <div id="carnet-list">${carnetList()}</div>
  </section>`;
}

function bindCarnetFilters() {
  const upd = () => ($('#carnet-list').innerHTML = carnetList());
  $('#carnet-q')?.addEventListener('input', (e) => { ui.carnet.q = e.target.value; upd(); });
  $('#carnet-kind')?.addEventListener('change', (e) => { ui.carnet.kind = e.target.value; upd(); });
  $('#carnet-theme')?.addEventListener('change', (e) => { ui.carnet.theme = e.target.value; upd(); });
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function exportCsv() {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['Type', 'Terme', 'Définition', 'Traduction', 'Contexte', 'Prochaine révision'], ...state.notebook.map((n) => [KIND_LABEL[n.kind] || n.kind, n.term, n.definition_fr, n.translation_cn, n.context, n.srs.due])];
  download(`carnet-lyla-${today()}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

// ───────────────────────── Réglages ─────────────────────────
function openSettings(focusCode = false) {
  const d = $('#settings');
  const sel = $('#set-voice');
  const voices = speech.frenchVoices();
  sel.innerHTML = `<option value="">Voix par défaut</option>` + voices.map((v) => `<option value="${esc(v.name)}"${state.settings.voice === v.name ? ' selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  $('#set-rate').value = state.settings.rate;
  $('#set-cn').checked = state.settings.showCn;
  $('#set-code').value = state.settings.code || '';
  $('#set-known').textContent = `${state.known.length} mot${state.known.length > 1 ? 's' : ''} marqué${state.known.length > 1 ? 's' : ''} « je connaissais »`;
  if (!d.open) d.showModal();
  if (focusCode) $('#set-code').focus();
}

// ───────────────────────── Santé de l'API ─────────────────────────
async function refreshHealth() {
  try {
    const h = await api.health();
    ui.ai.remaining = h.remaining;
    if (!h.ai) ui.ai.state = 'off';
    else if (h.needsCode && !state.settings.code) ui.ai.state = 'code';
    else if (h.remaining === 0) ui.ai.state = 'quota';
    else ui.ai.state = 'ok';
  } catch {
    ui.ai.state = 'offline';
  }
  renderNav();
  if (ui.tab === 'analyser' || ui.tab === 'atelier') {
    const keepA = ui.analyserText;
    const keepB = ui.atelier.text;
    ui.analyserText = $('#src')?.value ?? keepA;
    ui.atelier.text = $('#atelier-text')?.value ?? keepB;
    render();
  }
}

// ───────────────────────── Actions ─────────────────────────
const ACTIONS = {
  tab: (el) => go(el.dataset.tab),
  back: () => go(ui.prevTab || 'jour'),
  'jour-filter': (el) => { ui.jourTheme = el.dataset.theme; render(); },
  'open-daily': (el) => openDaily(el.dataset.id),
  'open-history': (el) => {
    const h = state.history.find((x) => x.id === el.dataset.id);
    if (h) openReader(h);
  },
  analyze: doAnalyze,
  'usage-filter': (el) => {
    ui.usageFilter = el.dataset.v;
    $('.margin').dataset.usageFilter = ui.usageFilter;
    $$('.margin-tools .chip-btn').forEach((b) => b.classList.toggle('on', b.dataset.v === ui.usageFilter));
  },
  'note-save': (el) => {
    const it = itemById(el.dataset.id);
    if (!it) return;
    if (hasNote(it.id)) removeNote(it.id);
    else if (!addNote(it, noteMeta())) return toast("Stockage du navigateur plein ou indisponible : l'élément n'a pas été enregistré.", 'error');
    syncReaderStates();
    renderNav();
  },
  'note-known': (el) => {
    const it = itemById(el.dataset.id);
    if (!it) return;
    if (isKnown(it.term)) unmarkKnown(it.term);
    else markKnown(it.term);
    syncReaderStates();
    renderNav();
  },
  'focus-note': (el) => {
    const n = $(`.note[data-id="${CSS.escape(el.dataset.id)}"]`);
    n?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    flash(n);
  },
  'focus-mark': (el) => {
    const m = $(`mark.m[data-id="${CSS.escape(el.dataset.id)}"]`);
    if (!m) return;
    m.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    flash(m);
  },
  cn: (el) => {
    const span = el.nextElementSibling;
    span.hidden = !span.hidden;
    el.setAttribute('aria-expanded', !span.hidden);
  },
  speak: (el) => {
    if (!speech.canSpeak) return toast('La lecture à voix haute n’est pas disponible dans ce navigateur.', 'error');
    speech.speak(el.dataset.text, { rate: state.settings.rate, voice: state.settings.voice });
  },
  'listen-all': listenAll,
  'shadow-toggle': () => {
    ui.shadow.on = !ui.shadow.on;
    ui.shadow.idx = 0;
    speech.stop();
    ui.listening = false;
    render();
    if (ui.shadow.on) markShadow();
  },
  'shadow-prev': () => shadowGo(-1),
  'shadow-next': () => shadowGo(1),
  'shadow-play': shadowPlay,
  'copy-fiche': async () => {
    try {
      await navigator.clipboard.writeText(ficheText());
      toast('Fiche copiée.', 'ok');
    } catch {
      toast('Copie impossible : autorisez le presse-papiers.', 'error');
    }
  },
  'atelier-target': (el) => {
    const id = el.dataset.id;
    const A = ui.atelier;
    A.targets = A.targets.includes(id) ? A.targets.filter((x) => x !== id) : [...A.targets, id].slice(0, 6);
    el.classList.toggle('on', A.targets.includes(id));
    el.setAttribute('aria-pressed', A.targets.includes(id));
  },
  'atelier-topic': () => {
    const cur = ui.atelier.input;
    const pool = TOPICS.filter((t) => t !== cur);
    ui.atelier.text = $('#atelier-text')?.value ?? ui.atelier.text;
    ui.atelier.input = pool[Math.floor(Math.random() * pool.length)];
    render();
  },
  'atelier-mic': toggleMic,
  'atelier-correct': doCorrect,
  'atelier-save': (el) => {
    const x = ui.atelier.result.r.retenir[Number(el.dataset.i)];
    if (!x) return;
    const id = retenirId(x);
    if (hasNote(id)) removeNote(id);
    else {
      const surf = findSurface(x.exemple, cleanTerm(x.term));
      const surface = surf ? x.exemple.slice(surf.start, surf.end) : cleanTerm(x.term);
      addNote({ id, kind: 'libre', term: x.term, surface, usage: 'actif', definition_fr: x.definition_fr, translation_cn: x.translation_cn, exemple: '', context: x.exemple, ia: true }, { theme: '', title: "Atelier d'expression", url: '' });
    }
    $('#atelier-result').innerHTML = atelierResult();
    renderNav();
  },
  'review-start': startReview,
  'review-grade': (el) => gradeReview(Number(el.dataset.g)),
  'review-end': () => { ui.review = null; render(); },
  'carnet-delete': (el) => {
    removeNote(el.dataset.id);
    render();
  },
  'export-csv': exportCsv,
  'backup-export': () => download(`sauvegarde-lyla-${today()}.json`, exportBackup(), 'application/json'),
  'settings-open': () => openSettings(),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  ACTIONS[el.dataset.action]?.(el, e);
});

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.form === 'review-check') checkReview($('#answer').value);
});

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.altKey && /^[1-5]$/.test(e.key)) {
    e.preventDefault();
    return go(TABS[Number(e.key) - 1][0]);
  }
  if (e.key === 'Escape') speech.stop();
  if (e.target.matches?.('mark.m') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    return ACTIONS['focus-note'](e.target);
  }
  if (ui.tab === 'reviser' && ui.review?.phase === 'revealed' && !typing) {
    if (['1', '2', '3'].includes(e.key)) return gradeReview(Number(e.key));
    if (e.key === 'Enter' && e.target.id !== 'grade-default' && !e.target.closest('button')) {
      e.preventDefault();
      return gradeReview(ui.review.result === 'no' ? 1 : 2);
    }
  }
  if (ui.tab === 'lecture' && ui.shadow.on && !typing) {
    if (e.key === 'ArrowRight') return (e.preventDefault(), shadowGo(1));
    if (e.key === 'ArrowLeft') return (e.preventDefault(), shadowGo(-1));
    if (e.key === ' ' && !e.target.closest('button')) return (e.preventDefault(), shadowPlay());
  }
});

// Réglages
$('#settings').addEventListener('click', (e) => {
  if (e.target.id === 'settings' || e.target.closest('[data-close]')) $('#settings').close();
});
$('#set-voice').addEventListener('change', (e) => { state.settings.voice = e.target.value; save(); });
$('#set-rate').addEventListener('input', (e) => { state.settings.rate = Number(e.target.value); save(); });
$('#set-cn').addEventListener('change', (e) => { state.settings.showCn = e.target.checked; save(); });
$('#set-code').addEventListener('change', (e) => { state.settings.code = e.target.value.trim(); save(); refreshHealth(); });
$('#set-test').addEventListener('click', () => speech.speak('Bonjour, je suis votre voix de lecture.', { rate: state.settings.rate, voice: state.settings.voice }));
$('#set-backup').addEventListener('click', () => download(`sauvegarde-lyla-${today()}.json`, exportBackup(), 'application/json'));
$('#set-import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const r = importBackup(await f.text());
    toast(`${r.added} élément${r.added > 1 ? 's' : ''} importé${r.added > 1 ? 's' : ''} sur ${r.total}.`, 'ok');
    $('#settings').close();
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
  e.target.value = '';
});
$('#set-reset-known').addEventListener('click', () => {
  state.known = [];
  save();
  $('#set-known').textContent = '0 mot marqué « je connaissais »';
  toast('Liste des mots connus vidée.', 'ok');
});

// ───────────────────────── Démarrage ─────────────────────────
render();
loadDaily();
refreshHealth();

// Exposé pour les tests de bout en bout.
window.__lyla = { ui, state, render };
