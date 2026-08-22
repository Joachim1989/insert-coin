import { $, vib } from "../util/dom.js";
import { norm, esc } from "../util/text.js";
import { KEY_STORE, MODEL_STORE, calRead, calWrite } from "../storage/local.js";
import { MODELS, extractJSON } from "../api/gemini.js";
import { credBump } from "./hud.js";

export let calFilter = "all";


export function calKey(x){ return norm((x.date||"") + "|" + (x.ville||"")); }


export async function calFetch(){
  const key = localStorage.getItem(KEY_STORE);
  if(!key){ alert("Configure d'abord ta clé Gemini dans Réglages."); return; }
  if(!navigator.onLine){ alert("Pas de réseau. Les dates déjà enregistrées restent visibles."); return; }

  const el = $('cal-list');
  el.innerHTML = `<div class="loading"><div class="dots"><span>●</span><span>●</span><span>●</span></div>
    <p>Recherche des brocantes autour de Binche…</p></div>`;

  const auj = new Date().toISOString().slice(0,10);
  const brief = `Tu cherches les brocantes, vide-greniers et marchés aux puces à moins de 50 km de Binche (7130, Belgique), en Belgique ET dans le nord de la France (Nord, Aisne, Ardennes).
Nous sommes le ${auj}. Ne retiens que les dates À VENIR dans les 3 prochains mois.
Cherche en priorité sur quefaire.be (le plus gros agenda de brocantes en Belgique), puis recoupe avec brocabrac.fr, vide-greniers.org, brocantes.be, les sites communaux et les agendas locaux.
Pour chaque brocante donne : date (AAAA-MM-JJ), nom, ville, pays ("BE" ou "FR"), distance approximative depuis Binche en km (nombre entier), nombre d'exposants si connu (0 sinon), horaires si connus, et une note courte (spécialité, réputation, entrée payante...).
N'invente aucune date : si tu n'es pas sûr, ne la mets pas. Trie par date croissante. Maximum 25 entrées.
Réponds UNIQUEMENT en JSON : {"brocantes":[{"date":"","nom":"","ville":"","pays":"","km":0,"exposants":0,"horaires":"","note":""}]}`;

  const chosen = localStorage.getItem(MODEL_STORE) || MODELS[0];
  const chain = [chosen, ...MODELS.filter(m => m !== chosen)];
  let lastErr = "";

  for(const m of chain){
    try{
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        {method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":key},
         body: JSON.stringify({
           contents:[{role:"user", parts:[{text:brief}]}],
           tools:[{google_search:{}}],
           generationConfig: /^gemini-3/.test(m)
             ? {maxOutputTokens:2600, thinkingConfig:{thinkingLevel:"low"}}
             : {temperature:0.1, maxOutputTokens:2600, thinkingConfig:{thinkingBudget:0}}
         })});
      if(!res.ok){
        let d=""; try{ d=(await res.json()).error?.message||""; }catch(e){}
        lastErr = "HTTP " + res.status + (d?" — "+d:"");
        if([400,403,404,429,500,503].includes(res.status)) continue;
        throw new Error(lastErr);
      }
      const j = extractJSON(await res.json());
      const trouve = (j.brocantes || []).filter(x => x && x.date && x.ville);
      if(!trouve.length){ lastErr = "Aucune date exploitable"; continue; }

      const cur = calRead();
      /* Ce que tu as décidé toi ne se perd jamais : une date ajoutée à la main
         OU marquée « j'y vais » survit à toutes les recherches suivantes,
         même si la nouvelle recherche ne la retrouve pas. */
      const garde = cur.filter(x => x.manuel || x.go);

      const fusion = [...garde];
      const vus = new Set(garde.map(calKey));
      trouve.forEach(x => {
        const k = calKey(x);
        if(vus.has(k)){
          /* Déjà conservée : on rafraîchit ses infos sans toucher au marquage. */
          const dej = fusion.find(y => calKey(y) === k);
          if(dej && !dej.manuel){
            dej.nom = x.nom || dej.nom;
            dej.km = Number(x.km) || dej.km;
            dej.exposants = Number(x.exposants) || dej.exposants;
            dej.horaires = x.horaires || dej.horaires;
            dej.note = x.note || dej.note;
          }
          return;
        }
        vus.add(k);
        fusion.push({...x, km: Number(x.km)||0, exposants: Number(x.exposants)||0, go: false});
      });
      fusion.sort((a,b) => (a.date||"").localeCompare(b.date||""));
      calWrite(fusion);
      credBump();
      renderCal();
      return;
    }catch(err){ lastErr = String(err.message || err); }
  }

  el.innerHTML = `<div class="aifail"><b>Recherche impossible.</b><br>
    ${/429|quota/i.test(lastErr) ? "Quota Gemini indisponible pour l'instant." : "Réessaie dans un moment."}
    <br><br><span style="font-family:var(--mono);font-size:11px;opacity:.7">${esc(lastErr)}</span></div>`;
}


