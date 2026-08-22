import { $, vib } from "../util/dom.js";
import { TICKS } from "../data/localBase.js";
import { KEY_STORE, SYNC_STORE, getGround, queueRead, driveFiles, themeGet } from "../storage/local.js";
import { modelsRefresh } from "../api/gemini.js";
import { modelsPaint, discPaint, paintKeyState, legoPaint, brickPaint, backupState, themeApply } from "./settings.js";
import { modeSet, srcPaint, queueRun, captureInit } from "./capture.js";
import { hudPaint } from "./hud.js";
import { renderLog, renderHist, renderRecherches } from "./log.js";
import { renderCal, paintImminent, calendarInit } from "./calendar.js";
import { collPaint, driveSync } from "./drive.js";
import { pwaInit } from "./pwa.js";

// --- UI LOGIC ---
/* L'onglet se retrouve par son nom : avant, il était désigné par son rang dans
   la barre, et retirer un onglet décalait silencieusement tous les autres. */
export function switchView(viewId, navEl) {
  const vue = document.getElementById('view-' + viewId);
  if(!vue) return;
  if(viewId === 'log') setTimeout(() => { renderLog(); renderHist(); renderRecherches(); }, 0);
  if(viewId === 'cal') setTimeout(renderCal, 0);
  paintImminent();
  vib();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  vue.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = navEl || document.querySelector('.nav-item[data-v="' + viewId + '"]');
  if(nav) nav.classList.add('active');
  window.scrollTo(0,0);
}


export function init() {
  $('api-key').value = localStorage.getItem(KEY_STORE) || "";
  /* La liste des modèles vient de l'API, plus du code : voir modelsRefresh().
     modelsPaint() affiche celle qu'on a déjà, la vérification se fait après,
     sans bloquer l'ouverture de l'app. */
  modelsPaint();
  if(navigator.onLine && localStorage.getItem(KEY_STORE)){
    const dern = parseInt(localStorage.getItem("insertcoin.gemini.models.t") || "0", 10);
    if(Date.now() - dern > 604800000){
      setTimeout(() => {
        modelsRefresh(false);
        try{ localStorage.setItem("insertcoin.gemini.models.t", String(Date.now())); }catch(e){}
      }, 2500);
    }
  }
  const gb = $('groundBox'); if(gb) gb.checked = getGround();
  themeApply(themeGet());
  modeSet('objet');
  legoPaint(); brickPaint(); discPaint(); collPaint(); hudPaint(); renderLog(); renderCal(); paintImminent(); renderHist(); renderRecherches(); backupState();
  if(queueRead().length && navigator.onLine) setTimeout(() => queueRun(false), 3000);
  if(navigator.onLine && driveFiles().length){
    const last = parseInt(localStorage.getItem(SYNC_STORE) || "0", 10);
    if(Date.now() - last > 3600000) setTimeout(() => driveSync(false), 1500);
  }
  paintKeyState(); srcPaint();

  captureInit();
  calendarInit();

  // Ticks init
  $("sac-ticks").innerHTML = TICKS.map(t => `<label class="tick"><input type="checkbox"><span>${t}</span></label>`).join("");

}

/* Un plantage dans un seul rendu ne doit pas emporter toute l'app :
   avant, une exception dans init() laissait un écran figé sans explication. */
window.addEventListener('error', e => {
  const el = document.getElementById('ai-results');
  if(el && !el.innerHTML){
    el.innerHTML = '<div class="aifail"><b>Un affichage a planté.</b><br>'
      + 'Tes données sont intactes. Change d\'onglet et reviens ; si ça persiste, '
      + 'sauvegarde depuis Réglages avant de recharger.<br><br>'
      + '<span style="font-family:var(--mono);font-size:11px;opacity:.7">'
      + String((e && e.message) || "").slice(0,200) + '</span></div>';
  }
});

window.onload = function(){
  /* Indépendant du try/catch ci-dessous : une erreur dans init() (données,
     rendu) ne doit pas empêcher le mode hors ligne de s'activer, et
     inversement. */
  pwaInit();
  try{ init(); }
  catch(err){
    console.error(err);
    alert("Une erreur est survenue au démarrage.\n\nTes données ne sont pas perdues : va dans Réglages pour les sauvegarder.\n\n" + (err.message || err));
  }
};
