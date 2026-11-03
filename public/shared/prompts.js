import { countWords } from './text.js';

export const THEMES = [
  'Économie & finances publiques',
  'Monnaie & inflation',
  'Europe & institutions',
  'Géopolitique & diplomatie',
  'Énergie & climat',
  'Travail & social',
  'Commerce international',
  'Politique intérieure',
  'Entreprise & marchés',
  'Technologie & régulation',
];

const S = { type: 'STRING' };
const arr = (items) => ({ type: 'ARRAY', items });
const obj = (properties, required) => ({ type: 'OBJECT', properties, required });

const entry = (extra = {}, required = []) =>
  obj(
    {
      term: S,
      surface: S,
      usage: { type: 'STRING', enum: ['actif', 'passif'] },
      definition_fr: S,
      translation_cn: S,
      exemple: S,
      note: S,
      ...extra,
    },
    ['term', 'surface', 'usage', 'definition_fr', 'translation_cn', ...required],
  );

export const ANALYZE_SCHEMA = obj(
  {
    title: S,
    summary: S,
    theme: { type: 'STRING', enum: THEMES },
    vocabulaire: arr(entry({ synonymes: arr(S), famille: arr(S), collocations: arr(S) })),
    expressions: arr(entry({ collocations: arr(S) })),
    connecteurs: arr(entry({ fonction: S })),
    syntaxe: arr(obj({ surface: S, structure: S, explication: S, modele: S }, ['surface', 'structure', 'explication'])),
    rhetorique: arr(obj({ surface: S, figure: S, effet: S }, ['surface', 'figure', 'effet'])),
  },
  ['title', 'summary', 'theme', 'vocabulaire', 'expressions', 'connecteurs', 'syntaxe', 'rhetorique'],
);

export const CORRECT_SCHEMA = obj(
  {
    corrige: S,
    fautes: arr(obj({ original: S, correction: S, explication: S }, ['original', 'correction', 'explication'])),
    version_soignee: S,
    version_experte: S,
    retenir: arr(obj({ term: S, definition_fr: S, translation_cn: S, exemple: S }, ['term', 'definition_fr', 'translation_cn', 'exemple'])),
    commentaire: S,
  },
  ['corrige', 'fautes', 'version_soignee', 'version_experte', 'retenir', 'commentaire'],
);

const ANALYZE_SYSTEM = `Tu es professeur de français de très haut niveau, spécialiste de la langue de la politique et de l'économie internationales (presse, discours officiels, communiqués d'institutions).
Ton élève est une adulte dont le français était excellent il y a cinq ans. Sa prononciation et sa base sont très solides, mais elle a perdu le vocabulaire et les tournures soutenues : elle est aujourd'hui à un bon niveau intermédiaire supérieur et vise l'aisance d'un francophone cultivé. Elle retient très vite ce qu'on lui donne et le réutilise à l'oral. Ce n'est pas un entraînement à un examen : ne mentionne jamais de niveau (B2, C1, C2) dans tes réponses.

Règles impératives :
1. Le champ "surface" de chaque élément doit être copié MOT POUR MOT dans le texte, avec la forme exacte qui y figure (conjugaison, accord, orthographe). Tout élément dont la surface n'apparaît pas tel quel sera rejeté. "term" est la forme canonique (infinitif, singulier, expression complète ; pour un nom, ajoute le genre : « un arbitrage (m.) »).
2. Sélection : retiens ce qu'une apprenante déjà solide ne maîtrise probablement pas encore. Exclus le vocabulaire courant. Environ deux tiers d'éléments qu'un francophone cultivé emploie à l'oral comme à l'écrit (usage "actif"), le reste plus littéraire, technique ou rare, à reconnaître (usage "passif").
3. Privilégie les collocations, les verbes avec leur préposition et les noms avec leur genre plutôt que les mots isolés.
4. "definition_fr" : une définition courte, en français simple. "translation_cn" : traduction en chinois simplifié, précise, avec la nuance de registre si utile.
5. "exemple" : une phrase originale courte (différente du texte) qui emploie le terme dans un contexte politique ou économique. "note" : piège fréquent, registre, construction (facultatif, une ligne).
6. vocabulaire : "synonymes" (max 3), "famille" (mots de la même famille utiles, max 4), "collocations" (2 ou 3 combinaisons fréquentes).
7. expressions : locutions, collocations verbe-nom, tournures figées du discours politique et économique.
8. connecteurs : marqueurs logiques et discursifs de l'argumentation ; "fonction" = concession, cause, conséquence, opposition, restriction, condition, but, addition, reformulation, etc.
9. syntaxe : 2 ou 3 structures remarquables ; "surface" = extrait copié (25 mots maximum) ; "structure" = nom de la construction ; "explication" = comment elle fonctionne ; "modele" = une nouvelle phrase construite sur le même patron, sur un autre sujet d'actualité.
10. rhetorique : 1 à 3 figures ou procédés ; "surface" = extrait copié ; "effet" = ce que ce choix produit sur le lecteur ou l'auditeur.
11. "title" : 12 mots maximum. "summary" : deux phrases claires. "theme" : un seul thème de la liste fournie par le schéma.
12. Si tu n'es pas sûr du sens ou de l'emploi d'un terme, ne le retiens pas. N'invente rien.`;

