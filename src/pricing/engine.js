
/* ---------- Les barèmes ----------
   Ils sont dans l'app, pas dans le prompt : un modèle qui improvise ses propres
   décotes donne un chiffre différent à chaque appel pour le même objet. */
export const ETAT_LBL = {5:"Neuf / scellé", 4:"Excellent", 3:"Bon", 2:"Moyen", 1:"Abîmé", 0:"Non évalué"};

/* ANCRAGE : la référence est le BON ÉTAT D'USAGE (note 3), pas l'exemplaire
   excellent. C'est dans cet état que la quasi-totalité des objets d'occasion se
   vendent réellement, et donc l'état auquel correspondent les prix constatés
   sur Vinted ou eBay. Ancrer sur « excellent » revenait à pénaliser tout objet
   normal d'un tiers de sa valeur, sur la base d'un prix qui le décrivait déjà. */
export const ETAT_COEF = {5:1.8, 4:1.25, 3:1, 2:0.6, 1:0.3, 0:0.9};

/* Une échelle à trois crans ne peut pas dire la différence entre un calot de
   peluche manquant et une cartouche de jeu manquante. Chaque élément porte
   donc SON propre poids, donné par le modèle qui connaît le métier : la perte
   de valeur, en pour cent, si cet élément-là est absent. La décote se calcule,
   elle ne se choisit plus dans une liste. */
export const PERTE_DEFAUT = {cle: 40, autre: 8};

export const PERTE_PLANCHER = 0.15;

export const PORT_LBL = {pochette:"Pochette", petit:"Petit colis", moyen:"Colis moyen", gros:"Gros colis", encombrant:"Encombrant"};

/* Sur Vinted, c'est l'acheteur qui paie le port. Ce qu'on retire ici n'est donc
   pas le tarif postal, c'est la PRESSION que le volume met sur ton prix : plus
   l'envoi coûte cher à l'acheteur, plus il faut baisser pour rester attractif —
   plus l'emballage et les casses. Un vinyle en subit à peine, un lampadaire
   énormément. */
export const PORT_COUT = {pochette:1, petit:2, moyen:3, gros:6, encombrant:10};

/* Et surtout : plafonnée à un quart de la valeur. Une retenue fixe de 5 € sur
   un objet à 14 € en mangeait plus des deux tiers — c'est ce qui transformait
   un lot vendable 15 € en « ne dépasse pas 1 € ». */
export const PORT_PART_MAX = 0.25;

/* Cas réel (Top Gun, 22-23/08/2026) : le modèle renvoie "circulation" au
   même moment que son estimation chiffrée ("marche"), et le prompt lui dit
   explicitement qu'un titre pressé en masse ne vaut presque rien — mais
   avant ce correctif, rien dans ficheCalc ne s'en servait jamais. Le vrai
   correctif reste le remplacement de "marche" par une cote vérifiée
   (Discogs/Rebrickable/Brickset/vente réelle, cf. Cas 3 dans
   docs/diagnostic-cotation.md — retest confirmé : le mécanisme fonctionne).
   Ce coefficient n'est qu'un FILET DE SÉCURITÉ SECONDAIRE pour le cas où
   aucune source vérifiée n'existe (pas de jeton, pas de match) : seul
   "massif" est tempéré, volontairement — les autres niveaux ("courant",
   "peu courant", "rare") restent neutres pour ne pas rouvrir le cas 1
   (Skylanders, "courant", plafond verrouillé à 3 €) ni le cas 2 (Remember
   Me, "peu courant", verrouillé à 6 €), qui n'ont aucun rapport avec ce
   défaut précis. */
export const CIRCULATION_COEF = {rare: 1, "peu courant": 1, courant: 1, massif: 0.6};


/* Les éléments attendus arrivent maintenant constatés : vu = oui / non / ?.
   On accepte encore l'ancien format (simple texte) pour ne rien casser. */
/* « JEUX_VIDEO » s'affichait tel quel. */
/* Avec la recherche web activée, Google interdit d'imposer un schéma de
   réponse : le modèle écrit ce qu'il veut. Il renvoie régulièrement "10-20 €",
   "environ 15", "12,50" ou "~8 EUR" au lieu d'un nombre. Number() rendait NaN,
   qui devenait 0, et l'app affichait « PAS DE PRIX FIABLE » sur une analyse
   pourtant réussie. On lit désormais le chiffre où qu'il soit. */
