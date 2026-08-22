export const KEY_STORE = "insertcoin.gemini.key";

export const MODEL_STORE = "insertcoin.gemini.model";


/* ══════ ÉCRITURE PROTÉGÉE ══════
   Quand le navigateur refusait une écriture (mémoire pleine), le catch était
   vide : tu enregistrais un achat, l'écran affichait « ✓ Enregistré », et rien
   n'était sauvé. Une panne muette est pire qu'une panne bruyante. */
export let MEM_ALERTE = 0;

export function storeSet(k, v, quoi){
  try{ localStorage.setItem(k, v); return true; }
  catch(e){
    /* Une seule alerte par minute : sur un stand, on ne veut pas cliquer sur
       dix pop-ups à la suite. */
    if(Date.now() - MEM_ALERTE > 60000){
      MEM_ALERTE = Date.now();
      alert("Mémoire du téléphone pleine.\n\n« " + quoi + " » n'a PAS été enregistré.\n\nVa dans Réglages → Sauvegarde et appuie sur « Libérer de la place ».");
    }
    return false;
  }
}


/* Poids réel des données de l'app, pour que la jauge ne soit pas décorative. */
export function memBytes(){
  let n = 0;
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf("insertcoin.") === 0) n += k.length + (localStorage.getItem(k) || "").length;
    }
  }catch(e){}
  return n * 2; // UTF-16
}


// --- CAMERA LOGIC ---
export const SRC_STORE = "insertcoin.photosrc";

export function srcGet(){ try { return localStorage.getItem(SRC_STORE) === "cam" ? "cam" : "ask"; } catch(e){ return "ask"; } }

export const GROUND_STORE = "insertcoin.gemini.ground";

export const getGround = () => { try { return localStorage.getItem(GROUND_STORE) !== "off"; } catch(e){ return true; } };


/* Cache : une même recherche dans la matinée ne reconsomme pas de quota
   et répond instantanément devant le vendeur. */
export const CACHE_STORE = "insertcoin.cache2";
/* L'ancien cache contient des entrées enregistrées sous une clé erronée :
   on l'efface une bonne fois. */
try{ localStorage.removeItem("insertcoin.cache"); }catch(e){}

export function cacheGet(k){
  try{
    const c = JSON.parse(localStorage.getItem(CACHE_STORE) || "{}");
    const hit = c[k];
    if(hit && Date.now() - hit.t < 86400000) return hit.j;
  }catch(e){}
  return null;
}

export function cacheSet(k, j){
  try{
    const c = JSON.parse(localStorage.getItem(CACHE_STORE) || "{}");
    c[k] = {t: Date.now(), j};
    const ks = Object.keys(c);
    if(ks.length > 60) ks.sort((a,b)=>c[a].t-c[b].t).slice(0, ks.length-60).forEach(x=>delete c[x]);
    localStorage.setItem(CACHE_STORE, JSON.stringify(c));
  }catch(e){}
}


/* ---------- COLLECTION : ANTI-DOUBLON ---------- */
export const COLL_STORE = "insertcoin.collection";


export function collRead(){ try { return JSON.parse(localStorage.getItem(COLL_STORE) || "[]"); } catch(e){ return []; } }

export function collWrite(a){
  try { localStorage.setItem(COLL_STORE, JSON.stringify(a)); return true; }
  catch(e){ alert("Mémoire du téléphone saturée. Réduis la liste."); return false; }
}


/* ---------- GOOGLE DRIVE ---------- */
export const CID_STORE   = "insertcoin.drive.cid";

export const FILES_STORE = "insertcoin.drive.files";   // [{id,name,mime,modified,kind}]

export const TOK_STORE   = "insertcoin.drive.tok";     // {t, exp}

export const SYNC_STORE  = "insertcoin.drive.sync";    // dernière synchro


export function driveCid(){ try { return localStorage.getItem(CID_STORE) || ""; } catch(e){ return ""; } }

export function driveFiles(){ try { return JSON.parse(localStorage.getItem(FILES_STORE) || "[]"); } catch(e){ return []; } }

export function driveToken(){
  try{
    const t = JSON.parse(localStorage.getItem(TOK_STORE) || "null");
    if(t && t.exp > Date.now() + 30000) return t.t;
  }catch(e){}
  return null;
}


/* ══════════ CALENDRIER DES BROCANTES ══════════
   Aucun service public ne fournit ces dates sous forme exploitable : on
   interroge le web via l'IA, puis on garde le résultat en local pour qu'il
   reste consultable sans réseau. Les entrées ajoutées à la main ne sont
   jamais écrasées par une recherche. */
export const CAL_STORE = "insertcoin.cal";


export function calRead(){ try { return JSON.parse(localStorage.getItem(CAL_STORE) || "[]"); } catch(e){ return []; } }

export function calWrite(a){ return storeSet(CAL_STORE, JSON.stringify(a), "ton calendrier"); }


