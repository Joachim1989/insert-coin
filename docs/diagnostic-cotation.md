# Diagnostic — les trois erreurs de cotation

Étape 3 du chantier de refactor. Ce document explique pourquoi chacun des
trois cas signalés se trompe, avant toute correction. Les tests qui
reproduisent ces erreurs sont dans `tests/pricing.test.js`.

## Cas 1 — Lot Skylanders : 1 € au lieu de 12-15 €

`ficheCalc` traite un lot exactement comme un objet seul : il applique la
décote de complétude (`attCoef`) et le port par-dessus le prix marché, sans
distinction. Or pour un lot, le prompt (`BRIEF_BASE`) dit explicitement à
l'IA que `marche` est déjà *"le prix du LOT ENTIER tel qu'il est, en vrac,
sans boîtes"* — c'est-à-dire un prix qui a déjà encaissé l'absence
d'accessoires. Quand l'IA signale en plus "le portail non vu → -65 %"
(un poids repris tel quel de la logique pensée pour un objet unique, où une
pièce essentielle manquante rend vraiment l'objet inutilisable), cette
décote s'applique une seconde fois sur un prix qui l'intégrait déjà.

Avec marché=14 € (cohérent avec les 12-15 € réels), état bon (coefficient
1), et une seule ligne "non confirmé" à -65 % : la complétude tombe à 0.35,
le port (colis moyen, 3 €) mange le peu qui reste, et le calcul
(14 × 1 × 0.35 − 3) ÷ 3 donne 1 €. Le marché était pourtant juste — c'est le
cumul des décotes qui écrase le résultat.

## Cas 2 — Remember Me PS3 : 6 € au lieu de 20 €

Ici l'arithmétique n'est pas en cause. Avec marché=20 € (cohérent avec les
annonces Vinted), état normal (coefficient 1), rien de manquant : le calcul
donne net = 18 € (20 − 2 € de port), puis plafond = 18 ÷ 3 = 6 €. Chaque
étape fait ce qu'elle est censée faire — la règle du tiers ("tu n'achètes
jamais au-dessus du tiers") est une règle *explicite et voulue* de l'app,
pas un accident.

Le problème est ailleurs : le chiffre affiché en gros, en haut de la fiche
("TON MAX"), c'est ce 6 €-là — le plafond de négociation, pas l'estimation
de valeur. La "revente nette" (18 €, cohérente avec les 20 € vus sur
Vinted) existe bien sur la fiche, mais en plus petit, plus bas. Un chineur
qui retient "l'app dit 6 €" n'a pas tort de lire ce qu'on lui montre le plus
gros — c'est la hiérarchie visuelle qui raconte "l'app se trompe", alors que
le moteur, lui, avait la bonne estimation sous la main.

*(Le test qui échoue ici — plafond ≥ moitié de la revente nette — encode
une hypothèse de correction possible, pas une certitude : à valider avant
de coder quoi que ce soit.)*

## Cas 3 — Bande originale Top Gun : 20 € au lieu de 3-5 €

Ce cas est d'une nature différente des deux précédents, et c'est la
découverte la plus importante des trois.

`ficheCalc` ne fait que *réduire* un prix marché : au mieux (état neuf,
coefficient ×1.8), un marché correctement estimé à 4-5 € ne peut
mathématiquement pas dépasser 2-3 € de plafond. Il est donc impossible que
le moteur ait *lui-même* transformé une bonne estimation en 20 €. Si "20 €"
est sorti de l'app, c'est que `marche` valait déjà around 20 € en entrée —
une estimation de l'IA, pas un calcul du moteur.

Ce qui EST un vrai défaut du moteur, démontré par un test qui échoue : l'IA
renvoie un champ `circulation` ("rare" / "peu courant" / "courant" /
"massif") en même temps que son estimation chiffrée, et le prompt lui dit
explicitement *"un titre pressé en masse ne vaut presque rien même dans une
catégorie rentable"*. Mais `ficheCalc` n'utilise `circulation` nulle part.
Deux fiches identiques sauf sur ce champ produisent exactement le même
prix. Le signal qualitatif que le modèle donne pour se corriger lui-même
n'est jamais exploité pour tempérer un chiffre douteux.

## Y a-t-il une cause commune ?

Partiellement, et il faut résister à la tentation d'en faire une seule
histoire.

**Cas 1 et 2 partagent un mécanisme :** le pipeline de décotes (état ×
complétude − port, puis ÷3) est appliqué mécaniquement, en chaîne, sans se
demander si une décote a déjà été comptée ailleurs (cas 1) ni si le chiffre
qui en ressort sera lu comme un plafond de négociation ou comme
l'estimation elle-même (cas 2).

**Le cas 3 est différent :** ce n'est pas un problème de calcul en chaîne,
c'est une absence totale de garde-fou — le moteur ne croise jamais deux
signaux que le modèle lui donne pourtant dans la même réponse
(`marche` et `circulation`).

**Le point commun réel, au-delà du calcul :** dans les trois cas, `ficheCalc`
traite chaque champ de la fiche indépendamment des autres, sans aucune
cohérence croisée — ni entre "lot" et "attendu", ni entre "plafond" et
"net" au moment de l'affichage, ni entre "marche" et "circulation". Le
moteur transforme fidèlement ce qu'on lui donne ; il ne vérifie jamais si ce
qu'on lui donne se tient.

## Tranchage (22/08/2026)

**Cas 2 — pas un bug.** La règle du tiers est intentionnelle. Le test est
désormais vert et verrouille ce comportement (`ficheCalc` inchangé).

**Défaut réel identifié, noté pour plus tard — pas fait :** sur la fiche, le
chiffre géant ("TON MAX") est le prix d'achat ; la revente nette (cohérente
avec le marché réel) est affichée en petit, plus bas. Un chineur qui ne
retient que le gros chiffre peut légitimement lire ça comme "l'app sous-
estime l'objet". Tâche d'interface à traiter séparément — voir
`src/ui/fiche.js`, fonctions `renderResult` / `fichePaint` (bloc `.aihead`
vs `.px-calc`) : rien à changer dans le moteur de cotation pour ça.

