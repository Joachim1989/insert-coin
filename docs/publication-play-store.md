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
| URL de départ | `https://joachim1989.github.io/insert-coin/index.html` — deviendra `https://<domaine perso>/index.html` une fois le domaine actif | hébergement GitHub Pages actuel |
| Couleur de thème | `#0a0a0c` | `public/manifest.json` |
| Icône (512×512) | `icon-512.png` | `public/manifest.json` |
| Icône maskable (512×512) | `icon-mask-512.png` | `public/manifest.json` |
| Orientation | portrait | `public/manifest.json` |

## Hébergement d'`assetlinks.json` — TRANCHÉ le 31/08/2026

Android vérifie qu'une TWA a le droit de s'afficher sans barre d'adresse en
lisant un fichier à une adresse **fixe, à la racine du domaine** :
`https://<ton-domaine>/.well-known/assetlinks.json`.

Décision : **domaine personnalisé** (ex. `pixelpapa.be`), plutôt qu'un
second dépôt `joachim1989.github.io`. Cohérent avec l'ID de package déjà
choisi (`be.pixelpapa.insertcoin`) et avec le nom "Pixel Papa" déjà utilisé
dans l'app — et une fois configuré, un domaine personnalisé pour un dépôt
GitHub Pages sert **tout le contenu de ce dépôt à la racine du domaine**,
chemins compris (`pixelpapa.be/preview/...` reste `preview/...`) : pas
besoin d'un second dépôt, `assetlinks.json` peut vivre directement ici.

### Étapes, dans l'ordre

1. **[À FAIRE PAR TOI]** Choisir et acheter le nom de domaine (vérifier sa
   disponibilité d'abord — `pixelpapa.be` n'est qu'un exemple, pas une
   réservation). Un `.be` chez un registrar belge (Combell, OVH) ou
   généraliste (Namecheap, Gandi) coûte typiquement 10-20 €/an. Je ne peux
   pas faire cet achat à ta place — c'est un paiement, une décision qui
   t'engage financièrement.
2. **[À FAIRE PAR TOI]** Une fois le domaine acheté, configurer le DNS chez
   ton registrar pour pointer vers GitHub Pages :
   - Pour le domaine nu (`pixelpapa.be`) : 4 enregistrements **A** vers
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153`.
   - Si tu veux aussi `www.pixelpapa.be` : un enregistrement **CNAME**
     vers `joachim1989.github.io`.
   - La propagation DNS peut prendre de quelques minutes à 24h.
3. Une fois le domaine acheté et le DNS configuré, dis-le-moi avec le nom
   exact du domaine : j'ajoute le fichier `CNAME` dans ce dépôt (racine) et
   active le domaine personnalisé côté GitHub Pages — **pas avant**, un
   `CNAME` posé sur un domaine pas encore configuré peut casser
   temporairement l'accès au site actuel.
4. **[À FAIRE PAR TOI]** Créer un compte développeur Google Play Console
   (25 $ à vie, vérification d'identité qui peut prendre plusieurs jours —
   à lancer tôt, pas la veille d'une publication voulue).
5. Installer [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
   (nécessite Node.js, déjà présent sur cette machine, et un JDK — Bubblewrap
   propose de l'installer automatiquement au premier lancement).
6. Lancer `bubblewrap init --manifest=https://<ton-domaine>/manifest.json`
   — répondre aux questions avec les valeurs du tableau ci-dessus quand
   elles sont demandées (package ID, couleurs, icônes sont déjà dans le
   manifest et seront pré-remplies).
7. Bubblewrap génère une **clé de signature Android** (`android.keystore`)
   pendant `init`. **[À FAIRE PAR TOI, ET À CONSERVER EN LIEU SÛR]** : cette
   clé privée signe toutes les futures mises à jour de l'app — la perdre
   revient à ne plus jamais pouvoir publier de mise à jour sous le même ID
   d'app. Ne jamais la commiter dans le dépôt Git (public).
8. `bubblewrap build` génère `assetlinks.json` avec la bonne empreinte
   SHA-256 de cette clé — ce fichier généré va dans
   `public/.well-known/assetlinks.json` de CE dépôt (servi à la racine du
   domaine personnalisé une fois celui-ci actif).
9. `bubblewrap build` produit aussi le fichier `.aab` (Android App Bundle)
   à uploader dans la Play Console.
10. **[À FAIRE PAR TOI]** Dans la Play Console : fiche store (captures
    d'écran, description, icône), lien vers la politique de
    confidentialité (sur le domaine personnalisé une fois actif), formulaire
    "Data safety" (voir la politique de confidentialité pour le détail
    exact de ce qui est envoyé, et à qui).

## Hors de portée de cette préparation

- La création du compte Play Console et son paiement.
- La génération et la garde de la clé de signature (jamais dans ce
  dépôt public).
- Les captures d'écran et le texte marketing de la fiche store — à faire
  quand la question du modèle économique (BYOK vs backend payant) sera
  tranchée, pour ne pas décrire un produit qui changera de forme entre
  temps.
