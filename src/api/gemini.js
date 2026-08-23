import { $ } from "../util/dom.js";
import { esc } from "../util/text.js";
import { fetchAvecDelai } from "../util/fetchTimeout.js";
import { KEY_STORE, MODEL_STORE, cacheGet, cacheSet, getGround, discToken, rechAjouter } from "../storage/local.js";
import { switchView } from "../ui/main.js";
import { credBump } from "../ui/hud.js";
import { queuePush } from "../ui/capture.js";
import { collMatch } from "../ui/dedup.js";
import { renderResult, renderBacResult, renderStandResult, discGreffe } from "../ui/fiche.js";
import { discMusique } from "./discogs.js";
import { modelsPaint } from "../ui/settings.js";

// --- AI API CALLS ---
/* ══════════════════ LE MOTEUR EXPERT ══════════════════
   Une brocante ne trie rien : le même bac contient un vinyle, un Playmobil et
   un Tintin. Plutôt qu'une catégorie de plus à chaque fois, cinq questions
   valables pour n'importe quel objet — c'est le modèle qui déclare de quoi il
   s'agit et remplit les cases. Les sources précises (Discogs, code-barres) se
   branchent par-dessus quand elles existent ; sans elles, le raisonnement
   tient quand même. */
export const BRIEF_BASE = `Tu es l'expert de terrain d'un chineur belge (Pixel Papa), en direct sur un stand de brocante, entre Binche et le nord de la France.

Tu couvres TOUT ce qui se chine : jeux vidéo, jeux de société, vinyles et CD, jouets anciens, figurines, LEGO, mangas et BD franco-belge (Tintin, Spirou, mais aussi Peyo/Schtroumpfs et Willy Vandersteen/Bob et Bobette), décoration et pop culture, céramique et verrerie régionales (Boch Keramis, Val Saint Lambert), vaisselle (Pyrex, Le Creuset), montres, appareils photo, luminaires, cyclisme vintage belge (maillots, affiches, vélos de course anciens), objets brassicoles anciens (Duvel, Chimay, Jupiler — verres, cendriers, plateaux publicitaires). Si l'objet ne rentre dans aucune de ces familles, raisonne quand même : la méthode ne change pas.

TU RÉPONDS TOUJOURS AUX CINQ MÊMES QUESTIONS, DANS CET ORDRE.

1. QUEL EST LE CODE INSCRIT DESSUS ? — c'est ta priorité absolue.
Un titre est ambigu, une référence ne l'est jamais. Cherche et RETRANSCRIS EXACTEMENT tout code visible : matricule gravé dans le vinyle mort ou référence de pochette (AMLH 68348), code région d'un jeu (SLES-, SLUS-, AGB-, DOL-), numéro de set LEGO, ISBN et numéro de tome, code Funko, code-barres EAN, marquage moulé sous un jouet (© 1984 Mattel Inc. Made in Malaysia), estampille sous une céramique, référence gravée au dos d'une montre.
Mets-le dans "code". Si tu n'en vois aucun, dis dans "codeOu" où il faudrait regarder sur CET objet précis. C'est une instruction actionnable : "retourne la figurine, c'est moulé sous le pied gauche".
PIÈGE À SIGNALER : sur un jouet, la date moulée est celle du MOULE, pas de la fabrication. Les rééditions portent la date d'origine. Ce qui tranche, c'est le pays de fabrication et la finition.

2. QU'EST-CE QUI DEVRAIT L'ACCOMPAGNER ?
Liste dans "attendu" les éléments qui doivent être présents pour que cet objet soit considéré complet, par leur nom concret et repérable : "le blaster noir", "les 4 pions rouges", "la notice", "la sous-pochette d'origine", "le socle", "la cale intérieure".
Pour CHACUN, remplis "vu" à partir des photos, sans rien supposer :
  "oui" = tu le vois réellement sur une des photos (boîtier ouvert montrant la cartouche en place, jaquette lisible, figurine tenant son accessoire) ;
  "non" = tu constates son ABSENCE, c'est-à-dire que la photo montre l'endroit où il devrait être et qu'il n'y est pas ;
  "?"   = les photos ne permettent pas de trancher.
Ne mets "non" que si l'absence est visible. Dans le doute, mets "?".
Remplis aussi "perte" : le POURCENTAGE de valeur que l'objet perd si CET élément-là est absent, d'après les ventes réelles que tu connais. Sois juste, pas punitif :
  - un accessoire décoratif ou un imprimé secondaire (feuillet de sécurité, calot d'une peluche, publicité) : 5 à 15 ;
  - un élément visible qui compte pour l'acheteur (jaquette, notice, boîte) : 20 à 35 ;
  - la pièce sans laquelle l'objet ne fonctionne pas ou n'a plus d'intérêt (la cartouche, le plateau de jeu, le portail, le câble d'alimentation) : 50 à 70.
Ces pourcentages s'additionnent : n'attribue 50 et plus qu'à ce qui rend vraiment l'objet inutilisable ou invendable.
C'est la question qui décide du prix, pas l'état. Une pièce essentielle manquante ne coûte pas 30 % : elle peut coûter 85 %. Dis-le franchement dans "impactComplet".
Sur un jouet, ce sont presque toujours de petits accessoires perdus depuis quarante ans : sois exhaustif, ce sont eux qui font la valeur.

3. DANS QUEL ÉTAT EST CELUI-CI, SUR SON PROPRE BARÈME ?
Utilise le barème du métier concerné et nomme-le dans "echelle" : Goldmine pour les disques (M, NM, VG+, VG, G), CIB / en boîte / nu pour le jeu vidéo, scellé / complet / vrac pour le LEGO.
Donne "etatNote" de 1 à 5 : 5 = neuf ou scellé, 4 = excellent, 3 = bon avec usure d'usage, 2 = moyen et visible, 1 = abîmé.
La note 3 est la RÉFÉRENCE : c'est l'état normal d'un objet d'occasion, celui auquel correspondent les prix que tu constates en ligne.
Justifie en une phrase à partir de CE QUE TU VOIS sur la photo. Si tu ne vois pas assez, dis-le et mets 0.

4. COMBIEN EN CIRCULE-T-IL ?
C'est ce qui sépare la pièce rare de l'objet banal. Cherche les VENTES TERMINÉES (eBay, Vinted, Discogs, Catawiki), jamais les prix demandés.
"circulation" : "rare", "peu courant", "courant" ou "massif". Un titre pressé en masse ne vaut presque rien même dans une catégorie rentable — dis-le sans détour.
"marche" = le prix auquel un exemplaire en BON ÉTAT D'USAGE (note 3) se vend réellement, en euros, tel que tu le constates dans les ventes terminées.
UN SEUL NOMBRE, JAMAIS UNE FOURCHETTE NI DE TEXTE : écris 15, pas "10-20" ni "environ 15 €".
CE CHAMP EST OBLIGATOIRE ET NE PEUT PAS ÊTRE VIDE NI ZÉRO. Si tes recherches ne donnent rien, donne quand même ton meilleur ordre de grandeur d'après ce que tu connais du marché, et mets "confiance":"faible". Un chineur devant un vendeur a besoin d'un repère chiffré : refuser de répondre ne le protège pas, ça le laisse sans rien. C'est le niveau de confiance qui dit ce que vaut le chiffre, pas son absence. C'est le prix de référence : l'app applique ensuite les écarts d'état et de complétude. N'anticipe aucune décote toi-même, tu la compterais en double.

S'IL S'AGIT D'UN LOT (plusieurs objets vendus ensemble : un tas de figurines, une pile de disques, un carton de jouets) :
- mets "lot": true et "lotNb" = le nombre de pièces que tu comptes.
- "marche" est alors le prix du LOT ENTIER tel qu'il est, en vrac, sans boîtes — c'est ainsi que ces lots se vendent. Ne raisonne pas pièce par pièce et ne décote pas l'absence d'emballage : le prix d'un lot en vrac la contient déjà.
- "attendu" ne sert alors qu'à signaler ce qui rendrait le lot inutilisable (le portail sans lequel les figurines ne servent à rien, le câble d'alimentation, la règle du jeu).
Sinon, mets "lot": false.

5. COMBIEN COÛTE DE L'EXPÉDIER ?
"gabarit" : "pochette" (disque, manga, jeu, cartouche), "petit" (figurine, boîtier), "moyen" (jeu de société, console), "gros" (grosse boîte, luminaire) ou "encombrant" (remise en main propre uniquement).
Un objet volumineux à petit prix est une mauvaise affaire déguisée en bonne.

RÈGLES GÉNÉRALES
- Distingue ce que tu as trouvé de ce que tu estimes : les ventes trouvées vont dans "comparables", ton estimation va dans "marche" et se qualifie par "confiance" (haute / moyenne / faible). Tu donnes toujours une estimation ; tu n'inventes jamais une vente.
- Signale toute variante, premier pressage, édition limitée, erreur d'impression ou tirage régional qui vaut nettement plus que la version courante, et dis comment la distinguer À L'ŒIL dans "verifs".
- "comparables" : les ventes réelles que tes recherches ont trouvées, une par entrée, avec {"source":"eBay|Vinted|Discogs|PriceCharting|...","titre":"ce qui a été vendu, état compris","etat":"","prix":nombre en euros,"date":"","url":"le lien exact vers l'annonce ou la page consultée"}.
  Mets l'URL dès que tu en as une : une affirmation qu'il peut ouvrir vaut dix fois une affirmation. Si tu n'as pas de lien, laisse "url" vide plutôt que d'en inventer un.
  Trois entrées suffisent. Cette liste ne contient QUE des ventes réellement trouvées : si tu n'en as trouvé aucune, renvoie une liste vide — cela n'empêche pas de remplir "marche", qui reste obligatoire.
- "nego" : l'ARGUMENT que le chineur oppose au vendeur, en français parlé, court, appuyé sur un fait vérifiable (nombre d'exemplaires en circulation, défaut visible, édition courante). NE CITE JAMAIS DE PRIX ni de montant dans cette phrase : le chiffre est calculé par l'application à partir de l'état réel constaté, et un montant venant de toi le contredirait devant le vendeur. Écris l'argument seul, l'app ajoute l'offre.
- "pieges" : ce qui peut transformer une bonne affaire en perte sur CET objet précis (contrefaçon, réédition, corrosion de piles, disque rayé, boîte vide).

`;