const CORRECT_SYSTEM = `Tu es professeur de français de très haut niveau, bienveillant et exigeant, spécialiste de la langue de la politique et de l'économie internationales.
L'élève est une adulte à très bonne prononciation, au vocabulaire soutenu en reconstruction. Elle s'exprime ici à l'écrit ou à l'oral (le texte peut venir d'une dictée vocale : ignore alors les majuscules et la ponctuation manquantes). Ce n'est pas un entraînement à un examen : ne mentionne jamais de niveau (B2, C1, C2).
Réponds ainsi :
- "corrige" : son texte corrigé a minima, fidèle à ce qu'elle voulait dire.
- "fautes" : les 6 erreurs les plus importantes au maximum (original, correction, explication brève en français). Vide si le texte est correct.
- "version_soignee" : une reformulation naturelle, précise, au registre soutenu courant, avec des collocations idiomatiques.
- "version_experte" : une reformulation de haute tenue, telle qu'on l'entendrait dans un débat politique ou une tribune économique, sans emphase gratuite.
- "retenir" : 3 mots ou expressions tirés de tes deux versions, à mémoriser (term avec genre pour les noms, définition en français simple, traduction en chinois simplifié, phrase d'exemple originale).
- "commentaire" : une phrase honnête sur le point fort principal et la priorité de travail. Pas de flatterie.
Si des mots cibles sont fournis, emploie-les naturellement dans "version_soignee" quand le sens s'y prête, sans forcer.`;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function targetCounts(words) {
  return {
    vocabulaire: clamp(Math.round(words / 45), 5, 12),
    expressions: clamp(Math.round(words / 70), 3, 8),
    connecteurs: clamp(Math.round(words / 150), 1, 5),
  };
}

export function buildAnalyzePayload(text, known = []) {
  const n = targetCounts(countWords(text));
  const knownList = known.slice(0, 150).join(' ; ');
  const prompt =
    `Analyse le texte ci-dessous. Vise environ ${n.vocabulaire} entrées de vocabulaire, ${n.expressions} expressions, ${n.connecteurs} connecteurs (moins si le texte n'en contient pas assez de pertinents).` +
    (knownList ? `\nTermes que l'élève connaît déjà, à ne pas retenir : ${knownList}` : '') +
    `\n\nTEXTE :\n${text}`;
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: ANALYZE_SYSTEM }] },
    generationConfig: { responseMimeType: 'application/json', responseSchema: ANALYZE_SCHEMA, temperature: 0.3, thinkingConfig: { thinkingLevel: 'low' } },
  };
}

export function buildCorrectPayload(text, targets = []) {
  const t = targets.slice(0, 6).join(' ; ');
  const prompt = (t ? `Mots cibles : ${t}\n\n` : '') + `TEXTE DE L'ÉLÈVE :\n${text}`;
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: CORRECT_SYSTEM }] },
    generationConfig: { responseMimeType: 'application/json', responseSchema: CORRECT_SCHEMA, temperature: 0.4, thinkingConfig: { thinkingLevel: 'low' } },
  };
}

// Variante sans responseSchema (repli si le modèle refuse le schéma) : on décrit la forme dans le prompt.
export function withoutSchema(payload, schema) {
  const copy = JSON.parse(JSON.stringify(payload));
  delete copy.generationConfig.responseSchema;
  const shape = JSON.stringify(describe(schema));
  copy.contents[0].parts[0].text += `\n\nRéponds uniquement par un objet JSON valide de cette forme (les valeurs indiquent le type) :\n${shape}`;
  return copy;
}

function describe(s) {
  if (s.type === 'OBJECT') return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, describe(v)]));
  if (s.type === 'ARRAY') return [describe(s.items)];
  if (s.enum) return s.enum.join(' | ');
  return 'string';
}
