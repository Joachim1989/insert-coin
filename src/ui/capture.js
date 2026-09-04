import { $, vib } from "../util/dom.js";
import { norm } from "../util/text.js";
import { SRC_STORE, srcGet, collRead, queueRead, queueWrite } from "../storage/local.js";
import { prixNouveau } from "./fiche.js";
import { collBanner } from "./dedup.js";
import { BRIEF_BASE, BRIEF_JSON, callGemini } from "../api/gemini.js";
import { hudPaint } from "./hud.js";
import { t } from "../i18n/index.js";

// --- STATE ---
export let currentCameraMode = null; // 'single', 'multi', 'stand'

/* Dans l'index.html monolithique, les boutons "Photographier"/"Galerie"
   lisaient directement la variable globale currentCameraMode depuis leur
   onclick — ça marchait parce que tout vivait dans le même <script>. En
   module ES, une variable de module n'est plus visible depuis le HTML,
   même exportée : il faut une fonction. Ce getter est ce qui remplace la
   lecture directe ; voir dev.html, les deux boutons .shoot-b. */
export function cameraMode(){ return currentCameraMode; }

export let photoQueue = [];

export let searchTerm = "";


export function syncAskButton() {
  const hasInput = searchTerm.trim().length > 1;
  $('ask').disabled = !hasInput;
}


export function clearSearch() {
  $('q').value = "";
  searchTerm = "";
  syncAskButton();
  $('ai-results').innerHTML = "";
  $('q').focus();
}

export function srcSet(v, el){
  try{ localStorage.setItem(SRC_STORE, v); }catch(e){}
  document.querySelectorAll('#src-seg button').forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
  vib();
}

export function srcPaint(){ /* le sélecteur a disparu de l'écran : plus rien à peindre */ }


/* La source peut être imposée par le bouton : « Photographier » ouvre
   l'objectif, « Galerie » laisse le téléphone proposer les deux. */
export function triggerCamera(mode, src) {
  vib();
  prixNouveau();
  if(mode) currentCameraMode = mode;
  /* « Photographier » ouvre l'objectif, « Galerie » laisse le téléphone
     proposer ses images. Le choix est dans le bouton pressé. */
  const input = (src || srcGet()) === "cam" ? $('file-cam') : $('file-input');
  /* La galerie autorise toujours la sélection multiple, sauf pour une vue
     d'ensemble qui n'en prend qu'une. On n'efface jamais la pile ici : c'est
     précisément ce qui empêchait d'ajouter une deuxième vue du même objet. */
  input.multiple = (currentCameraMode !== 'stand');
  input.click();
}


/* ══════════ LES TROIS SITUATIONS ══════════
   Le mode ne dit pas comment prendre la photo, il dit ce qu'on demande :
     objet — une pièce, autant de vues que tu veux (dos, dessous, défauts) ;
     lot   — un carton, un bac : chaque pièce est évaluée séparément ;
     stand — la table entière : qu'est-ce qui mérite qu'on s'arrête ?
   Les photos s'empilent quelle que soit leur provenance : appareil, galerie,
   ou les deux mélangés. C'est le même tas. */
/* Cles i18n, pas le texte lui-meme : MODE_DIT/MODE_BTN etaient evalues une
   seule fois a l'import du module, donc figes dans la langue active a ce
   moment-la — un changement de langue ensuite ne les aurait jamais mis a
   jour. t() est appele au moment de l'usage (modeSet(), updatePhotoQueueUI())
   pour toujours refleter la langue courante, comme i18nAppliquer(). */
export const MODE_DIT = {
  objet: "mode.dit.objet",
  bac:   "mode.dit.bac",
  stand: "mode.dit.stand"
};

export const MODE_BTN = {objet: "shoot.analyser", bac: "mode.btn.bac", stand: "mode.btn.stand"};


export function modeSet(m){
  currentCameraMode = m;
  document.querySelectorAll('#modes .md').forEach(b => b.classList.toggle("on", b.dataset.m === m));
  const dd = $('mode-dit'); if(dd) dd.textContent = MODE_DIT[m] ? t(MODE_DIT[m]) : "";
  /* La vue d'ensemble ne traite qu'une seule image : on ne garde que la dernière. */
  if(m === 'stand' && photoQueue.length > 1) photoQueue = [photoQueue[photoQueue.length - 1]];
  vib(); updatePhotoQueueUI();
}


