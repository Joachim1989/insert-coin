import { $, vib } from "../util/dom.js";
import { esc } from "../util/text.js";
import {
  KEY_STORE, MODEL_STORE, GROUND_STORE, memBytes, queueRead,
  CACHE_STORE, Q_STORE, DISC_CACHE, LEGO_CACHE, sortieRead, logRead,
  discToken, DISC_STORE, legoKey, LEGO_STORE, LEGO_PIECE_STORE, LEGO_FIG_STORE, legoTarifs,
  brickKey, BRICK_STORE, BRICK_RELAY_STORE, brickRelay, THEME_STORE, themeGet,
  REGION_STORE, regionGet
} from "../storage/local.js";
import { MODELS, modelJoli, modelsRefresh } from "../api/gemini.js";
import { discCote } from "../api/discogs.js";
import { legoSet } from "../api/rebrickable.js";
import { brickSet, BRICK_RELAY_CODE } from "../api/brickset.js";
import { hudPaint } from "./hud.js";
import { driveAuth } from "../api/googledrive.js";
import { i18nAppliquer, locale, localeSet } from "../i18n/index.js";
import { calSousTitrePaint } from "./calendar.js";

export function saveSettings() {
  vib();
  const keyVal = $('api-key').value.trim();
  const modelVal = $('api-model').value;
  
  if(keyVal) {
    localStorage.setItem(KEY_STORE, keyVal);
  } else {
    localStorage.removeItem(KEY_STORE);
  }
  localStorage.setItem(MODEL_STORE, modelVal);
  try{ localStorage.setItem(GROUND_STORE, $('groundBox').checked ? "on" : "off"); }catch(e){}

  const selVal = $('region-select').value;
  const regionVal = selVal === "__autre__" ? ($('region-input').value || "").trim() : selVal;
  try{ regionVal ? localStorage.setItem(REGION_STORE, regionVal) : localStorage.removeItem(REGION_STORE); }catch(e){}
  calSousTitrePaint();

  paintKeyState();
  /* Une clé neuve n'ouvre pas forcément les mêmes modèles que l'ancienne. */
  if(keyVal && navigator.onLine) modelsRefresh(false);
}


export function backupState(){
  const el = $('backup-state'); if(!el) return;
  let t = 0; try{ t = parseInt(localStorage.getItem("insertcoin.lastbackup")||"0",10); }catch(e){}
  const n = sortieRead().length, j = logRead().length;
  const jours = t ? Math.floor((Date.now()-t)/86400000) : null;
  const alerte = (jours === null || jours > 14);
  el.style.borderLeft = "3px solid " + (alerte ? "var(--stop)" : "var(--go)");
  el.innerHTML = `${n} sortie(s) archivée(s) · ${j} achat(s) en cours<br>`
    + (t ? `Dernière sauvegarde : il y a ${jours} jour(s)` : "<b>Jamais sauvegardé</b>");
  memPaint();
}


/* La limite du navigateur tourne autour de 5 Mo. On la montre AVANT d'être
   dedans, parce que le jour où elle est atteinte, c'est en pleine brocante. */
export const MEM_MAX = 5 * 1024 * 1024;

export function memPaint(){
  const el = $('mem-state'); if(!el) return;
  const b = memBytes();
  const pc = Math.min(100, Math.round(b / MEM_MAX * 100));
  const col = pc >= 80 ? "var(--stop)" : pc >= 60 ? "var(--mid)" : "var(--go)";
  const q = queueRead().length;
  el.innerHTML = `<div class="memrow"><span>Mémoire utilisée</span><b style="color:${col}">${pc} %</b></div>
    <div class="membar"><i style="width:${pc}%;background:${col}"></i></div>
    <div class="memnote">${(b/1024/1024).toFixed(2)} Mo sur environ 5 Mo disponibles`
    + (q ? ` · ${q} photo(s) en file d'attente` : "")
    + (pc >= 80 ? `<br><b style="color:var(--stop)">Au-delà de 90 %, tes achats ne s'enregistreront plus.</b>` : "")
    + `</div>`;
}


