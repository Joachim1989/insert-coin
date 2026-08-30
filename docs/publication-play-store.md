# Publication sur le Play Store — préparation TWA

Ce document rassemble ce qui est déjà tranché et ce qui reste à faire pour
publier Insert Coin comme app Android via une **TWA** (Trusted Web
Activity) — la PWA existante, empaquetée sans réécriture native.

Contrairement au code de l'app, rien ici n'est vérifiable par un test
automatisé : c'est de la configuration d'outillage et des démarches
administratives. Chaque étape marquée **[À FAIRE PAR TOI]** nécessite ton
compte, ta carte d'identité ou ta clé privée — aucun agent ne peut s'y
substituer.

## Décisions déjà prises

| Paramètre | Valeur | Source |
|---|---|---|
| ID du package Android | `be.pixelpapa.insertcoin` | décidé le 30/08/2026 — **définitif après publication, ne peut plus changer** |
| Nom affiché | Insert Coin | `public/manifest.json` |
| URL de départ | `https://joachim1989.github.io/insert-coin/index.html` | hébergement GitHub Pages actuel |
| Couleur de thème | `#0a0a0c` | `public/manifest.json` |
| Icône (512×512) | `icon-512.png` | `public/manifest.json` |
| Icône maskable (512×512) | `icon-mask-512.png` | `public/manifest.json` |
| Orientation | portrait | `public/manifest.json` |

## Ce qui reste à trancher : où héberger `assetlinks.json`

Android vérifie qu'une TWA a le droit de s'afficher sans barre d'adresse en
lisant un fichier à une adresse **fixe, à la racine du domaine** :
`https://joachim1989.github.io/.well-known/assetlinks.json`.

J'ai vérifié : `https://joachim1989.github.io/` renvoie un 404 GitHub Pages
aujourd'hui — il n'y a pas encore de site à la racine de ton compte, l'app
n'existe qu'en sous-chemin (`/insert-coin/`). Ce fichier doit pourtant vivre
à la racine, pas dans ce dépôt. Deux options :

1. **Créer un second dépôt nommé exactement `joachim1989.github.io`**
   (le nom spécial que GitHub sert automatiquement à la racine du compte).
   Gratuit, rapide, mais un deuxième dépôt à maintenir juste pour un
   fichier.
2. **Domaine personnalisé** (ex. `pixelpapa.be`, cohérent avec l'ID de
   package choisi) pointé vers ce dépôt `insert-coin` via GitHub Pages.
   Coût d'un nom de domaine (~10-20 €/an) + configuration DNS chez le
   registrar, mais un domaine à toi plutôt qu'un sous-domaine
   `github.io` — meilleure image pour une app payante, et
   `assetlinks.json` peut alors vivre directement dans CE dépôt.

**[À FAIRE PAR TOI]** : trancher entre les deux avant d'aller plus loin —
ça détermine où poser le fichier.

## Étapes concrètes (une fois l'hébergement de assetlinks.json choisi)

1. **[À FAIRE PAR TOI]** Créer un compte développeur Google Play Console
   (25 $ à vie, vérification d'identité qui peut prendre plusieurs jours —
   à lancer tôt, pas la veille d'une publication voulue).
2. Installer [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
   (nécessite Node.js, déjà présent sur cette machine, et un JDK — Bubblewrap
   propose de l'installer automatiquement au premier lancement).
3. Lancer `bubblewrap init --manifest=https://joachim1989.github.io/insert-coin/manifest.json`
   — répondre aux questions avec les valeurs du tableau ci-dessus quand
   elles sont demandées (package ID, couleurs, icônes sont déjà dans le
   manifest et seront pré-remplies).
4. Bubblewrap génère une **clé de signature Android** (`android.keystore`)
   pendant `init`. **[À FAIRE PAR TOI, ET À CONSERVER EN LIEU SÛR]** : cette
   clé privée signe toutes les futures mises à jour de l'app — la perdre
   revient à ne plus jamais pouvoir publier de mise à jour sous le même ID
   d'app. Ne jamais la commiter dans le dépôt Git (public).
5. `bubblewrap build` génère `assetlinks.json` avec la bonne empreinte
   SHA-256 de cette clé — c'est CE fichier généré qu'il faut poser à
   l'emplacement choisi ci-dessus (dépôt racine ou domaine personnalisé).
6. `bubblewrap build` produit aussi le fichier `.aab` (Android App Bundle)
   à uploader dans la Play Console.
7. **[À FAIRE PAR TOI]** Dans la Play Console : fiche store (captures
   d'écran, description, icône), lien vers
   `https://joachim1989.github.io/insert-coin/confidentialite.html`,
   formulaire "Data safety" (voir la politique de confidentialité pour le
   détail exact de ce qui est envoyé, et à qui).

## Hors de portée de cette préparation

- La création du compte Play Console et son paiement.
- La génération et la garde de la clé de signature (jamais dans ce
  dépôt public).
- Les captures d'écran et le texte marketing de la fiche store — à faire
  quand la question du modèle économique (BYOK vs backend payant) sera
  tranchée, pour ne pas décrire un produit qui changera de forme entre
  temps.
