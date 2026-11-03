import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { hash, countWords } from '../public/shared/text.js';

export const UA = 'Mozilla/5.0 (compatible; LylaDailyBot/1.0; +https://github.com)';

export async function getText(url, fetchImpl = fetch, timeout = 25000) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,application/atom+xml,application/rss+xml;q=0.9,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return { text: await res.text(), url: res.url || url };
}

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const val = (v) => (v && typeof v === 'object' ? v['#text'] ?? '' : v ?? '');

export function parseFeed(xml) {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
  const doc = p.parse(xml);
  const out = [];
  if (doc.rss?.channel) {
    for (const it of asArray(doc.rss.channel.item)) {
      const link = String(val(it.link) || val(it.guid)).trim();
      if (link) out.push({ title: String(val(it.title)).trim(), link, date: it.pubDate ? new Date(it.pubDate) : null });
    }
  } else if (doc.feed) {
    for (const e of asArray(doc.feed.entry)) {
      const links = asArray(e.link);
      const l = links.find((x) => x['@_rel'] === 'alternate') || links[0];
      const link = String(l?.['@_href'] || val(e.id)).trim();
      if (link) out.push({ title: String(val(e.title)).trim(), link, date: e.updated || e.published ? new Date(e.updated || e.published) : null });
    }
  } else if (doc['rdf:RDF']) {
    for (const it of asArray(doc['rdf:RDF'].item)) {
      const link = String(val(it.link)).trim();
      if (link) out.push({ title: String(val(it.title)).trim(), link, date: it['dc:date'] ? new Date(it['dc:date']) : null });
    }
  }
  return out;
}

export function discoverFeed(html, baseUrl) {
  const { document } = parseHTML(html);
  const l = document.querySelector('link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]');
  const href = l?.getAttribute('href');
  return href ? new URL(href, baseUrl).toString() : null;
}

// Texte principal d'une page : paragraphes séparés par une ligne vide.
export function extractArticle(html, url) {
  const { document } = parseHTML(html);
  const art = new Readability(document, { charThreshold: 200 }).parse();
  if (!art) return null;
  const { document: d2 } = parseHTML(`<div id="r">${art.content}</div>`);
  const blocks = [...d2.querySelectorAll('p, h2, h3, li, blockquote')]
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0);
  const text = blocks.join('\n\n');
  return { title: (art.title || '').trim(), text };
}

// Coupe à ~maxWords sur une fin de paragraphe.
export function trimToWords(text, maxWords = 900) {
  if (countWords(text) <= maxWords) return text;
  const out = [];
  let n = 0;
  for (const para of text.split(/\n\n/)) {
    const w = countWords(para);
    if (n + w > maxWords && n > 0) break;
    out.push(para);
    n += w;
  }
  return out.join('\n\n');
}

export function readIndex(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  } catch {
    return [];
  }
}

export function writeEntry(dir, entry) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${entry.id}.json`), JSON.stringify(entry, null, 1) + '\n');
  const idx = readIndex(dir).filter((e) => e.id !== entry.id);
  idx.unshift({
    id: entry.id,
    date: entry.date,
    title: entry.title,
    source: entry.source.name,
    theme: entry.analysis.theme,
    summary: entry.analysis.summary,
    mode: entry.source.mode,
    words: entry.words,
    count: entry.analysis.vocabulaire.length + entry.analysis.expressions.length + entry.analysis.connecteurs.length,
  });
  idx.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx.slice(0, 200), null, 1) + '\n');
}

export const entryId = (date, url) => `${date}-${hash(url).slice(0, 5)}`;