/* Les clés de la fiche unique. Le mode Bac et la vue d'ensemble ont leur propre
   format : leur envoyer cette liste en plus produirait deux consignes
   contradictoires dans le même prompt. */
export const BRIEF_JSON = `
Réponds UNIQUEMENT en JSON, sans texte autour, avec ces clés :
objet, categorie, lot, lotNb, identification, code, codeOu, attendu[] (chaque entrée : {"n":"nom de l'élément","vu":"oui|non|?","perte":nombre}), impactComplet, echelle, etatNote, etatDit, circulation, marche, gabarit, confiance, comparables[], verifs[], pieges[], nego, note.`;


/* Modèles du plus sûr au plus récent. Les plus neufs sont souvent à quota ZÉRO
   sur l'offre gratuite : ils renvoient un 429 immédiat sur une clé neuve. */
/* Google ferme l'accès aux anciens modèles dès qu'une clé est jugée « nouvelle » :
   la réponse est un 404 « no longer available to new users », pas une erreur de quota.
   Cette liste ne contient donc que des modèles en service, du plus capable au plus rapide. */
/* Liste de secours, utilisée tant que le vrai catalogue n'a pas été lu. */
export const MODELS_FALLBACK = ["gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite"];

export const MODELS_STORE = "insertcoin.gemini.models";

