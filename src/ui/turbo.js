// ══════════════════ MODE TERRAIN TURBO (SCAN EN RAFALE & PANIER DE NÉGOCIATION) ══════════════════
// Viseur continu avec détection instantanée de codes-barres, retours sonores 8-bit,
// contrôle automatique de doublons, panier de stand en direct et calculatrice de négociation.

import { $ } from "../util/dom.js";
import { esc } from "../util/text.js";
import { logRead, logWrite, collRead, KEY_STORE, MODEL_STORE, pcToken, discToken } from "../storage/local.js";
import { collMatch } from "./dedup.js";
import { pcCote } from "../api/pricecharting.js";
import { discCote } from "../api/discogs.js";
import { extractJSON } from "../api/gemini.js";
import { fetchAvecDelai } from "../util/fetchTimeout.js";
import { repartirProrata } from "../util/repartition.js";
import { hudPaint } from "./hud.js";
import { renderLog } from "./log.js";
import {
  playCoinSound, playWarningSound, playBuzzerSound, playClickSound,
  vibCoin, vibWarn, vibLow, isSoundEnabled, setSoundEnabled
} from "../util/sound.js";

// --- ÉTAT DU MODE TURBO ---
export let turboPanier = [];
export let turboPrixDefaut = 3;
export let turboPrixLotGlobal = null;
let turboFlux = null;
let turboBoucle = null;
const turboCooldowns = new Map(); // anti-rebond par code (3 secondes)

export function turboDispo(){
  return typeof window.BarcodeDetector !== "undefined";
}

// Ouvre l'overlay et lance la caméra en continu
export async function turboOuvrir(){
  if(!turboDispo()){
    alert("Le scan en direct nécessite Chrome sur Android ou un navigateur compatible avec BarcodeDetector.");
    return;
  }
  const ov = $('bc-overlay');
  if(!ov) return;
  ov.classList.add('on');
  playClickSound();

  turboRender();

  try{
    turboFlux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }
    });
    const v = $('bc-video');
    if(v){
      v.srcObject = turboFlux;
      await v.play();
    }
    turboDemarrerBoucle();
  }catch(err){
    const msg = $('bc-status-msg');
    if(msg) msg.textContent = "Accès à la caméra refusé.";
    setTimeout(turboFermer, 2000);
  }
}

// Ferme l'overlay et arrête le flux caméra
export function turboFermer(){
  if(turboBoucle){ clearInterval(turboBoucle); turboBoucle = null; }
  if(turboFlux){
    turboFlux.getTracks().forEach(t => t.stop());
    turboFlux = null;
  }
  const v = $('bc-video');
  if(v) v.srcObject = null;
  const ov = $('bc-overlay');
  if(ov) ov.classList.remove('on');
}

// Alias pour compatibilité avec l'ancien bcOuvrir / bcFermer
export const bcOuvrir = turboOuvrir;
export const bcFermer = turboFermer;

// Boucle continue de détection
function turboDemarrerBoucle(){
  let det;
  try{
    det = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"]
    });
  }catch(e){
    const msg = $('bc-status-msg');
    if(msg) msg.textContent = "Détecteur non supporté.";
    return;
  }

  const v = $('bc-video');
  turboBoucle = setInterval(async () => {
    if(!v || v.readyState < 2) return;
    try{
      const codes = await det.detect(v);
      if(codes && codes.length){
        for(const item of codes){
          const brut = String(item.rawValue || "").trim();
          if(brut){
            turboTraiterScan(brut);
            break; // Un code par frame
          }
        }
      }
    }catch(e){}
  }, 350);
}