/* ══════════ HISTORIQUE DES RECHERCHES ══════════
   Demande du 23/08/2026 : une fiche obtenue (photo, code-barres, recherche
   texte) disparaissait dès qu'on quittait l'écran, sauf à l'acheter — "j'ai
   fait des photos ce matin et reçu une fiche mais je ne la retrouve plus".
   Chaque analyse réussie (objet seul, lot, stand) est donc enregistrée ici
   automatiquement, qu'elle mène à un achat ou non — voir rechAjouter, appelé
   depuis callGemini(). Flexible par nécessité : c'est TOI qui choisis quoi
   garder (rechDel) ou vider entièrement (voir ui/log.js). On ne stocke que
   le JSON renvoyé par le modèle (quelques Ko), jamais la photo elle-même —
   elle n'est de toute façon jamais conservée ailleurs dans l'app non plus. */
export const RECH_STORE = "insertcoin.recherches";

/* Plafond du nombre d'entrées gardées : au-delà, les plus anciennes sont
   silencieusement retirées (rechAjouter). Un JSON de fiche pèse environ 0.5
   à 2 Ko ; 300 entrées restent sous le Mo, loin de menacer le quota. */
export const RECH_MAX = 300;

export function rechRead(){ try { return JSON.parse(localStorage.getItem(RECH_STORE) || "[]"); } catch(e){ return []; } }

export function rechWrite(a){ return storeSet(RECH_STORE, JSON.stringify(a), "ton historique de recherches"); }

/* Appelé une fois par analyse réussie, jamais sur un résultat déjà en cache
   (voir callGemini : le cache texte du jour ne rejoue qu'un affichage, ce
   n'est pas une nouvelle recherche). */
export function rechAjouter(mode, j, avis){
  const a = rechRead();
  a.push({id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), date: new Date().toISOString(), mode, j, avis: avis || ""});
  while(a.length > RECH_MAX) a.shift();
  rechWrite(a);
}


/* ══════════ THÈME ══════════ */

/* ══════════════════ COTES DISCOGS ══════════════════
   Gemini devine, Discogs mesure. Pour tout ce qui est musique, la marketplace
   donne trois chiffres qu'aucun modèle ne peut inventer : le prix le plus bas
   réellement en vente, le nombre d'exemplaires disponibles (= le tirage), et
   le rapport entre ceux qui l'ont et ceux qui le veulent.

   Deux choix techniques volontaires :
   - le jeton passe en paramètre d'URL, pas en en-tête Authorization. Un en-tête
     personnalisé déclencherait une requête préliminaire (preflight) que Discogs
     ne gère pas ; en paramètre, c'est un simple GET.
   - aucun User-Agent forcé : le navigateur interdit de le modifier, et le sien
     est accepté par Discogs. */
export const DISC_STORE = "insertcoin.discogs.token";

export const DISC_CACHE = "insertcoin.discogs.cache";


export function discToken(){ try { return localStorage.getItem(DISC_STORE) || ""; } catch(e){ return ""; } }


/* Cache 7 jours : une cote de vinyle ne bouge pas d'un dimanche à l'autre,
   et sur le terrain la réponse doit être instantanée devant le vendeur. */
export function discCacheGet(k){
  try{
    const c = JSON.parse(localStorage.getItem(DISC_CACHE) || "{}");
    const h = c[k];
    if(h && Date.now() - h.t < 604800000) return h.v;
  }catch(e){}
  return null;
}

export function discCacheSet(k, v){
  try{
    const c = JSON.parse(localStorage.getItem(DISC_CACHE) || "{}");
    c[k] = {t: Date.now(), v};
    const ks = Object.keys(c);
    if(ks.length > 120) ks.sort((a,b)=>c[a].t-c[b].t).slice(0, ks.length-120).forEach(x=>delete c[x]);
    localStorage.setItem(DISC_CACHE, JSON.stringify(c));
  }catch(e){}
}


/* ══════════════════ COTES LEGO (Rebrickable) ══════════════════
   Rebrickable ne donne pas de prix — aucune API gratuite n'en donne pour le
   LEGO d'occasion. Mais il donne les deux chiffres dont se sert tout revendeur :
   le nombre de pièces et le nombre de figurines. Un set se valorise à la pièce
   et à la figurine ; savoir « 1 200 pièces, 6 figurines, 2015 » vaut mieux
   qu'une estimation sortie de nulle part.

   Même choix technique que Discogs : la clé passe en paramètre d'URL, pas en
   en-tête Authorization, pour rester une requête simple. */
export const LEGO_STORE = "insertcoin.rebrickable.key";

export const LEGO_CACHE = "insertcoin.rebrickable.cache";

/* Barème du revendeur, ajustable : c'est une règle de pouce, pas une cote.
   À corriger avec tes propres ventes au fil du temps. */
export const LEGO_PIECE_STORE = "insertcoin.lego.piece";

export const LEGO_FIG_STORE   = "insertcoin.lego.fig";

