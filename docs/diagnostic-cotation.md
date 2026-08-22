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

Je n'ai pas touché à `ficheCalc` ni à `ficheNorm` : les trois tests restent
rouges tant qu'on n'a pas décidé ensemble de la correction pour chacun.