// Traitement d'un code-barres scanné
export async function turboTraiterScan(code){
  const now = Date.now();
  const dernier = turboCooldowns.get(code) || 0;
  // Anti-rebond : 3 secondes sur le même code
  if(now - dernier < 3000) return;
  turboCooldowns.set(code, now);

  // Flash visuel sur le cadre
  const cadre = $('bc-cadre');
  if(cadre){
    cadre.classList.add('flash-green');
    setTimeout(() => cadre.classList.remove('flash-green'), 400);
  }

  // Vérification de doublon dans la collection
  let isDoublon = false;
  let doublonInfo = "";
  try{
    const m = collMatch(code);
    if(m && m.e){
      isDoublon = true;
      doublonInfo = (m.e.a ? m.e.a + " — " : "") + (m.e.t || "");
    } else {
      // Recherche exacte dans la liste
      const items = collRead();
      const direct = items.find(x => String(x.code || "").trim() === code || String(x.t || "").toLowerCase().includes(code.toLowerCase()));
      if(direct){
        isDoublon = true;
        doublonInfo = (direct.a ? direct.a + " — " : "") + (direct.t || "");
      }
    }
  }catch(e){}

  const itemId = "t_" + now + "_" + Math.floor(Math.random() * 1000);
  const nouvelArticle = {
    id: itemId,
    code: code,
    nom: "Réf. " + code,
    console: "",
    cote: 0,
    coteSrc: "Recherche...",
    prixDemande: turboPrixDefaut,
    isDoublon: isDoublon,
    doublonInfo: doublonInfo,
    verdict: "N",
    selected: true,
    loading: true,
    date: now
  };

  turboPanier.unshift(nouvelArticle);
  turboRender();

  // Signal sonore initial
  if(isDoublon){
    playWarningSound();
    vibWarn();
  } else {
    playClickSound();
    vibLow();
  }

  // Résolution asynchrone de la cote
  await turboResoudreCote(nouvelArticle);
  turboRender();
}

// Recherche de cote par PriceCharting, Discogs ou Gemini
async function turboResoudreCote(art){
  // 1. Essai PriceCharting (jeux vidéo)
  if(pcToken()){
    try{
      const pc = await pcCote(art.code);
      if(pc && pc.nom){
        art.nom = pc.nom;
        art.console = pc.console || "";
        art.cote = pc.cib || pc.loose || pc.neuf || 0;
        art.coteSrc = `PriceCharting ($${art.cote})`;
        art.loading = false;
        turboCalculerVerdict(art);
        return;
      }
    }catch(e){}
  }

  // 2. Essai Discogs (vinyles / CD)
  if(discToken()){
    try{
      const dc = await discCote(art.code);
      if(dc && (dc.titre || dc.artiste)){
        art.nom = (dc.artiste ? dc.artiste + " — " : "") + (dc.titre || "");
        art.console = dc.format || "Musique";
        art.cote = dc.bas || 0;
        art.coteSrc = `Discogs (${art.cote}€)`;
        art.loading = false;
        turboCalculerVerdict(art);
        return;
      }
    }catch(e){}
  }

  // 3. Essai Gemini
  const apiKey = localStorage.getItem(KEY_STORE);
  if(apiKey && navigator.onLine){
    try{
      const model = localStorage.getItem(MODEL_STORE) || "gemini-2.5-flash";
      const prompt = `Code-barres : ${art.code}. Identifie précisément ce produit (jeu vidéo, livre, CD, jouet, etc.).
Donne son titre, sa plateforme ou catégorie, et son prix d'occasion moyen en euros (chiffre entier dans 'marche').
Réponds uniquement en JSON : {"nom":"...","console":"...","marche":15}`;

      const res = await fetchAvecDelai(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: 250 }
          })
        },
        7000
      );

      if(res.ok){
        const data = await res.json();
        const j = extractJSON(data);
        if(j && (j.nom || j.objet)){
          art.nom = j.nom || j.objet;
          art.console = j.console || j.categorie || "";
          art.cote = Number(j.marche) || Number(j.revente) || 0;
          art.coteSrc = `Estimation IA (~${art.cote}€)`;
          art.loading = false;
          turboCalculerVerdict(art);
          return;
        }
      }
    }catch(e){}
  }

  // Si non identifié en ligne
  art.coteSrc = "Cote manuelle";
  art.loading = false;
  turboCalculerVerdict(art);
}

// Calcul de rentabilité d'un article
function turboCalculerVerdict(art){
  const dem = art.prixDemande || turboPrixDefaut;
  if(art.cote >= dem * 2.2 && art.cote >= 10){
    art.verdict = "R"; // Rentable / Jackpot
    if(!art.isDoublon){
      playCoinSound();
      vibCoin();
    }
  } else if(art.cote >= dem * 1.3){
    art.verdict = "N"; // À négocier
  } else {
    art.verdict = "L"; // Laisse
    if(!art.isDoublon && art.cote > 0){
      playBuzzerSound();
    }
  }
}

// Gestion des prix
export function turboSetUnitPrice(prix){
  turboPrixDefaut = Math.max(0, Number(prix) || 0);
  turboPanier.forEach(it => {
    it.prixDemande = turboPrixDefaut;
    turboCalculerVerdict(it);
  });
  turboRender();
}

export function turboToggleSound(){
  const cur = isSoundEnabled();
  setSoundEnabled(!cur);
  playClickSound();
  turboRender();
}

