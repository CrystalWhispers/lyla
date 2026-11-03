// Génère la/les entrée(s) du jour : choisit un article, l'analyse avec Gemini, écrit public/data/daily/*.json.
// Usage : GEMINI_API_KEY=... node scripts/generate-daily.mjs [--dir public/data/daily] [--max 1]
import fs from 'node:fs';
import { createGemini } from '../public/shared/gemini.js';
import { ANALYZE_SCHEMA, buildAnalyzePayload } from '../public/shared/prompts.js';
import { finalizeAnalysis, parseModelJson } from '../public/shared/analysis.js';
import { countWords } from '../public/shared/text.js';
import { getText, parseFeed, discoverFeed, extractArticle, trimToWords, readIndex, writeEntry, entryId } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const DIR = args.dir || 'public/data/daily';
const MAX_AUTO = Number(args.max || 1);
const MAX_QUEUE = 2;
const MIN_WORDS = 180;
const log = (...m) => console.log('[daily]', ...m);

export async function run({ fetchImpl = fetch, gemini, now = new Date(), sourcesPath = 'sources.json', queuePath = 'queue.txt', dir = DIR, maxAuto = MAX_AUTO } = {}) {
  const date = now.toISOString().slice(0, 10);
  const index = readIndex(dir);
  const seenUrls = new Set(index.map((e) => e.url).filter(Boolean));
  const seenIds = new Set(index.map((e) => e.id));
  let made = 0;
  let errors = 0;

  async function analyzeAndStore({ url, title, text, source }) {
    const id = entryId(date, url);
    if (seenIds.has(id)) return false;
    const body = trimToWords(text, 900);
    const words = countWords(body);
    if (words < MIN_WORDS) throw new Error(`texte trop court (${words} mots)`);
    const { text: out, model } = await gemini.generate(buildAnalyzePayload(body, []), ANALYZE_SCHEMA);
    const analysis = finalizeAnalysis(parseModelJson(out), body, { excerptOnly: source.mode !== 'full' });
    const entry = {
      id,
      date,
      title: title || analysis.title,
      source: { name: source.name, url, mode: source.mode, license: source.license || '' },
      words,
      model,
      ...(source.mode === 'full' ? { text: body } : {}),
      analysis,
    };
    writeEntry(dir, entry);
    // l'URL est mémorisée dans l'index pour éviter les doublons
    const idx = readIndex(dir);
    const row = idx.find((e) => e.id === id);
    if (row) {
      row.url = url;
      fs.writeFileSync(`${dir}/index.json`, JSON.stringify(idx, null, 1) + '\n');
    }
    seenUrls.add(url);
    seenIds.add(id);
    log(`ok ${id} (${words} mots, ${analysis.vocabulaire.length}+${analysis.expressions.length}+${analysis.connecteurs.length} éléments, ${analysis.dropped} rejetés)`);
    return true;
  }

  // 1. File d'attente de l'enseignant (citations courtes uniquement)
  let queue = [];
  try {
    queue = fs
      .readFileSync(queuePath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('|')[0].trim())
      .filter((u) => /^https?:\/\//.test(u) && !seenUrls.has(u));
  } catch {
    /* pas de file */
  }
  for (const url of queue.slice(0, MAX_QUEUE)) {
    try {
      const { text: html, url: finalUrl } = await getText(url, fetchImpl);
      const art = extractArticle(html, finalUrl);
      if (!art) throw new Error('contenu illisible');
      const host = new URL(finalUrl).hostname.replace(/^www\./, '');
      if (await analyzeAndStore({ url, title: art.title, text: art.text, source: { name: host, mode: 'excerpt', license: 'Citations courtes, voir la source' } })) made++;
    } catch (e) {
      errors++;
      log(`file d'attente, échec ${url} : ${e.message}`);
    }
  }

  // 2. Sources automatiques : la moins utilisée d'abord
  const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8')).sources;
  const used = (s) => index.filter((e) => e.source === s.name).length;
  const ordered = [...sources].sort((a, b) => used(a) - used(b));
  let autoMade = 0;
  for (const s of ordered) {
    if (autoMade >= maxAuto) break;
    try {
      let feedUrl = s.feed;
      if (!feedUrl) {
        const home = await getText(s.home, fetchImpl);
        feedUrl = discoverFeed(home.text, home.url);
        if (!feedUrl) throw new Error('aucun flux RSS trouvé sur la page d’accueil');
      }
      const { text: xml } = await getText(feedUrl, fetchImpl);
      const entries = parseFeed(xml).filter((e) => !seenUrls.has(e.link));
      if (!entries.length) {
        log(`${s.id} : rien de nouveau`);
        continue;
      }
      let ok = false;
      for (const e of entries.slice(0, 6)) {
        try {
          const page = await getText(e.link, fetchImpl);
          const art = extractArticle(page.text, page.url);
          if (!art || countWords(art.text) < MIN_WORDS) { log(`${s.id} : ${e.link} trop court ou illisible (${art ? countWords(art.text) : 'null'} mots, ${page.text.length} octets)`); continue; }
          if (await analyzeAndStore({ url: e.link, title: e.title || art.title, text: art.text, source: s })) {
            ok = true;
            break;
          }
        } catch (err) {
          errors++;
          log(`${s.id} : ${e.link} ignoré (${err.message})`);
        }
      }
      if (ok) {
        autoMade++;
        made++;
      }
    } catch (e) {
      errors++;
      log(`${s.id} : échec (${e.message})`);
    }
  }
  return { made, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY manquante.');
    process.exit(1);
  }
  const gemini = createGemini({ apiKey: process.env.GEMINI_API_KEY });
  run({ gemini }).then(({ made, errors }) => {
    log(`terminé : ${made} entrée(s) créée(s), ${errors} erreur(s)`);
    // Échec visible (e-mail GitHub) seulement si rien n'a pu être produit ET qu'il y a eu des erreurs.
    if (made === 0 && errors > 0) process.exit(1);
  });
}