export function handleFileSelect(e) {
  const files = e.target.files;
  if(!files.length) return;
  const liste = Array.from(files);
  /* Une vue d'ensemble, c'est une seule image : les autres seraient du bruit. */
  const garder = currentCameraMode === 'stand' ? liste.slice(-1) : liste;
  if(currentCameraMode === 'stand') photoQueue = [];
  Promise.all(garder.map(shrink)).then(ps => {
    ps.forEach(p => photoQueue.push(p));
    /* Plafond volontaire : au-delà, la requête devient lourde et lente, et sur
       un stand une analyse qui met une minute ne sert à rien. */
    if(photoQueue.length > 8){
      photoQueue = photoQueue.slice(0, 8);
      alert(t("alert.photos_max"));
    }
    updatePhotoQueueUI();
  });
  e.target.value = "";
}


/* Le bouton unique : il sait quoi lancer selon le mode et le nombre de vues. */
/* La pile appartient à l'objet qu'on vient d'analyser : la garder ferait
   partir les vues du vendeur précédent avec le suivant. */
export function photoVider(){
  photoQueue = [];
  updatePhotoQueueUI();
}


export function askAIGo(){
  if(!photoQueue.length) return;
  if(currentCameraMode === 'bac') return askAIBac();
  if(currentCameraMode === 'stand') return askAIStand();
  return photoQueue.length > 1 ? askAIMulti() : askAISingle();
}


export function updatePhotoQueueUI() {
  const q = $('photo-queue');
  const imgs = $('photo-queue-imgs');
  if(!q || !imgs) return;
  const n = photoQueue.length;
  const btn = q.querySelector('.analyze-multi-btn');
  if(btn){
    btn.textContent = t(MODE_BTN[currentCameraMode] || "shoot.analyser")
      + (n > 1 ? t("shoot.vues_suffix", {n}) : "");
  }
  const cs = $('shoot-cam-s');
  if(cs) cs.textContent = n ? t("shoot.photo.ajouter") : t("shoot.photo.sub");
  if(n > 0){
    q.classList.add('active');
    imgs.innerHTML = photoQueue.map((p, i) => `
      <div class="photo-thumb-wrap">
        <img src="${p.url}" class="photo-thumb">
        <button class="photo-remove" onclick="removePhoto(${i})">✕</button>
      </div>
    `).join('');
  } else {
    q.classList.remove('active');
    imgs.innerHTML = "";
  }
}


export function removePhoto(idx) {
  photoQueue.splice(idx, 1);
  updatePhotoQueueUI();
}


export function shrink(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=1000, sc=Math.min(1,max/Math.max(img.width,img.height));
        const cv=document.createElement("canvas");
        cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
        cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
        const url=cv.toDataURL("image/jpeg",0.8);
        res({data:url.split(",")[1], media:"image/jpeg", url:url});
      };
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}


// Fonction pour les recherches 100% texte
export function askAIText() {
  prixNouveau();
  const q = $('q').value.trim();
  /* Contrôle local instantané : gratuit, hors ligne, avant toute requête. */
  const dup = collBanner(q);
  if(dup) $('ai-results').innerHTML = dup;
  if(!q) return;
  const p = $('price').value.trim();
  let prompt = BRIEF_BASE + BRIEF_JSON + `\nObjet recherché : ${q}. `;
  if(p) prompt += `Le vendeur en demande ${p} EUR. Dis dans "note" si c'est ok à ce prix.`;
  callGemini(prompt, [], 'single', false, "t:" + norm(q) + "|" + (p || ""));
}


/* ══════ ANALYSER UNE ANNONCE EN LIGNE ══════
   Le chineur tombe sur une annonce (Vinted, eBay, Leboncoin, 2ememain...)
   sans avoir l'objet sous la main : pas de photo à prendre, juste un lien.
   L'IA va lire la page elle-même (outil url_context, voir buildBody() dans
   api/gemini.js) — description, prix affiché, photos si elle peut les
   consulter — plutôt que de deviner à partir d'un titre recopié à la main.
   Pas de cache : chaque annonce est unique, et son prix peut bouger. */
