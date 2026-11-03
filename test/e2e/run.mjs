import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { start, mode } from './server.mjs';

const srv = await start(8788);
const B = 'http://localhost:8788';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `/tmp/lyla-${n}.png` });
let step = 0;
const ok = (m) => console.log(`ok ${++step} ${m}`);

await page.goto(B);
await page.waitForSelector('.hero h2');
assert.equal(await page.locator('.mono').innerText(), 'LY'); ok('logo LY');
assert.ok(!/C1|C2/.test(await page.locator('body').innerText()), 'aucune mention de niveau'); ok('aucune mention C1/C2 sur la page d’accueil');
assert.equal(await page.locator('.hero h2').innerText(), 'La Banque centrale face à l’inflation : tenir le cap'); ok('texte du jour affiché');
assert.equal(await page.locator('.rows .row').count(), 2); ok('bibliothèque : 2 autres textes');
await shot('jour');

// Lecture
await page.click('.hero .primary');
await page.waitForSelector('.sheet-body mark.m');
const nMarks = await page.locator('mark.m').count();
assert.ok(nMarks >= 20, 'marques=' + nMarks); ok(`lecture : ${nMarks} mots surlignés dans le texte`);
await shot('lecture');
// clic sur un mot surligné => carte à droite
await page.locator('mark.m', { hasText: 'atone' }).first().click();
assert.ok(await page.locator('.note.flash').count() >= 1); ok('clic sur un mot -> note mise en évidence');
// chinois masqué par défaut
assert.equal(await page.locator('.note .cn:visible').count(), 0); ok('traduction chinoise masquée par défaut');
await page.locator('.note[data-id] .link', { hasText: '中文' }).first().click();
assert.equal(await page.locator('.note .cn:visible').count(), 1); ok('traduction chinoise affichable');
// filtre actif/passif
await page.click('[data-action="usage-filter"][data-v="passif"]');
const visible = await page.locator('.note[data-usage="actif"]:visible').count();
assert.equal(visible, 0); ok('filtre « à reconnaître » masque les entrées actives');
await page.click('[data-action="usage-filter"][data-v="tous"]');
// ajout au carnet (3 vocab, 1 expression, 1 connecteur) + « je connaissais »
const saves = page.locator('[data-action="note-save"]');
for (let i = 0; i < 5; i++) await saves.nth(i * 3).click();
assert.equal(await page.evaluate(() => window.__lyla.state.notebook.length), 5); ok('5 éléments ajoutés au carnet');
await page.locator('[data-action="note-known"]').nth(1).click();
assert.equal(await page.evaluate(() => window.__lyla.state.known.length), 1); ok('« je connaissais » enregistré');
// persistance
await page.reload();
await page.waitForSelector('.hero h2');
assert.equal(await page.evaluate(() => window.__lyla.state.notebook.length), 5); ok('carnet conservé après rechargement');

// Réviser
await page.click('[data-action="tab"][data-tab="reviser"]');
await page.waitForSelector('.review-start');
assert.match(await page.locator('.review-start h2').innerText(), /5 à réviser/); ok('révision : 5 cartes dues');
await page.click('[data-action="review-start"]');
await page.waitForSelector('#answer');
await shot('reviser');
let graded = 0;
for (let i = 0; i < 12 && (await page.locator('#answer').count()); i++) {
  const blankText = await page.evaluate(() => { const R = window.__lyla.ui.review; const n = window.__lyla.state.notebook.find((x) => x.id === R.queue[R.idx]); return n.surface; });
  // 1re carte : mauvaise réponse ; 2e : sans accents ; autres : exact
  const answer = graded === 0 ? 'zzz' : graded === 1 ? blankText.normalize('NFD').replace(/[̀-ͯ]/g, '') : blankText;
  await page.fill('#answer', answer);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.grades');
  const verdict = await page.locator('.verdict').innerText();
  if (graded === 0) assert.match(verdict, /attendue/);
  if (graded === 1 && blankText !== answer) assert.match(verdict, /orthographe|Exact/);
  if (graded >= 2) assert.match(verdict, /Exact/);
  await page.keyboard.press(graded === 0 ? '1' : '2');
  graded++;
  await page.waitForTimeout(60);
}
await page.waitForSelector('text=Séance terminée');
ok(`révision terminée (${graded} évaluations, carte ratée représentée)`);
assert.ok(graded >= 6, 'la carte ratée doit revenir: ' + graded);
const due = await page.evaluate(() => window.__lyla.state.notebook.map((n) => n.srs.due + '/' + n.srs.interval));
console.log('   échéances', due.join(' '));
await page.click('[data-action="review-end"]');
await page.waitForSelector('text=Rien à réviser');
ok('plus rien à réviser après la séance');