/* Ce qu'on peut jeter sans rien perdre : le cache des recherches du jour et
   les photos en attente d'analyse. Le journal, les sorties et le stock, jamais. */
export function memFree(){
  const q = queueRead().length;
  if(!confirm("Libérer de la place ?\n\nCela efface le cache des recherches (IA et Discogs)"
    + (q ? " et les " + q + " analyse(s) en file d'attente" : "")
    + ".\n\nTon journal et tes sorties archivées ne sont pas touchés.")) return;
  try{
    localStorage.removeItem(CACHE_STORE);
    localStorage.removeItem(Q_STORE);
    localStorage.removeItem(DISC_CACHE);
    localStorage.removeItem(LEGO_CACHE);
  }catch(e){}
  vib(); hudPaint(); backupState();
  alert("Place libérée.");
}


export function paintKeyState() {
  const k = localStorage.getItem(KEY_STORE);
  const m = localStorage.getItem(MODEL_STORE) || MODELS[0];
  const st = $('keyState');
  st.style.display = 'block';
  if(k) {
    st.innerHTML = `Clé OK · Modèle : ${m}`;
    st.style.color = "var(--go)";
    st.style.borderColor = "var(--go)";
  } else {
    st.innerHTML = "Aucune clé enregistrée — l'analyse IA est désactivée.";
    st.style.color = "var(--stop)";
    st.style.borderColor = "var(--stop)";
  }
}


export function modelsPaint(){
  const sel = $('api-model'); if(!sel) return;
  let cur = localStorage.getItem(MODEL_STORE) || MODELS[0];
  if(MODELS.indexOf(cur) === -1){
    cur = MODELS[0];
    try{ localStorage.setItem(MODEL_STORE, cur); }catch(e){}
  }
  sel.innerHTML = MODELS.map((m, i) =>
    `<option value="${m}">${modelJoli(m)}${i === 0 ? " — recommandé" : ""}${/lite/.test(m) ? " (le plus rapide)" : ""}</option>`
  ).join("");
  sel.value = cur;
}


/* ---------- Réglages ---------- */
export function discSave(){
  const v = ($('disc-token').value || "").trim();
  if(v) { try{ localStorage.setItem(DISC_STORE, v); }catch(e){} }
  else  { try{ localStorage.removeItem(DISC_STORE); }catch(e){} }
  vib(); discPaint();
}


export function discPaint(){
  const el = $('disc-state'); if(!el) return;
  const t = discToken();
  const inp = $('disc-token');
  if(inp && !inp.value) inp.value = t;
  el.style.borderLeft = "3px solid " + (t ? "var(--go)" : "var(--border)");
  el.innerHTML = t
    ? "Jeton enregistré. Les cotes Discogs s'affichent sous chaque analyse de disque."
    : "Aucun jeton. Les vinyles restent estimés par l'IA, sans vérification du marché réel.";
}


/* Le test que tu ne peux pas faire à l'œil : est-ce que le navigateur du
   téléphone a le droit d'appeler Discogs ? */
export async function discTest(){
  const el = $('disc-state');
  if(!discToken()){ alert("Colle d'abord ton jeton, puis appuie sur Enregistrer."); return; }
  el.innerHTML = "Test en cours…";
  try{
    const c = await discCote("Daft Punk Discovery");
    el.style.borderLeft = "3px solid var(--go)";
    el.innerHTML = c
      ? `<b style="color:var(--go)">Connexion réussie.</b><br>Test sur « ${esc(c.titre)} » : `
        + `${c.bas ? c.bas + "€ le moins cher, " : ""}${c.envente} en vente, ${c.ont} possesseurs.`
      : `<b style="color:var(--mid)">Connexion établie, mais aucun résultat sur le disque test.</b>`;
  }catch(err){
    el.style.borderLeft = "3px solid var(--stop)";
    el.innerHTML = String(err.message) === "JETON"
      ? `<b style="color:var(--stop)">Jeton refusé.</b><br>Vérifie qu'il n'y a ni espace ni retour à la ligne.`
      : /Failed to fetch|NetworkError/i.test(String(err.message))
        ? `<b style="color:var(--stop)">Discogs bloque l'appel depuis le navigateur.</b><br>`
          + `C'est la restriction CORS. Le jeton est peut-être bon : teste la même URL dans un onglet. `
          + `Si elle répond là mais pas ici, il faut passer par un relais.`
        : `<b style="color:var(--stop)">Échec.</b><br>${esc(err.message)}`;
  }
}