export function calAddManual(){
  const nom = prompt("Nom de la brocante ?"); if(!nom) return;
  const ville = prompt("Ville ?") || "";
  const date = prompt("Date (AAAA-MM-JJ) ?", new Date().toISOString().slice(0,10)) || "";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){ alert("Date attendue au format AAAA-MM-JJ."); return; }
  const km = parseInt(prompt("Distance depuis Binche en km ?", "20") || "0", 10) || 0;
  const a = calRead();
  a.push({date, nom, ville, pays:"BE", km, exposants:0, horaires:"", note:"", manuel:true, go:true});
  a.sort((x,y) => (x.date||"").localeCompare(y.date||""));
  calWrite(a); renderCal();
}


/* ══════ RAPPEL ══════
   Une app web fermée ne peut rien déclencher : sans serveur, aucune
   notification ne part. On confie donc le rappel à l'agenda du téléphone,
   qui lui sonne même app fermée. Départ à 6h30, alerte la veille à 19h. */
export function calDates(x){
  const debut = new Date(x.date + "T06:30:00");
  const fin   = new Date(x.date + "T13:30:00");
  const z = d => d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  return {debut, fin, zd: z(debut), zf: z(fin)};
}


export function calTitre(x){
  return (x.nom || "Brocante") + (x.ville ? " — " + x.ville : "");
}

export function calDesc(x){
  const l = [];
  if(x.km) l.push("Distance depuis Binche : " + x.km + " km");
  if(x.exposants) l.push(x.exposants + " exposants");
  if(x.horaires) l.push("Horaires : " + x.horaires);
  if(x.note) l.push(x.note);
  l.push("Sac : espèces en petites coupures, piles AA/AAA, sacs, chiffon.");
  l.push("Ajouté par Insert Coin");
  return l.join("\n");
}


/* Voie 1 : Google Agenda en un tap. Le rappel se règle une fois dans
   les préférences de l'agenda et s'applique ensuite à tout. */
export function calGoogle(i){
  const x = calRead()[i]; if(!x) return;
  const d = calDates(x);
  const u = "https://calendar.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(calTitre(x))
    + "&dates=" + d.zd + "/" + d.zf
    + "&details=" + encodeURIComponent(calDesc(x))
    + "&location=" + encodeURIComponent((x.ville || "") + (x.pays === "FR" ? ", France" : ", Belgique"));
  window.open(u, "_blank");
}


/* Voie 2 : fichier .ics, avec l'alerte la veille à 19h déjà dedans.
   Fonctionne avec n'importe quel agenda, y compris hors ligne. */