export let MODELS = MODELS_FALLBACK.slice();
try{
  const c = JSON.parse(localStorage.getItem(MODELS_STORE) || "null");
  if(Array.isArray(c) && c.length) MODELS = c;
}catch(e){}


/* ══════ CATALOGUE DES MODÈLES ══════
   Les noms codés en dur pourrissent : Google retire un modèle et l'app répond
   404 en pleine brocante. On demande donc la vraie liste à l'API, on la garde
   en local, et la liste de secours ne sert plus qu'au tout premier lancement. */
export function modelJoli(n){
  return n.replace(/^gemini-/,"Gemini ").replace(/-/g," ")
          .replace(/\b\w/g, c => c.toUpperCase());
}


export async function modelsRefresh(manuel){
  const key = localStorage.getItem(KEY_STORE);
  if(!key || !navigator.onLine){ if(manuel) alert("Il faut une clé enregistrée et du réseau."); return; }
  try{
    /* Budget de temps : liste de modèles = requête légère, sans image ni
       génération — 10 s est déjà généreux (correctif du 23/08/2026, voir
       docs/diagnostic-cotation.md, aucun appel n'avait de timeout avant). */
    const r = await fetchAvecDelai("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
      {headers:{"x-goog-api-key": key}}, 10000);
    if(!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    const dispo = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).indexOf("generateContent") !== -1)
      .map(m => String(m.name || "").replace(/^models\//, ""))
      /* On ne garde que les modèles rapides et multimodaux : sur un stand,
         trente secondes d'attente valent moins qu'une réponse correcte tout de suite. */
      .filter(n => /gemini/.test(n) && /flash/.test(n))
      .filter(n => !/(embedding|aqa|tts|audio|live|image|native)/.test(n));
    if(!dispo.length) throw new Error("Aucun modèle exploitable");

    /* Du plus capable au plus rapide : version décroissante, « lite » en dernier,
       et les préversions après les modèles stables. */
    const score = n => {
      const v = parseFloat((n.match(/gemini-([\d.]+)/) || [0,"0"])[1]) || 0;
      return v * 100 - (/lite/.test(n) ? 30 : 0) - (/(preview|exp)/.test(n) ? 50 : 0);
    };
    dispo.sort((a,b) => score(b) - score(a));
    MODELS = dispo.slice(0, 8);
    try{ localStorage.setItem(MODELS_STORE, JSON.stringify(MODELS)); }catch(e){}
    modelsPaint();
    if(manuel) alert(MODELS.length + " modèle(s) disponibles sur ta clé.\n\n" + MODELS.join("\n"));
  }catch(err){
    if(manuel) alert("Impossible de lire la liste des modèles.\n" + (err.message || err));
  }
}


export const SCHEMA_SINGLE = {
  type:"OBJECT",
  properties:{
    objet:{type:"STRING"}, categorie:{type:"STRING"}, identification:{type:"STRING"},
    lot:{type:"BOOLEAN"}, lotNb:{type:"NUMBER"},
    code:{type:"STRING"}, codeOu:{type:"STRING"},
    attendu:{type:"ARRAY",items:{type:"OBJECT",properties:{
      n:{type:"STRING"}, vu:{type:"STRING"}, perte:{type:"NUMBER"}}}},
    impactComplet:{type:"STRING"},
    echelle:{type:"STRING"}, etatNote:{type:"NUMBER"}, etatDit:{type:"STRING"},
    circulation:{type:"STRING"}, marche:{type:"NUMBER"}, gabarit:{type:"STRING"},
    confiance:{type:"STRING"},
    comparables:{type:"ARRAY",items:{type:"OBJECT",properties:{
      source:{type:"STRING"}, titre:{type:"STRING"}, etat:{type:"STRING"},
      prix:{type:"NUMBER"}, date:{type:"STRING"}, url:{type:"STRING"}}}},
    verifs:{type:"ARRAY",items:{type:"STRING"}},
    pieges:{type:"ARRAY",items:{type:"STRING"}},
    nego:{type:"STRING"}, note:{type:"STRING"}
  }
};

export const SCHEMA_BAC = {
  type:"OBJECT",
  properties:{
    typeBac:{type:"STRING"},
    resume:{type:"STRING"},
    lot:{type:"ARRAY",items:{type:"OBJECT",properties:{
      nom:{type:"STRING"}, artiste:{type:"STRING"}, annee:{type:"STRING"},
      revente:{type:"NUMBER"}, prixMax:{type:"NUMBER"},
      verdict:{type:"STRING"}, note:{type:"STRING"}}}}
  }
};

export const SCHEMA_STAND = {
  type:"OBJECT",
  properties:{
    verdictGlobal:{type:"STRING"},
    objetsReperes:{type:"ARRAY",items:{type:"OBJECT",properties:{
      nom:{type:"STRING"}, reventeEstimee:{type:"NUMBER"},
      interet:{type:"STRING"}, verifsStand:{type:"STRING"}}}},
    conseil:{type:"STRING"}
  }
};


/* Gemini refuse responseSchema ET tools dans la même requête.
   La cote réelle prime sur le confort de parsing : on passe donc en priorité
   par la recherche web SANS schéma (JSON demandé dans le texte, parsé large),
   et on ne retombe sur le schéma strict que si le grounding est indisponible. */
export function buildBody(parts, mode, ground, model){
  /* Gemini 3 a changé les règles : temperature/topP/topK sont dépréciés, et
     thinkingBudget est refusé (400) au profit de thinkingLevel. Envoyer les deux
     ferait échouer la requête, on choisit donc selon la famille du modèle. */
  const g3 = /^gemini-3/.test(model || "");

  /* Le tri d'un bac produit une ligne par pièce, une vue d'ensemble plusieurs
     objets : leur réponse est bien plus longue qu'une fiche unique. */
  const utile = mode === 'bac' ? 3000 : mode === 'stand' ? 2000 : 1400;

  /* Chez Gemini 3, les jetons de réflexion sont décomptés de maxOutputTokens.
     Avec l'ancien plafond de 1200, la recherche web consommait tout le budget
     en réflexion : la réponse revenait tronquée, l'app basculait en repli
     « sans recherche web » — d'où des cotes de mémoire en multi et en bac
     alors qu'une photo unique passait encore. */
  const gc = {maxOutputTokens: g3 ? utile + 6000 : utile};
  if(g3){
    gc.thinkingConfig = {thinkingLevel:"low"};
  }else{
    gc.temperature = 0.2;
    /* Sans ça, 30 à 50 secondes d'attente pour un gain nul sur une fiche de prix. */
    gc.thinkingConfig = {thinkingBudget:0};
  }
  const b = { contents:[{role:"user", parts}], generationConfig: gc };
  if(ground){
    b.tools = [{google_search:{}}];
  }else{
    b.generationConfig.responseMimeType = "application/json";
    b.generationConfig.responseSchema = mode === 'stand' ? SCHEMA_STAND
      : mode === 'bac' ? SCHEMA_BAC : SCHEMA_SINGLE;
  }
  return b;
}


/* ══════ LECTURE TOLÉRANTE DU JSON ══════
   Avec la recherche web, Gemini ne renvoie pas un bloc propre : le texte arrive
   en plusieurs morceaux, parfois coupé au milieu d'une phrase, avec des retours
   à la ligne à l'intérieur des valeurs. JSON.parse refusait tout en bloc et
   l'app basculait en « estimation de mémoire » — c'est-à-dire qu'elle jetait
   une réponse correcte à 95 %. On répare avant de renoncer. */
export function jsonRepare(raw){
  let t = String(raw || "").replace(/```json|```/g, "");
  /* Les caractères de contrôle invisibles cassent JSON.parse sans rien dire. */
  t = t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const dep = t.indexOf("{");
  if(dep < 0) return null;

  let out = "", pile = [], ins = false, ech = false, fini = false;
  for(let i = dep; i < t.length && !fini; i++){
    const c = t[i];
    if(ech){ out += c; ech = false; continue; }
    if(c === "\\"){ out += c; ech = true; continue; }
    if(c === '"'){ ins = !ins; out += c; continue; }
    if(ins){
      /* Un retour à la ligne au milieu d'une valeur est illégal en JSON :
         c'est le cas le plus fréquent quand la réponse arrive en morceaux. */
      out += (c === "\n" || c === "\r" || c === "\t") ? " " : c;
      continue;
    }
    if(c === "{" || c === "[") pile.push(c);
    else if(c === "}" || c === "]"){
      pile.pop();
      if(!pile.length){ out += c; fini = true; break; }
    }
    out += c;
  }

  /* Réponse coupée en plein vol : on referme proprement ce qui reste ouvert
     plutôt que de tout perdre. Les champs déjà lus sont exploitables. */
  if(!fini){
    if(ins) out += '"';
    out = out.replace(/,\s*$/, "").replace(/:\s*$/, ": null");
    while(pile.length) out += (pile.pop() === "[" ? "]" : "}");
  }
  out = out.replace(/,\s*([}\]])/g, "$1");

  try{ return JSON.parse(out); }catch(e){}
  /* Dernier recours : du premier { à la dernière }, méthode d'origine. */
  const b = t.lastIndexOf("}");
  if(b > dep){ try{ return JSON.parse(t.slice(dep, b + 1)); }catch(e){} }
  return null;
}


