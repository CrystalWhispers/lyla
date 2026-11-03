# Le français avec Lyla

Site d'apprentissage du français de la politique et de l'économie internationales, pour une élève de bon niveau qui reconstruit son vocabulaire soutenu. Usage sur ordinateur.

Coût de fonctionnement : 0 (GitHub, Cloudflare Pages et le quota gratuit de Gemini).

## Ce que fait le site

| Onglet | Fonction |
|---|---|
| Du jour | Un texte par jour, déjà analysé. Les mots surlignés dans le texte renvoient à leur fiche. |
| Analyser | Elle colle un texte (200–800 mots) et l'IA l'analyse. |
| Atelier | Elle écrit ou dicte quelques phrases ; l'IA corrige puis donne une version soignée et une version experte. |
| Réviser | Cartes à trou tirées des phrases d'origine, répétition espacée, 100 % au clavier. |
| Carnet | Tous les mots retenus, recherche, export CSV et sauvegarde. |

Chaque fiche indique si l'élément est « à utiliser » (à réemployer à l'oral) ou « à reconnaître » (usage plus littéraire ou technique), sans parler de niveau d'examen.

Garde-fous : tout élément proposé par l'IA dont la forme n'apparaît pas mot pour mot dans le texte est rejeté ; les phrases de contexte affichées sont toujours les vraies phrases du texte ; les exemples écrits par l'IA sont étiquetés « Exemple (IA) ».

## Mise en ligne (une seule fois, environ 25 minutes)

Vous avez besoin de trois comptes gratuits : GitHub, Cloudflare, Google AI Studio.

### 1. Clé Gemini
1. Ouvrir https://aistudio.google.com/apikey avec un compte Google.
2. « Create API key », copier la clé. Ne la collez nulle part ailleurs que dans les deux endroits indiqués ci-dessous.

### 2. Dépôt GitHub
1. Créer un dépôt **privé ou public** nommé par exemple `lyla`.
2. Y déposer tout le contenu de ce dossier, **y compris le dossier caché `.github`** (glisser-déposer le dossier entier dans la page « Upload files » ; sinon utiliser `git push`). Ne pas déposer `node_modules`.
3. Dépôt → Settings → Secrets and variables → Actions → New repository secret : nom `GEMINI_API_KEY`, valeur = la clé.
4. Dépôt → Settings → Actions → General → Workflow permissions : choisir **Read and write permissions**, Save.
5. Onglet Actions → « Texte du jour » → Run workflow. Lisez le journal : il indique le texte créé ou la raison de l'échec. Un texte est ajouté chaque matin vers 7 h (heure de Bangkok).

### 3. Cloudflare Pages
1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → choisir le dépôt.
2. Build command : laisser vide. **Build output directory : `public`**. Save and Deploy.
3. Workers & Pages → KV → Create a namespace, nom `lyla-quota`.
4. Projet Pages → Settings → Bindings → Add → KV namespace : variable name **`QUOTA`**, namespace `lyla-quota`.
5. Projet Pages → Settings → Variables and Secrets (Production) :
   - `GEMINI_API_KEY` (type Secret) : la même clé.
   - `ACCESS_CODE` (type Secret) : un code de votre choix, à donner à l'élève.
   - `DAILY_CAP` (texte, facultatif) : nombre maximal d'analyses par jour pour tout le site. Défaut 120.
6. Deployments → Retry deployment (pour prendre en compte les variables).

### 4. Premier essai
Ouvrir l'adresse `https://<projet>.pages.dev`, Réglages → saisir le code d'accès → onglet Analyser → coller un texte → Analyser.

## Utilisation au quotidien

- **Choisir ses propres articles** : ajouter une URL par ligne dans `queue.txt` (modifiable directement sur GitHub). Au plus deux par jour sont analysés. Seules de courtes citations sont conservées, avec le lien vers l'article.
- **Sources automatiques** : `sources.json`. Le mode `full` conserve le texte intégral et ne doit servir que si la licence de la source l'autorise ; le mode `excerpt` ne garde que des citations courtes.
- **Carnet de l'élève** : stocké dans son navigateur. Elle doit l'exporter de temps en temps (Réglages → Exporter), surtout avant de changer d'ordinateur ou d'effacer les données du navigateur.

## Limites à connaître

- Le quota gratuit de Gemini change sans préavis et n'est pas garanti. Quand il est épuisé, « Du jour », « Réviser » et « Carnet » continuent de fonctionner.
- La dictée vocale ne marche que dans Chrome ou Edge sur ordinateur. La lecture à voix haute utilise les voix du navigateur.
- Les polices viennent de Google Fonts ; sans connexion, le site s'affiche avec des polices système.
- GitHub peut suspendre les tâches planifiées d'un dépôt sans activité pendant longtemps. Si les textes du jour s'arrêtent, relancer le workflow depuis l'onglet Actions.
- Les textes du jour ne sont analysés qu'une fois, au moment de leur création : la liste des « mots déjà connus » de l'élève ne s'applique qu'aux analyses faites dans l'onglet Analyser.

## Développement

```
npm install
npm test                        # tests unitaires (32)
node scripts/build-seeds.mjs    # régénère les 3 textes de départ
GEMINI_API_KEY=... node scripts/generate-daily.mjs
```

Structure : `public/` (site statique, publié tel quel), `functions/api/` (API Cloudflare Pages Functions), `public/shared/` (logique commune navigateur/serveur), `scripts/` (génération du texte du jour), `.github/workflows/daily.yml` (planification).