export function turboToggleItem(id){
  const it = turboPanier.find(x => x.id === id);
  if(it){
    it.selected = !it.selected;
    playClickSound();
    turboRender();
  }
}

export function getTurboPrixDefaut(){
  return turboPrixDefaut;
}

export function turboRemoveItem(id){
  const idx = turboPanier.findIndex(x => x.id === id);
  if(idx >= 0) turboPanier.splice(idx, 1);
  playClickSound();
  turboRender();
}

export function turboClearBasket(){
  if(!turboPanier.length) return;
  if(confirm("Vider tout le panier du stand ?")){
    turboPanier.length = 0;
    turboPrixLotGlobal = null;
    turboCooldowns.clear();
    turboRender();
  }
}

export function turboSetLotPricePrompt(){
  const act = turboPanier.filter(x => x.selected);
  const defaut = turboPrixLotGlobal || (act.length * turboPrixDefaut);
  const saisie = prompt(`Prix global demandé par le vendeur pour ces ${act.length} article(s) (€) :`, String(defaut));
  if(saisie === null) return;
  const val = parseFloat(saisie);
  if(!isNaN(val) && val >= 0){
    turboPrixLotGlobal = val;
    turboRender();
  }
}

// Conseil de Barnabé pour la négociation
function turboConseilNego(selectionnes, totalCote, totalDemande){
  if(!selectionnes.length){
    return "Cadre les codes-barres des boîtes ou des pochettes. Le panier se remplit en temps réel !";
  }
  const n = selectionnes.length;
  if(totalCote <= 0){
    return `Tu as ${n} article(s) dans le lot. Demande le prix global au vendeur pour calculer ta marge.`;
  }

  const marge = totalCote - totalDemande;
  const offreAttaque = Math.max(1, Math.round(totalCote * 0.45));
  const offreMax = Math.max(1, Math.round(totalCote * 0.65));

  if(totalDemande <= offreAttaque){
    return `🔥 Affaire en or ! Le vendeur demande ${totalDemande} € pour une cote de ~${totalCote} € (marge +${marge.toFixed(0)} €). Prends sans hésiter !`;
  }
  if(totalDemande <= offreMax){
    return `👍 Bon lot négociable. Cote totale ~${totalCote} €. Tente d'emporter le tout pour ${offreAttaque} € cash (soit ~${(offreAttaque/n).toFixed(1)} € / pièce).`;
  }
  return `⚠️ Vendeur gourmand (${totalDemande} € demandés pour ~${totalCote} € de cote). Propose maximum ${offreMax} € pour le lot, ou laisse les titres moins cotés.`;
}

// Enregistrement des achats sélectionnés dans le Journal
export function turboSaveLot(){
  const selectionnes = turboPanier.filter(x => x.selected);
  if(!selectionnes.length){
    alert("Aucun article sélectionné à enregistrer.");
    return;
  }

  const totalCote = selectionnes.reduce((acc, it) => acc + (it.cote || 0), 0);
  const totalPaye = turboPrixLotGlobal !== null ? turboPrixLotGlobal : selectionnes.reduce((acc, it) => acc + (it.prixDemande || turboPrixDefaut), 0);

  // Répartition au prorata de la cote
  const cotes = selectionnes.map(x => x.cote || 1);
  const partsPaye = repartirProrata(cotes, totalPaye);

  const lg = logRead();
  selectionnes.forEach((it, i) => {
    lg.unshift({
      d: Date.now() + i,
      o: it.nom + (it.console ? ` (${it.console})` : ""),
      p: partsPaye[i] || 0,
      r: it.cote || 0,
      dem: it.prixDemande || turboPrixDefaut,
      mx: Math.round((it.cote || 0) * 0.7)
    });
  });

  logWrite(lg);
  playCoinSound();
  vibCoin();
  hudPaint();
  renderLog();

  // Retirer les articles enregistrés du panier
  const aGarder = turboPanier.filter(x => !x.selected);
  turboPanier.length = 0;
  turboPanier.push(...aGarder);
  turboPrixLotGlobal = null;
  turboRender();

  alert(`✓ ${selectionnes.length} article(s) enregistré(s) dans ton Journal de chasse !`);
}

