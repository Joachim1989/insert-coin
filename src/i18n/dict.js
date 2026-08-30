// Dictionnaire de traduction. FR est la langue de reference (celle deja
// ecrite en dur dans dev.html avant ce chantier) : toute cle absente d'une
// autre langue retombe sur sa valeur FR (voir index.js, fonction t()).
//
// PORTEE DE CETTE PREMIERE PASSE (30/08/2026) : uniquement le texte
// STATIQUE de dev.html (rien genere dynamiquement par le JS). Les messages
// generes par src/ui/*.js (fiches resultat, alertes, erreurs) restent en
// francais pour l'instant - chantier separe, plus invasif, pas encore fait.
//
// Traduction neerlandaise : premiere passe honnete, pas une relecture
// native. A faire verifier avant une publication commerciale reelle,
// en particulier le jargon brocante/negociation (voir le compte rendu
// du 30/08/2026).
export const DICT = {
  fr: {
    "app.tagline": "Argus de terrain",

    "bc.cadre": "Cadre le code-barres",
    "bc.annuler": "Annuler",

    "hud.score": "Score",
    "hud.credits": "Crédits",
    "hud.file": "En file",

    "mode.objet": "Un objet",
    "mode.bac": "Un lot",
    "mode.stand": "Un stand",

    "shoot.photo.titre": "Photographier",
    "shoot.photo.sub": "l'appareil s'ouvre",
    "shoot.galerie.titre": "Galerie",
    "shoot.galerie.sub": "plusieurs à la fois",
    "shoot.analyser": "Analyser",

    "scan.bc.titre": "Scanner le code-barres",
    "scan.bc.sub": "identification exacte, instantanée",

    "prix.placeholder": "Il en demande combien ? (facultatif)",
    "prix.label": "Prix demandé",

    "autres.summary": "Autres façons de chercher",
    "recherche.placeholder": "Chercher par nom, ou poser une question",
    "recherche.demander": "Demander à l'IA",

    "cal.titre": "Calendrier",
    "cal.sous_titre": "Brocantes à moins de 50 km de Binche, Belgique et France. Recherché sur quefaire.be en priorité, croisé avec d'autres agendas — vérifie avant de partir, une date d'IA reste une date d'IA.",
    "cal.chercher": "Chercher les prochaines dates",
    "cal.ajouter_manuel": "＋ Ajouter à la main",
    "cal.exporter": "Exporter toutes mes dates marquées (.ics)",
    "cal.filtre.toutes": "Toutes",
    "cal.filtre.jyvais": "J'y vais",
    "cal.filtre.grosses": "Les grosses",

    "log.titre": "Journal de chasse",
    "log.tes_achats": "Tes achats",
    "log.terminer_sortie": "Terminer la sortie",
    "log.envoyer_drive": "Envoyer le journal dans mon Drive",
    "log.sorties_archivees": "Sorties archivées",
    "log.vider_journal": "Vider le journal",
    "log.historique_recherches": "Historique des recherches",
    "log.historique_sub": "Chaque photo, scan ou question analysée, achetée ou non — pour retrouver une fiche vue plus tôt.",
    "log.vider_recherches": "Vider l'historique des recherches",

    "guide.titre": "Menu Guide 🧔🏼‍♂️",

    "guide.ia.titre": "⚙️ Configuration IA",
    "guide.ia.cle_label": "Clé API Gemini (stockée localement) :",
    "guide.ia.cle_placeholder": "Collez votre clé API Google ici",
    "guide.ia.modele_label": "Modèle IA (Puissance vs Vitesse) :",
    "guide.ia.verifier_modeles": "Vérifier les modèles disponibles",
    "guide.ia.ground_label": "Chercher les prix sur le web",
    "guide.ia.ground_note": "Indispensable pour des cotes réelles. Décoche seulement en cas d'erreurs 429 répétées.",
    "guide.ia.enregistrer": "Enregistrer les réglages",

    "guide.discogs.titre": "Cotes Discogs (musique)",
    "guide.discogs.explain": "Jeton personnel, à générer sur discogs.com &rarr; Settings &rarr; Developers &rarr; Generate new token. Il reste sur ce téléphone. Pour tout ce qui est disque, Discogs remplace l'estimation de l'IA par le prix réellement pratiqué et le nombre d'exemplaires en vente.",
    "guide.discogs.placeholder": "Colle ton jeton Discogs ici",
    "guide.discogs.enregistrer": "Enregistrer le jeton",
    "guide.discogs.tester": "Tester la connexion Discogs",

    "guide.rebrickable.titre": "Sets LEGO (Rebrickable)",
    "guide.rebrickable.explain": "Clé gratuite et immédiate : rebrickable.com &rarr; ton profil &rarr; Settings &rarr; API &rarr; Generate. Rebrickable ne publie pas de prix — il donne le nombre de pièces et de figurines, les deux chiffres qui font vraiment la valeur d'un set d'occasion.",
    "guide.rebrickable.placeholder": "Colle ta clé Rebrickable",
    "guide.rebrickable.piece": "€ la pièce",
    "guide.rebrickable.figurine": "€ la figurine",
    "guide.rebrickable.bareme": "Barème de revendeur, à corriger avec tes propres ventes.",
    "guide.rebrickable.tester": "Tester la connexion Rebrickable",

    "guide.brickset.titre": "Sets LEGO (Brickset)",
    "guide.brickset.explain": "Clé gratuite sur demande : brickset.com &rarr; ton compte &rarr; API &rarr; Request a key. Brickset donne les mêmes pièces et figurines que Rebrickable, plus le prix de vente neuf officiel LEGO. Sert de second avis quand tu n'as pas de clé Rebrickable — les deux ne s'affichent jamais en double sur une même fiche.",
    "guide.brickset.placeholder": "Colle ta clé Brickset",
    "guide.brickset.relais_html": "<b style=\"color:var(--mid)\">Brickset bloque les appels directs depuis un navigateur</b> — contrairement à Discogs et Rebrickable. La clé seule ne suffit donc pas : il faut un relais gratuit qui transmet la requête à ta place. Deux minutes, une fois :<br>1. <b>dash.cloudflare.com</b> (compte gratuit) &rarr; Workers &amp; Pages &rarr; Create &rarr; « Hello World ».<br>2. Colle le code ci-dessous à la place de l'exemple, dans l'éditeur du navigateur, puis Deploy.<br>3. Colle l'adresse en <b>*.workers.dev</b> qu'il te donne dans le champ juste en dessous, et reteste.",
    "guide.brickset.copier_relais": "Copier le code du relais",
    "guide.brickset.relais_placeholder": "https://xxxxx.workers.dev (relais, optionnel mais nécessaire pour que Brickset marche)",
    "guide.brickset.tester": "Tester la connexion Brickset",

    "guide.sauvegarde.titre": "Sauvegarde",
    "guide.sauvegarde.liberer": "Libérer de la place",
    "guide.sauvegarde.explain": "Journal, sorties archivées, calendrier et bases : tout est stocké dans ce navigateur. Un nettoyage de cache Android l'effacerait sans prévenir.",
    "guide.sauvegarde.drive": "Sauvegarder dans mon Drive",
    "guide.sauvegarde.telecharger": "Télécharger la sauvegarde",
    "guide.sauvegarde.restaurer": "Restaurer une sauvegarde",

    "guide.apparence.titre": "Apparence",
    "guide.apparence.clair": "Clair",
    "guide.apparence.auto": "Auto",
    "guide.apparence.sombre": "Sombre",

    "guide.langue.titre": "Langue",

    "guide.drive.titre": "Mes bases Google Drive",
    "guide.drive.cid_explain": "Identifiant client OAuth (Google Cloud Console). À coller une seule fois.",
    "guide.drive.connecter": "Connecter mon Drive",
    "guide.drive.choisir_fichiers": "Choisir mes fichiers",
    "guide.drive.synchroniser": "Synchroniser maintenant",
    "guide.drive.oublier": "Oublier mes bases",
    "guide.drive.sync_explain": "La synchronisation se relance toute seule à l'ouverture de l'app quand tu as du réseau. Sur le terrain, la comparaison se fait en local : elle marche sans connexion.",

    "action.enregistrer": "Enregistrer",

    "guide.nego.titre": "💬 Négociation (La mécanique)",
    "guide.nego.regle1": "Offre 50 à 60 % du prix affiché. Tope à 70 %. Au-delà, tu paies le prix de revente.",
    "guide.nego.regle2": "Groupe toujours : « je prends ces quatre-là, 20 € et c'est fait » marche mieux que quatre marchandages.",
    "guide.nego.regle3": "Espèces, petites coupures, montant exact déjà en main. Un billet tendu conclut une hésitation.",
    "guide.nego.regle4": "Visage neutre, même sur une pépite. Dès que tu t'illumines, le prix se fige.",
    "guide.nego.regle5": "Un seul chiffre, puis tu te tais. Le silence fait le travail à ta place.",

    "guide.pieges.titre": "⚠️ Pièges Fréquents",
    "guide.pieges.repro_html": "<b>Cartouches repro :</b> Étiquette trop nette, vis cruciforme. Nintendo utilise du tri-wing 3,8 mm. Le plastique d'origine est mat.",
    "guide.pieges.piles_html": "<b>Corrosion de piles :</b> Ouvre toujours la trappe. Le vert ronge les contacts et coûte plus cher que l'objet.",
    "guide.pieges.boite_html": "<b>Boîte pleine, jeu absent :</b> Ouvre tout. Le boîtier PS2 avec un disque de karaoké dedans est un classique.",
    "guide.pieges.lot_html": "<b>Le lot piège :</b> Trois bons objets sur le dessus, du remplissage en dessous. Retourne le carton avant d'annoncer un prix.",

    "guide.sac.titre": "🎒 Le Sac Idéal",

    "nav.scan": "Scan",
    "nav.dates": "Dates",
    "nav.journal": "Journal",
    "nav.reglages": "Réglages",

    "mode.dit.objet": "Prends-en plusieurs si tu veux : le dos, le dessous, le défaut.",
    "mode.dit.bac": "Une photo par pièce, ou une photo de plusieurs pièces. Chacune sera chiffrée.",
    "mode.dit.stand": "Une vue large de la table. L'app te dit s'il vaut la peine de fouiller.",
    "mode.btn.bac": "Trier ce lot",
    "mode.btn.stand": "Lire ce stand",
    "shoot.photo.ajouter": "ajouter une vue",
    "shoot.vues_suffix": " · {n} vues",

    "alert.photos_max": "8 photos au maximum par analyse.",
    "alert.bac_vide": "Prends d'abord une ou plusieurs photos du bac.",
    "alert.file_pleine": "File pleine (4 objets). Relance-la dès que tu captes.",
    "alert.memoire_saturee": "Mémoire du téléphone saturée : impossible de mettre en file.\n\nVa dans Réglages → Sauvegarde pour libérer de la place.",
    "alert.file_vide": "La file est vide.",
    "alert.pas_de_reseau": "Toujours pas de réseau.",

    "analyse.fermer": "Fermer l'analyse",

    "bac.deja_badge": "DÉJÀ",
    "bac.ressemble": "Ressemble à « {titre} » que tu as déjà — vérifie l'édition.",
    "bac.cote_discogs": "Cote Discogs",
    "bac.en_collection": "en collection",
    "bac.lus": "LUS",
    "bac.mode_bac": "MODE BAC",
    "bac.n_a_prendre": "{n} à prendre",
    "bac.deja_chez_toi": " · {n} déjà chez toi",
    "bac.valeur_a_prendre": "valeur des « à prendre » ≈ {n}€",

    "bac.section.prendre": "À prendre",
    "bac.section.negocier": "À négocier",
    "bac.section.negocier_sub": "Seulement sous le prix indiqué.",
    "bac.section.deja": "Tu l'as déjà",
    "bac.section.deja_sub": "Sauf si l'édition diffère de la tienne.",
    "bac.section.laisse": "Laisse",
    "bac.section.deja_court": "Déjà",

    "bac.vide.titre": "Rien de lisible",
    "bac.vide.sub": "Rapproche-toi, ou écarte les pochettes pour dégager les tranches.",

    "bac.bar.a_prendre": "{n} à prendre",
    "bac.bar.a_negocier": "{n} à négocier",
    "bac.bar.deja": "{n} déjà",
    "bac.bar.laisse": "{n} laisse",

    "bac.cart.enregistre": "Lot enregistré",
    "bac.cart.journal_maj": "Journal de chasse mis à jour",
    "bac.cart.resume_un": "1 pièce · revente ≈ {val}€",
    "bac.cart.resume_plusieurs": "{n} pièces · revente ≈ {val}€",
    "bac.cart.ne_depasse_pas": "ne dépasse pas {max}€ pour le lot",
    "bac.cart.coche": "coche ce que tu emportes",
    "bac.cart.jai_achete": "J'ai acheté",

    "bac.buy.coche_dabord": "Coche d'abord les pièces que tu emportes.",
    "bac.buy.prompt_paye_un": "Combien as-tu payé pour cette pièce au total ?",
    "bac.buy.prompt_paye_plusieurs": "Combien as-tu payé pour ces {n} pièces au total ?",
    "bac.buy.prompt_demande_un": "Il en demandait combien pour cette pièce, avant négociation ? (facultatif)",
    "bac.buy.prompt_demande_plusieurs": "Il en demandait combien pour ces {n} pièces, avant négociation ? (facultatif)"
  },

  nl: {
    "app.tagline": "Prijsgids voor op de rommelmarkt",

    "bc.cadre": "Richt de barcode in het kader",
    "bc.annuler": "Annuleren",

    "hud.score": "Score",
    "hud.credits": "Credits",
    "hud.file": "In wachtrij",

    "mode.objet": "Eén object",
    "mode.bac": "Een lot",
    "mode.stand": "Een kraam",

    "shoot.photo.titre": "Fotograferen",
    "shoot.photo.sub": "camera gaat open",
    "shoot.galerie.titre": "Galerij",
    "shoot.galerie.sub": "meerdere tegelijk",
    "shoot.analyser": "Analyseren",

    "scan.bc.titre": "Streepjescode scannen",
    "scan.bc.sub": "exacte identificatie, direct",

    "prix.placeholder": "Hoeveel vraagt hij ervoor? (optioneel)",
    "prix.label": "Gevraagde prijs",

    "autres.summary": "Andere manieren om te zoeken",
    "recherche.placeholder": "Zoek op naam, of stel een vraag",
    "recherche.demander": "Vraag het aan de AI",

    "cal.titre": "Kalender",
    "cal.sous_titre": "Rommelmarkten binnen 50 km van Binche, België en Frankrijk. In de eerste plaats gezocht op quefaire.be, gekruist met andere agenda's — controleer voor je vertrekt, een datum van AI blijft een datum van AI.",
    "cal.chercher": "Eerstvolgende data zoeken",
    "cal.ajouter_manuel": "＋ Handmatig toevoegen",
    "cal.exporter": "Al mijn gemarkeerde data exporteren (.ics)",
    "cal.filtre.toutes": "Alle",
    "cal.filtre.jyvais": "Ik ga erheen",
    "cal.filtre.grosses": "De grote",

    "log.titre": "Jachtjournaal",
    "log.tes_achats": "Jouw aankopen",
    "log.terminer_sortie": "Uitstap afsluiten",
    "log.envoyer_drive": "Journaal naar mijn Drive sturen",
    "log.sorties_archivees": "Gearchiveerde uitstappen",
    "log.vider_journal": "Journaal leegmaken",
    "log.historique_recherches": "Zoekgeschiedenis",
    "log.historique_sub": "Elke geanalyseerde foto, scan of vraag, gekocht of niet — om een eerder bekeken fiche terug te vinden.",
    "log.vider_recherches": "Zoekgeschiedenis wissen",

    "guide.titre": "Gidsmenu 🧔🏼‍♂️",

    "guide.ia.titre": "⚙️ AI-configuratie",
    "guide.ia.cle_label": "Gemini API-sleutel (lokaal opgeslagen):",
    "guide.ia.cle_placeholder": "Plak hier je Google API-sleutel",
    "guide.ia.modele_label": "AI-model (Kracht vs Snelheid):",
    "guide.ia.verifier_modeles": "Beschikbare modellen controleren",
    "guide.ia.ground_label": "Prijzen op het web zoeken",
    "guide.ia.ground_note": "Onmisbaar voor echte prijzen. Vink alleen uit bij herhaalde 429-fouten.",
    "guide.ia.enregistrer": "Instellingen opslaan",

    "guide.discogs.titre": "Discogs-prijzen (muziek)",
    "guide.discogs.explain": "Persoonlijk token, aan te maken op discogs.com &rarr; Settings &rarr; Developers &rarr; Generate new token. Het blijft op deze telefoon. Voor alles wat platen betreft, vervangt Discogs de schatting van de AI door de werkelijk gehanteerde prijs en het aantal exemplaren te koop.",
    "guide.discogs.placeholder": "Plak hier je Discogs-token",
    "guide.discogs.enregistrer": "Token opslaan",
    "guide.discogs.tester": "Discogs-verbinding testen",

    "guide.rebrickable.titre": "LEGO-sets (Rebrickable)",
    "guide.rebrickable.explain": "Gratis en direct beschikbare sleutel: rebrickable.com &rarr; jouw profiel &rarr; Settings &rarr; API &rarr; Generate. Rebrickable publiceert geen prijzen — het geeft het aantal onderdelen en poppetjes, de twee cijfers die echt de waarde van een tweedehands set bepalen.",
    "guide.rebrickable.placeholder": "Plak je Rebrickable-sleutel",
    "guide.rebrickable.piece": "€ per onderdeel",
    "guide.rebrickable.figurine": "€ per poppetje",
    "guide.rebrickable.bareme": "Wederverkoperstarief, aan te passen aan je eigen verkopen.",
    "guide.rebrickable.tester": "Rebrickable-verbinding testen",

    "guide.brickset.titre": "LEGO-sets (Brickset)",
    "guide.brickset.explain": "Gratis sleutel op aanvraag: brickset.com &rarr; jouw account &rarr; API &rarr; Request a key. Brickset geeft dezelfde onderdelen en poppetjes als Rebrickable, plus de officiële LEGO-nieuwprijs. Dient als tweede mening wanneer je geen Rebrickable-sleutel hebt — de twee worden nooit dubbel getoond op dezelfde fiche.",
    "guide.brickset.placeholder": "Plak je Brickset-sleutel",
    "guide.brickset.relais_html": "<b style=\"color:var(--mid)\">Brickset blokkeert directe aanroepen vanuit een browser</b> — in tegenstelling tot Discogs en Rebrickable. De sleutel alleen volstaat dus niet: je hebt een gratis relais nodig die het verzoek voor jou doorstuurt. Twee minuten, eenmalig:<br>1. <b>dash.cloudflare.com</b> (gratis account) &rarr; Workers &amp; Pages &rarr; Create &rarr; « Hello World ».<br>2. Plak de code hieronder in plaats van het voorbeeld, in de browsereditor, en klik dan op Deploy.<br>3. Plak het <b>*.workers.dev</b>-adres dat je krijgt in het veld hieronder, en test opnieuw.",
    "guide.brickset.copier_relais": "Relaiscode kopiëren",
    "guide.brickset.relais_placeholder": "https://xxxxx.workers.dev (relais, optioneel maar nodig om Brickset te laten werken)",
    "guide.brickset.tester": "Brickset-verbinding testen",

    "guide.sauvegarde.titre": "Back-up",
    "guide.sauvegarde.liberer": "Ruimte vrijmaken",
    "guide.sauvegarde.explain": "Journaal, gearchiveerde uitstappen, kalender en databases: alles wordt opgeslagen in deze browser. Een Android-cache-opruiming zou dit zonder waarschuwing wissen.",
    "guide.sauvegarde.drive": "Opslaan naar mijn Drive",
    "guide.sauvegarde.telecharger": "Back-up downloaden",
    "guide.sauvegarde.restaurer": "Back-up herstellen",

    "guide.apparence.titre": "Weergave",
    "guide.apparence.clair": "Licht",
    "guide.apparence.auto": "Auto",
    "guide.apparence.sombre": "Donker",

    "guide.langue.titre": "Taal",

    "guide.drive.titre": "Mijn Google Drive-bestanden",
    "guide.drive.cid_explain": "OAuth-client-ID (Google Cloud Console). Eenmalig te plakken.",
    "guide.drive.connecter": "Mijn Drive verbinden",
    "guide.drive.choisir_fichiers": "Mijn bestanden kiezen",
    "guide.drive.synchroniser": "Nu synchroniseren",
    "guide.drive.oublier": "Mijn bestanden vergeten",
    "guide.drive.sync_explain": "De synchronisatie start vanzelf opnieuw bij het openen van de app zodra je internet hebt. Op de markt zelf gebeurt de vergelijking lokaal: dat werkt zonder verbinding.",

    "action.enregistrer": "Opslaan",

    "guide.nego.titre": "💬 Onderhandelen (De mechaniek)",
    "guide.nego.regle1": "Bied 50 tot 60% van de gevraagde prijs. Sluit af op 70%. Daarboven betaal je de wederverkoopprijs.",
    "guide.nego.regle2": "Bundel altijd: « ik neem die vier, 20 € en we zijn klaar » werkt beter dan vier keer apart afdingen.",
    "guide.nego.regle3": "Contant geld, kleine coupures, het juiste bedrag al klaar. Een uitgestoken briefje beslecht een aarzeling.",
    "guide.nego.regle4": "Neutraal gezicht, zelfs bij een parel. Zodra je opklaart, ligt de prijs vast.",
    "guide.nego.regle5": "Eén cijfer, en dan zwijg je. De stilte doet het werk voor jou.",

    "guide.pieges.titre": "⚠️ Veelvoorkomende valkuilen",
    "guide.pieges.repro_html": "<b>Namaakcartridges:</b> Label te scherp gedrukt, kruiskopschroef. Nintendo gebruikt 3,8 mm tri-wing. Het originele plastic is mat.",
    "guide.pieges.piles_html": "<b>Batterijcorrosie:</b> Open altijd het klepje. Het groene beslag vreet de contacten aan en kost meer dan het object waard is.",
    "guide.pieges.boite_html": "<b>Volle doos, spel afwezig:</b> Open alles. De PS2-doos met een karaoke-cd erin is een klassieker.",
    "guide.pieges.lot_html": "<b>De valstrik-lot:</b> Drie goede stukken bovenop, opvulling eronder. Draai de doos om voor je een prijs noemt.",

    "guide.sac.titre": "🎒 De ideale tas",

    "nav.scan": "Scan",
    "nav.dates": "Data",
    "nav.journal": "Journaal",
    "nav.reglages": "Instellingen",

    "mode.dit.objet": "Neem er meerdere als je wilt: de achterkant, de onderkant, het defect.",
    "mode.dit.bac": "Eén foto per stuk, of één foto van meerdere stukken. Elk stuk krijgt een prijs.",
    "mode.dit.stand": "Een brede blik op de tafel. De app zegt je of het de moeite waard is om te zoeken.",
    "mode.btn.bac": "Dit lot sorteren",
    "mode.btn.stand": "Deze kraam lezen",
    "shoot.photo.ajouter": "nog een foto toevoegen",
    "shoot.vues_suffix": " · {n} weergaven",

    "alert.photos_max": "Maximaal 8 foto's per analyse.",
    "alert.bac_vide": "Neem eerst een of meer foto's van het lot.",
    "alert.file_pleine": "Wachtrij vol (4 objecten). Start opnieuw zodra je weer bereik hebt.",
    "alert.memoire_saturee": "Telefoongeheugen vol: kan niet in de wachtrij zetten.\n\nGa naar Instellingen → Back-up om ruimte vrij te maken.",
    "alert.file_vide": "De wachtrij is leeg.",
    "alert.pas_de_reseau": "Nog steeds geen netwerk.",

    "analyse.fermer": "Analyse sluiten",

    "bac.deja_badge": "AL",
    "bac.ressemble": "Lijkt op « {titre} », die je al hebt — controleer de editie.",
    "bac.cote_discogs": "Discogs-prijs",
    "bac.en_collection": "in collectie",
    "bac.lus": "GELEZEN",
    "bac.mode_bac": "LOT-MODUS",
    "bac.n_a_prendre": "{n} te nemen",
    "bac.deja_chez_toi": " · {n} al in bezit",
    "bac.valeur_a_prendre": "waarde van de « te nemen » ≈ {n}€",

    "bac.section.prendre": "Te nemen",
    "bac.section.negocier": "Te onderhandelen",
    "bac.section.negocier_sub": "Alleen onder de aangegeven prijs.",
    "bac.section.deja": "Heb je al",
    "bac.section.deja_sub": "Tenzij de editie verschilt van die van jou.",
    "bac.section.laisse": "Laat liggen",
    "bac.section.deja_court": "Al",

    "bac.vide.titre": "Niets leesbaars",
    "bac.vide.sub": "Kom dichterbij, of spreid de hoezen om de ruggen vrij te maken.",

    "bac.bar.a_prendre": "{n} te nemen",
    "bac.bar.a_negocier": "{n} te onderhandelen",
    "bac.bar.deja": "{n} al",
    "bac.bar.laisse": "{n} laat liggen",

    "bac.cart.enregistre": "Lot geregistreerd",
    "bac.cart.journal_maj": "Jachtjournaal bijgewerkt",
    "bac.cart.resume_un": "1 stuk · doorverkoop ≈ {val}€",
    "bac.cart.resume_plusieurs": "{n} stuks · doorverkoop ≈ {val}€",
    "bac.cart.ne_depasse_pas": "niet meer dan {max}€ voor het lot",
    "bac.cart.coche": "vink aan wat je meeneemt",
    "bac.cart.jai_achete": "Ik heb gekocht",

    "bac.buy.coche_dabord": "Vink eerst de stukken aan die je meeneemt.",
    "bac.buy.prompt_paye_un": "Hoeveel heb je in totaal voor dit stuk betaald?",
    "bac.buy.prompt_paye_plusieurs": "Hoeveel heb je in totaal voor deze {n} stukken betaald?",
    "bac.buy.prompt_demande_un": "Hoeveel vroeg hij voor dit stuk, voor het onderhandelen? (optioneel)",
    "bac.buy.prompt_demande_plusieurs": "Hoeveel vroeg hij voor deze {n} stukken, voor het onderhandelen? (optioneel)"
  }
};