export function calICS(i){
  const liste = i === -1 ? calRead().filter(x => x.go && calJours(x.date) !== null)
                         : [calRead()[i]].filter(Boolean);
  if(!liste.length){ alert("Aucune date marquée « j'y vais »."); return; }

  const ev = liste.map((x, n) => {
    const d = calDates(x);
    /* Alerte la veille à 19h : le calcul se fait en heures avant le début. */
    const veille = new Date(d.debut); veille.setDate(veille.getDate()-1); veille.setHours(19,0,0,0);
    const mins = Math.round((d.debut - veille) / 60000);
    return [
      "BEGIN:VEVENT",
      "UID:insertcoin-" + Date.now() + "-" + n + "@pixelpapa",
      "DTSTAMP:" + d.zd,
      "DTSTART:" + d.zd,
      "DTEND:" + d.zf,
      "SUMMARY:" + calTitre(x).replace(/[,;\\]/g, m => "\\" + m),
      "LOCATION:" + ((x.ville||"") + (x.pays==="FR" ? "\\, France" : "\\, Belgique")),
      "DESCRIPTION:" + calDesc(x).replace(/\n/g, "\\n").replace(/[,;]/g, m => "\\" + m),
      "BEGIN:VALARM",
      "TRIGGER:-PT" + mins + "M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Brocante demain matin — prépare tes espèces et tes sacs",
      "END:VALARM",
      "END:VEVENT"
    ].join("\r\n");
  }).join("\r\n");

  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pixel Papa//Insert Coin//FR",
               "CALSCALE:GREGORIAN","METHOD:PUBLISH", ev, "END:VCALENDAR"].join("\r\n");

  const url = URL.createObjectURL(new Blob([ics], {type:"text/calendar;charset=utf-8"}));
  const a = document.createElement("a");
  a.href = url;
  a.download = (i === -1 ? "InsertCoin_brocantes" : "brocante_" + (liste[0].date||"")) + ".ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


export function calGo(i){
  const a = calRead(); if(!a[i]) return;
  a[i].go = !a[i].go; calWrite(a); renderCal(); paintImminent(); vib();
}

export function calDel(i){ const a = calRead(); a.splice(i,1); calWrite(a); renderCal(); }


/* ══════ VÉRIFICATION DE LA DATE ══════
   L'IA cherche sur le web, mais une date de brocante reste une affirmation,
   pas une preuve — contrairement à un prix, personne ne peut la confirmer par
   du grounding fiable à 100 %. On donne donc le même geste qu'ailleurs dans
   l'app : la recherche déjà tapée, à un doigt, avant de marquer « j'y vais ».
   Cliquer ne PROUVE rien de plus, mais dit que TOI tu as regardé. */
export function calVerifQuery(x){
  return ((x.ville || "") + " brocante").trim();
}

export function calVerifMark(i){
  const a = calRead(); if(!a[i]) return;
  a[i].verifie = true; calWrite(a);
  /* Pas de renderCal() ici : rouvrir la page pendant que l'onglet quefaire.be
     s'ouvre ferait perdre le tap. Le badge se met à jour au prochain rendu. */
}


export function calJours(d){
  const j = Math.round((new Date(d + "T12:00:00") - new Date().setHours(12,0,0,0)) / 86400000);
  if(j < 0) return null;
  if(j === 0) return "Aujourd'hui";
  if(j === 1) return "Demain";
  if(j < 7) return "Dans " + j + " jours";
  if(j < 14) return "La semaine prochaine";
  return "Dans " + Math.round(j/7) + " semaines";
}


/* Bandeau d'imminence : visible dès l'ouverture de l'app, sur toutes les vues.
   C'est le filet de sécurité quand le rappel d'agenda n'a pas été mis. */
export function calImminent(){
  const auj = new Date(); auj.setHours(0,0,0,0);
  return calRead().filter(x => x.go).map(x => {
    const j = Math.round((new Date(x.date + "T12:00:00") - new Date().setHours(12,0,0,0)) / 86400000);
    return {x, j};
  }).filter(o => o.j === 0 || o.j === 1).sort((a,b) => a.j - b.j)[0] || null;
}


export function paintImminent(){
  const el = $('imminent'); if(!el) return;
  const o = calImminent();
  if(!o){ el.className = "imminent"; el.innerHTML = ""; return; }
  const dem = o.j === 1;
  el.className = "imminent on" + (dem ? " demain" : " aujourdhui");
  el.innerHTML = `
    <svg class="ico16"><use href="#i-${dem ? "cal" : "flame"}"/></svg>
    <div class="im-t"><b>${dem ? "Demain" : "Aujourd'hui"} : ${esc(o.x.nom || "brocante")}</b>
      <span>${esc(o.x.ville || "")}${o.x.km ? " · " + o.x.km + " km" : ""}${o.x.horaires ? " · " + esc(o.x.horaires) : ""}</span></div>
    ${dem ? `<button onclick="switchView('guide');setTimeout(()=>document.getElementById('sac-ticks')?.scrollIntoView({behavior:'smooth'}),150)">Sac</button>` : ""}`;
}


