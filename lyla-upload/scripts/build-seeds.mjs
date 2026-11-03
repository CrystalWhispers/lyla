// Génère public/data/daily/* à partir des textes pédagogiques originaux. Échoue si une surface n'est pas dans le texte.
import { SEEDS } from './seeds-data.mjs';
import { finalizeAnalysis } from '../public/shared/analysis.js';
import { countWords } from '../public/shared/text.js';
import { writeEntry, readIndex, entryId } from './lib.mjs';
import fs from 'node:fs';

const DIR = 'public/data/daily';
fs.rmSync(DIR, { recursive: true, force: true });
let bad = 0;
for (const s of SEEDS) {
  const a = finalizeAnalysis(s.analysis, s.text);
  const expected = s.analysis.vocabulaire.length + s.analysis.expressions.length + s.analysis.connecteurs.length;
  const got = a.vocabulaire.length + a.expressions.length + a.connecteurs.length;
  if (a.dropped || got !== expected || a.syntaxe.length !== s.analysis.syntaxe.length || a.rhetorique.length !== s.analysis.rhetorique.length) {
    console.error(`ÉCHEC « ${s.title} » : ${a.dropped} rejeté(s), ${got}/${expected} éléments`);
    bad++;
  }
  writeEntry(DIR, {
    id: entryId(s.date, 'seed:' + s.title),
    date: s.date,
    title: s.title,
    source: { name: 'Texte original du site', url: '', mode: 'full', license: 'Texte pédagogique rédigé pour ce site (pas un article de presse).' },
    words: countWords(s.text),
    model: 'rédigé à la main',
    text: s.text,
    analysis: a,
  });
  console.log(`ok « ${s.title} » — ${countWords(s.text)} mots, ${got} éléments`);
}
if (bad) process.exit(1);
console.log('index :', readIndex(DIR).map((e) => e.id).join(', '));