**Cas 1 — CORRIGÉ (23/08/2026).** Cause confirmée (décote de complétude
appliquée en double sur les lots). Autres décotes vérifiées pour le même
risque : `ce` (état) et `port` s'appliquent une seule fois, globalement, sur
la fiche entière — ni l'un ni l'autre ne dépend de `f.attendu` ni ne
compose avec un autre mécanisme spécifique aux lots. Le seul point de double
comptage trouvé est `attCoef`/`attPerte`.

Règle écrite dans `attCoef` (`src/pricing/engine.js`) : sur un lot
(`f.lot === true`, posé par Gemini — jamais par les modes "Un lot"/bac ni
"Un stand", qui ne passent pas par `ficheCalc`), la décote de complétude est
plafonnée à 25 % de la valeur, mais uniquement quand un seul élément de
`f.attendu` est constaté absent. Dès qu'un deuxième élément manque, la
décote complète repart sans plafond — vérifié par un garde-fou dédié
(`tests/fixtures/lot-boites-vides.js`, un lot de boîtiers vides à deux
éléments manquants, reste à 0 €). "Un stand" n'est pas traité comme un lot :
question sans objet techniquement, et la mauvaise réponse sur le fond même
si le code changeait — un stand, ce sont des objets indépendants, rien de
partagé à décoter en trop.

Skylanders : 1 € → 3 € (plafond, un prix d'achat maximum — pas la valeur du
lot, même verrou que le cas 2). Tests à jour dans `tests/pricing.test.js` :
l'ancien test qui documentait le 1 € a été retiré (son rôle était de
caractériser le bug, pas de figer un comportement à garder), remplacé par le
test qui verrouille le 3 € correct.

**Cas 3 — investigation Discogs, avant tout câblage de `circulation`.**
Deux hypothèses testées avec les vraies fonctions du projet (pas de
supposition) :
- `discMusique(...)` sur plusieurs formulations plausibles de l'objet
  ("Bande originale Top Gun", "Vinyle Bande originale Top Gun", etc.) :
  retourne `true` dans tous les cas. **Écarté.**
- `discPertinent`/le seuil de correspondance (0.45) contre des titres
  Discogs plausibles ("Top Gun (Original Motion Picture Soundtrack)", avec
  ou sans année, avec ou sans "Various -") : score entre 0.50 et 0.80 dans
  tous les cas testés — `collNorm` retire le contenu entre parenthèses, donc
  le sous-titre anglais ne dilue pas la comparaison comme je le pensais au
  départ. **Écarté** (mon hypothèse initiale était fausse).