export function legoTarifs(){
  let pc = parseFloat(localStorage.getItem(LEGO_PIECE_STORE) || ""), fg = parseFloat(localStorage.getItem(LEGO_FIG_STORE) || "");
  return {piece: isFinite(pc) && pc > 0 ? pc : 0.07, fig: isFinite(fg) && fg > 0 ? fg : 3};
}

export function legoKey(){ try { return localStorage.getItem(LEGO_STORE) || ""; } catch(e){ return ""; } }


export function legoCacheGet(k){
  try{
    const c = JSON.parse(localStorage.getItem(LEGO_CACHE) || "{}");
    const h = c[k];
    if(h && Date.now() - h.t < 2592000000) return h.v; /* 30 jours : un set ne change pas */
  }catch(e){}
  return null;
}

export function legoCacheSet(k, v){
  try{
    const c = JSON.parse(localStorage.getItem(LEGO_CACHE) || "{}");
    c[k] = {t: Date.now(), v};
    const ks = Object.keys(c);
    if(ks.length > 80) ks.sort((a,b)=>c[a].t-c[b].t).slice(0, ks.length-80).forEach(x=>delete c[x]);
    localStorage.setItem(LEGO_CACHE, JSON.stringify(c));
  }catch(e){}
}


/* ══════════════════ COTES LEGO (Brickset) ══════════════════
   Second avis sur les sets : mêmes pièces/figurines que Rebrickable, plus le
   prix de vente neuf officiel LEGO (ce que Rebrickable ne donne pas). Il ne
   s'affiche que si Rebrickable n'est pas configuré — deux cartes qui répètent
   les mêmes pièces/figurines sur la même fiche n'aideraient personne. */
export const BRICK_STORE = "insertcoin.brickset.key";

export const BRICK_CACHE = "insertcoin.brickset.cache";

export const BRICK_RELAY_STORE = "insertcoin.brickset.relay";

export function brickKey(){ try { return localStorage.getItem(BRICK_STORE) || ""; } catch(e){ return ""; } }

/* Brickset ne renvoie aucun en-tête CORS : testé côté navigateur, l'appel
   direct échoue en "Failed to fetch" alors que Discogs et Rebrickable
   répondent normalement à la même requête. Sans relais, Brickset ne
   fonctionnera jamais depuis cette app — ce n'est pas un bug d'ici. */
export function brickRelay(){ try { return (localStorage.getItem(BRICK_RELAY_STORE) || "").trim().replace(/\/+$/, ""); } catch(e){ return ""; } }


export function brickCacheGet(k){
  try{
    const c = JSON.parse(localStorage.getItem(BRICK_CACHE) || "{}");
    const h = c[k];
    if(h && Date.now() - h.t < 2592000000) return h.v; /* 30 jours : un set ne change pas */
  }catch(e){}
  return null;
}

export function brickCacheSet(k, v){
  try{
    const c = JSON.parse(localStorage.getItem(BRICK_CACHE) || "{}");
    c[k] = {t: Date.now(), v};
    const ks = Object.keys(c);
    if(ks.length > 80) ks.sort((a,b)=>c[a].t-c[b].t).slice(0, ks.length-80).forEach(x=>delete c[x]);
    localStorage.setItem(BRICK_CACHE, JSON.stringify(c));
  }catch(e){}
}


export const THEME_STORE = "insertcoin.theme";

export function themeGet(){ try { return localStorage.getItem(THEME_STORE) || "auto"; } catch(e){ return "auto"; } }


/* Compteur de requêtes du jour : savoir où on en est du quota gratuit. */
export const CRED_STORE = "insertcoin.cred";

export function credCount(){
  try{
    const c = JSON.parse(localStorage.getItem(CRED_STORE) || "{}");
    return (c.d === new Date().toDateString()) ? (c.n || 0) : 0;
  }catch(e){ return 0; }
}


/* ══════════ FILE D'ATTENTE HORS LIGNE ══════════ */
export const Q_STORE = "insertcoin.queue";

export function queueRead(){ try { return JSON.parse(localStorage.getItem(Q_STORE) || "[]"); } catch(e){ return []; } }

export function queueWrite(a){ try { localStorage.setItem(Q_STORE, JSON.stringify(a)); return true; } catch(e){ return false; } }


/* ---------- JOURNAL DE CHASSE ---------- */
export const LOG_STORE = "insertcoin.log";


export function logRead(){ try { return JSON.parse(localStorage.getItem(LOG_STORE) || "[]"); } catch(e){ return []; } }

export function logWrite(a){ return storeSet(LOG_STORE, JSON.stringify(a), "ton journal de chasse"); }


/* ══════════ SORTIES ARCHIVÉES ══════════
   Rien ne s'efface : terminer une sortie l'archive, elle reste consultable
   et exportable. Le journal courant repart à zéro pour la suivante. */
export const SORTIE_STORE = "insertcoin.sorties";

export function sortieRead(){ try { return JSON.parse(localStorage.getItem(SORTIE_STORE) || "[]"); } catch(e){ return []; } }

export function sortieWrite(a){ return storeSet(SORTIE_STORE, JSON.stringify(a), "cette sortie archivée"); }