export function askAIUrl() {
  prixNouveau();
  const u = ($('annonce-url').value || "").trim();
  if(!u) return;
  if(!/^https?:\/\//i.test(u)){ alert(t("alert.lien_invalide")); return; }

  let prompt = BRIEF_BASE + BRIEF_JSON + `
ANNONCE EN LIGNE. Ouvre et lis cette page avant de répondre, elle est la seule source fiable : ${u}
Base-toi sur son contenu réel — titre, description complète, photos si tu peux les consulter, et le prix affiché — pour identifier l'objet et répondre aux cinq questions habituelles.
Si un prix est affiché sur cette annonce, recopie-le tel quel (le nombre seul, sans texte autour) dans une clé supplémentaire "prixAnnonce" ; si tu n'en vois aucun, mets "prixAnnonce":null. Compare ce prix à "marche" dans "note".
Si la page est inaccessible ou que son contenu ne suffit pas à identifier l'objet, dis-le franchement plutôt que d'inventer.`;

  const customText = $('q').value.trim();
  if(customText) prompt += `\n\nQUESTION OU PRÉCISION DU CHINEUR : ${customText}\nRéponds obligatoirement à cette instruction spécifique.`;

  const p = $('price').value.trim();
  if(p) prompt += `\nPrix déjà noté par le chineur, fais-lui confiance plutôt qu'à ce que tu lirais sur la page : ${p} EUR.`;

  callGemini(prompt, [], 'single', false, null, 0, true);
  $('annonce-url').value = "";
}


// Fonctions Photos modifiées pour inclure le texte de la barre de recherche
export function askAISingle() {
  let prompt = BRIEF_BASE + BRIEF_JSON + `\nIdentifie l'objet sur cette photo. Lis en priorité toute référence, code, matricule ou marquage moulé visible, même partiellement.`;
  
  // On récupère le texte ou la macro saisie par le chineur
  const customText = $('q').value.trim();
  if(customText) {
    prompt += `\n\nQUESTION OU PRÉCISION DU CHINEUR : ${customText}\nRéponds obligatoirement à cette instruction spécifique.`;
  }
  
  const p = $('price').value.trim();
  if(p) prompt += `\nPrix vendeur : ${p} EUR.`;
  
  callGemini(prompt, photoQueue, 'single');
  photoVider();
}


export function askAIMulti() {
  let prompt = BRIEF_BASE + BRIEF_JSON + `\nVoici PLUSIEURS VUES du MÊME objet. Identifie-le, lis les références visibles (dos, dessous, tranche) et évalue les défauts.`;
  
  const customText = $('q').value.trim();
  if(customText) {
    prompt += `\n\nQUESTION OU PRÉCISION DU CHINEUR : ${customText}\nRéponds obligatoirement à cette instruction spécifique.`;
  }
  
  const p = $('price').value.trim();
  if(p) prompt += `\nPrix vendeur : ${p} EUR.`;
  
  callGemini(prompt, photoQueue, 'multi');
  photoVider();
}


export function askAIBac() {
  if(!photoQueue.length){ alert(t("alert.bac_vide")); return; }
  /* On envoie la liste des artistes déjà possédés, tronquée : elle aide le
     modèle à lire les pochettes floues, sans pour autant remplacer le
     contrôle de doublon qui reste fait en local, exemplaire par exemplaire. */
  const artistes = [...new Set(collRead().map(x => x.a).filter(Boolean))].slice(0, 120);
  const indice = artistes.length
    ? `\nIndice de lecture : le chineur possède déjà des articles de ${artistes.join(", ")}. Ces noms t'aident à déchiffrer une tranche floue, mais ne suppose jamais qu'un article est présent s'il ne l'est pas visiblement.`
    : "";

  /* Correctif du 30/08/2026 (retour de terrain : bacs de jouets/LEGO en
     vrac systématiquement "Rien de lisible", y compris sur des pièces
     reconnaissables comme une tête de figurine Spider-Man). L'ancienne
     version ("article LISIBLE", "ne liste que ce que tu LIS vraiment")
     ne parlait que de texte imprimé — un vinyle ou une boîte de jeu en a,
     une pièce LEGO ou une figurine en vrac n'en a presque jamais, alors
     que BRIEF_BASE couvre explicitement les jouets/figurines/LEGO. Le mot
     "lisible" excluait donc par construction tout ce qui s'identifie à
     l'œil plutôt qu'au texte. Élargi à "reconnaissable" (texte OU
     identification visuelle sûre), en gardant le même garde-fou contre
     l'invention : on ne baisse pas l'exigence de certitude, on élargit
     seulement le moyen d'y arriver. Non testable par un test automatisé
     (comportement réel du modèle) — à confirmer sur le terrain, voir
     NON TESTÉ. */
  const prompt = BRIEF_BASE + `
BAC / LOT. Les photos montrent un bac, un carton ou une pile d'articles à trier un par un : pochettes de vinyles, boîtes de jeux, cartouches, BD, mais aussi jouets en vrac, figurines, pièces LEGO, peluches — tout ce qui se vend à l'unité dans ce genre de tas.
Identifie CHAQUE article RECONNAISSABLE, un par un. "Reconnaissable" veut dire soit un texte ou code lisible (titre, référence, code-barres), soit une identification VISUELLE dont tu es sûr (un personnage, une gamme ou une marque que tu reconnais avec certitude à l'œil, même sans aucun texte dessus — une tête de figurine LEGO Marvel, une pièce d'un thème LEGO connu). Ne devine pas ce qui reste flou, générique ou ambigu : liste seulement ce dont tu es sûr, par le texte ou par la reconnaissance visuelle.
Pour chacun : nom (le titre exact si tu l'as lu, sinon une description reconnaissable si l'identification est visuelle — "Figurine LEGO Spider-Man", "Roue LEGO Technic"), artiste (ou console/éditeur/gamme), annee si visible, revente estimée en euros, prixMax à payer aujourd'hui, verdict "R" (prends), "N" (seulement sous prixMax) ou "L" (laisse), et une note très courte s'il y a une raison particulière (pressage recherché, tirage massif, état visible, identification visuelle sans texte pour la confirmer).
Trie du plus intéressant au moins intéressant.
typeBac = ce que contient le bac en trois mots. resume = une phrase : vaut-il le coup de fouiller ce bac ou non — remplis-la même si le lot est vide, pour dire pourquoi (rien de net, trop en vrac, hors sujet...).${indice}
Réponds UNIQUEMENT en JSON : {"typeBac":"","resume":"","lot":[{"nom":"","artiste":"","annee":"","revente":0,"prixMax":0,"verdict":"","note":""}]}`;
  callGemini(prompt, photoQueue, 'bac');
  photoVider();
}


export function askAIStand() {
  let prompt = BRIEF_BASE + `\nVue d'ensemble d'un stand. Liste les objets rentables visibles, du plus au moins intéressant. Verdict global : 'S' (À fouiller) ou 'L' (Laisse). Réponds en JSON avec les clés : verdictGlobal, objetsReperes[] (nom, reventeEstimee, interet, verifsStand), conseil.`;
  
  const customText = $('q').value.trim();
  if(customText) {
    prompt += `\n\nRECHERCHE SPÉCIFIQUE DU CHINEUR SUR CE STAND : ${customText}\nDis-moi si tu vois cela.`;
  }
  
  callGemini(prompt, photoQueue, 'stand');
  photoVider();
}



/* ══════════════════ LECTEUR DE CODE-BARRES ══════════════════
   Le geste le plus rapide de l'app : viser, c'est identifié. Pas d'analyse
   d'image par l'IA, pas d'ambiguïté de titre — le code EAN désigne une
   référence et une seule. Sur les jeux de société, les figurines en boîte et
   les mangas, on passe de quinze secondes à deux.

   L'API BarcodeDetector est native à Chrome sur Android : ni bibliothèque, ni
   téléchargement. Là où elle manque, on le dit et on propose la saisie. */
export let BC_FLUX = null, BC_BOUCLE = null;


export function bcDispo(){ return typeof window.BarcodeDetector !== "undefined"; }


export async function bcOuvrir(){
  vib();
  if(!bcDispo()){
    const t = prompt("Ton navigateur ne sait pas lire les codes-barres.\n\nTape le code à la main (les chiffres sous les barres) :");
    if(t && t.trim()) bcTrouve(t.trim());
    return;
  }
  const ov = $('bc-overlay');
  ov.classList.add('on');
  $('bc-msg').textContent = "Cadre le code-barres";
  try{
    BC_FLUX = await navigator.mediaDevices.getUserMedia({
      video: {facingMode: {ideal: "environment"}}
    });
    const v = $('bc-video');
    v.srcObject = BC_FLUX;
    await v.play();
    bcBoucle();
  }catch(err){
    $('bc-msg').textContent = "Accès à la caméra refusé.";
    setTimeout(bcFermer, 1600);
  }
}


export async function bcBoucle(){
  let det;
  try{
    det = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"]
    });
  }catch(e){ $('bc-msg').textContent = "Lecture impossible sur cet appareil."; return; }

  const v = $('bc-video');
  BC_BOUCLE = setInterval(async () => {
    if(!v || v.readyState < 2) return;
    try{
      const codes = await det.detect(v);
      if(codes && codes.length){
        const brut = String(codes[0].rawValue || "").trim();
        if(brut){ bcFermer(); bcTrouve(brut); }
      }
    }catch(e){}
  }, 400);
}


