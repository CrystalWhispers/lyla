import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../scripts/generate-daily.mjs';
import { parseFeed, discoverFeed, extractArticle } from '../scripts/lib.mjs';

const PARA = [
  "Face à la surenchère protectionniste, le Gouvernement n'entend nullement céder à l'attentisme et prépare un plan d'investissement ambitieux pour les années à venir.",
  "Il s'agit de sceller sans délai un pacte de souveraineté industrielle, garant de nos arbitrages budgétaires, et de redonner de la marge de manœuvre aux entreprises du pays.",
  "Toutefois, la réindustrialisation ne saurait être un vœu pieux : elle exige la mobilisation de nos capitaux publics et une simplification drastique des normes réglementaires qui pèsent sur les investisseurs.",
];
const body = Array.from({ length: 4 }, () => PARA.join(' ')).join('</p><p>');
const ARTICLE = `<html><head><title>Plan industriel</title></head><body><nav>Menu</nav><article><h1>Plan industriel</h1><p>${body}</p><p>${body}</p></article><footer>Pied</footer></body></html>`;
const HOME = '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml"></head><body></body></html>';
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Plan industriel</title><link>https://exemple.fr/a1</link><pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate></item><item><title>Autre</title><link>https://exemple.fr/a2</link></item></channel></rss>`;
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title><link rel="alternate" href="https://exemple.fr/z"/><updated>2026-10-26T08:00:00Z</updated></entry></feed>`;

const ANALYSIS = {
  title: 'Souveraineté industrielle',
  summary: 'Le gouvernement annonce un plan.',
  theme: 'Économie & finances publiques',
  vocabulaire: [
    { term: 'attentisme (m.)', surface: 'attentisme', usage: 'actif', definition_fr: 'Attitude qui consiste à attendre.', translation_cn: '观望' },
    { term: 'réindustrialisation (f.)', surface: 'réindustrialisation', usage: 'actif', definition_fr: 'Retour de l’industrie.', translation_cn: '再工业化' },
  ],
  expressions: [{ term: 'sceller un pacte', surface: 'sceller sans délai un pacte', usage: 'actif', definition_fr: 'Conclure solennellement.', translation_cn: '缔结' }],
  connecteurs: [{ term: 'toutefois', surface: 'Toutefois', usage: 'actif', definition_fr: 'Marque une restriction.', translation_cn: '然而', fonction: 'restriction' }],
  syntaxe: [],
  rhetorique: [],
};

function mockFetch(map) {
  return async (url) => {
    const hit = map[url];
    if (hit === undefined) return { ok: false, status: 404, url, text: async () => '' };
    return { ok: true, status: 200, url, text: async () => hit };
  };
}
const gemini = { generate: async () => ({ text: JSON.stringify(ANALYSIS), model: 'gemini-test' }) };

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lyla-'));
  const src = path.join(d, 'sources.json');
  fs.writeFileSync(src, JSON.stringify({ sources: [{ id: 's', name: 'Source test', home: 'https://exemple.fr/', feed: null, mode: 'full', license: 'test' }] }));
  fs.writeFileSync(path.join(d, 'queue.txt'), '# commentaire\n');
  return { d, src, q: path.join(d, 'queue.txt'), dir: path.join(d, 'daily') };
}

test('parseFeed: RSS et Atom', () => {
  assert.equal(parseFeed(RSS).length, 2);
  assert.equal(parseFeed(RSS)[0].link, 'https://exemple.fr/a1');
  assert.equal(parseFeed(ATOM)[0].link, 'https://exemple.fr/z');
});

test('discoverFeed', () => {
  assert.equal(discoverFeed(HOME, 'https://exemple.fr/'), 'https://exemple.fr/rss.xml');
});

test('extractArticle: texte principal sans menu ni pied de page', () => {
  const a = extractArticle(ARTICLE, 'https://exemple.fr/a1');
  assert.ok(a.text.includes('surenchère protectionniste'));
  assert.ok(!a.text.includes('Menu'));
});

test('run: découverte du flux, analyse, écriture, pas de doublon', async () => {
  const t = tmp();
  const f = mockFetch({ 'https://exemple.fr/': HOME, 'https://exemple.fr/rss.xml': RSS, 'https://exemple.fr/a1': ARTICLE, 'https://exemple.fr/a2': ARTICLE });
  const r1 = await run({ fetchImpl: f, gemini, now: new Date('2026-10-29T00:17:00Z'), sourcesPath: t.src, queuePath: t.q, dir: t.dir });
  assert.equal(r1.made, 1);
  const idx = JSON.parse(fs.readFileSync(path.join(t.dir, 'index.json'), 'utf8'));
  assert.equal(idx.length, 1);
  assert.equal(idx[0].url, 'https://exemple.fr/a1');
  const entry = JSON.parse(fs.readFileSync(path.join(t.dir, idx[0].id + '.json'), 'utf8'));
  assert.ok(entry.text.includes('attentisme'));
  assert.equal(typeof entry.analysis.vocabulaire[0].start, 'number');
  // 2e passage : a1 déjà vu => a2
  const r2 = await run({ fetchImpl: f, gemini, now: new Date('2026-10-30T00:17:00Z'), sourcesPath: t.src, queuePath: t.q, dir: t.dir });
  assert.equal(r2.made, 1);
  const idx2 = JSON.parse(fs.readFileSync(path.join(t.dir, 'index.json'), 'utf8'));
  assert.deepEqual(idx2.map((e) => e.url), ['https://exemple.fr/a2', 'https://exemple.fr/a1']);
});

test('run: file d’attente => extraits courts, pas de texte intégral', async () => {
  const t = tmp();
  fs.writeFileSync(t.q, '# x\nhttps://presse.example/article-1 | Énergie\n');
  const f = mockFetch({ 'https://presse.example/article-1': ARTICLE, 'https://exemple.fr/': HOME });
  const r = await run({ fetchImpl: f, gemini, now: new Date('2026-10-29T00:17:00Z'), sourcesPath: t.src, queuePath: t.q, dir: t.dir, maxAuto: 0 });
  assert.equal(r.made, 1);
  const idx = JSON.parse(fs.readFileSync(path.join(t.dir, 'index.json'), 'utf8'));
  const entry = JSON.parse(fs.readFileSync(path.join(t.dir, idx[0].id + '.json'), 'utf8'));
  assert.equal(entry.text, undefined);
  assert.equal(entry.source.mode, 'excerpt');
  assert.ok(entry.analysis.vocabulaire.every((v) => v.start === undefined && v.context.split(/\s+/).length <= 27));
});

test('run: flux en erreur => compté, pas de crash', async () => {
  const t = tmp();
  const r = await run({ fetchImpl: mockFetch({}), gemini, now: new Date('2026-10-29T00:17:00Z'), sourcesPath: t.src, queuePath: t.q, dir: t.dir });
  assert.deepEqual([r.made, r.errors > 0], [0, true]);
});