Hypothèses restantes, non tranchables sans les données réelles du cas :
1. Aucun jeton Discogs n'était enregistré au moment du test — `discGreffe`
   s'arrête silencieusement avant tout appel. La plus probable, la plus
   simple à confirmer.
2. Un jeton était présent, un match a été trouvé, mais `lowest_price` était
   vide côté Discogs (`c.bas = 0`) — possible si aucun exemplaire n'est
   actuellement en vente sur le marketplace pour ce pressage précis, même
   très diffusé. Dans ce cas la carte Discogs s'affiche mais ne remplace
   jamais `marche`.
3. Un jeton était présent, un match a été trouvé, mais sur un pressage
   différent du disque en main (réédition limitée collector, par exemple) —
   la cote Discogs aurait alors bien remplacé l'IA, avec un prix réel mais
   pour le mauvais exemplaire.

**Cas 3 — TRANCHÉ (23/08/2026).** Retest sur téléphone, jeton Discogs
configuré : carte "Cote Discogs" affichée, cote à 9 €, prix final de la
fiche recalculé à partir de cette valeur (le mécanisme de remplacement dans
`discGreffe`/`renderResult` fonctionne comme conçu — confirmé, pas
seulement lu dans le code). Ça confirme l'hypothèse 1 : le 20 € rapporté à
l'origine venait très probablement d'un jeton non configuré au moment des
faits, pas d'un bug de calcul. Les hypothèses 2 et 3 restent possibles dans
l'absolu mais ne sont plus la piste principale — rien dans ce retest ne les
confirme.

Deux correctifs écrits malgré tout, un par défaut réel identifié en cours
de route :

- **Badge de confiance ambigu.** Le badge "Cote partielle" laissait croire
  à une vérification externe partielle, alors qu'il ne reflétait que
  l'auto-évaluation de l'IA (`f.confiance`) — même apparence, jeton
  configuré ou pas, match trouvé ou pas. Renommé "Estimation confiante"
  dans `src/ui/fiche.js` (`renderResult`). Aucun changement de calcul,
  seulement le libellé — "Cote vérifiée" reste réservé aux sources
  externes réelles (`f.marcheReel`).
- **Filet de sécurité "circulation".** Le modèle renvoie `circulation` en
  même temps que son estimation chiffrée et le prompt lui dit que ça doit
  peser sur le prix, mais `ficheCalc` ne s'en servait jamais. Ajouté
  `CIRCULATION_COEF` dans `src/pricing/engine.js` : seul le niveau
  "massif" est tempéré (×0.6), et uniquement sur l'estimation IA quand
  aucune source vérifiée n'existe — jamais sur un prix Discogs/
  Rebrickable/Brickset/vente réelle, qui décrit déjà l'exemplaire précis.
  Volontairement étroit : "courant" et "peu courant" restent neutres pour
  ne pas rouvrir les cas 1 (Skylanders, "courant") et 2 (Remember Me,
  "peu courant"), sans rapport avec ce défaut. C'est un filet SECONDAIRE :
  le vrai correctif reste le remplacement par une source vérifiée
  ci-dessus, ce filet ne joue que quand cette source n'existe pas.

Question pour trancher : la carte "Cote Discogs" est-elle apparue sous la
fiche au moment des faits, et si oui, qu'affichait-elle ?

## Suite du tranchage (22/08/2026, deuxième passe)

### Cas 1 — règle chiffrée validée, deux vérifications faites avant d'écrire

**1. Le drapeau `lot` arrive-t-il jusqu'à `attCoef` ?** Oui, par un seul
chemin, tracé dans le code (pas supposé) :

- `src/pricing/engine.js`, dans `ficheNorm` : `lot: j.lot === true, lotNb:
  Math.max(0, Math.round(nombre(j.lotNb)))`. `f.lot` vient donc du champ
  `lot` que **Gemini renvoie dans son JSON**, pas d'un bouton d'interface.
