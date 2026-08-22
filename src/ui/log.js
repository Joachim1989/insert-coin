import { $, vib } from "../util/dom.js";
import { esc } from "../util/text.js";
import { logRead, logWrite, sortieRead, sortieWrite, rechRead, rechWrite } from "../storage/local.js";
import { LAST, renderResult, renderBacResult, renderStandResult } from "./fiche.js";
import { catJoli } from "../pricing/engine.js";
import { hudPaint } from "./hud.js";
import { driveAuth } from "../api/googledrive.js";
import { switchView } from "./main.js";

/* Courbe de marge cumulée : la matinée d'un coup d'œil.
   Une pente qui monte = ça se passe bien. Une pente qui s'aplatit = tu dépenses
   sans rentabiliser. */
export function margeChart(){
  const a = logRead().slice().reverse();          // du plus ancien au plus récent
  if(a.length < 2) return "";
  const W = 300, H = 96, pad = 6;
  let cum = 0;
  const pts = a.map((x,i) => { cum += (x.r||0)-(x.p||0); return {i, v: cum, o: x.o}; });
  const vals = pts.map(p => p.v);
  const vmin = Math.min(0, ...vals), vmax = Math.max(0, ...vals);
  const span = (vmax - vmin) || 1;
  const X = i => pad + (i / Math.max(1, pts.length-1)) * (W - pad*2);
  const Y = v => H - pad - ((v - vmin) / span) * (H - pad*2);
  const y0 = Y(0);

  const ligne = pts.map((p,i) => `${i?"L":"M"}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const aire = `M${X(0).toFixed(1)},${y0.toFixed(1)} ` +
    pts.map(p => `L${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") +
    ` L${X(pts.length-1).toFixed(1)},${y0.toFixed(1)} Z`;
  const fin = pts[pts.length-1];
  const pos = fin.v >= 0;

  return `<div class="chart">
    <div class="chart-h">Marge cumulée <i>${a.length} achats</i></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
         aria-label="Marge cumulée : ${fin.v.toFixed(0)} euros après ${a.length} achats">
      <line x1="0" y1="${y0.toFixed(1)}" x2="${W}" y2="${y0.toFixed(1)}"
            stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3"/>
      <path d="${aire}" fill="${pos?'var(--go)':'var(--stop)'}" opacity=".16"/>
      <path d="${ligne}" fill="none" stroke="${pos?'var(--go)':'var(--stop)'}"
            stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.5"
            fill="${pos?'var(--go)':'var(--stop)'}"/>`).join("")}
    </svg>
    <div class="chart-f">
      <span>Départ 0€</span>
      <b class="${pos?'pos':'neg'}">${pos?'+':''}${fin.v.toFixed(0)}€</b>
    </div>
  </div>`;
}


/* Meilleures prises : un classement se lit mieux qu'une liste. */
export function topChart(){
  const a = logRead().map(x => ({o:x.o, m:(x.r||0)-(x.p||0)}))
                     .filter(x => x.m > 0).sort((p,q) => q.m - p.m).slice(0,5);
  if(a.length < 2) return "";
  const max = a[0].m || 1;
  return `<div class="chart">
    <div class="chart-h">Tes meilleures prises</div>
    ${a.map(x => `
      <div class="tb">
        <div class="tb-n">${esc(x.o || "—")}</div>
        <div class="tb-r"><i style="width:${Math.max(6,(x.m/max)*100)}%"></i></div>
        <div class="tb-v">+${x.m.toFixed(0)}€</div>
      </div>`).join("")}
  </div>`;
}


export function logFind(){
  if(!LAST) return;
  const paye = parseFloat(($('log-price') || {}).value || "0") || 0;
  const a = logRead();
  a.unshift({d: Date.now(), o: LAST.objet, p: paye, r: LAST.revente,
             dem: LAST.demande || 0, mx: LAST.prixMax || 0});
  logWrite(a); vib();
  const btn = document.querySelector('.act-buy');
  if(btn){ btn.innerHTML = "✓ Enregistré"; btn.classList.add("done"); }
  renderLog(); hudPaint();
}


export function logDel(i){ const a = logRead(); a.splice(i,1); logWrite(a); renderLog(); hudPaint(); }

export function logClear(){
  if(confirm("Vider le journal ? Le total de la matinée sera perdu.")){ logWrite([]); renderLog(); hudPaint(); }
}


/* Statistiques de négociation : sur plusieurs sorties, elles disent
   si tu ouvres trop haut ou si tu laisses filer de bonnes affaires. */
export function negoStats(){
  const a = logRead().filter(x => x.dem > 0 && x.p > 0);
  if(a.length < 2) return null;
  const gagne = a.filter(x => x.p < x.dem).length;
  const remise = a.reduce((s,x) => s + ((x.dem - x.p) / x.dem), 0) / a.length;
  const sousMax = a.filter(x => x.mx > 0 && x.p <= x.mx).length;
  const avecMax = a.filter(x => x.mx > 0).length;
  return {
    n: a.length,
    taux: Math.round(gagne / a.length * 100),
    remise: Math.round(remise * 100),
    disc: avecMax ? Math.round(sousMax / avecMax * 100) : null
  };
}


export function renderLog(){
  const el = $('log-list'); if(!el) return;
  const a = logRead();
  const dep = a.reduce((s,x)=>s+(x.p||0),0);
  const val = a.reduce((s,x)=>s+(x.r||0),0);
  const marge = val - dep;

  $('log-sum').innerHTML = `
    <div class="sumbox"><div class="sn">${dep.toFixed(0)}€</div><div class="sc">Dépensé</div></div>
    <div class="sumbox"><div class="sn">${val.toFixed(0)}€</div><div class="sc">Revente est.</div></div>
    <div class="sumbox ${marge>=0?'pos':'neg'}"><div class="sn">${marge>=0?'+':''}${marge.toFixed(0)}€</div><div class="sc">Marge</div></div>`;

  const ch = $('log-charts');
  if(ch) ch.innerHTML = margeChart() + topChart();

  const st = negoStats();
  const stEl = $('log-stats');
  if(stEl){
    if(!st){
      stEl.innerHTML = `<div class="statnote">Tes statistiques de négociation apparaîtront après deux achats
        où tu auras saisi le prix demandé et le prix payé.</div>`;
    }else{
      const jauge = (v, lbl, aide) => `
        <div class="stat">
          <div class="stat-t"><span>${lbl}</span><b>${v}%</b></div>
          <div class="bar"><i style="width:${Math.min(100,v)}%"></i></div>
          <div class="stat-a">${aide}</div>
        </div>`;
      let conseil = "";
      if(st.taux < 40) conseil = "Tu payes souvent le prix affiché. Ouvre plus bas : 55 % du demandé.";
      else if(st.remise > 45) conseil = "Belles remises. Tu pourrais viser des pièces plus chères.";
      else conseil = "Négociation régulière. Continue à grouper les achats par stand.";
      stEl.innerHTML = `<h3 class="sect">Ta négociation <i>${st.n} achats</i></h3>`
        + jauge(st.taux, "Prix obtenu sous le demandé", "Part des achats où tu as fait baisser le prix.")
        + jauge(st.remise, "Remise moyenne arrachée", "Écart moyen entre le prix affiché et ce que tu payes.")
        + (st.disc !== null ? jauge(st.disc, "Achats sous ton plafond", "Discipline : rester sous le prix max conseillé.") : "")
        + `<div class="statnote">${conseil}</div>`;
    }
  }

  if(!a.length){
    el.innerHTML = `<div class="empty-state">
      <svg class="ico-big"><use href="#i-cash"/></svg>
      <b>Journal vide</b>
      <p>Après une analyse, saisis le prix payé et appuie sur « Acheté ».
      Ta marge du jour se calcule toute seule.</p></div>`;
    return;
  }
  el.innerHTML = a.map((x,i)=>{
    const m = (x.r||0)-(x.p||0);
    const rem = (x.dem && x.p && x.dem > x.p) ? ` · −${Math.round((x.dem-x.p)/x.dem*100)}%` : "";
    const vendu = x.vendu
      ? `<span class="li-vendu">vendu ${x.vendu}€</span>`
      : `<button class="li-vendre" onclick="logVendre(${i})">Vendu ?</button>`;
    return `<div class="logitem">
      <div class="li-main"><b>${esc(x.o||"—")}</b>
        <span>payé ${(x.p||0).toFixed(0)}€ · revente ${(x.r||0).toFixed(0)}€${rem}</span></div>
      <div class="li-m ${m>=0?'pos':'neg'}">${m>=0?'+':''}${m.toFixed(0)}€</div>
      ${vendu}
      <button class="li-x" onclick="logDel(${i})">✕</button>
    </div>`;
  }).join('');
}


/* Le prix payé fixe ta marge d'achat ; le prix vendu fixe ta vraie cote.
   Les deux comptent, mais ils ne mesurent pas la même chose — et seul le
   second sert de référence la prochaine fois que tu croises le même objet. */
export function logVendre(i){
  const a = logRead(); const x = a[i]; if(!x) return;
  const v = parseFloat(prompt(`« ${x.o} » — vendu pour combien ?`, String(x.r || "")) || "");
  if(isNaN(v) || v < 0) return;
  x.vendu = Math.round(v); x.venduD = Date.now();
  if(!logWrite(a)) return;
  vib(); renderLog();
}


export function rang(dep, val){
  if(!dep) return val > 0 ? "A" : "—";
  const m = val / dep;
  return m >= 4 ? "S" : m >= 3 ? "A" : m >= 2 ? "B" : m >= 1.3 ? "C" : "D";
}

export const RANG_MOT = {S:"Sortie exceptionnelle", A:"Très belle sortie", B:"Bonne sortie",
                  C:"Sortie correcte", D:"Tu as payé trop cher", "—":"Rien à mesurer"};


export function sortieFin(){
  const achats = logRead();
  if(!achats.length){ alert("Aucun achat enregistré : rien à archiver."); return; }
  const lieu = prompt("Quelle brocante ? (laisse vide si tu ne veux pas la nommer)", "") || "";

  const dep = achats.reduce((s,x)=>s+(x.p||0),0);
  const val = achats.reduce((s,x)=>s+(x.r||0),0);
  const best = achats.slice().sort((a,b)=>((b.r||0)-(b.p||0))-((a.r||0)-(a.p||0)))[0];
  const st = negoStats();

  const so = {
    id: Date.now(), date: new Date().toISOString().slice(0,10), lieu,
    achats,
    dep, val, marge: val - dep, rang: rang(dep, val),
    best: best ? {o: best.o, m: (best.r||0)-(best.p||0)} : null,
    nego: st || null
  };

  const a = sortieRead(); a.unshift(so);
  if(!sortieWrite(a)) return;

  /* On vide le courant seulement une fois l'archive écrite. */
  logWrite([]);
  hudPaint(); renderLog();
  showScore(so);
}


export function showScore(so){
  const r = so.rang;
  $('score-screen').className = "scoreov on";
  $('score-screen').innerHTML = `
    <div class="score">
      <div class="sc-top">Sortie terminée</div>
      <div class="sc-rang r${r}">${r}</div>
      <div class="sc-mot">${RANG_MOT[r]}</div>
      ${so.lieu ? `<div class="sc-lieu">${esc(so.lieu)} · ${new Date(so.id).toLocaleDateString('fr-BE')}</div>` : ""}
      <div class="sc-grid">
        <div><b>${so.dep.toFixed(0)}€</b><span>Dépensé</span></div>
        <div><b>${so.val.toFixed(0)}€</b><span>Revente est.</span></div>
        <div class="${so.marge>=0?'pos':'neg'}"><b>${so.marge>=0?'+':''}${so.marge.toFixed(0)}€</b><span>Marge</span></div>
      </div>
      <div class="sc-lines">
        <div><span>Pièces achetées</span><b>${so.achats.length}</b></div>
        ${so.best ? `<div><span>Meilleure prise</span><b>${esc(so.best.o||"—")} +${so.best.m.toFixed(0)}€</b></div>` : ""}
        ${so.nego ? `<div><span>Remise moyenne</span><b>${so.nego.remise}%</b></div>` : ""}
      </div>
      <div class="sc-vendu">
        <div class="sc-vendu-t">Ce qui est réellement parti</div>
        ${so.achats.map((x,i) => `
          <div class="sc-item">
            <span>${esc(x.o || "—")}</span>
            ${x.vendu
              ? `<b class="pos">vendu ${x.vendu}€</b>`
              : `<button onclick="sortieVendre(${so.id},${i})">Vendu ?</button>`}
          </div>`).join('')}
        <p class="sc-vendu-n">Chaque vente notée ici devient ta cote réelle, sur le terrain, la prochaine fois.</p>
      </div>
      <button class="btn-save" onclick="scoreClose()">Continuer</button>
      <button class="btn-save alt2" onclick="sortieExport(${so.id})">Exporter cette sortie</button>
    </div>`;
}


/* Une vente arrive presque toujours des semaines après la sortie, bien après
   que le journal ait été vidé et archivé — c'est ici, en revoyant une sortie
   passée, qu'elle se note. */
export function sortieVendre(sid, i){
  const a = sortieRead(); const so = a.find(s => s.id === sid); if(!so) return;
  const x = so.achats[i]; if(!x) return;
  const v = parseFloat(prompt(`« ${x.o} » — vendu pour combien ?`, String(x.r || "")) || "");
  if(isNaN(v) || v < 0) return;
  x.vendu = Math.round(v); x.venduD = Date.now();
  if(!sortieWrite(a)) return;
  vib(); showScore(so);
}

export function scoreClose(){ $('score-screen').className = "scoreov"; renderHist(); }


export function sortieDel(id){
  if(!confirm("Supprimer définitivement cette sortie archivée ?")) return;
  sortieWrite(sortieRead().filter(x => x.id !== id)); renderHist();
}

export function sortieRevoir(id){
  const so = sortieRead().find(x => x.id === id);
  if(so) showScore(so);
}


export function renderHist(){
  const el = $('hist-list'); if(!el) return;
  const a = sortieRead();
  if(!a.length){
    el.innerHTML = `<p class="statnote">Aucune sortie archivée. Le bouton « Terminer la sortie »
      range ta matinée ici et remet le journal à zéro — rien n'est perdu.</p>`;
    return;
  }
  const tot = a.reduce((s,x)=>s+(x.marge||0),0);
  el.innerHTML = `<div class="hist-tot">Cumul de ${a.length} sortie${a.length>1?"s":""} :
      <b class="${tot>=0?'pos':'neg'}">${tot>=0?'+':''}${tot.toFixed(0)}€</b></div>`
    + a.map(x => `
      <div class="hist">
        <div class="h-r r${x.rang}">${x.rang}</div>
        <div class="h-c">
          <b>${esc(x.lieu || "Sortie")}</b>
          <span>${new Date(x.id).toLocaleDateString('fr-BE')} · ${x.achats.length} pièces · ${x.dep.toFixed(0)}€ dépensés</span>
        </div>
        <div class="h-m ${x.marge>=0?'pos':'neg'}">${x.marge>=0?'+':''}${x.marge.toFixed(0)}€</div>
        <div class="h-a">
          <button onclick="sortieRevoir(${x.id})">Revoir</button>
          <button onclick="sortieDel(${x.id})">✕</button>
        </div>
      </div>`).join("");
}