export function legoSave(){
  const v = ($('lego-key').value || "").trim();
  try{ v ? localStorage.setItem(LEGO_STORE, v) : localStorage.removeItem(LEGO_STORE); }catch(e){}
  const pc = ($('lego-piece').value || "").trim(), fg = ($('lego-fig').value || "").trim();
  try{
    pc ? localStorage.setItem(LEGO_PIECE_STORE, pc) : localStorage.removeItem(LEGO_PIECE_STORE);
    fg ? localStorage.setItem(LEGO_FIG_STORE, fg) : localStorage.removeItem(LEGO_FIG_STORE);
  }catch(e){}
  vib(); legoPaint();
}


export function legoPaint(){
  const el = $('lego-state'); if(!el) return;
  const k = legoKey(), t = legoTarifs();
  if($('lego-key') && !$('lego-key').value) $('lego-key').value = k;
  if($('lego-piece') && !$('lego-piece').value) $('lego-piece').value = t.piece;
  if($('lego-fig') && !$('lego-fig').value) $('lego-fig').value = t.fig;
  el.style.borderLeft = "3px solid " + (k ? "var(--go)" : "var(--border)");
  el.innerHTML = k
    ? `Clé enregistrée. Barème actuel : ${t.piece.toFixed(2).replace(".", ",")}€ la pièce, ${t.fig}€ la figurine.`
    : "Aucune clé. Les sets LEGO restent estimés par l'IA, sans comptage de pièces.";
}


export async function legoTest(){
  const el = $('lego-state');
  if(!legoKey()){ alert("Colle d'abord ta clé, puis appuie sur Enregistrer."); return; }
  el.innerHTML = "Test en cours…";
  try{
    const c = await legoSet("10182");  /* Café Corner, un set connu */
    el.style.borderLeft = "3px solid var(--go)";
    el.innerHTML = c
      ? `<b style="color:var(--go)">Connexion réussie.</b><br>Test : « ${esc(c.nom)} » (${c.annee}) — ${c.pieces} pièces, ${c.figs} figurines.`
      : `<b style="color:var(--mid)">Connexion établie, set test introuvable.</b>`;
  }catch(err){
    el.style.borderLeft = "3px solid var(--stop)";
    el.innerHTML = String(err.message) === "CLE"
      ? `<b style="color:var(--stop)">Clé refusée.</b><br>Vérifie qu'il n'y a ni espace ni retour à la ligne.`
      : /Failed to fetch|NetworkError/i.test(String(err.message))
        ? `<b style="color:var(--stop)">Rebrickable bloque l'appel depuis le navigateur.</b><br>Dis-le-moi, on passera par un relais.`
        : `<b style="color:var(--stop)">Échec.</b><br>${esc(err.message)}`;
  }
}

export function brickRelayCopier(){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(BRICK_RELAY_CODE)
      .then(() => { vib(); alert("Code du relais copié.\n\nColle-le dans l'éditeur Cloudflare Worker, à la place de l'exemple « Hello World », puis Deploy."); });
  } else prompt("Copie le code du relais :", BRICK_RELAY_CODE);
}


export function brickSave(){
  const v = ($('brick-key').value || "").trim();
  try{ v ? localStorage.setItem(BRICK_STORE, v) : localStorage.removeItem(BRICK_STORE); }catch(e){}
  const rl = ($('brick-relay').value || "").trim().replace(/\/+$/, "");
  try{ rl ? localStorage.setItem(BRICK_RELAY_STORE, rl) : localStorage.removeItem(BRICK_RELAY_STORE); }catch(e){}
  vib(); brickPaint();
}