export function extractJSON(data){
  const cand = (data.candidates || [])[0];
  if(!cand){
    const bl = data.promptFeedback && data.promptFeedback.blockReason;
    throw new Error(bl ? ("Requête bloquée : " + bl) : "Réponse vide");
  }
  if(cand.finishReason === "SAFETY") throw new Error("Réponse bloquée par le filtre de sécurité");
  /* Les morceaux sont la suite les uns des autres : les coller avec un retour
     à la ligne insérait une coupure au milieu des valeurs. */
  const raw = ((cand.content && cand.content.parts) || [])
    .map(x => x.text || "").join("").trim();
  const j = jsonRepare(raw);
  if(j) return j;
  if(cand.finishReason === "MAX_TOKENS") throw new Error("Réponse tronquée (budget de jetons dépassé)");
  throw new Error("Réponse illisible");
}


/* Correctif du 23/08/2026 (voir docs/diagnostic-cotation.md, "objet en
   file qui disparaît") : avant, un job déjà venu de la file
   (fromQueue===true) ne pouvait plus JAMAIS y retourner, quelle que soit
   l'erreur — un réseau qui flanche (revient un instant, retombe en pleine
   requête) faisait perdre l'objet en silence. La décision ne dépend
   maintenant que du nombre de tentatives déjà faites, pas de la provenance
   du job — mais plafonnée, pour ne pas boucler indéfiniment sur un réseau
   mort. Extraite pure (aucun accès réseau/DOM) pour être testable sans
   mock lourd — voir tests/reenfilage.test.js. */