- `src/api/gemini.js` (le dispatch de `callGemini`) : trois branches selon
  le mode de capture — `bac` → `renderBacResult`, `stand` →
  `renderStandResult`, sinon (single/multi) → `renderResult`.
- Seule `renderResult` appelle `ficheNorm`/`ficheCalc`. `renderBacResult`
  utilise un `j.lot` complètement différent : `const lot =
  Array.isArray(j.lot) ? j.lot : []` (le tableau des objets du bac), un
  champ homonyme sans rapport. `renderStandResult` n'appelle `ficheCalc` nulle
  part.

Donc : le plafond de 25 % que je m'apprête à écrire dans `attCoef` ne peut
se déclencher QUE quand Gemini répond en mode single/multi avec `lot: true`
dans son JSON — jamais depuis le mode "Un lot" (bac) ni "Un stand", qui ne
traversent tout simplement pas cette fonction. Si Gemini oublie de mettre
`lot: true` sur un objet qui est visiblement un lot, le plafond ne se
déclenche pas — mais c'est un problème de fiabilité du JSON renvoyé par
l'IA, pas un problème de câblage entre les mêmes fonctions.

**2. "Un stand" doit-il compter comme un lot ?** Question sans objet
techniquement (le mode stand ne passe jamais par `ficheCalc`, donc le
plafond ne peut de toute façon pas s'y appliquer), mais sur le fond : non,
et je pense que c'est la bonne réponse même si un jour le code changeait.
Un lot, c'est plusieurs UNITÉS d'une même logique de décote (les figurines
d'un même Skylanders, où il manque UN portail partagé). Un stand, c'est
plusieurs OBJETS indépendants (un jeu, une figurine, un DVD, sans rapport
entre eux) — rien n'y est "partagé", donc le raisonnement "un seul élément
manquant ne doit pas décoter tout le lot" n'a pas de sens à cette échelle :
chaque objet du stand a sa propre complétude, sans élément commun à
manquer.

**3. Le plafond de 25 % peut-il masquer une vraie perte ?** Oui, en
principe — c'est pour ça que je ne l'ai pas écrit à plat. Le risque concret
avec les données que le modèle renvoie : `f.attendu` est un tableau, un
élément par ligne "vu / non vu" avec sa propre `perte`. Rien n'empêche
Gemini de renvoyer plusieurs lignes `vu: "non"` sur un lot réellement vide
(boîtiers sans disques, ni notices — testé avec la fixture
`lot-boites-vides.js`). La distinction que je propose et que j'ai codée
dans le test : le plafond de 25 % ne s'applique que si **un seul** élément
de `f.attendu` est constaté manquant. Dès qu'un deuxième élément distinct
est signalé absent, la décote complète (non plafonnée) s'applique — le lot
n'a plus le profil "accessoire partagé unique", il a le profil "plusieurs
pièces vraiment perdues". Vérifié : la fixture à deux éléments manquants
(disques + notices) donne bien `plafond: 0`, aujourd'hui et après la
correction prévue (test de garde-fou dans `tests/pricing.test.js`, doit
rester vert).

**Tests à jour** (dans `tests/pricing.test.js`, encore rouges pour les deux
premiers jusqu'à l'écriture du correctif) :
- Skylanders, un seul élément manquant (le portail) → `plafond` attendu à
  3 € (calcul détaillé en commentaire dans le test).
- `lot-boites-vides`, deux éléments manquants → `plafond` attendu à 0 €,
  déjà vert, doit le rester.

Ces deux nombres restent des **prix d'achat maximum**, pas des estimations
de valeur de revente — même verrou que le cas 2, pour la même raison :
"3 €" ne veut pas dire "le lot vaut 3 €", ça veut dire "tu ne payes pas plus
que 3 € pour ce lot".

Correctif pas encore écrit dans `src/pricing/engine.js` — j'attends ta
confirmation sur cette règle avant de toucher `attCoef`.

### Cas 3 — ce que voit l'utilisateur sans jeton Discogs

Tracé dans `src/ui/fiche.js`. Réponse à ta question : **les deux origines
s'affichent bien de la même façon** — c'est le vrai défaut à corriger.

- `discGreffe` (ligne 606) s'arrête à la toute première ligne :
  `if(!discToken()) return;` — avant même de toucher au DOM. Le
  `<div id="disc-slot"></div>` placeholder (ligne 338 de `renderResult`)
  reste vide, silencieusement. Aucun message, aucune trace visible qu'un
  disque aurait normalement dû être vérifié.
- Le badge de confiance (`cKey`, ligne 313) ne regarde que `f.marcheReel`
  (jamais posé, puisque Discogs n'a pas tourné) et `f.confiance` — **le
  propre avis de Gemini sur lui-même**. Résultat concret : sur un disque
  sans jeton configuré, le badge affiche "Cote partielle" (si Gemini se dit
  confiant) ou "Estimation" — visuellement identique à ce qu'affiche
  n'importe quel objet non musical jamais vérifié par aucune source.

Autrement dit, rien sur la fiche ne distingue aujourd'hui trois situations
pourtant très différentes : "aucun jeton configuré, Discogs n'a jamais été
interrogé", "Discogs interrogé, rien trouvé pour ce pressage" et "l'IA a
deviné, sans aucune vérification externe possible". Les trois rendent un
`disc-slot` vide et un badge "Estimation"/"Cote partielle" identique. Ça
confirme directement ton hypothèse la plus probable pour ce cas précis (pas
de jeton enregistré au moment du test) : si c'était le cas, tu n'avais
strictement aucun moyen de le voir sur la fiche elle-même.

Aucun code touché ici, comme demandé — j'attends ton retest avec le jeton
configuré avant de proposer quoi que ce soit (correctif du badge et/ou
garde-fou circulation).

### Service worker — proposition (pas implémenté)

Découverte en préparant cette section, qui change la portée de la tâche :
**`sw.js` n'est actuellement enregistré nulle part.** J'ai cherché
`serviceWorker`/`register(` dans `src/`, `dev.html` et `index.html` (la
version publiée) : aucune occurrence. Le fichier existe, avec des
commentaires soignés sur le mode hors ligne, mais aucun code n'appelle
`navigator.serviceWorker.register(...)` — le navigateur ne l'installe
donc jamais. Le mode hors ligne décrit dans `sw.js` n'est pas juste
perfectible, il n'est **pas actif du tout** aujourd'hui. C'est plus
important que la stratégie de mise à jour elle-même : sans enregistrement,
la question de rester bloqué sur une version périmée ne se pose même pas
encore.

Proposition en deux temps :

**1. Enregistrement.** Dans `src/ui/main.js`, à la fin de `init()` (ou dans
le `window.onload` de `src/main.js`) :
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
```
Comportement attendu dès ce seul ajout : première installation du cache
(les fichiers listés dans `FILES`), app utilisable hors ligne dès la
deuxième visite. `sw.js` a déjà `skipWaiting()`/`clients.claim()` — la
première installation prend effet immédiatement, sans rien à changer côté
`sw.js` pour ça.

**2. Stratégie de mise à jour, pour éviter le blocage silencieux sur une
version périmée.** Le risque précis : `skipWaiting()` +`clients.claim()`
font prendre le contrôle au nouveau SW dès son activation, mais l'onglet
déjà ouvert continue d'exécuter le JS déjà chargé en mémoire — il ne se
recharge pas tout seul. Sans rien de plus, tu peux avoir un nouveau SW actif
et un vieil écran affiché en même temps, sans le savoir. Deux ajouts pour
couvrir ça, à faire dans une tâche séparée après validation de cette
branche :

- **Détecter la bascule et le signaler, sans recharger tout seul** (un
  rechargement automatique en pleine brocante, au milieu d'une photo ou
  d'une négociation, serait pire que le problème) :
  ```js
  let dejaAverti = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (dejaAverti) return;
    dejaAverti = true;
    // afficher un bandeau non bloquant : "Nouvelle version disponible —
    // recharger", avec un bouton qui fait window.location.reload()
  });
  ```
- **Forcer la vérification à l'ouverture**, pour ne pas dépendre du délai
  de vérification automatique du navigateur (jusqu'à ~24h) : appeler
  `registration.update()` explicitement quand l'app redevient visible
  (`visibilitychange` → `document.visibilityState === 'visible'`), pas
  seulement au chargement — utile en brocante où l'app reste ouverte en
  arrière-plan entre deux fiches et ne recharge jamais toute seule.

Le comportement réseau déjà présent dans `sw.js` (network-first sur
`index.html`, avec repli sur le cache si hors ligne) reste inchangé et
continue de bien faire son travail pour le contenu de la page — cette
proposition ajoute seulement la couche manquante : le worker lui-même, et
un signal visible quand il change de version.

## Bug de terrain — `currentCameraMode` (23/08/2026)

Trouvé par l'utilisateur sur téléphone, sur le sous-dossier `preview/` :
`Uncaught ReferenceError: currentCameraMode is not defined`, en cliquant
"Photographier"/"Galerie" sur l'écran Scan. Même classe que `credCount`
(`ui/hud.js`, trouvé pendant le découpage) : une variable qui vivait comme
`let` de haut niveau dans l'`index.html` monolithique — visible depuis
n'importe quel `onclick="..."` inline, parce que tout partageait le même
scope global — devenue une variable de MODULE ES après le découpage
(`export let currentCameraMode` dans `ui/capture.js`), donc invisible
depuis le HTML même si elle est exportée : un `import` ne rend rien visible
à un attribut HTML, seul `window.x` le fait.

**Correctif :** un getter exporté, `cameraMode()`, exposé sur `window`
comme les autres fonctions ; les deux `onclick="triggerCamera(...)"` de
`dev.html` l'appellent au lieu de lire la variable directement. Comportement
inchangé : `triggerCamera` ne réassigne `currentCameraMode` que si
l'argument reçu est non vide, donc relire la valeur courante pour se la
repasser à soi-même était déjà un no-op avant même le bug.

**Balayage complet du graphe de modules**, pas seulement ce cas :
- `npx eslint src public/sw.js` (règle `no-undef` seule, globals
  navigateur/service-worker + liste exposée sur `window` par `main.js`) :
  après correctif, **zéro autre occurrence**. `google` (`api/googledrive.js`)
  et `XLSX` (`ui/drive.js`) remontent d'abord comme non définis, mais ce
  sont des globals chargés dynamiquement par un `<script>` injecté à
  l'exécution (même mécanisme que l'`index.html` d'origine) — allowlistés,
  pas corrigés.
- `scripts/checkhandlers.mjs` (nouveau) : ESLint ne lit jamais de HTML, donc
  jamais les `onclick="..."` inline — exactement où vivait ce bug. Ce script
  extrait tous les attributs `onXxx="..."` de `dev.html` et des template
  literals générés dans `src/ui/*.js`, et les fait relire par le moteur
  ESLint (mêmes globals) comme des mini-scripts. 81 attributs vérifiés,
  0 problème après correctif. Vérifié à l'aveugle : en réintroduisant
  temporairement `currentCameraMode` dans `dev.html`, le script détecte les
  deux occurrences exactes.

**Garde-fou permanent :** `npm run lint` (les deux vérifications ci-dessus)
tourne désormais en première étape de `npm run build` et `npm test` — ce
défaut ne peut plus atteindre un build ni être marqué vert par erreur.

**Pourquoi la vérification navigateur des 4 vues ne l'a pas attrapé :**
cette vérification changeait de vue (`switchView`) et regardait la console
à chaque fois — un test de *rendu*, pas d'*interaction*. Le code JS d'un
attribut `onclick="..."` n'est compilé/évalué par le navigateur qu'à son
premier déclenchement, jamais au chargement de la page ni à l'affichage de
la vue qui le contient. Contrairement à `credCount` (qui plantait dans
`hudPaint()`, appelée automatiquement à chaque rendu — donc visible dès
qu'une vue s'affichait), `currentCameraMode` ne se déclenche que sur un
clic précis, sur un bouton précis (« Photographier »/« Galerie »), que la
procédure n'a pas simulé — se contenter de changer d'onglet et lire la
console ne pouvait pas le voir, quel que soit le nombre de vues parcourues.
Plus largement : *aucune* quantité de clics manuels ne peut prouver
l'absence de ce bug — seule une preuve exhaustive comme `no-undef` (qui
n'a pas besoin qu'un chemin de code s'exécute pour le vérifier) le peut.
C'est précisément pourquoi le garde-fou ci-dessus est statique, pas un test
d'interaction de plus : il remplace "espérer avoir cliqué le bon bouton"
par "prouver que chaque identifiant se résout, cliqué ou non".