export function bcFermer(){
  if(BC_BOUCLE){ clearInterval(BC_BOUCLE); BC_BOUCLE = null; }
  if(BC_FLUX){ BC_FLUX.getTracks().forEach(t => t.stop()); BC_FLUX = null; }
  const v = $('bc-video'); if(v) v.srcObject = null;
  const ov = $('bc-overlay'); if(ov) ov.classList.remove('on');
}


/* Un code-barres est une référence exacte : on le donne tel quel au moteur, en
   lui interdisant de deviner à partir d'un titre approchant. */
export function bcTrouve(code){
  vib();
  const q = $('q');
  if(q) q.value = "Code-barres " + code;
  const chp = $('ask'); if(chp) chp.disabled = false;
  askAICode(code);
}


export function askAICode(code){
  const prompt = BRIEF_BASE + BRIEF_JSON + `
IDENTIFICATION PAR CODE-BARRES. Le code lu sur l'emballage est : ${code}
Ce code désigne une référence précise et une seule. Cherche à quoi il correspond exactement (produit, édition, région, année) avant toute estimation.
Si tu ne trouves pas ce code exact, dis-le franchement dans "note", mets "confiance":"faible", et n'invente pas un produit approchant.
Recopie le code dans "code".`
    + (($('price').value || "").trim() ? `\nPrix vendeur : ${$('price').value.trim()} EUR.` : "");
  callGemini(prompt, [], 'single');
}


