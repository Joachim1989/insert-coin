# Retour en arrière — si un problème apparaît sur le terrain

Ce document explique comment republier la dernière version d'avant le
découpage en modules à la racine du site, **depuis un téléphone, via
l'interface web de GitHub uniquement — sans terminal, sans `git`, sans
machine de développement, sans moi.**

Tout ce qui suit a été vérifié directement (diff, hash de commit, historique
git réel) au moment de l'écriture — rien n'est deviné.

## Le commit de référence

**`f4e9457`** — *"Ajoute un relais Cloudflare Worker pour Brickset (CORS
bloqué)"*, le dernier commit avant le début du découpage.

Confirmé par `git log` : c'est le commit juste avant `eae76cc` *"Découpe le
moteur de cotation en modules ES..."*, qui a lancé le chantier de refactor.
Son `index.html` est un fichier autonome complet et fonctionnel : 4945
lignes, 296 175 octets — l'app telle qu'elle tournait avant tout le travail
de découpage, testée et publiée à l'époque.

## Pourquoi le retour est simple : un seul fichier à remplacer

Comparé fichier par fichier (hash de contenu Git, pas une estimation) entre
`f4e9457` et l'état actuel de `main` :

| Fichier racine | Identique à `f4e9457` ? |
|---|---|
| `manifest.json` | ✅ oui, byte pour byte |
| `sw.js` | ✅ oui, byte pour byte |
| `icon-192.png`, `icon-512.png`, `icon-mask-192.png`, `icon-mask-512.png` | ✅ oui, byte pour byte |
| `pixel-papa-logo.png` | ✅ oui, byte pour byte |
| `index.html` | ❌ seul fichier qui diffère |

**Un seul fichier à remplacer : `index.html`.** Rien d'autre à toucher.

## Tes données survivent-elles ? Oui — vérifié, pas supposé

Toutes les clés `localStorage` utilisées par l'ancienne version (`f4e9457`)
et par la version actuelle ont été comparées une par une (extraction de
toutes les constantes `*_STORE` des deux versions) : **identiques, sans
exception** — `insertcoin.log`, `insertcoin.sorties`, `insertcoin.cal`,
`insertcoin.gemini.key`, `insertcoin.discogs.token`, `insertcoin.drive.*`,
etc., portent exactement le même nom des deux côtés.

Une seule clé existe en plus dans la version actuelle :
`insertcoin.recherches` (l'historique des recherches). Si tu reviens à
l'ancienne version, cette clé reste dans le stockage de ton téléphone,
intacte, mais l'ancien code ne la lit ni ne l'affiche — elle ne sera pas
perdue, juste invisible tant que tu n'es pas revenue à la version actuelle.

`localStorage` est rattaché à l'origine du site
(`https://joachim1989.github.io/insert-coin/`), pas au contenu du fichier
`index.html` servi à un instant donné — remplacer ce fichier ne touche
jamais aux données déjà stockées sur ton téléphone. Ton journal, tes sorties
archivées, ton calendrier, tes clés API : tout reste en place, dans les deux
sens (retour en arrière, puis retour à la version actuelle plus tard).

## Procédure, depuis ton téléphone, uniquement via github.com

**1. Copie l'ancien contenu.**
Ouvre cette adresse dans le navigateur de ton téléphone :
```
https://raw.githubusercontent.com/Joachim1989/insert-coin/f4e9457/index.html
```
Sélectionne tout le texte de la page (sur mobile : appui long → "Tout
sélectionner") et copie-le.

**2. Ouvre l'éditeur du fichier actuel.**
```
https://github.com/Joachim1989/insert-coin/edit/main/index.html
```
(Connecte-toi si GitHub te le demande.)

**3. Remplace le contenu.**
Dans l'éditeur, sélectionne tout le texte existant et supprime-le, puis colle
le contenu copié à l'étape 1.

**4. Commit directement sur `main`.**
Fais défiler jusqu'en bas de la page. Un message de commit est déjà proposé
par GitHub ; remplace-le par quelque chose comme *"Retour d'urgence à la
version d'avant le découpage (f4e9457)"*. Vérifie que l'option choisie est
bien **"Commit directly to the main branch"** (pas "Create a new branch"),
puis valide.

**5. Attends la republication.**
GitHub Pages republie le site automatiquement après le commit — compte
quelques dizaines de secondes. Vérifie en ouvrant un **nouvel onglet** (pas
celui déjà ouvert : un onglet déjà chargé peut garder l'ancienne page en
mémoire même après la republication) sur :
```
https://joachim1989.github.io/insert-coin/
```

## Combien de temps ça prend

De l'ordre de **5 à 10 minutes** dans de bonnes conditions réseau : c'est une
estimation, pas un temps mesuré en conditions réelles — le facteur limitant
est de manipuler un fichier de 296 Ko (4945 lignes) dans l'éditeur mobile de
GitHub, pas la difficulté de la manipulation elle-même. Si ça semble lent ou
figé, c'est attendu sur un gros fichier en 3G faible ; laisse le temps à la
page de répondre avant de recommencer.

## Revenir à la version actuelle ensuite

Une fois le problème résolu (ou de retour devant un ordinateur), la version
actuelle du découpage reste entièrement intacte dans l'historique Git — rien
n'est perdu par ce retour en arrière. Demande-moi simplement de republier
`main` depuis l'état du dépôt d'avant ce retour d'urgence, ou republie
`index.html` de la même façon en repartant du commit le plus récent sur
`main` au lieu de `f4e9457`.