export function nombre(v){
  if(typeof v === "number") return isFinite(v) ? v : 0;
  const t = String(v || "").replace(/\s/g, "").replace(/,(\d)/g, ".$1");
  const nb = (t.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat).filter(isFinite);
  if(!nb.length) return 0;
  /* Une fourchette « 10-20 » se lit par son milieu : c'est ce que le modèle
     voulait dire, et c'est ce qu'un chineur en retiendrait. */
  if(nb.length >= 2 && /\d\s*(?:-|–|à|a|et)\s*\d/.test(String(v))) return (nb[0] + nb[1]) / 2;
  return nb[0];
}


export function catJoli(c){
  const t = String(c || "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}


export function attNorm(a){
  if(!Array.isArray(a)) return [];
  return a.map(x => {
    if(typeof x === "string") return {n:x, vu:"?", cle:true};
    if(!x || typeof x !== "object") return null;
    const v = String(x.vu || "").toLowerCase();
    /* On accepte l'ancien format (cle: true/false) en lui donnant un poids. */
    let pe = nombre(x.perte);
    if(!isFinite(pe) || pe < 0) pe = (x.cle !== false) ? PERTE_DEFAUT.cle : PERTE_DEFAUT.autre;
    return {n: x.n || x.nom || "", vu: (v === "oui" || v === "non") ? v : "?",
            perte: Math.min(90, Math.round(pe)), cle: x.cle !== false};
  }).filter(x => x && x.n);
}


/* Seul ce qui est CONSTATÉ absent est facturé. Ce que la photo ne montre pas
   reste en suspens : on le signale, on ne le fait pas payer. */
export function attPerte(att){
  return att.filter(x => x.vu === "non").reduce((t, x) => t + x.perte, 0);
}

export function attManquants(att){ return att.filter(x => x.vu === "non"); }

/* Cas réel (Skylanders, 22/08/2026) : un lot de ~15 figurines dont seul le
   portail (accessoire PARTAGÉ) n'est pas confirmé sur la photo ressortait à
   1 € au lieu des 12-15 € du marché. La décote "élément clé absent" est
   pensée pour un objet unique — une pièce essentielle manquante le rend
   inutilisable, d'où un poids lourd (jusqu'à 90%). Appliquée telle quelle à
   un lot, cette même décote retire la valeur du portail à la valeur du LOT
   ENTIER, pas juste au portail : double comptage, puisque le prix marché
   d'un lot ("en vrac, sans boîtes") a déjà encaissé l'absence d'accessoires
   individuels. Même logique et même plafond que PORT_PART_MAX côté port :
   on borne la décote de complétude à 25% de la valeur — mais SEULEMENT
   quand un seul élément du lot est constaté absent, signe d'un accessoire
   partagé. Dès qu'un DEUXIÈME élément manque, ce n'est plus le profil d'un
   accessoire partagé unique : la décote complète repart sans plafond, pour
   ne pas masquer un lot réellement vide (voir
   tests/fixtures/lot-boites-vides.js et docs/diagnostic-cotation.md, Cas 1). */
export const LOT_PERTE_MAX = 25;

export function attCoef(att, isLot){
  let perte = attPerte(att);
  if(isLot && attManquants(att).length === 1) perte = Math.min(perte, LOT_PERTE_MAX);
  return Math.max(PERTE_PLANCHER, 1 - perte / 100);
}


export function ficheNorm(j){
  const n = Math.round(nombre(j.etatNote));
  const g = String(j.gabarit || "petit").toLowerCase();
  return {
    objet: j.objet || "", categorie: catJoli(j.categorie), identification: j.identification || "",
    lot: j.lot === true, lotNb: Math.max(0, Math.round(nombre(j.lotNb))),
    code: j.code || "", codeOu: j.codeOu || "",
    attendu: attNorm(j.attendu),
    impactComplet: j.impactComplet || "",
    echelle: j.echelle || "", etatDit: j.etatDit || "",
    circulation: String(j.circulation || "").toLowerCase(),
    marche: nombre(j.marche),
    gabarit: PORT_COUT[g] !== undefined ? g : "petit",
    confiance: j.confiance || "", verifs: j.verifs || [],
    pieges: j.pieges || [], nego: j.nego || "", note: j.note || "",
    /* Réglages du chineur : ce que TOI tu constates, pas ce que la photo suggère. */
    etat: (n >= 1 && n <= 5) ? n : 0,

    /* Renseignée après coup par Discogs ou Rebrickable/Brickset quand l'objet est identifié. */
    marcheReel: 0, marcheVu: 0, marcheSrc: "",
    comparables: compNorm(j.comparables && j.comparables.length ? j.comparables : j.preuves)
  };
}


export function ficheCalc(f){
  /* Ordre de confiance : ce que tu as vu > une source de données > le modèle.
     Le filet "circulation" ne tempère QUE l'estimation brute de l'IA : un
     prix vérifié (toi ou une source externe) décrit déjà CET exemplaire
     précis, la donnée qualitative n'ajoute rien dessus — voir
     CIRCULATION_COEF. */
  const verifie = f.marcheVu || f.marcheReel || 0;
  const circCoef = verifie ? 1 : (CIRCULATION_COEF[f.circulation] !== undefined ? CIRCULATION_COEF[f.circulation] : 1);
  const base = verifie || (f.marche || 0) * circCoef;
  const port = Math.min(PORT_COUT[f.gabarit] || 0, Math.round(base * PORT_PART_MAX));
  const ce = ETAT_COEF[f.etat] !== undefined ? ETAT_COEF[f.etat] : 0.9;
  /* Somme des pertes des seuls éléments constatés absents. Un lot en vrac n'a
     pas de « boîte manquante » : le modèle ne la liste pas, donc rien ne se
     facture deux fois. f.lot passé pour le plafond de 25% sur les lots à un
     seul élément manquant (accessoire partagé) — voir attCoef. */
  const cc = attCoef(f.attendu, f.lot);

  /* Ce que tu encaisses réellement : le prix de référence corrigé de l'état et
     de la complétude, moins le port que tu avanceras. */
  const brut = base * ce * cc;
  const net = Math.max(0, brut - port);

  /* Un chiffre unique ne se négocie pas. Trois, oui — mais seulement si l'écart
     entre eux est réel : sur un objet à 6 €, « annonce 1, vise 1, plafond 2 »
     ne veut rien dire. En dessous de trois euros de plafond, on ne fait pas
     semblant de négocier, on dit quoi proposer. */
  const plafond = Math.max(0, Math.round(net / 3));
  let ouverture, cible, echelonne = false;
  if(plafond >= 6){
    ouverture = Math.max(1, Math.round(plafond * 0.45));
    cible     = Math.max(ouverture + 1, Math.round(plafond * 0.72));
    echelonne = true;
  }else if(plafond >= 3){
    ouverture = plafond - 2;
    cible     = plafond - 1;
    echelonne = true;
  }else{
    ouverture = Math.max(1, plafond - 1);
    cible     = plafond;
  }
  return {
    base, port, ce: Math.round(ce * 100) / 100, cc: Math.round(cc * 100) / 100,
    brut: Math.round(brut), net: Math.round(net),
    ouverture, cible, plafond, echelonne,
    verdict: !base ? "N" : plafond < 1 ? "L" : "R"
  };
}


/* Le verdict tient compte du prix demandé quand tu l'as saisi. */
export function ficheVerdict(f, c, demande){
  if(!c.base) return {v:"N", t:"À VÉRIFIER"};
  if(c.plafond < 1) return {v:"L", t:"LAISSE"};
  /* Le vert veut dire « prends », pas « l'objet existe ». Sans prix affiché,
     rien n'est encore une bonne affaire. */
  if(!demande) return {v:"N", t:"À CE PRIX SEULEMENT"};
  if(demande <= c.cible) return {v:"R", t:"RAFLE"};
  if(demande <= c.plafond) return {v:"N", t:"NÉGOCIE"};
  return {v:"L", t:"LAISSE"};
}


export function attResume(att){
  const perte = attPerte(att);
  const q = att.filter(x => x.vu === "?").length;
  let t = perte ? "Manque constaté : −" + perte + "% appliqués" : "Rien ne manque : aucune décote";
  if(q) t += " · " + q + " élément" + (q>1?"s":"") + " à vérifier sur place";
  return t;
}


/* Les constats chiffrés que le modèle rapporte, avec leur lien quand il en a
   un : une affirmation vérifiable vaut mieux qu'une affirmation. */
export function compNorm(a){
  if(!Array.isArray(a)) return [];
  return a.map(x => {
    if(typeof x === "string") return {t: x, url: "", prix: 0};
    if(!x || typeof x !== "object") return null;
    return {t: [x.source, x.titre, x.etat, x.date].filter(Boolean).join(" · ") || String(x.titre || ""),
            prix: nombre(x.prix),
            url: /^https?:\/\//.test(String(x.url || "")) ? x.url : ""};
  }).filter(x => x && (x.t || x.prix));
}