/* Une image mise en file pesait double : `data` (le base64 envoyé à Gemini)
   ET `url` (le même base64 avec son en-tête, pour l'aperçu). Six photos
   suffisaient à remplir les 5 Mo du navigateur — et c'est le journal de chasse
   qui sautait en premier, silencieusement. On ne stocke plus que `data`,
   l'aperçu se reconstruit au moment de l'analyse. */
export const qImgSlim = img => ({data: img.data, media: img.media});

export const qImgFull = img => ({...img, url: img.url || ("data:" + (img.media||"image/jpeg") + ";base64," + img.data)});


export function queuePush(promptText, images, mode, cacheKey, tentatives = 0, urlCtx = false){
  const a = queueRead();
  if(a.length >= 4){ alert(t("alert.file_pleine")); return false; }
  /* Au-delà de deux vues, le gain d'identification ne compense pas le risque
     de saturer la mémoire du téléphone. */
  const slim = (images || []).slice(0, 2).map(qImgSlim);
  /* tentatives : combien de fois ce job est déjà repassé par la file — voir
     devraitReenfiler()/TENTATIVES_MAX dans src/api/gemini.js, correctif du
     23/08/2026. Sans ce compteur, un job requeue-able à l'infini bouclerait
     pour toujours sur un réseau mort.
     urlCtx : l'analyse d'un lien d'annonce a besoin de l'outil url_context
     au retour en ligne — sans le garder ici, la relance perdrait le lien. */
  a.push({d: Date.now(), promptText, images: slim, mode, cacheKey, tentatives, urlCtx});
  if(!queueWrite(a)){ alert(t("alert.memoire_saturee")); return false; }
  hudPaint();
  $('ai-results').innerHTML = `<div class="queued">
    <svg class="ico-big"><use href="#i-queue"/></svg>
    <b>Mis en file d'attente</b>
    <p>Pas de réseau ici. L'analyse partira toute seule dès que le signal revient —
    ${a.length} objet${a.length>1?"s":""} en attente. Continue à chiner.</p></div>`;
  return true;
}


export let qBusy = false;

export async function queueRun(manuel){
  if(qBusy) return;
  const a = queueRead();
  if(!a.length){ if(manuel) alert(t("alert.file_vide")); return; }
  if(!navigator.onLine){ if(manuel) alert(t("alert.pas_de_reseau")); return; }
  qBusy = true;
  const job = a.shift();
  queueWrite(a); hudPaint();
  try{ await callGemini(job.promptText, (job.images || []).map(qImgFull), job.mode || 'single', true, job.cacheKey, job.tentatives || 0, job.urlCtx || false); }
  finally{ qBusy = false; }
  if(queueRead().length) setTimeout(() => queueRun(false), 1200);
}
window.addEventListener('online', () => setTimeout(() => queueRun(false), 2000));

/* Câblage du champ de recherche libre : regroupé ici parce que searchTerm
   n'appartient qu'à ce module (appelé depuis init(), voir ui/main.js). */
export function captureInit(){
  $('q').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    syncAskButton();
    });

  $('q').addEventListener('keydown', (e) => {
    if(e.key === "Enter") { e.preventDefault(); askAIText(); }
  });

  $('ask').addEventListener('click', () => { vib(); askAIText(); });

  $('annonce-url').addEventListener('keydown', (e) => {
    if(e.key === "Enter") { e.preventDefault(); askAIUrl(); }
  });
}