export function brickPaint(){
  const el = $('brick-state'); if(!el) return;
  const k = brickKey(), rl = brickRelay();
  if($('brick-key') && !$('brick-key').value) $('brick-key').value = k;
  if($('brick-relay') && !$('brick-relay').value) $('brick-relay').value = rl;
  el.style.borderLeft = "3px solid " + (k ? "var(--go)" : "var(--border)");
  if(!k){ el.innerHTML = "Aucune clé. Optionnelle : Rebrickable suffit pour les pièces et figurines."; return; }
  el.innerHTML = (legoKey() ? "Clé enregistrée. Rebrickable est configuré : Brickset ne sert que si Rebrickable ne répond pas."
                            : "Clé enregistrée. Sert de source pour les sets LEGO.")
    + (rl ? " Relais configuré." : " <b style=\"color:var(--mid)\">Sans le relais des 3 étapes ci-dessus, Brickset ne répondra jamais</b> — il bloque tout appel direct depuis un navigateur.");
}


export async function brickTest(){
  const el = $('brick-state');
  if(!brickKey()){ alert("Colle d'abord ta clé, puis appuie sur Enregistrer."); return; }
  el.innerHTML = "Test en cours…";
  try{
    const c = await brickSet("10182");  /* Café Corner, même set test que Rebrickable */
    el.style.borderLeft = "3px solid var(--go)";
    el.innerHTML = c
      ? `<b style="color:var(--go)">Connexion réussie.</b><br>Test : « ${esc(c.nom)} » (${c.annee}) — ${c.pieces} pièces, ${c.figs} figurines${c.prixNeuf ? ", " + c.prixNeuf + "€ neuf" : ""}.`
      : `<b style="color:var(--mid)">Clé valide, mais set test introuvable.</b>`;
  }catch(err){
    el.style.borderLeft = "3px solid var(--stop)";
    el.innerHTML = String(err.message) === "CLE"
      ? `<b style="color:var(--stop)">Clé refusée.</b><br>Vérifie qu'il n'y a ni espace ni retour à la ligne.`
      : /Failed to fetch|NetworkError/i.test(String(err.message))
        ? (brickRelay()
            ? `<b style="color:var(--stop)">Le relais ne répond pas.</b><br>Vérifie l'adresse *.workers.dev collée ci-dessus (pas d'espace, pas de slash final) et que le Worker est bien déployé sur Cloudflare.`
            : `<b style="color:var(--stop)">Brickset bloque l'appel direct depuis un navigateur.</b><br>Suis les 3 étapes juste au-dessus (2 minutes, gratuit), colle l'adresse *.workers.dev, puis reteste.`)
        : `<b style="color:var(--stop)">Échec.</b><br>${esc(err.message)}`;
  }
}

/* Demande du 01/09/2026 : liste déroulante BE/FR plutôt qu'un champ de
   saisie libre, avec repli "Autre" pour qui n'est couvert par aucune ville
   de la liste (l'app est publique, pas réservée à la région de départ). */
export function regionSelectChange(){
  const sel = $('region-select'); const inp = $('region-input');
  if(!sel || !inp) return;
  inp.style.display = sel.value === "__autre__" ? "block" : "none";
}

export function regionPaint(){
  const sel = $('region-select'); const inp = $('region-input');
  if(!sel || !inp) return;
  const stocke = regionGet();
  const correspond = stocke && [...sel.options].some(o => o.value === stocke);
  if(!stocke){ sel.value = ""; inp.value = ""; }
  else if(correspond){ sel.value = stocke; inp.value = ""; }
  else { sel.value = "__autre__"; inp.value = stocke; }
  regionSelectChange();
}


export function themeApply(mode){
  const sombre = mode === "dark" || (mode === "auto" &&
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", sombre ? "dark" : "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", sombre ? "#0a0a0c" : "#EFEADD");
  document.querySelectorAll('#theme-seg button').forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.t === mode));
}