export function sortieExport(id){
  const so = sortieRead().find(x => x.id === id); if(!so) return;
  const l = [["Date","Lieu","Objet","Prix demandé","Prix payé","Revente estimée","Marge"]];
  so.achats.slice().reverse().forEach(x => l.push([
    new Date(x.d).toLocaleDateString('fr-BE'), so.lieu || "",
    (x.o||"").replace(/"/g,"'"), x.dem||0, x.p||0, x.r||0, ((x.r||0)-(x.p||0)).toFixed(0)]));
  const csv = "\uFEFF" + l.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a");
  a.href = url; a.download = "InsertCoin_" + so.date + ".csv"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}


/* ══════════ EXPORT VERS DRIVE ══════════ */
export function logCSV(){
  const rows = [["Date","Objet","Prix demandé","Prix payé","Revente estimée","Marge"]];
  logRead().slice().reverse().forEach(x => rows.push([
    new Date(x.d).toLocaleDateString('fr-BE'),
    (x.o||"").replace(/"/g,"'"),
    x.dem||0, x.p||0, x.r||0, ((x.r||0)-(x.p||0)).toFixed(0)
  ]));
  return rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
}


export async function logExport(){
  const a = logRead();
  if(!a.length){ alert("Le journal est vide."); return; }
  const csv = "\uFEFF" + logCSV();
  const nom = "InsertCoin_" + new Date().toISOString().slice(0,10) + ".csv";

  const tok = await driveAuth(false) || await driveAuth(true);
  if(tok){
    try{
      const meta = {name: nom, mimeType: "text/csv"};
      const bound = "-------insertcoin" + Date.now();
      const body = `--${bound}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
        + JSON.stringify(meta)
        + `\r\n--${bound}\r\nContent-Type: text/csv\r\n\r\n` + csv + `\r\n--${bound}--`;
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {method:"POST",
         headers:{Authorization:"Bearer " + tok, "Content-Type": "multipart/related; boundary=" + bound},
         body});
      if(!r.ok) throw new Error("HTTP " + r.status);
      alert("Envoyé dans ton Drive : " + nom);
      return;
    }catch(err){
      alert("Envoi Drive impossible (" + err.message + "). Téléchargement local à la place.");
    }
  }
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url; link.download = nom; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}



/* ══════════ HISTORIQUE DES RECHERCHES ══════════
   Voir storage/local.js (rechAjouter, appelé depuis callGemini) pour ce qui
   remplit cette liste — automatiquement, à chaque analyse réussie. Ici :
   l'afficher, la rouvrir en fiche complète, et laisser le chineur décider
   quoi garder. */
export function renderRecherches(){
  const el = $('rech-list'); if(!el) return;
  const a = rechRead().slice().reverse(); // la plus récente d'abord
  if(!a.length){
    el.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:8px 2px">
      Aucune recherche pour l'instant — chaque photo, scan ou question analysée apparaîtra ici.</p>`;
    return;
  }
  el.innerHTML = a.map(r => {
    const j = r.j || {};
    const titre = j.objet
      || (Array.isArray(j.lot) ? j.lot.length + " objet" + (j.lot.length > 1 ? "s" : "") + " (lot)" : "")
      || (Array.isArray(j.objetsReperes) ? "Stand · " + j.objetsReperes.filter(Boolean).length + " repère(s)" : "")
      || "Analyse";
    const d = new Date(r.date);
    const quand = isNaN(d) ? "" : d.toLocaleDateString('fr-BE', {day:'numeric', month:'short'}) + " à " + d.toLocaleTimeString('fr-BE', {hour:'2-digit', minute:'2-digit'});
    const cat = j.categorie ? catJoli(j.categorie) : "";
    return `<div class="logitem" onclick="rechOuvrir('${r.id}')" style="cursor:pointer">
      <div class="li-main" style="flex:1">
        <b>${esc(titre)}</b>
        <span>${esc(quand)}${cat ? " · " + esc(cat) : ""}</span>
      </div>
      <button class="li-x" onclick="event.stopPropagation();rechDel('${r.id}')">✕</button>
    </div>`;
  }).join('');
}

/* Rouvre une entrée comme une fiche à part entière, en rappelant le même
   rendu que l'analyse d'origine — sans la photo (jamais conservée), le
   reste (prix, décotes, pièges, actions) est identique et à jour des
   éventuelles corrections du moteur depuis. */
export function rechOuvrir(id){
  const r = rechRead().find(x => x.id === id); if(!r) return;
  switchView('live');
  setTimeout(() => {
    if(r.mode === 'bac') renderBacResult(r.j, [], r.avis);
    else if(r.mode === 'stand') renderStandResult(r.j, null, r.avis);
    else renderResult(r.j, [], r.avis);
    $('ai-results') && $('ai-results').scrollIntoView({behavior:'smooth'});
  }, 0);
}

export function rechDel(id){
  rechWrite(rechRead().filter(x => x.id !== id));
  renderRecherches();
}

export function rechClear(){
  if(!confirm("Vider tout l'historique des recherches ?\n\nTes achats et sorties archivées ne sont pas touchés.")) return;
  rechWrite([]);
  renderRecherches();
}