export function renderCal(){
  const el = $('cal-list'); if(!el) return;
  let a = calRead().filter(x => calJours(x.date) !== null);
  if(calFilter === "go")  a = a.filter(x => x.go);
  if(calFilter === "big") a = a.filter(x => (x.exposants || 0) >= 150);

  if(!a.length){
    el.innerHTML = `<div class="empty-state">
      <svg class="ico-big"><use href="#i-cal"/></svg>
      <b>Aucune date</b>
      <p>${calFilter === "all"
        ? "Appuie sur « Chercher les prochaines dates » pour remplir ton agenda des trois prochains mois."
        : "Rien sous ce filtre. Reviens sur « Toutes »."}</p></div>`;
    return;
  }

  let moisCourant = "";
  el.innerHTML = a.map((x, i) => {
    const idx = calRead().findIndex(y => calKey(y) === calKey(x));
    const dt = new Date(x.date + "T12:00:00");
    const mois = dt.toLocaleDateString('fr-BE', {month:'long', year:'numeric'});
    const sep = mois !== moisCourant ? `<div class="cal-mois">${mois}</div>` : "";
    moisCourant = mois;
    const grosse = (x.exposants || 0) >= 150;
    const proche = (x.km || 0) <= 15;
    return sep + `
      <div class="cal ${x.go ? 'go' : ''}">
        <div class="cal-d">
          <b>${dt.getDate()}</b>
          <span>${dt.toLocaleDateString('fr-BE',{weekday:'short'})}</span>
        </div>
        <div class="cal-c">
          <div class="cal-n">${esc(x.nom || "Brocante")}
            ${grosse ? `<svg class="ico16 hot"><use href="#i-flame"/></svg>` : ""}</div>
          <div class="cal-v"><svg class="ico16"><use href="#i-pin"/></svg>${esc(x.ville)}
            <em>${x.pays === "FR" ? "France" : "Belgique"}</em></div>
          <div class="cal-tags">
            <span class="${proche ? 'near' : ''}">${x.km || "?"} km</span>
            ${x.exposants ? `<span>${x.exposants} exposants</span>` : ""}
            ${x.horaires ? `<span>${esc(x.horaires)}</span>` : ""}
            <span class="soon">${calJours(x.date)}</span>
          </div>
          ${x.note ? `<div class="cal-note">${esc(x.note)}</div>` : ""}
          ${!x.manuel ? `<div class="cal-verif${x.verifie ? " ok" : ""}">
            <span>${x.verifie ? "✓ Vérifiée par toi" : "Non vérifiée — trouvée par l'IA"}</span>
            <a href="https://www.quefaire.be/annonces/index.php?word=${encodeURIComponent(calVerifQuery(x))}"
              target="_blank" rel="noopener" onclick="calVerifMark(${idx})">quefaire.be</a>
            <a href="https://www.google.com/search?q=${encodeURIComponent(calVerifQuery(x) + ' ' + (x.date||''))}"
              target="_blank" rel="noopener" onclick="calVerifMark(${idx})">Google</a>
          </div>` : ""}
          <div class="cal-act">
            <button class="cal-go" onclick="calGo(${idx})">
              <svg class="ico16"><use href="#i-star"/></svg>${x.go ? "J'y vais" : "Marquer"}</button>
            <button class="li-x" onclick="calDel(${idx})">✕</button>
          </div>
          ${x.go ? `<div class="cal-rem">
            <button onclick="calGoogle(${idx})">＋ Google Agenda</button>
            <button onclick="calICS(${idx})">Fichier .ics</button>
          </div>` : ""}
        </div>
      </div>`;
  }).join('');
}

/* Câblage des filtres du calendrier : regroupé ici parce que calFilter
   n'appartient qu'à ce module (appelé depuis init(), voir ui/main.js). */
export function calendarInit(){
  document.querySelectorAll('#cal-filter button').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#cal-filter button').forEach(x => x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
      calFilter = b.dataset.f;
      renderCal();
    }));
}
