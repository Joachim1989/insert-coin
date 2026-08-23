import { $, vib } from "../util/dom.js";
import { norm } from "../util/text.js";
import { SRC_STORE, srcGet, collRead, queueRead, queueWrite } from "../storage/local.js";
import { prixNouveau } from "./fiche.js";
import { collBanner } from "./dedup.js";
import { BRIEF_BASE, BRIEF_JSON, callGemini } from "../api/gemini.js";
import { hudPaint } from "./hud.js";

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
export const MODE_DIT = {
  objet: "Prends-en plusieurs si tu veux : le dos, le dessous, le défaut.",
  bac:   "Une photo par pièce, ou une photo de plusieurs pièces. Chacune sera chiffrée.",
  stand: "Une vue large de la table. L'app te dit s'il vaut la peine de fouiller."
};

export const MODE_BTN = {objet: "Analyser", bac: "Trier ce lot", stand: "Lire ce stand"};


export function modeSet(m){
  currentCameraMode = m;
  document.querySelectorAll('#modes .md').forEach(b => b.classList.toggle("on", b.dataset.m === m));
  const dd = $('mode-dit'); if(dd) dd.textContent = MODE_DIT[m] || "";
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
      alert("8 photos au maximum par analyse.");
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
    btn.textContent = (MODE_BTN[currentCameraMode] || "Analyser")
      + (n > 1 ? ` · ${n} vues` : "");
  }
  const cs = $('shoot-cam-s');
  if(cs) cs.textContent = n ? "ajouter une vue" : "l'appareil s'ouvre";
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
  if(!photoQueue.length){ alert("Prends d'abord une ou plusieurs photos du bac."); return; }
  /* On envoie la liste des artistes déjà possédés, tronquée : elle aide le
     modèle à lire les pochettes floues, sans pour autant remplacer le
     contrôle de doublon qui reste fait en local, exemplaire par exemplaire. */
  const artistes = [...new Set(collRead().map(x => x.a).filter(Boolean))].slice(0, 120);
  const indice = artistes.length
    ? `\nIndice de lecture : le chineur possède déjà des articles de ${artistes.join(", ")}. Ces noms t'aident à déchiffrer une tranche floue, mais ne suppose jamais qu'un article est présent s'il ne l'est pas visiblement.`
    : "";

  const prompt = BRIEF_BASE + `
BAC / LOT HOMOGÈNE. Les photos montrent un bac, un carton ou une pile d'articles du même type (pochettes de vinyles serrées, boîtes de jeux, cartouches, BD...).
Identifie CHAQUE article LISIBLE, un par un. Ne devine pas ce qui est illisible ou masqué : ne liste que ce que tu lis vraiment.
Pour chacun : nom (titre exact), artiste (ou console/éditeur), annee si visible, revente estimée en euros, prixMax à payer aujourd'hui, verdict "R" (prends), "N" (seulement sous prixMax) ou "L" (laisse), et une note très courte s'il y a une raison particulière (pressage recherché, tirage massif, état visible).
Trie du plus intéressant au moins intéressant.
typeBac = ce que contient le bac en trois mots. resume = une phrase : vaut-il le coup de fouiller ce bac ou non.${indice}
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


export function queuePush(promptText, images, mode, cacheKey, tentatives = 0){
  const a = queueRead();
  if(a.length >= 4){ alert("File pleine (4 objets). Relance-la dès que tu captes."); return false; }
  /* Au-delà de deux vues, le gain d'identification ne compense pas le risque
     de saturer la mémoire du téléphone. */
  const slim = (images || []).slice(0, 2).map(qImgSlim);
  /* tentatives : combien de fois ce job est déjà repassé par la file — voir
     devraitReenfiler()/TENTATIVES_MAX dans src/api/gemini.js, correctif du
     23/08/2026. Sans ce compteur, un job requeue-able à l'infini bouclerait
     pour toujours sur un réseau mort. */
  a.push({d: Date.now(), promptText, images: slim, mode, cacheKey, tentatives});
  if(!queueWrite(a)){ alert("Mémoire du téléphone saturée : impossible de mettre en file.\n\nVa dans Réglages → Sauvegarde pour libérer de la place."); return false; }
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
  if(!a.length){ if(manuel) alert("La file est vide."); return; }
  if(!navigator.onLine){ if(manuel) alert("Toujours pas de réseau."); return; }
  qBusy = true;
  const job = a.shift();
  queueWrite(a); hudPaint();
  try{ await callGemini(job.promptText, (job.images || []).map(qImgFull), job.mode || 'single', true, job.cacheKey, job.tentatives || 0); }
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
}