export const TENTATIVES_MAX = 2; // 1 essai initial + jusqu'à 2 remises en file = 3 essais au total

export function devraitReenfiler(erreurMessage, tentatives){
  return /Failed to fetch|NetworkError|network/i.test(String(erreurMessage)) && (tentatives || 0) < TENTATIVES_MAX;
}


export async function callGemini(promptText, images = [], mode = 'single', fromQueue, cacheKey, tentatives = 0) {
  const key = localStorage.getItem(KEY_STORE);
  const aiEl = $('ai-results');

  if(!key) {
    switchView('guide');
    setTimeout(()=> alert("Configure ta clé API Gemini pour utiliser l'IA."), 300);
    return;
  }

  // Cache : uniquement sur les recherches texte (une photo est toujours unique)
  /* La clé DOIT venir de la recherche elle-même. Elle était calculée sur les
     180 premiers caractères du prompt — c'est-à-dire le début du brief,
     identique pour toutes les requêtes : chaque recherche retombait donc sur
     le résultat de la précédente. */
  const ckey = (!images.length && mode === 'single' && cacheKey) ? cacheKey : null;
  if(ckey){
    const hit = cacheGet(ckey);
    if(hit){ renderResult(hit, [], "Résultat déjà obtenu ce jour — aucun quota consommé."); return; }
  }

  if(!navigator.onLine && !fromQueue){ queuePush(promptText, images, mode, cacheKey); return; }

  aiEl.innerHTML = `<div class="loading">
    <div class="dots"><span>●</span><span>●</span><span>●</span></div>
    <p id="load-step">${images.length ? "Lecture de la photo" : "Identification"}…</p>
    <div class="chrono" id="chrono">0.0 s</div>
  </div>`;
  const t0 = Date.now();
  const etapes = getGround()
    ? [[1200,"Recherche des ventes récentes…"],[4000,"Comparaison des prix…"],[9000,"Presque fini…"]]
    : [[900,"Estimation…"],[3000,"Presque fini…"]];
  const tics = etapes.map(([ms,txt]) => setTimeout(() => {
    const e = $('load-step'); if(e) e.textContent = txt;
  }, ms));
  const chrono = setInterval(() => {
    const c = $('chrono');
    if(!c){ clearInterval(chrono); return; }
    c.textContent = ((Date.now()-t0)/1000).toFixed(1) + " s";
  }, 100);
  const stopChrono = () => { clearInterval(chrono); tics.forEach(clearTimeout); };
  $('photo-queue').classList.remove('active');
  window.scrollTo({top:0, behavior:'smooth'});

  /* Seules les entrées proches de la recherche sont transmises : on donne le
     contexte utile sans envoyer 400 lignes à chaque requête. */
  let ctx = "";
  if(!images.length){
    const m = collMatch(promptText);
    if(m) ctx = `\n\nCONTEXTE : le chineur possède déjà « ${m.e.a} — ${m.e.t} » dans sa collection. `
              + `Signale-le dans "note" et dis si une autre édition vaut quand même l'achat.`;
  }

  const parts = [];
  images.forEach(img => parts.push({inlineData:{mimeType: img.media, data: img.data}}));
  parts.push({text: promptText + ctx});

  const chosen = localStorage.getItem(MODEL_STORE) || MODELS[0];
  const chain = [chosen, ...MODELS.filter(m => m !== chosen)];
  const attempts = [];
  for(const m of chain){
    /* Deux passages avec recherche web avant de renoncer : un JSON illisible
       est le plus souvent un accident de génération, pas une incapacité du
       modèle. Renoncer au premier essai, c'est troquer une vraie cote contre
       une estimation de mémoire — exactement ce qu'on cherche à éviter. */
    if(getGround()){ attempts.push({model:m, ground:true}); attempts.push({model:m, ground:true, bis:true}); }
    attempts.push({model:m, ground:false});
  }

  let lastErr = "";
  /* Le rendu ne doit JAMAIS se faire à l'intérieur de ce try : une clé
     manquante dans le JSON faisait planter l'affichage, l'erreur tombait dans
     le catch, et l'app relançait toute la requête sur le modèle suivant —
     quota brûlé et « Échec de l'analyse » alors que Gemini avait répondu. */
  let ok = null;
  for(const at of attempts){
    try{
      if(at.bis){
        const e = $('load-step');
        if(e) e.textContent = "Réponse incomplète, nouvelle tentative…";
      }
      /* Budget de temps par tentative : upload de photos + recherche web +
         génération, ça prend du temps même sur un bon réseau — 25 s laisse
         de la marge tout en évitant qu'UNE tentative bloque indéfiniment
         sur un réseau qui traîne sans jamais couper franchement. Un budget
         dépassé se comporte comme n'importe quel autre échec : la boucle
         passe à la tentative suivante (voir le catch plus bas). */
      const res = await fetchAvecDelai(
        `https://generativelanguage.googleapis.com/v1beta/models/${at.model}:generateContent`,
        {method:"POST",
         headers:{"Content-Type":"application/json","x-goog-api-key":key},
         body: JSON.stringify(buildBody(parts, mode, at.ground, at.model))}, 25000);

      if(!res.ok){
        let d = ""; try { d = (await res.json()).error?.message || ""; } catch(e){}
        lastErr = "HTTP " + res.status + (d ? " — " + d : "");
        if([400,403,404,429,500,503].includes(res.status)) continue;
        throw new Error(lastErr);
      }

      credBump(); stopChrono();
      const j = extractJSON(await res.json());
      let avis = null;
      if(!at.ground){
        avis = "Sans recherche web : prix estimés de mémoire, à confirmer."
             + (discToken() ? " La cote Discogs ci-dessous, elle, vient du marché réel." : "")
             + (lastErr ? " (cause : " + lastErr + ")" : "");
        if(mode !== 'stand' && mode !== 'bac') j.confiance = "faible";
      }
      if(at.model !== chosen) try{ localStorage.setItem(MODEL_STORE, at.model); }catch(e){}

      ok = {j, avis};
      break;

    }catch(err){ lastErr = String(err.message || err); }
  }

  if(ok){
    stopChrono();
    /* Enregistré même si l'affichage plante juste après (catch ci-dessous) :
       l'analyse a réussi, c'est ça qui compte pour l'historique — voir
       storage/local.js et la demande du 23/08/2026. */
    rechAjouter(mode, ok.j, ok.avis);
    try{
      if(mode === 'bac') renderBacResult(ok.j, images, ok.avis);
      else if(mode === 'stand') renderStandResult(ok.j, images[0], ok.avis);
      else { renderResult(ok.j, images, ok.avis); if(ckey && !ok.avis) cacheSet(ckey, ok.j); }
    }catch(err){
      /* La réponse est arrivée mais elle est incomplète : on le dit, on ne
         relance pas une requête. */
      aiEl.innerHTML = `<div class="aifail"><b>Réponse incomplète.</b><br>
        Le modèle a répondu, mais il manque des informations pour afficher la fiche.
        Relance l'analyse, ou reformule en une phrase courte.
        <br><br><span style="font-family:var(--mono);font-size:11px;opacity:.7">${esc(err.message || err)}</span></div>
        <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">Masquer</button>`;
    }
    return;
  }

  if(devraitReenfiler(lastErr, tentatives)){
    if(queuePush(promptText, images, mode, cacheKey, tentatives + 1)) return;
  }

  stopChrono();
  let titre = "Échec de l'analyse.", aide = "Vérifie ta connexion et réessaie.";
  if(/401|403|API_KEY_INVALID|PERMISSION/i.test(lastErr)){
    titre = "Clé refusée.";
    aide = "Recolle ta clé dans l'onglet Guide, sans espace avant ni après.";
  }else if(/429|quota|RESOURCE_EXHAUSTED/i.test(lastErr)){
    titre = "Quota à zéro sur ta clé.";
    aide = "Ce n'est pas une surconsommation : aucun des modèles testés n'a de quota gratuit disponible. "
         + "Cause la plus fréquente : la facturation est activée sur le projet Google, ce qui supprime l'offre gratuite. "
         + "Sinon, décoche la recherche web dans le Guide — elle a son propre quota.";
  }else if(/404|NOT_FOUND/i.test(lastErr)){
    titre = "Aucun modèle disponible.";
    aide = "Les modèles testés n'existent plus sous ce nom. Vérifie la liste sur aistudio.google.com.";
  }
  /* L'IA a échoué, mais si tu as tapé un nom de disque, Discogs peut encore
     répondre : c'est le seul chiffre qui compte devant le vendeur. */
  const secours = ($('q').value || "").trim();
  aiEl.innerHTML = `<div class="aifail"><b>${titre}</b><br>${aide}
    <br><br><span style="font-family:var(--mono);font-size:11px;opacity:.7">${esc(lastErr)}</span></div>
    <div id="disc-slot"></div>
    <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">Masquer</button>`;
  if(discToken() && discMusique(secours)) discGreffe(secours, 'disc-slot');
}
