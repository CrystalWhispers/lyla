// Textes pédagogiques ORIGINAUX (rédigés pour ce site, pas des articles de presse) et leur analyse rédigée à la main.
// Chaque "surface" est vérifiée contre le texte par finalizeAnalysis (scripts/build-seeds.mjs).

const V = (term, surface, usage, definition_fr, translation_cn, o = {}) => ({
  term, surface, usage, definition_fr, translation_cn,
  synonymes: o.syn, famille: o.fam, collocations: o.col, exemple: o.ex, note: o.note, fonction: o.fn,
});

export const SEEDS = [
  {
    date: '2026-10-29',
    title: 'La Banque centrale face à l’inflation : tenir le cap',
    text: `Depuis dix-huit mois, la Banque centrale européenne durcit sa politique monétaire avec une constance qui n'a guère d'équivalent dans son histoire récente. Face à une spirale inflationniste alimentée tout à la fois par la flambée des prix de l'énergie et par les tensions sur les chaînes d'approvisionnement, ses dirigeants ont relevé les taux directeurs à plusieurs reprises, quitte à fragiliser une croissance déjà atone.

Les marchés, eux, restent sceptiques. Certains analystes estiment que l'institution a tardé à réagir et qu'elle s'efforce désormais de rattraper le temps perdu ; d'autres redoutent qu'elle ne pèche par excès de zèle et n'étouffe la reprise dans l'œuf. Il n'en demeure pas moins que la désinflation tarde à se manifester dans les services, où les hausses de salaires se répercutent sur les prix.

Pour les gouvernements, la marge de manœuvre se réduit à vue d'œil. Le renchérissement du crédit alourdit la charge de la dette, alors même que l'opinion réclame des mesures de soutien au pouvoir d'achat. Reste à savoir si les États parviendront à concilier rigueur budgétaire et protection des ménages sans que l'un ne se fasse au détriment de l'autre. Quoi qu'il en soit, la crédibilité de la banque centrale dépendra de sa capacité à tenir le cap, sans céder aux pressions politiques.`,
    analysis: {
      title: 'La banque centrale face à l’inflation',
      summary: 'La BCE relève ses taux au risque de freiner une croissance déjà faible, tandis que les États voient leur marge budgétaire se réduire. Sa crédibilité dépendra de sa fermeté.',
      theme: 'Monnaie & inflation',
      vocabulaire: [
        V('alimenter (une inflation, un débat)', 'alimentée', 'actif', 'Entretenir et faire croître.', '助长；推动（通胀、争论等）', { syn: ['nourrir', 'entretenir'], col: ['alimenter les tensions', 'alimenter un débat'], ex: 'Les rumeurs ont alimenté la défiance envers les banques.' }),
        V('une flambée (f.)', 'flambée', 'actif', 'Hausse brutale et rapide, surtout des prix.', '（价格等）飙升', { syn: ['envolée', 'explosion'], fam: ['flamber'], col: ['flambée des prix', 'flambée de violence'], ex: 'La flambée du cours du gaz a surpris les ménages.' }),
        V('atone', 'atone', 'actif', 'Sans dynamisme, très faible.', '疲软的；缺乏活力的', { syn: ['molle', 'anémique'], col: ['croissance atone', 'demande atone'], ex: 'La demande intérieure reste atone depuis le printemps.' }),
        V('fragiliser', 'fragiliser', 'actif', 'Rendre plus fragile, affaiblir.', '使脆弱；削弱', { fam: ['fragile', 'fragilité', 'fragilisation'], col: ['fragiliser l’économie', 'fragiliser une coalition'], ex: 'Ce scandale a fragilisé la position du ministre.' }),
        V('la désinflation (f.)', 'désinflation', 'actif', 'Ralentissement de la hausse des prix.', '通胀回落（物价涨幅放缓）', { fam: ['inflation', 'déflation'], note: 'À ne pas confondre avec la déflation, qui est une baisse générale des prix.', ex: 'La désinflation est plus lente que prévu dans les services.' }),
        V('le renchérissement (m.)', 'renchérissement', 'actif', 'Augmentation du prix de quelque chose.', '涨价；成本上升', { fam: ['cher', 'renchérir'], col: ['le renchérissement du crédit', 'le renchérissement de l’énergie'], ex: 'Le renchérissement des matières premières pèse sur les marges.' }),
        V('la crédibilité (f.)', 'crédibilité', 'actif', 'Capacité à être cru et à inspirer confiance.', '可信度；公信力', { fam: ['crédible', 'discréditer'], col: ['perdre en crédibilité', 'asseoir sa crédibilité'], ex: 'Une banque centrale vit de sa crédibilité.' }),
      ],
      expressions: [
        V('durcir sa politique monétaire', 'durcit sa politique monétaire', 'actif', 'Rendre le crédit plus cher et plus rare, en relevant les taux.', '收紧货币政策', { col: ['assouplir la politique monétaire'], ex: 'La Fed pourrait durcir sa politique monétaire dès l’automne.' }),
        V('une spirale inflationniste', 'spirale inflationniste', 'actif', 'Mécanisme où hausse des prix et hausse des salaires s’entraînent mutuellement.', '通胀螺旋', { ex: 'Les syndicats craignent d’être accusés d’alimenter une spirale inflationniste.' }),
        V('pécher par excès de zèle', 'pèche par excès de zèle', 'actif', 'En faire trop, avec de bonnes intentions mais de mauvais effets.', '矫枉过正；过于热心反而误事', { ex: 'L’administration a péché par excès de zèle en multipliant les contrôles.' }),
        V('étouffer quelque chose dans l’œuf', 'étouffe la reprise dans l’œuf', 'actif', 'Empêcher quelque chose de se développer dès le début.', '把…扼杀在萌芽状态', { ex: 'Le gouvernement veut étouffer la contestation dans l’œuf.' }),
        V('tarder à + infinitif', 'tarde à se manifester', 'actif', 'Mettre longtemps à se produire.', '迟迟没有…', { ex: 'Les effets de la réforme tardent à se faire sentir.', note: '« Sans tarder » = immédiatement.' }),
        V('se répercuter sur', 'se répercutent sur les prix', 'actif', 'Avoir des effets en chaîne sur.', '波及；传导到', { col: ['se répercuter sur les prix', 'se répercuter sur l’emploi'], ex: 'La hausse des coûts se répercute sur les consommateurs.' }),
        V('une marge de manœuvre', 'marge de manœuvre', 'actif', 'Liberté d’action dont on dispose.', '回旋余地', { col: ['réduire la marge de manœuvre', 'retrouver des marges de manœuvre'], ex: 'Le déficit limite la marge de manœuvre de l’État.' }),
        V('alourdir la charge de la dette', 'alourdit la charge de la dette', 'actif', 'Augmenter ce que l’État doit payer chaque année pour sa dette (intérêts).', '加重债务负担', { col: ['la charge de la dette', 'alourdir la facture'], ex: 'La hausse des taux alourdit la charge de la dette.' }),
        V('à vue d’œil', 'à vue d’œil', 'actif', 'De façon perceptible, très vite.', '肉眼可见地', { ex: 'Les stocks diminuent à vue d’œil.' }),
        V('tenir le cap', 'tenir le cap', 'actif', 'Maintenir sa ligne d’action malgré les difficultés.', '坚持既定方向', { ex: 'Le Premier ministre promet de tenir le cap des réformes.' }),
        V('au détriment de', 'au détriment de', 'actif', 'En causant du tort à.', '以…为代价；损害…', { ex: 'Les économies se font au détriment de la qualité du service.' }),
      ],
      connecteurs: [
        V('tout à la fois… et', 'tout à la fois', 'actif', 'Exprime que deux réalités coexistent.', '既…又…（同时）', { fn: 'addition', ex: 'Une crise tout à la fois sociale et politique.' }),
        V('quitte à + infinitif', 'quitte à', 'actif', 'En acceptant le risque ou l’inconvénient de.', '哪怕要…；不惜…', { fn: 'risque assumé', ex: 'Il maintiendra sa réforme, quitte à perdre sa majorité.' }),
        V('il n’en demeure pas moins que', 'Il n’en demeure pas moins que', 'actif', 'Malgré ce qui vient d’être dit, il reste que.', '尽管如此，仍然…', { fn: 'concession', ex: 'Il n’en demeure pas moins que les résultats sont décevants.' }),
        V('alors même que', 'alors même que', 'actif', 'Malgré le fait que (renforce « alors que »).', '尽管…（强调反差）', { fn: 'concession', ex: 'Il a été réélu alors même que son bilan était contesté.' }),
        V('reste à savoir si', 'Reste à savoir si', 'actif', 'Il faut encore déterminer si.', '尚待观察…是否…', { fn: 'ouverture d’une question', ex: 'Reste à savoir si le texte sera adopté.' }),
        V('quoi qu’il en soit', 'Quoi qu’il en soit', 'actif', 'Quelle que soit la situation, en tout cas.', '无论如何', { fn: 'conclusion', ex: 'Quoi qu’il en soit, la décision appartient aux électeurs.' }),
      ],
      syntaxe: [
        { surface: 'd’autres redoutent qu’elle ne pèche par excès de zèle et n’étouffe la reprise dans l’œuf', structure: 'Subjonctif après un verbe de crainte, avec « ne » explétif', explication: 'Après redouter ou craindre que, on emploie le subjonctif, et la langue soignée ajoute un « ne » sans valeur négative. Le sens reste positif : ils craignent qu’elle pèche.', modele: 'Les experts redoutent que la crise ne s’aggrave avant l’été.' },
        { surface: 'Les marchés, eux, restent sceptiques', structure: 'Mise en relief par le pronom disjoint', explication: 'Le pronom « eux » inséré après le sujet marque l’opposition avec ce qui précède (ici, les dirigeants de la banque).', modele: 'Les syndicats, eux, refusent tout compromis.' },
        { surface: 'Reste à savoir si les États parviendront à concilier rigueur budgétaire et protection des ménages sans que l’un ne se fasse au détriment de l’autre', structure: 'Tournure elliptique « reste à + infinitif », puis « sans que » + subjonctif', explication: '« Reste à savoir » omet le sujet (il reste à savoir) et ouvre une question en fin de paragraphe. « Sans que » exige le subjonctif et accepte un « ne » explétif.', modele: 'Reste à voir si le gouvernement saura réformer sans que la dette ne s’envole.' },
      ],
      rhetorique: [
        { surface: 'spirale inflationniste', figure: 'Métaphore', effet: 'La spirale évoque un mouvement qui s’entretient lui-même et échappe au contrôle : l’image dramatise la situation et justifie la fermeté de la banque.' },
        { surface: 'étouffe la reprise dans l’œuf', figure: 'Métaphore biologique', effet: 'La reprise devient un être vivant fragile que l’on peut tuer avant sa naissance ; l’image souligne le risque d’une erreur irréversible.' },
      ],
    },
  },
  {
    date: '2026-10-28',
    title: 'Budget : un gouvernement pris en étau',
    text: `À quelques semaines de l'examen du projet de loi de finances, le gouvernement se trouve pris en étau entre des engagements européens contraignants et une majorité fragile. Le déficit public, qui avoisine les cinq pour cent du produit intérieur brut, ne saurait se résorber sans un effort d'économies d'une ampleur inédite, que l'exécutif peine à faire accepter.

Le ministre de l'Économie plaide pour une trajectoire de redressement étalée sur plusieurs années : il s'agit, dit-il, de rétablir les comptes sans briser l'élan de l'investissement. L'opposition, de son côté, dénonce un budget de rigueur qui ne dit pas son nom et réclame que les efforts soient équitablement répartis. Les syndicats menacent de mobiliser dès l'automne.

Les agences de notation, elles, scrutent chaque annonce. Une dégradation de la note souveraine renchérirait le coût de l'emprunt et réduirait d'autant les moyens d'action de l'État. À cela s'ajoute la question des prélèvements : relever les impôts risquerait de peser sur la consommation, tandis que tailler dans les dépenses sociales exposerait le pouvoir à une contestation durable.

Dans ces conditions, nul ne s'attend à un compromis rapide. Il faudra sans doute arbitrer entre des priorités concurrentes, au risque de mécontenter tout le monde.`,
    analysis: {
      title: 'Le budget et la contrainte des déficits',
      summary: 'Le gouvernement doit réduire un déficit proche de 5 % du PIB sans majorité solide. Chaque option, hausse d’impôts ou coupes sociales, comporte un coût politique élevé.',
      theme: 'Économie & finances publiques',
      vocabulaire: [
        V('contraignant', 'contraignants', 'actif', 'Qui impose une obligation.', '有约束力的；强制性的', { fam: ['contraindre', 'contrainte'], col: ['engagements contraignants', 'règles contraignantes'], ex: 'Les objectifs climatiques deviennent juridiquement contraignants.' }),
        V('avoisiner', 'avoisine', 'actif', 'Être proche d’un chiffre.', '接近（某个数值）', { syn: ['frôler', 'approcher'], col: ['avoisiner les 5 %'], ex: 'Le taux de chômage avoisine les sept pour cent.' }),
        V('se résorber', 'se résorber', 'actif', 'Diminuer jusqu’à disparaître (déficit, chômage).', '（赤字、失业等）逐渐消除', { fam: ['résorption', 'résorber'], col: ['résorber le déficit', 'le chômage se résorbe'], ex: 'Le déficit ne se résorbera pas sans réformes.' }),
        V('une ampleur (f.)', 'ampleur inédite', 'actif', 'Importance, taille d’un phénomène.', '规模；幅度', { col: ['prendre de l’ampleur', 'l’ampleur des dégâts'], ex: 'La mobilisation a pris une ampleur inattendue.' }),
        V('étaler', 'étalée', 'actif', 'Répartir dans le temps.', '分摊（在时间上）；分期', { col: ['étaler les paiements', 'étaler une dette'], ex: 'Le remboursement sera étalé sur dix ans.' }),
        V('dénoncer', 'dénonce', 'actif', 'Critiquer publiquement et vivement.', '公开谴责；揭露', { col: ['dénoncer un scandale', 'dénoncer une injustice'], ex: 'L’opposition dénonce un manque de transparence.' }),
        V('scruter', 'scrutent', 'passif', 'Examiner avec une grande attention.', '仔细审视', { syn: ['épier', 'examiner'], ex: 'Les investisseurs scrutent les décisions de la banque centrale.' }),
        V('renchérir', 'renchérirait', 'actif', 'Rendre plus cher.', '使…变贵；提高成本', { fam: ['cher', 'renchérissement'], ex: 'Une hausse des taux renchérirait le crédit immobilier.' }),
      ],
      expressions: [
        V('être pris en étau (entre)', 'pris en étau', 'actif', 'Subir deux pressions contraires en même temps.', '被夹在中间；腹背受敌', { ex: 'Les PME sont prises en étau entre l’inflation et la baisse de la demande.' }),
        V('peiner à + infinitif', 'peine à faire accepter', 'actif', 'Avoir du mal à.', '难以…', { ex: 'Le gouvernement peine à convaincre sa propre majorité.' }),
        V('une trajectoire de redressement', 'trajectoire de redressement', 'actif', 'Chemin planifié pour rétablir une situation, ici les comptes publics.', '（财政）修复路径', { col: ['une trajectoire budgétaire', 'redresser les comptes'], ex: 'Bruxelles exige une trajectoire de redressement crédible.' }),
        V('briser l’élan', 'briser l’élan', 'actif', 'Interrompre une dynamique positive.', '打断势头', { ex: 'Cette décision risque de briser l’élan de la reprise.' }),
        V('un budget de rigueur qui ne dit pas son nom', 'budget de rigueur qui ne dit pas son nom', 'actif', 'Un budget d’austérité que l’on refuse d’appeler ainsi.', '名不副实的紧缩预算', { note: '« Qui ne dit pas son nom » = que l’on dissimule volontairement.', ex: 'Ils dénoncent une réforme des retraites qui ne dit pas son nom.' }),
        V('la note souveraine', 'note souveraine', 'actif', 'Évaluation de la solvabilité d’un État par une agence de notation.', '主权信用评级', { col: ['dégrader la note', 'perdre son triple A'], ex: 'La note souveraine du pays a été abaissée d’un cran.' }),
        V('peser sur', 'peser sur la consommation', 'actif', 'Exercer une pression négative sur.', '对…造成压力', { ex: 'L’inflation pèse sur le moral des ménages.' }),
        V('tailler dans les dépenses', 'tailler dans les dépenses sociales', 'actif', 'Réduire fortement les dépenses.', '大幅削减开支', { syn: ['réduire', 'rogner'], ex: 'Le gouvernement veut tailler dans les dépenses de fonctionnement.' }),
        V('arbitrer entre', 'arbitrer entre des priorités concurrentes', 'actif', 'Choisir entre des options qui ne peuvent pas toutes être satisfaites.', '在…之间权衡取舍', { fam: ['un arbitrage'], ex: 'Il faudra arbitrer entre la défense et la santé.' }),
      ],
      connecteurs: [
        V('de son côté', 'de son côté', 'actif', 'Introduit la position d’un autre acteur.', '就其而言；另一方面', { fn: 'opposition', ex: 'Le patronat, de son côté, réclame une baisse des charges.' }),
        V('d’autant (que)', 'd’autant', 'actif', 'Dans la même mesure, en proportion.', '相应地；更何况', { fn: 'proportion', note: '« D’autant plus que » introduit une cause qui renforce.', ex: 'Le projet est d’autant plus risqué que les fonds manquent.' }),
        V('à cela s’ajoute', 'À cela s’ajoute', 'actif', 'Introduit un élément supplémentaire.', '此外还有…', { fn: 'addition', ex: 'À cela s’ajoute une pénurie de main-d’œuvre.' }),
        V('tandis que', 'tandis que', 'actif', 'Oppose deux faits simultanés.', '而（对比）', { fn: 'opposition', ex: 'Les prix grimpent tandis que les salaires stagnent.' }),
        V('dans ces conditions', 'Dans ces conditions', 'actif', 'Compte tenu de ce qui précède.', '在这种情况下', { fn: 'conséquence', ex: 'Dans ces conditions, le report paraît inévitable.' }),
        V('au risque de', 'au risque de', 'actif', 'En acceptant la possibilité d’un inconvénient.', '冒着…的风险', { fn: 'risque assumé', ex: 'Il persiste, au risque de se couper de sa base.' }),
      ],
      syntaxe: [
        { surface: 'ne saurait se résorber sans un effort d’économies d’une ampleur inédite', structure: 'Conditionnel de « pouvoir » à valeur de négation posée', explication: 'Dans la langue soutenue, « ne saurait » + infinitif exprime l’impossibilité ou l’interdiction avec plus de retenue et d’élégance que « ne peut pas ».', modele: 'Le débat ne saurait être réduit à une question de chiffres.' },
        { surface: 'Une dégradation de la note souveraine renchérirait le coût de l’emprunt et réduirait d’autant les moyens d’action de l’État', structure: 'Conditionnel d’hypothèse portée par le sujet', explication: 'La condition est contenue dans le groupe nominal sujet (« une dégradation… ») : le conditionnel suffit, sans proposition en « si ».', modele: 'Un retrait des investisseurs précipiterait la chute de la monnaie.' },
        { surface: 'nul ne s’attend à un compromis rapide', structure: 'Pronom indéfini négatif « nul ne » (registre soutenu)', explication: '« Nul ne » équivaut à « personne ne » mais appartient à la langue écrite et oratoire ; il se construit sans « pas ».', modele: 'Nul ne saurait nier l’urgence de la situation.' },
      ],
      rhetorique: [
        { surface: 'pris en étau', figure: 'Métaphore', effet: 'L’image physique de l’étau traduit une contrainte mécanique inévitable ; elle présente le gouvernement comme victime des circonstances plus que de ses choix.' },
        { surface: 'budget de rigueur qui ne dit pas son nom', figure: 'Dénonciation d’un euphémisme', effet: 'L’opposition accuse le pouvoir de dissimuler la réalité des économies sous un vocabulaire adouci ; la formule est plus accusatrice qu’une critique frontale.' },
      ],
    },
  },
  {
    date: '2026-10-27',
    title: 'Commerce : l’Europe cherche une voix commune',
    text: `Au sommet de Bruxelles, les Vingt-Sept se sont efforcés de parler d'une seule voix face à la montée du protectionnisme. Les dirigeants européens ont réaffirmé leur attachement au multilatéralisme, tout en admettant que l'Union ne pouvait plus se contenter d'un rôle de simple spectatrice dans la compétition entre grandes puissances.

Au cœur des discussions figurait la question des subventions massives accordées par certains partenaires à leurs industries. Plusieurs capitales plaident pour un durcissement des mesures de défense commerciale, quand d'autres, soucieuses de préserver leurs exportations, redoutent un engrenage de représailles. La présidence tente de ménager la chèvre et le chou en proposant un dispositif graduel, qui ne serait déclenché qu'en dernier recours.

Reste que les divergences sont profondes. Les États les plus exposés à la concurrence étrangère jugent urgent d'agir, alors que les économies tournées vers l'export mettent en garde contre toute escalade. Le compromis, s'il aboutit, devra répondre à un double impératif : protéger le tissu industriel européen sans fermer le marché unique au reste du monde.

D'ici là, les négociations commerciales avec les partenaires du continent se poursuivent à huis clos. Nul ne sait encore si elles déboucheront sur un accord avant la fin de l'année.`,
    analysis: {
      title: 'L’Europe entre ouverture et défense commerciale',
      summary: 'Les Vingt-Sept cherchent une ligne commune face aux subventions étrangères. Les pays exposés veulent durcir la défense commerciale, les exportateurs craignent l’escalade.',
      theme: 'Commerce international',
      vocabulaire: [
        V('réaffirmer', 'réaffirmé', 'actif', 'Affirmer de nouveau avec force.', '重申', { fam: ['affirmer', 'affirmation'], col: ['réaffirmer son attachement à', 'réaffirmer son soutien'], ex: 'Le président a réaffirmé son soutien à l’Alliance.' }),
        V('un durcissement (m.)', 'durcissement', 'actif', 'Fait de devenir plus strict ou plus sévère.', '强化；收紧', { fam: ['dur', 'durcir'], col: ['durcissement du ton', 'durcissement des conditions'], ex: 'On observe un durcissement du discours sur l’immigration.' }),
        V('soucieux (de)', 'soucieuses de préserver', 'actif', 'Qui se préoccupe de quelque chose, qui y tient.', '重视…的；关切…的', { col: ['soucieux de l’environnement', 'soucieux de préserver'], ex: 'Soucieux de rassurer, le ministre a multiplié les déclarations.' }),
        V('un engrenage (m.)', 'engrenage', 'actif', 'Enchaînement de faits dont on ne peut plus s’échapper.', '连锁升级；恶性循环', { col: ['un engrenage de violence', 'être pris dans l’engrenage'], ex: 'Les sanctions risquent d’enclencher un engrenage de représailles.' }),
        V('les représailles (f. pl.)', 'représailles', 'actif', 'Mesures de riposte prises en réponse à une action jugée hostile.', '报复措施', { col: ['exercer des représailles', 'en représailles à'], note: 'Presque toujours au pluriel.', ex: 'Pékin a annoncé des représailles commerciales.' }),
        V('un dispositif (m.)', 'dispositif', 'actif', 'Ensemble organisé de mesures pour atteindre un but.', '机制；措施体系', { col: ['mettre en place un dispositif', 'un dispositif de sécurité'], ex: 'Un dispositif d’alerte précoce sera mis en place.' }),
        V('déclencher', 'déclenché', 'actif', 'Mettre en marche, provoquer.', '触发；启动', { col: ['déclencher une procédure', 'déclencher une crise'], ex: 'La clause pourra être déclenchée à la majorité qualifiée.' }),
        V('un impératif (m.)', 'impératif', 'actif', 'Exigence à laquelle on ne peut échapper.', '迫切要求；必要条件', { col: ['un impératif de sécurité', 'répondre à un impératif'], ex: 'La transition énergétique est devenue un impératif économique.' }),
      ],
      expressions: [
        V('parler d’une seule voix', 'parler d’une seule voix', 'actif', 'Défendre une position commune.', '用同一个声音说话；立场一致', { ex: 'Les partenaires sociaux ont réussi à parler d’une seule voix.' }),
        V('la montée du protectionnisme', 'montée du protectionnisme', 'actif', 'Progression des politiques de protection du marché national.', '保护主义抬头', { col: ['la montée du populisme', 'la montée des tensions'], ex: 'La montée du protectionnisme inquiète les exportateurs.' }),
        V('se contenter de', 'se contenter d’un rôle de simple spectatrice', 'actif', 'Ne pas chercher à obtenir davantage que.', '满足于…；仅限于…', { ex: 'L’Europe ne peut plus se contenter de commenter.' }),
        V('plaider pour', 'plaident pour un durcissement', 'actif', 'Défendre une idée, la soutenir avec des arguments.', '主张；为…辩护', { col: ['plaider pour une réforme', 'plaider en faveur de'], ex: 'Plusieurs ONG plaident pour un moratoire.' }),
        V('les mesures de défense commerciale', 'mesures de défense commerciale', 'actif', 'Outils (droits antidumping, quotas) qui protègent les producteurs contre la concurrence jugée déloyale.', '贸易防御措施', { ex: 'Bruxelles étudie de nouvelles mesures de défense commerciale.' }),
        V('ménager la chèvre et le chou', 'ménager la chèvre et le chou', 'actif', 'Satisfaire deux parties aux intérêts opposés.', '两边都不得罪；左右逢源', { note: 'Familier, mais fréquent dans la presse politique.', ex: 'Le gouvernement tente de ménager la chèvre et le chou.' }),
        V('en dernier recours', 'en dernier recours', 'actif', 'Seulement quand tout le reste a échoué.', '作为最后手段', { ex: 'La force ne doit être employée qu’en dernier recours.' }),
        V('mettre en garde contre', 'mettent en garde contre toute escalade', 'actif', 'Avertir d’un danger.', '警告；提醒注意…的危险', { ex: 'Les experts mettent en garde contre un emballement des prix.' }),
        V('déboucher sur', 'déboucheront sur un accord', 'actif', 'Aboutir à, avoir pour résultat.', '导致；通向', { ex: 'Ces discussions n’ont débouché sur rien.' }),
        V('le tissu industriel', 'tissu industriel', 'actif', 'Ensemble des entreprises industrielles d’un territoire et de leurs liens.', '工业基础；产业网络', { col: ['le tissu économique', 'le tissu associatif'], ex: 'La région a perdu une part de son tissu industriel.' }),
        V('à huis clos', 'à huis clos', 'actif', 'Sans public ni presse.', '闭门（进行）', { ex: 'Le procès se tiendra à huis clos.' }),
      ],
      connecteurs: [
        V('tout en + gérondif', 'tout en admettant que', 'actif', 'Exprime une concession en même temps qu’une action.', '虽然…但同时…', { fn: 'concession', ex: 'Il salue le texte tout en regrettant sa lenteur.' }),
        V('reste que', 'Reste que', 'actif', 'Il n’en est pas moins vrai que.', '问题依然是…', { fn: 'restriction', ex: 'Reste que le calendrier est serré.' }),
        V('alors que', 'alors que', 'actif', 'Oppose deux situations.', '而；然而（对比）', { fn: 'opposition', ex: 'Certains défendent la réforme alors que d’autres la rejettent.' }),
        V('d’ici là', 'D’ici là', 'actif', 'Entre maintenant et ce moment futur.', '在此之前', { fn: 'temps', ex: 'D’ici là, les marchés resteront nerveux.' }),
      ],
      syntaxe: [
        { surface: 'Les États les plus exposés à la concurrence étrangère jugent urgent d’agir', structure: 'Verbe d’opinion + adjectif attribut + « de » + infinitif', explication: '« Juger urgent de + infinitif » est plus dense que « penser qu’il est urgent d’agir » : l’adjectif attribut suit directement le verbe, sans « il est ».', modele: 'Les experts jugent indispensable de revoir la méthode.' },
        { surface: 'qui ne serait déclenché qu’en dernier recours', structure: 'Conditionnel de l’éventualité + restriction « ne… que »', explication: '« Ne… que » limite la condition (seulement en dernier recours) ; le conditionnel signale une mesure encore hypothétique.', modele: 'Un dispositif qui ne serait activé qu’en cas de crise grave.' },
        { surface: 'Nul ne sait encore si elles déboucheront sur un accord avant la fin de l’année', structure: '« Nul ne » + interrogative indirecte au futur', explication: '« Si » introduit une question indirecte ; on emploie le futur, car le fait est à venir.', modele: 'Nul ne sait encore si le texte sera voté avant l’été.' },
      ],
      rhetorique: [
        { surface: 'parler d’une seule voix', figure: 'Métaphore', effet: 'L’unité politique devient une voix unique : l’image insiste sur la cohésion attendue et suggère, par contraste, la réalité des divisions.' },
        { surface: 'ménager la chèvre et le chou', figure: 'Expression imagée', effet: 'Le ton familier présente la présidence en équilibriste, avec une légère ironie sur la difficulté de contenter tout le monde.' },
      ],
    },
  },
];