export function themeSet(mode){
  try{ localStorage.setItem(THEME_STORE, mode); }catch(e){}
  themeApply(mode);
}
if(window.matchMedia){
  window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => { if(themeGet() === "auto") themeApply("auto"); });
}


/* Meme mecanique que le choix du theme juste au-dessus : localStorage +
   re-peinture immediate + mise en avant du bouton actif. i18nAppliquer()
   ne touche que le texte STATIQUE de dev.html marque data-i18n* (voir
   src/i18n/index.js) - le texte genere dynamiquement par capture.js/
   fiche.js (ex. mode-dit) reste en francais pour l'instant, chantier
   separe non fait dans cette passe (30/08/2026). */
export function langueApply(l){
  i18nAppliquer();
  calSousTitrePaint(); // ne fait plus partie du balayage data-i18n générique (variables {lieu}/{pays})
  document.querySelectorAll('#langue-seg button').forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.l === l));
}

export function langueSet(l){
  localeSet(l);
  langueApply(locale());
}


/* ══════════ SAUVEGARDE COMPLÈTE ══════════
   Un nettoyage de cache Android efface le stockage du navigateur sans
   prévenir. Ce fichier remet tout en place. */
export const CLES = ["insertcoin.log","insertcoin.sorties","insertcoin.cal",
              "insertcoin.recherches",
              "insertcoin.photosrc",
              "insertcoin.collection","insertcoin.cred","insertcoin.theme",
              "insertcoin.drive.files","insertcoin.drive.cid","insertcoin.gemini.model"];


export function backupData(){
  const d = {app:"Insert Coin", version:"4.0", date:new Date().toISOString(), data:{}};
  CLES.forEach(k => { const v = localStorage.getItem(k); if(v !== null) d.data[k] = v; });
  return d;
}


export function backupDownload(){
  const j = JSON.stringify(backupData(), null, 1);
  const url = URL.createObjectURL(new Blob([j], {type:"application/json"}));
  const a = document.createElement("a");
  a.href = url; a.download = "InsertCoin_sauvegarde_" + new Date().toISOString().slice(0,10) + ".json";
  a.click(); setTimeout(()=>URL.revokeObjectURL(url), 2000);
}


export async function backupDrive(){
  const tok = await driveAuth(false) || await driveAuth(true);
  if(!tok){ alert("Connecte d'abord ton Drive."); backupDownload(); return; }
  try{
    const nom = "InsertCoin_sauvegarde_" + new Date().toISOString().slice(0,10) + ".json";
    const b = "----ic" + Date.now();
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
      + JSON.stringify({name:nom, mimeType:"application/json"})
      + `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n`
      + JSON.stringify(backupData()) + `\r\n--${b}--`;
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {method:"POST", headers:{Authorization:"Bearer "+tok, "Content-Type":"multipart/related; boundary="+b}, body});
    if(!r.ok) throw new Error("HTTP " + r.status);
    try{ localStorage.setItem("insertcoin.lastbackup", String(Date.now())); }catch(e){}
    alert("Sauvegarde envoyée dans ton Drive : " + nom);
  }catch(err){
    alert("Envoi impossible (" + err.message + "). Téléchargement local à la place.");
    backupDownload();
  }
}


export function backupRestore(e){
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const j = JSON.parse(r.result);
      if(!j.data) throw new Error("format");
      const n = Object.keys(j.data).length;
      if(!confirm(`Restaurer ${n} élément(s) sauvegardés le ${new Date(j.date).toLocaleDateString('fr-BE')} ?\n\nCela remplacera tes données actuelles.`)) return;
      Object.entries(j.data).forEach(([k,v]) => { try{ localStorage.setItem(k, v); }catch(e){} });
      alert("Restauration terminée.");
      location.reload();
    }catch(err){ alert("Fichier de sauvegarde illisible."); }
  };
  r.readAsText(f);
}