// Analyser : code d'accès requis, puis analyse réelle via handler
await page.click('[data-action="tab"][data-tab="analyser"]');
await page.waitForSelector('#src');
assert.match(await page.locator('#ai-pill').innerText(), /Code d'accès/); ok('IA : code d’accès requis signalé');
assert.equal(await page.locator('[data-action="analyze"]').isDisabled(), true); ok('bouton Analyser désactivé sans code');
await page.click('[data-action="settings-open"]');
await page.fill('#set-code', 'mauvais');
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
// le code incorrect fait passer la santé à "ok" côté client (le code est vérifié à l'appel)
await page.fill('#src', "Face à la montée du protectionnisme, la mesure ne serait déclenchée qu'en dernier recours. Reste que l'engrenage des représailles menace tous les exportateurs européens et leurs partenaires.");
await page.click('[data-action="analyze"]');
await page.locator('.toast.error', { hasText: /Code d'accès/ }).first().waitFor({ timeout: 8000 }); ok('mauvais code -> message clair');
await page.waitForSelector('#set-code');
await page.fill('#set-code', 'sesame');
await page.keyboard.press('Tab');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('[data-action="analyze"]');
await page.waitForSelector('.reader-head', { timeout: 15000 });
const reads = await page.locator('mark.m').count();
assert.equal(reads, 3, 'marques=' + reads); ok('analyse collée : 3 éléments retrouvés, l’élément inventé est rejeté');
await shot('analyse');
await page.click('[data-action="back"]');
await page.waitForSelector('text=Analyses récentes');
assert.equal(await page.locator('.history .row').count(), 1); ok('analyse ajoutée à l’historique');

// Atelier
await page.click('[data-action="tab"][data-tab="atelier"]');
await page.waitForSelector('#atelier-text');
await page.click('[data-action="atelier-topic"]');
assert.ok(await page.locator('.topic').count()); ok('sujet proposé');
await page.fill('#atelier-text', 'Le gouvernement a decidé de réduire les dépenses publiques pour éviter une crise.');
await page.click('[data-action="atelier-correct"]');
await page.waitForSelector('.verdict', { timeout: 15000 });
assert.ok((await page.locator('.fixes li').count()) === 1); ok('Atelier : correction affichée');
await page.click('[data-action="atelier-save"]');
assert.equal(await page.evaluate(() => window.__lyla.state.notebook.some((n) => n.kind === 'libre')), true); ok('« à retenir » ajouté au carnet');
await shot('atelier');

// Carnet
await page.click('[data-action="tab"][data-tab="carnet"]');
await page.waitForSelector('.entries');
assert.equal(await page.locator('.entry').count(), 6); ok('carnet : 6 entrées');
await page.fill('#carnet-q', 'engrenage');
assert.ok((await page.locator('.entry').count()) <= 1); ok('recherche dans le carnet');
await page.fill('#carnet-q', '');
const dl = page.waitForEvent('download');
await page.click('[data-action="backup-export"]');
const d = await dl;
const fs = await import('node:fs');
await d.saveAs('/tmp/lyla-backup.json');
const backup = JSON.parse(fs.readFileSync('/tmp/lyla-backup.json', 'utf8'));
assert.equal(backup.notebook.length, 6); ok('sauvegarde JSON exportée (6 éléments)');
const dl2 = page.waitForEvent('download');
await page.click('[data-action="export-csv"]');
const csv = fs.readFileSync(await (await dl2).path(), 'utf8');
assert.ok(csv.startsWith('\ufeff"Type","Terme"')); ok('export CSV (UTF-8 avec BOM, ouvrable dans Excel)');
await shot('carnet');

// Import dans un contexte vierge
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(B);
await p2.waitForSelector('.hero h2');
await p2.click('[data-action="settings-open"]');
await p2.setInputFiles('#set-import', '/tmp/lyla-backup.json');
await p2.waitForSelector('.toast.ok');
assert.equal(await p2.evaluate(() => window.__lyla.state.notebook.length), 6); ok('import de sauvegarde sur un navigateur vierge');
await p2.evaluate(() => { document.querySelector('#settings').close(); });
await p2.setInputFiles('#set-import', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') }).catch(() => {});

// Quota Gemini épuisé -> message
mode.gemini = 'quota';
await page.click('[data-action="tab"][data-tab="analyser"]');
await page.fill('#src', "Face à la montée du protectionnisme, la mesure ne serait déclenchée qu'en dernier recours. Reste que l'engrenage des représailles menace tous les exportateurs.");
await page.click('[data-action="analyze"]');
await page.locator('.toast.error', { hasText: /quota gratuit/ }).waitFor({ timeout: 8000 }); ok('quota épuisé -> message en français');
mode.gemini = 'ok';

// Raccourcis clavier
await page.keyboard.press('Escape');
await page.keyboard.press('Alt+1');
await page.waitForSelector('.hero h2');
ok('raccourci Alt+1');

// Texte de la source en mode extrait (pas de texte intégral)
await page.evaluate(() => {
  const w = window.__lyla;
  w.ui.reader = { id: 'x', kind: 'daily', title: 'Article', theme: 'Énergie & climat', text: '', analysis: { summary: 's', theme: 'Énergie & climat', vocabulaire: [{ id: 'a', kind: 'vocab', term: 'x', surface: 'x', usage: 'actif', definition_fr: 'd', translation_cn: 'c', context: '… un extrait court …' }], expressions: [], connecteurs: [], syntaxe: [], rhetorique: [] }, source: { name: 'Presse', url: 'https://exemple.fr/a', mode: 'excerpt' } };
  w.ui.tab = 'lecture'; w.render();
});
assert.match(await page.locator('.sheet-body').innerText(), /n'est pas reproduit/); ok('source en extraits : pas de texte intégral, lien vers la source');

console.log('\nerreurs navigateur :', errors.length ? errors : 'aucune');
await browser.close();
srv.close();
process.exit(errors.length ? 1 : 0);