// Rendu complet de l'interface Turbo dans dev.html
export function turboRender(){
  const ribbonEl = $('turbo-ribbon');
  const sumEl = $('turbo-summary');
  const soundBtn = $('turbo-sound-btn');
  const priceDisplay = $('turbo-unit-price-display');

  if(soundBtn){
    const on = isSoundEnabled();
    soundBtn.innerHTML = on ? "🔊 Son ON" : "🔇 Muet";
    soundBtn.classList.toggle('muted', !on);
  }

  if(priceDisplay){
    priceDisplay.textContent = turboPrixDefaut + "€";
  }

  // Articles sélectionnés
  const selectionnes = turboPanier.filter(x => x.selected);
  const totalCote = selectionnes.reduce((acc, it) => acc + (it.cote || 0), 0);
  const totalDemande = turboPrixLotGlobal !== null ? turboPrixLotGlobal : selectionnes.reduce((acc, it) => acc + (it.prixDemande || turboPrixDefaut), 0);
  const marge = totalCote - totalDemande;

  // Rendu du ruban d'articles
  if(ribbonEl){
    if(!turboPanier.length){
      ribbonEl.innerHTML = `
        <div class="turbo-empty">
          <svg class="ico16"><use href="#i-scan"/></svg>
          <span>Le panier est vide. Scanne des codes pour les empiler en direct.</span>
        </div>`;
    } else {
      ribbonEl.innerHTML = turboPanier.map(it => {
        const vCls = it.verdict === "R" ? "pos" : (it.verdict === "L" ? "neg" : "mid");
        const vBadge = it.verdict === "R" ? "PÉPITE" : (it.verdict === "L" ? "LAISSE" : "À NÉGO");
        return `
          <div class="turbo-card ${it.selected ? 'checked' : 'dimmed'}" onclick="turboToggleItem('${it.id}')">
            <input type="checkbox" class="turbo-check" ${it.selected ? 'checked' : ''} onclick="event.stopPropagation(); turboToggleItem('${it.id}')">
            <div class="turbo-card-info">
              <div class="turbo-title">
                <b>${esc(it.nom)}</b>
                ${it.console ? `<span class="turbo-tag">${esc(it.console)}</span>` : ''}
              </div>
              <div class="turbo-details">
                <span class="turbo-cote ${vCls}">
                  ${it.loading ? '⏳ Recherche...' : (it.cote ? it.cote + '€' : 'Cote ?')}
                </span>
                <span class="turbo-src">${esc(it.coteSrc)}</span>
                <span class="turbo-sep">·</span>
                <span class="turbo-buy-p">Achat : ${it.prixDemande}€</span>
              </div>
              ${it.isDoublon ? `<div class="turbo-doublon">⚠️ DÉJÀ EN COLL. : ${esc(it.doublonInfo)}</div>` : ''}
            </div>
            <div class="turbo-card-right">
              <span class="turbo-badge ${vCls}">${vBadge}</span>
              <button class="turbo-del-btn" onclick="event.stopPropagation(); turboRemoveItem('${it.id}')">✕</button>
            </div>
          </div>`;
      }).join('');
    }
  }

  // Rendu de la barre de négociation
  if(sumEl){
    const conseil = turboConseilNego(selectionnes, totalCote, totalDemande);
    sumEl.innerHTML = `
      <div class="turbo-advice">
        <div class="turbo-advice-mascot">
          <img src="/mascot/${marge >= 25 ? 'jackpot.png' : (marge >= 10 ? 'bargaining.png' : 'inspecting.png')}" alt="Conseil Barnabé">
        </div>
        <div class="turbo-advice-text">${esc(conseil)}</div>
      </div>
      <div class="turbo-metrics-row">
        <div class="tmetric">
          <span class="lbl">Articles</span>
          <b>${selectionnes.length} / ${turboPanier.length}</b>
        </div>
        <div class="tmetric">
          <span class="lbl">Cote totale</span>
          <b>${totalCote.toFixed(0)}€</b>
        </div>
        <div class="tmetric" onclick="turboSetLotPricePrompt()" style="cursor:pointer" title="Cliquer pour modifier le prix du lot">
          <span class="lbl">Offre stand ✏️</span>
          <b>${totalDemande.toFixed(0)}€</b>
        </div>
        <div class="tmetric ${marge >= 0 ? 'pos' : 'neg'}">
          <span class="lbl">Marge est.</span>
          <b>${marge >= 0 ? '+' : ''}${marge.toFixed(0)}€</b>
        </div>
      </div>
      <div class="turbo-actions-row">
        <button class="turbo-clear-btn" onclick="turboClearBasket()">Vider</button>
        <button class="turbo-save-btn" onclick="turboSaveLot()" ${!selectionnes.length ? 'disabled' : ''}>
          🤝 Enregistrer ${selectionnes.length} achat${selectionnes.length > 1 ? 's' : ''}
        </button>
      </div>`;
  }
}
