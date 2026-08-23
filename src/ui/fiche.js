import { $, vib } from "../util/dom.js";
import { esc, collTokens, collScore } from "../util/text.js";
import { repartirProrata } from "../util/repartition.js";
import { logRead, logWrite, sortieRead, discToken, legoKey, brickKey, legoTarifs } from "../storage/local.js";
import {
  ETAT_LBL, PORT_LBL, ficheNorm, ficheCalc, ficheVerdict, attManquants, attResume
} from "../pricing/engine.js";
import { discCote, discLire, discMusique } from "../api/discogs.js";
import { legoSet, legoValeur, legoNumTrouve } from "../api/rebrickable.js";
import { brickSet } from "../api/brickset.js";
import { collMatch, collBanner } from "./dedup.js";
import { hudPaint } from "./hud.js";
import { renderLog } from "./log.js";

/* Le prix demandé appartient à l'objet qu'on vient d'analyser. S'il traîne
   d'une fiche à l'autre, l'objet suivant est jugé contre le prix du précédent —
   et le verdict est faux sans que rien ne le signale. */
export let PRIX_UTILISE = null;

export function prixNouveau(){
  const p = $('price'); if(!p) return;
  if(PRIX_UTILISE !== null && p.value === PRIX_UTILISE){ p.value = ""; PRIX_UTILISE = null; }
}


/* ══════════════════ FICHE EXPERT ══════════════════
   Le modèle observe et cherche ; l'app calcule. Tu es devant l'objet, tu vois
   mieux que lui : les deux réglages ci-dessous sont sous ton doigt et les prix
   se refont instantanément, sans requête, sans réseau. C'est là toute la
   différence entre « ça vaut combien » et « combien vaut CELUI-CI ». */
export let FICHE = null;


export function ficheEtatSet(n){
  if(!FICHE) return;
  FICHE.etat = Number(n); vib(); fichePaint();
}


/* Redessine uniquement les prix et le bandeau : pas de requête, pas d'attente. */
export function fichePaint(){
  if(!FICHE) return;
  const c = ficheCalc(FICHE);
  const dem = parseFloat(($('price') || {}).value || "0") || 0;
  const vd = ficheVerdict(FICHE, c, dem);

  const ac = $('fiche-acte');
  if(ac) ac.innerHTML = ficheAction(FICHE, c, dem);
  const px = $('fiche-prix');
  if(px) px.innerHTML = fichePrix(FICHE, c, dem);
  const sy = $('fiche-say');
  if(sy) sy.textContent = "« " + ficheDire(FICHE) + " »";

  const hd = $('fiche-head');
  if(hd){
    hd.className = "aihead " + vd.v;
    const num = hd.querySelector('.num'), lab = hd.querySelector('.v'), r = hd.querySelector('.r');
    if(num) num.textContent = c.plafond ? c.plafond + "€" : "—";
    if(lab) lab.textContent = vd.t;
    if(r) r.textContent = c.net ? "Revente nette ≈ " + c.net + "€" : "Marché inconnu";
  }
  /* Ce qui part au journal et aux objets repérés doit suivre tes réglages. */
  LAST = {objet: FICHE.objet, revente: c.net, prixMax: c.plafond, demande: dem};
}


/* Le vendeur attend. Une seule bande, juste sous le titre : le chiffre à dire
   et le chiffre à ne pas dépasser. Tout le reste de la fiche est là pour après,
   ou pour les cas où tu veux comprendre. */
export function ficheAction(f, c, dem){
  /* Un écran qui dit « pas de prix » et s'arrête là ne sert à rien devant un
     vendeur. L'objet est identifié : on enchaîne directement sur la
     vérification, requête déjà écrite, et sur le champ où poser le chiffre. */
  if(!c.base) return `<div class="acte-plat">
    <b>Prix à vérifier</b>
    <span>L'objet est identifié, mais aucune vente n'a pu être confirmée.
      Ouvre eBay ci-dessous — la recherche est déjà prête — et note ce que tu vois.</span>
    <div class="vf-g vf-court">${VERIF_SITES.slice(0, 3).map(x => {
      const q = verifQuery(f, x.pref);
      return `<a class="vf" href="${x.url(q)}" target="_blank" rel="noopener"><b>${x.nom}</b><i>${x.note}</i></a>`;
    }).join("")}</div>
    <div class="vf-row">
      <input id="vf-prix-h" type="number" inputmode="decimal" placeholder="Prix constaté €"
        onchange="verifSet(this.value)">
      <button onclick="verifSet(document.getElementById('vf-prix-h').value)">Recalculer</button>
    </div>
  </div>`;
  if(!c.plafond) return `<div class="acte-plat"><b>Passe ton chemin</b>
    <span>Ce que tu en tirerais ne couvrirait même pas l'emballage.</span></div>`;

  const incertain = f.attendu.filter(x => x.vu === "?");
  const absent = attManquants(f.attendu);
  let alerte = "";
  if(incertain.length) alerte = "Vérifie d'abord : " + incertain.slice(0,2).map(x => x.n).join(", ") + ".";

  /* Sur un lot, un chiffre nu est ambigu : 1 € la figurine ou 1 € le tas ?
     On le dit, et on donne le prix unitaire pour pouvoir négocier au détail. */
  const pour = f.lot ? " pour le lot" + (f.lotNb ? " de " + f.lotNb + " pièces" : "") : "";
  const unite = (f.lot && f.lotNb > 1)
    ? "Soit " + (c.plafond / f.lotNb).toFixed(2).replace(".", ",") + " € la pièce — utile s'il veut vendre au détail."
    : "";

  let phrase, cls = "oui";
  if(dem && dem <= c.ouverture){ phrase = "Il en demande " + dem + " € : ne négocie pas, prends."; }
  else if(dem && dem > c.plafond){ phrase = "Il en demande " + dem + " €. Repose-le."; cls = "non"; }
  else if(dem){ phrase = "Propose " + c.ouverture + " €. Tu peux monter jusqu'à " + c.plafond + " €" + pour + "."; }
  else { phrase = "Propose " + c.ouverture + " €. Ne dépasse pas " + c.plafond + " €" + pour + "."; }

  return `<div class="acte ${cls}">
    <div class="acte-t"><b>${phrase}</b>
      ${alerte ? `<span>${esc(alerte)}</span>` : ""}
      ${unite ? `<span class="acte-u">${unite}</span>` : ""}</div>
    ${ficheParce(f, c, absent)}
  </div>`;
}


/* Le chiffre ne vaut rien si tu ne peux pas le contester. Toute la chaîne, en
   phrases, à l'endroit exact où tu décides — et pas en petit caractères plus bas. */
export function ficheParce(f, c, absent){
  const l = [];
  l.push(`<b>${c.base}€</b> — ${f.marcheVu ? "le prix que TU as constaté" : "ce que ça se vend en bon état"}${f.marcheSrc ? " (" + esc(f.marcheSrc) + ")" : ""}${f.lot && f.lotNb ? ", le lot entier" : ""}`);
  if(c.ce > 1) l.push(`<b>+${Math.round((c.ce - 1) * 100)}%</b> — meilleur que l'état courant (${ETAT_LBL[f.etat].toLowerCase()})`);
  else if(c.ce < 1) l.push(`<b>−${Math.round((1 - c.ce) * 100)}%</b> — état ${ETAT_LBL[f.etat].toLowerCase()}`);
  absent.forEach(x => l.push(`<b>−${x.perte}%</b> — ${esc(x.n)} manque`));
  if(c.port) l.push(`<b>−${c.port}€</b> — ce que le volume te coûte à l'envoi`);
  l.push(`= <b>${c.net}€</b> dans ta poche à la revente`);
  l.push(`<b>÷3</b> — ta règle : tu n'achètes jamais au-dessus du tiers`);
  return `<details class="pq"><summary>Pourquoi ${c.plafond}€ ?</summary>
    <ol>${l.map(x => `<li>${x}</li>`).join("")}</ol></details>`;
}


export function ficheReglages(f, c){
  const b = (n) => `<button class="et${f.etat === n ? " on" : ""}" onclick="ficheEtatSet(${n})">
    <b>${n}</b><span>${ETAT_LBL[n]}</span></button>`;
  return `
    <div class="reg" id="fiche-reglages">
      <div class="reg-t">État réel <i>${f.echelle ? esc(f.echelle) : "que TU constates"} · la note 3 est la référence du marché</i></div>
      <div class="reg-et">${[5,4,3,2,1].map(b).join("")}</div>
      ${f.etatDit ? `<div class="reg-dit">Vu sur la photo : ${esc(f.etatDit)}</div>` : ""}
    </div>`;
}


export function fichePrix(f, c, dem){
  if(!c.base) return `<div class="px-vide">Aucun prix de marché fiable trouvé.
    Les réglages ci-dessus restent utiles : note l'objet, puis vérifie toi-même sur Vinted ou eBay.</div>`;
  const ligne = (cls, lbl, val, aide) =>
    `<div class="px ${cls}"><div class="px-l">${lbl}</div><div class="px-v">${val}€</div><div class="px-a">${aide}</div></div>`;
  const grille = c.echelonne
    ? `<div class="px-grid">
        ${ligne("o","Tu annonces", c.ouverture,"le premier chiffre")}
        ${ligne("c","Tu vises", c.cible,"l'accord normal")}
        ${ligne("p","Tu te lèves", c.plafond,"au-delà, tu perds")}
      </div>`
    : `<div class="px-petit">
        <b>${c.plafond ? c.plafond + "€ maximum" : "Seulement si c'est donné"}</b>
        <span>${c.plafond
          ? "À ce prix-là il n'y a rien à négocier : propose " + c.ouverture + "€, et n'insiste pas au-delà de " + c.plafond + "€. Ça n'a d'intérêt que glissé dans un lot."
          : "La marge ne couvre même pas l'envoi. À prendre uniquement pour compléter un lot que tu vends déjà."}</span>
      </div>`;
  return `
    ${grille}
    <div class="px-calc">
      <b>${c.base}€</b> le marché${f.marcheSrc ? " (" + esc(f.marcheSrc) + ")" : ""}
      · <b>×${c.ce}</b> état · <b>×${c.cc}</b> complétude
      ${c.port ? ` · <b>−${c.port}€</b> de volume` : ""}
      → <b>${c.net}€</b> nets pour toi${f.lot && f.lotNb > 1 ? ` (le lot de ${f.lotNb})` : ""}
    </div>
    ${dem ? `<div class="px-dem">${dem <= c.cible
      ? "Il en demande " + dem + "€ : c'est déjà sous ta cible. Prends sans discuter."
      : dem <= c.plafond
        ? "Il en demande " + dem + "€ : négociable, mais ne dépasse pas " + c.plafond + "€."
        : "Il en demande " + dem + "€, ton plafond est à " + c.plafond + "€. Repose-le."}</div>` : ""}`;
}


export const CIRC_MOT = {rare:["Rare","r"], "peu courant":["Peu courant","r"],
                  courant:["Courant","c"], massif:["Pressage massif","c"]};


export function ficheCorps(f){
  const ci = CIRC_MOT[f.circulation];
  /* Un seul bloc ouvert : le reste attend. Sur un stand, on lit trois lignes,
     on parle, et on ne fait défiler que si quelque chose cloche. */
  const bloc = (id, titre, corps, ouvert) => corps
    ? `<details class="bl"${ouvert ? " open" : ""}><summary>${titre}</summary><div class="bl-in">${corps}</div></details>`
    : "";

  const listes = (t) => t.length ? `<ul>${t.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

  return `
    ${bloc("ck", "Ce qui doit être là" + (f.attendu.length ? ` <i>${f.attendu.length}</i>` : ""),
      f.attendu.length
        ? `<div class="fi-ck">${f.attendu.map((x,i) =>
            `<label class="v-${x.vu === "oui" ? "o" : x.vu === "non" ? "n" : "q"}">
              <input type="checkbox"${x.vu === "oui" ? " checked" : ""} onchange="ficheCoche(${i}, this.checked)">
              <span>${esc(x.n)}
                ${x.vu === "non" ? `<i>absent — ${x.perte}% de valeur en moins</i>`
                : x.vu === "?" ? `<i>non visible — à vérifier (vaudrait ${x.perte}%)</i>`
                : `<i>présent</i>`}</span></label>`).join("")}</div>
           <div class="fi-ck-n" id="fiche-ck-n">${attResume(f.attendu)}</div>
           ${f.impactComplet ? `<div class="fi-imp">${esc(f.impactComplet)}</div>` : ""}`
        : "", true)}

    ${bloc("vf", "Vérifier le prix pour de vrai",
      `<div id="vf-slot">${verifBloc(f)}</div>${compBloc(f.comparables)}`, !ficheCalc(f).base)}

    ${bloc("dg", "Ce qui peut te coûter cher" + (f.pieges.length ? ` <i>${f.pieges.length}</i>` : ""),
      listes(f.pieges) + listes(f.verifs), f.pieges.length > 0)}

    ${bloc("et", "L'état, si la photo t'a menti", ficheReglages(f, ficheCalc(f)), false)}

    ${bloc("id", "L'identification",
      (f.code ? `<div class="fi-code">${esc(f.code)}</div>
                 <button class="fi-cp" onclick="ficheCopieCode()">Copier la référence</button>`
              : `<div class="fi-vide">${f.codeOu ? esc(f.codeOu) : "Aucune référence visible."}</div>`)
      + (f.identification ? `<div class="ident">${esc(f.identification)}</div>` : "")
      + (ci ? `<div class="fi-circ ${ci[1]}">${ci[0]}</div>` : "")
      + (f.note ? `<div class="aimeta">${esc(f.note)}</div>` : ""), false)}`;
}


/* La complétude se règle toute seule à mesure que tu coches. */
/* L'argument vient du modèle, le chiffre vient du calcul. Séparer les deux
   évite ce qui s'est produit : une phrase proposant 5 € sous un plafond à 2 €. */
export function ficheDire(f){
  const c = ficheCalc(f);
  let arg = String(f.nego || "").trim();
  /* Filet : si le modèle a quand même glissé un montant, on retire la
     proposition entière — pas seulement le chiffre — sinon il reste « je peux
     t'en proposer. » au milieu de la phrase. On garde l'argument, on jette
     l'offre. */
  if(/\d+\s*(€|euros?)/i.test(arg)){
    arg = arg.split(/([,;.!?])/)
             .filter((x, i) => i % 2 === 0)
             .filter(x => !/\d+\s*(€|euros?)/i.test(x))
             .map(x => x.trim()).filter(Boolean)
             .join(", ");
  }
  if(!arg) arg = "C'est un titre très courant";
  if(!/[.!?]$/.test(arg)) arg += ".";
  return c.plafond ? arg + " Je t'en donne " + c.ouverture + " €." : arg;
}


/* Décocher, c'est constater une absence — et l'absence est chiffrée. Un
   élément que tu n'as pas encore touché reste « à vérifier » et ne coûte rien. */
export function ficheCoche(i, coche){
  if(!FICHE || !FICHE.attendu[i]) return;
  FICHE.attendu[i].vu = coche ? "oui" : "non";
  const lb = document.querySelectorAll('.fi-ck label')[i];
  if(lb){
    lb.className = "v-" + (coche ? "o" : "n");
    const it = lb.querySelector('i');
    if(it) it.textContent = coche ? "présent" : "absent — " + FICHE.attendu[i].perte + "% de valeur en moins";
  }
  const el = $('fiche-ck-n');
  if(el) el.textContent = attResume(FICHE.attendu);
  vib(); fichePaint();
}


export function ficheCopieCode(){
  if(!FICHE || !FICHE.code) return;
  const t = FICHE.code;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(() => { vib(); alert("Référence copiée : " + t); });
  } else prompt("Copie la référence :", t);
}


/* ══════ TA VRAIE COTE ══════
   Une estimation IA vaut ce qu'elle vaut ; ce que TU as réellement encaissé
   sur le même objet, une autre fois, est un fait. On le cherche dans le
   journal en cours ET dans les sorties déjà archivées — la revente arrive
   presque toujours des semaines après l'achat, bien après que la sortie ait
   été rangée. */
export function coteReelle(query){
  const qt = collTokens(query); if(qt.length < 2) return null;
  const pool = [];
  logRead().forEach(x => { if(x.vendu > 0) pool.push(x); });
  sortieRead().forEach(so => (so.achats || []).forEach(x => { if(x.vendu > 0) pool.push(x); }));
  let best = null;
  pool.forEach(x => {
    const sc = collScore(qt, collTokens(x.o || ""));
    if(sc >= 0.55 && (!best || sc > best.sc)) best = {sc, x};
  });
  if(!best) return null;
  return {prix: Math.round(best.x.vendu), d: best.x.venduD || 0};
}


// --- RENDERERS ---
export function renderResult(j, images, avis) {
  FICHE = ficheNorm(j);
  const f = FICHE;
  /* Ce que TU as réellement encaissé sur le même objet, une autre fois, écrase
     n'importe quelle estimation — la tienne comme celle du modèle. */
  const cote = coteReelle((f.objet || "") + " " + (f.identification || ""));
  if(cote){
    f.marcheReel = cote.prix;
    f.marcheSrc = "ta vente réelle" + (cote.d ? " · " + new Date(cote.d).toLocaleDateString('fr-BE') : "");
  }
  const c = ficheCalc(f);
  const dem = parseFloat($('price').value || "0") || 0;
  const vd = ficheVerdict(f, c, dem);

  const conf = (f.confiance || "").toLowerCase();
  /* « Cote vérifiée » se mérite : sans source extérieure (Discogs, Rebrickable,
     Brickset ou une vente que tu as réellement conclue), c'est l'avis du
     modèle sur lui-même — quelle que soit la confiance qu'il s'accorde.
     Cas 3 (23/08/2026, Top Gun) : le badge du milieu s'appelait "Cote
     partielle", un nom qui laisse croire à une vérification externe
     partielle alors que c'est purement l'auto-évaluation de l'IA — la même
     apparence, qu'un jeton Discogs soit configuré ou pas, que Discogs ait
     trouvé un match ou pas. Renommé "Estimation confiante" : ça reste une
     estimation IA, juste une dans laquelle le modèle dit avoir confiance —
     aucune ambiguïté possible avec une source vérifiée. */
  let cKey = f.marcheReel ? "h" : (conf.startsWith("haut") ? "m" : conf.startsWith("moy") ? "m" : "f");
  const cTxt = {h:"Cote vérifiée", m:"Estimation confiante", f:"Estimation"}[cKey];

  const imgHtml = (images && images.length)
    ? `<div class="aithumb-container">` + images.map(im => `<img src="${im.url}" class="aithumb">`).join('') + `</div>`
    : "";

  const rq = (f.objet || "") + " " + (f.identification || "");
  const dupHtml = collBanner(rq);

  $('ai-results').innerHTML = dupHtml + `
    <div class="aicard">
      ${imgHtml}
      <div class="aihead ${vd.v}" id="fiche-head">
        <div class="p"><div class="num">${c.plafond ? c.plafond + "€" : "—"}</div><div class="cap">TON MAX</div></div>
        <div class="t">
          <div class="v">${vd.t}</div>
          <div class="o">${esc(f.objet)}</div>
          <div class="r">${c.net ? "Revente nette ≈ " + c.net + "€" : "Marché inconnu"}</div>
        </div>
      </div>
      ${f.pieges.length ? `<div class="piege-top">⚠ <b>${esc(f.pieges[0])}</b>${f.pieges.length > 1
        ? `<span>+ ${f.pieges.length - 1} autre${f.pieges.length > 2 ? "s" : ""} piège${f.pieges.length > 2 ? "s" : ""} détaillé${f.pieges.length > 2 ? "s" : ""} plus bas</span>` : ""}</div>` : ""}
      <div id="fiche-acte">${ficheAction(f, c, dem)}</div>
      ${f.nego ? `<div class="say" id="fiche-say">« ${esc(ficheDire(f))} »</div>` : ""}
      <div id="disc-slot"></div>
      <div id="lego-slot"></div>
      <div id="brick-slot"></div>
      <div class="aibody">${ficheCorps(f)}</div>
      <div id="fiche-prix" class="prix">${fichePrix(f, c, dem)}</div>
      <div class="conf ${cKey}"><span class="cdot"></span>${cTxt}${f.categorie ? " · " + esc(f.categorie) : ""}${f.gabarit ? " · " + PORT_LBL[f.gabarit] : ""}</div>
      ${avis ? `<div class="avis">⚠︎ ${esc(avis)}</div>` : ''}
      <div class="act-grid deux">
        <input id="log-dem" type="number" inputmode="decimal" placeholder="Demandé €"
          title="Ce qu'il demandait avant négociation, à taper toi-même — jamais pré-rempli : un oubli doit rester une absence de donnée (exclue des stats), jamais un ancien chiffre resté affiché par erreur (inclus à tort).">
        <input id="log-price" type="number" inputmode="decimal" placeholder="Payé €">
        <button class="act act-buy" onclick="logFind()">
          <svg class="ico16"><use href="#i-cash"/></svg>Je l'achète</button>
      </div>
      <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">Fermer</button>
    </div>`;

  LAST = {objet: f.objet, revente: c.net, prixMax: c.plafond, demande: dem};
  PRIX_UTILISE = $('price').value;

  /* Changer le prix demandé refait le verdict sans relancer quoi que ce soit. */
  const pi = $('price');
  if(pi && !pi.dataset.lie){ pi.dataset.lie = "1"; pi.addEventListener('input', () => { if(FICHE) fichePaint(); }); }

  const req = (f.objet || "") + (f.identification && f.identification.length < 60 ? " " + f.identification : "");
  if(discMusique(req)) discGreffe(req.trim(), 'disc-slot');
  legoGreffe(f, 'lego-slot');
  brickGreffe(f, 'brick-slot');
}


export function renderStandResult(j, image, avis) {
  /* Le mode Stand est celui où le JSON revient le plus souvent amputé :
     aucune clé n'est supposée présente. */
  const vg = String(j.verdictGlobal || "");
  const v = vg.toLowerCase().includes('fouill') ? 'S' : 'L';
  
  const reperes = Array.isArray(j.objetsReperes) ? j.objetsReperes.filter(Boolean) : [];
  let itemsHtml = "";
  if(reperes.length > 0) {
    itemsHtml = reperes.map(obj => `
      <li style="margin-bottom:10px;">
        <b style="color:var(--gold)">${esc(obj.nom || "Objet non nommé")}</b>${obj.reventeEstimee ? ` (Revente ≈ ${Number(obj.reventeEstimee)||0}€)` : ""}<br>
        ${obj.interet ? `<span style="font-size:12px; color:var(--text-muted)">${esc(obj.interet)}</span>` : ""}
        ${obj.verifsStand ? `<br><i style="font-size:11px; color:#ff9800;">Verif: ${esc(obj.verifsStand)}</i>` : ''}
      </li>`).join('');
  } else {
    itemsHtml = "<li>Rien de très évident à première vue.</li>";
  }

  $('ai-results').innerHTML = `
    <div class="aicard">
      ${image && image.url ? `<img src="${image.url}" style="width:100%; max-height:220px; object-fit:cover;">` : ""}
      <div class="aihead ${v}">
        <div class="p" style="flex: 0 0 80px;"><div class="num" style="font-size:38px;">🎯</div></div>
        <div class="t">
          <div class="v">ANALYSE DE STAND</div>
          <div class="o" style="font-size:16px;">${esc(vg || (v === 'S' ? "Stand à fouiller" : "Rien de flagrant"))}</div>
        </div>
      </div>
      ${avis ? `<div class="avis">⚠︎ ${esc(avis)}</div>` : ''}
      <div class="aibody">
        <h4>Cibles Potentielles Repérées</h4>
        <ul style="list-style-type:none; padding-left:0;">${itemsHtml}</ul>
        ${j.conseil ? `<h4>Conseil Stratégique</h4><p style="font-size:14px; margin-top:5px; font-style:italic;">${esc(j.conseil)}</p>` : ''}
      </div>
      <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">Fermer l'analyse</button>
    </div>`;
}


export function renderBacResult(j, images, avis, garderSel){
  const lot = Array.isArray(j.lot) ? j.lot : [];
  /* Le résultat est conservé pour pouvoir se redessiner à chaque coche
     sans relancer une requête. */
  BAC_VUE = {j, images, avis};
  if(!garderSel){
    BAC_ACHETE = false;
    BAC_SEL = new Set();
  }
  const rows = lot.map(o => {
    const dup = collMatch((o.artiste || "") + " " + (o.nom || ""));
    return {o, dup: dup && dup.sur ? dup : null, flou: dup && !dup.sur ? dup : null};
  });

  /* Un doublon certain repasse en "laisse" quel que soit l'avis du modèle :
     l'objet peut être une bonne affaire dans l'absolu et un mauvais achat
     pour lui. */
  const pris   = rows.filter(r => !r.dup && (r.o.verdict || "").toUpperCase() === "R");
  const nego   = rows.filter(r => !r.dup && (r.o.verdict || "").toUpperCase() === "N");
  const laisse = rows.filter(r => !r.dup && (r.o.verdict || "").toUpperCase() === "L");
  const doub   = rows.filter(r => r.dup);

  const valeur = pris.reduce((s,r) => s + (Number(r.o.revente)||0), 0);

  const ligne = (r, i) => {
    const o = r.o;
    const v = (o.verdict || "N").toUpperCase();
    const cls = r.dup ? "D" : (["R","N","L"].includes(v) ? v : "N");
    const idx = rows.indexOf(r);
    const coche = BAC_SEL.has(idx);
    return `<div class="bacrow ${cls}${coche ? " sel" : ""}" onclick="bacToggle(${idx})">
      <div class="bac-v">${r.dup ? "DÉJÀ" : cls}</div>
      <div class="bac-tick">${coche ? "☑" : "☐"}</div>
      <div class="bac-c">
        <div class="bac-n">${esc(o.nom || "—")}</div>
        <div class="bac-a">${esc(o.artiste || "")}${o.annee ? " · " + esc(o.annee) : ""}</div>
        ${r.flou ? `<div class="bac-warn">Ressemble à « ${esc(r.flou.e.t)} » que tu as déjà — vérifie l'édition.</div>` : ""}
        ${o.note ? `<div class="bac-note">${esc(o.note)}</div>` : ""}
        ${!r.dup && discToken() && discMusique((o.artiste||"") + " " + (o.nom||""))
          ? `<button class="bac-disc" onclick="event.stopPropagation();bacDisc(${idx})">Cote Discogs</button>
             <div id="disc-bac-${idx}"></div>` : ""}
      </div>
      <div class="bac-p">
        ${r.dup ? `<span class="bac-dup">en collection</span>`
          : `<b>${Number(o.prixMax)||"?"}€</b><span>→ ${Number(o.revente)||"?"}€</span>`}
      </div>
    </div>`;
  };

  const bloc = (titre, arr, sub) => arr.length
    ? `<div class="bac-sect"><h4>${titre} <i>${arr.length}</i></h4>
       ${sub ? `<p class="bac-sub">${sub}</p>` : ""}${arr.map(ligne).join("")}</div>`
    : "";

  BAC_ROWS = rows;
  if(!garderSel){
    rows.forEach((r, i) => {
      if(!r.dup && (r.o.verdict || "").toUpperCase() === "R") BAC_SEL.add(i);
    });
  }

  $('ai-results').innerHTML = `
    <div class="aicard">
      <div class="bac-strip">${images.slice(0,4).map(im => `<img src="${im.url}">`).join("")}</div>
      <div class="aihead ${pris.length ? 'R' : doub.length && !nego.length ? 'L' : 'N'}">
        <div class="p"><div class="num">${lot.length}</div><div class="cap">LUS</div></div>
        <div class="t">
          <div class="v">MODE BAC${j.typeBac ? " · " + esc(j.typeBac).toUpperCase() : ""}</div>
          <div class="o">${pris.length} à prendre${doub.length ? ` · ${doub.length} déjà chez toi` : ""}</div>
          ${valeur ? `<div class="r">valeur des « à prendre » ≈ ${valeur}€</div>` : ""}
        </div>
      </div>
      ${avis ? `<div class="avis">⚠︎ ${esc(avis)}</div>` : ""}
      <div class="aibody">
        ${bacBar({R:pris.length, N:nego.length, D:doub.length, L:laisse.length})}
        ${j.resume ? `<div class="saywrap">${esc(j.resume)}</div>` : ""}
        ${bloc("À prendre", pris)}
        ${bloc("À négocier", nego, "Seulement sous le prix indiqué.")}
        ${bloc("Tu l'as déjà", doub, "Sauf si l'édition diffère de la tienne.")}
        ${bloc("Laisse", laisse)}
        ${!lot.length ? `<div class="empty-state"><svg class="ico-big"><use href="#i-crate"/></svg>
          <b>Rien de lisible</b><p>Rapproche-toi, ou écarte les pochettes pour dégager les tranches.</p></div>` : ""}
      </div>
      ${lot.length ? bacCart() : ""}
      <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">Fermer l'analyse</button>
    </div>`;
}


/* Le panier : ce que tu emportes réellement du bac, et à quel prix.
   Sans lui, un lot négocié en bloc devait être ressaisi pièce par pièce. */
export function bacCart(){
  if(BAC_ACHETE){
    return `<div class="bac-cart done"><div class="bc-t">
      <b>Lot enregistré</b>
      <span>Journal de chasse mis à jour</span></div></div>`;
  }
  const sel = [...BAC_SEL].map(i => BAC_ROWS[i]).filter(Boolean);
  const val = sel.reduce((s,r) => s + (Number(r.o.revente)||0), 0);
  const max = sel.reduce((s,r) => s + (Number(r.o.prixMax)||0), 0);
  return `<div class="bac-cart">
    <div class="bc-t">
      <b>${sel.length} pièce${sel.length>1?"s":""} · revente ≈ ${val}€</b>
      <span>${sel.length ? "ne dépasse pas " + max + "€ pour le lot" : "coche ce que tu emportes"}</span>
    </div>
    <button class="${sel.length ? "" : "off"}" onclick="bacBuy()">J'ai acheté</button>
  </div>`;
}


/* Une pochette à la fois, à la demande : vérifier vingt disques d'un coup
   viderait le quota Discogs de la minute pour rien. */
export function bacDisc(i){
  const r = BAC_ROWS[i]; if(!r) return;
  const q = ((r.o.artiste || "") + " " + (r.o.nom || "")).trim();
  discGreffe(q, 'disc-bac-' + i);
}


export function bacToggle(i){
  if(BAC_ACHETE) return;
  if(BAC_SEL.has(i)) BAC_SEL.delete(i); else BAC_SEL.add(i);
  vib();
  if(BAC_VUE) renderBacResult(BAC_VUE.j, BAC_VUE.images, BAC_VUE.avis, true);
}


export function bacNom(r){
  const o = r.o;
  return (o.artiste ? o.artiste + " — " : "") + (o.nom || "—");
}


export function bacBuy(){
  const idx = [...BAC_SEL].sort((a,b)=>a-b);
  const sel = idx.map(i => BAC_ROWS[i]).filter(Boolean);
  if(!sel.length){ alert("Coche d'abord les pièces que tu emportes."); return; }

  const tot = parseFloat(prompt(
    "Combien as-tu payé pour ces " + sel.length + " pièce(s) au total ?", "") || "");
  if(isNaN(tot) || tot < 0) return;

  /* Correctif du 23/08/2026 (voir docs/diagnostic-cotation.md) : avant, rien
     ne demandait le prix annoncé par le vendeur avant négociation sur un
     achat de lot — dem valait toujours 0, donc negoStats() (src/ui/log.js)
     excluait silencieusement TOUS les achats de lot de tes statistiques de
     négociation, y compris la négociation groupée que l'app recommande
     elle-même en premier conseil. Facultatif, comme sur un achat simple :
     laisse vide si tu ne sais plus ce qui était demandé. */
  const totDem = parseFloat(prompt(
    "Il en demandait combien pour ces " + sel.length + " pièce(s), avant négociation ? (facultatif)", "") || "");

  /* Répartition au prorata de la revente estimée : dans un lot négocié en bloc,
     la pièce qui vaut le plus doit porter la plus grosse part du prix, sinon
     la marge par objet ne veut plus rien dire. Même règle appliquée à "payé"
     et à "demandé" — voir src/util/repartition.js. */
  const vals = sel.map(r => Number(r.o.revente) || 0);
  const parts = repartirProrata(vals, tot);
  const demParts = (!isNaN(totDem) && totDem >= 0) ? repartirProrata(vals, totDem) : sel.map(() => 0);

  const lg = logRead();
  sel.forEach((r, i) => {
    lg.unshift({d: Date.now() + i, o: bacNom(r), p: parts[i],
                r: Number(r.o.revente) || 0, dem: demParts[i], mx: Number(r.o.prixMax) || 0});
  });
  logWrite(lg);

  BAC_ACHETE = true;
  vib(); hudPaint(); renderLog();
  if(BAC_VUE) renderBacResult(BAC_VUE.j, BAC_VUE.images, BAC_VUE.avis, true);
}


export let BAC_ROWS = [];

export let BAC_SEL = new Set();

export let BAC_VUE = null;

export let BAC_ACHETE = false;


export function discCarte(c){
  const l = discLire(c);
  return `<div class="disc">
    <div class="disc-h"><span class="disc-b">Discogs</span>
      <b>${esc(c.artiste ? c.artiste + " — " : "")}${esc(c.titre)}</b>
      <i>${[c.annee, c.label, c.format].filter(Boolean).map(esc).join(" · ")}</i></div>
    <div class="disc-n">
      <div><b>${c.bas ? c.bas + "€" : "—"}</b><span>moins cher en vente</span></div>
      <div><b>${c.envente}</b><span>exemplaires dispo</span></div>
      <div><b>${c.ont}/${c.veulent}</b><span>l'ont / le veulent</span></div>
    </div>
    ${l.revente ? `<div class="disc-v"><b>${l.prixMax}€ maximum</b>
      <span>pour revendre autour de ${l.revente}€ — un cran sous le moins cher en ligne</span></div>` : ""}
    <div class="disc-l ${l.rcls}">${esc(l.rarete)}</div>
    ${l.demande ? `<div class="disc-d">${esc(l.demande)}</div>` : ""}
    <a class="disc-a" href="${c.url}" target="_blank" rel="noopener">Ouvrir la fiche Discogs</a>
  </div>`;
}


/* Greffée sur la fiche Gemini : elle arrive après coup, sans faire attendre
   l'affichage principal. Si Discogs ne connaît pas l'objet, rien ne s'affiche. */
export async function discGreffe(query, cibleId){
  if(!discToken()) return;
  const el = $(cibleId); if(!el) return;
  el.innerHTML = `<div class="disc-load">Vérification de la cote Discogs…</div>`;
  try{
    const c = await discCote(query);
    const cur = $(cibleId); if(!cur) return;
    cur.innerHTML = c ? discCarte(c) : "";
    /* Le marché réel écrase l'estimation du modèle, et les décotes d'état et de
       complétude s'appliquent par-dessus : c'est ça, le prix de CET exemplaire. */
    if(c && cibleId === 'disc-slot' && FICHE){
      const l = discLire(c);
      if(l.revente && !FICHE.marcheVu){
        FICHE.marcheReel = l.revente;
        FICHE.marcheSrc = "Discogs · " + c.envente + " en vente";
        FICHE.circulation = c.envente > 150 ? "massif" : c.envente > 40 ? "courant"
                          : c.envente > 8 ? "peu courant" : "rare";
        fichePaint();
      }
    }
  }catch(err){
    const cur = $(cibleId); if(!cur) return;
    cur.innerHTML = String(err.message) === "JETON"
      ? `<div class="disc-err">Jeton Discogs refusé — recolle-le dans Réglages.</div>`
      : /Failed to fetch|NetworkError/i.test(String(err.message))
        ? `<div class="disc-err">Discogs injoignable depuis le navigateur.<br>
           <i>Si ça se répète, c'est la restriction CORS : dis-le-moi, on passera par un relais.</i></div>`
        : `<div class="disc-err">${esc(err.message)}</div>`;
  }
}


/* ══════════════════ VÉRIFIER POUR DE VRAI ══════════════════
   Aucune API gratuite ne donne les prix de VENTE : eBay a fermé la sienne,
   Vinted n'en a jamais eu, PriceCharting fait payer la sienne. Un modèle qui
   « a cherché sur le web » produit une phrase, pas une preuve.

   Alors on ne simule pas : on met les vraies recherches à un doigt. Deux
   secondes pour ouvrir les ventes conclues d'eBay avec la bonne requête déjà
   tapée — c'est plus fiable que n'importe quelle estimation, et c'est
   exactement ce que fait un professionnel devant un stand. */
export function verifQuery(f, pref){
  const code = String(f.code || "").trim();
  const obj = String(f.objet || "").replace(/\s+/g, " ").trim();
  /* Une référence alphanumérique (PCSB-00315, AMLH 68348) est bien plus
     discriminante qu'un titre — mais seulement sur les sites qui l'indexent. */
  const refUtile = code.length >= 5 && /\d/.test(code) && /[A-Za-z-]/.test(code);
  if(pref === "ref" && refUtile) return code;
  if(pref === "ref+" && refUtile) return code + " " + obj.slice(0, 40);
  return obj;
}


export const VERIF_SITES = [
  {id:"ebay", nom:"eBay · ventes conclues", note:"le seul vrai prix payé", pref:"ref",
   url: q => "https://www.ebay.fr/sch/i.html?_nkw=" + encodeURIComponent(q) + "&LH_Sold=1&LH_Complete=1&_sop=13"},
  {id:"vinted", nom:"Vinted", note:"prix demandés, pas encore vendus", pref:"obj",
   url: q => "https://www.vinted.fr/catalog?search_text=" + encodeURIComponent(q) + "&order=newest_first"},
  {id:"pc", nom:"PriceCharting", note:"jeux vidéo, cotes par état", pref:"obj",
   url: q => "https://www.pricecharting.com/search-products?q=" + encodeURIComponent(q) + "&type=prices"},
  {id:"lbc", nom:"Leboncoin", note:"le marché local, souvent moins cher", pref:"obj",
   url: q => "https://www.leboncoin.fr/recherche?text=" + encodeURIComponent(q)},
  {id:"goo", nom:"Google", note:"tout le reste", pref:"ref+",
   url: q => "https://www.google.com/search?q=" + encodeURIComponent(q + " prix vendu occasion")}
];


export function verifBloc(f){
  const liens = VERIF_SITES.map(s => {
    const q = verifQuery(f, s.pref);
    return `<a class="vf" href="${s.url(q)}" target="_blank" rel="noopener">
      <b>${s.nom}</b><i>${s.note}</i>
      <em>${esc(q.length > 34 ? q.slice(0, 34) + "…" : q)}</em></a>`;
  }).join("");

  const base = ficheCalc(f).base;
  return `<div class="vf-h">La requête est déjà écrite : un doigt, tu vois les vrais prix.</div>
    <div class="vf-g">${liens}</div>
    <div class="vf-in">
      <label>Prix constaté <i>ce que tu viens de voir, pour un exemplaire en bon état</i></label>
      <div class="vf-row">
        <input id="vf-prix" type="number" inputmode="decimal" placeholder="${base || "—"}"
          value="${f.marcheVu || ""}" onchange="verifSet(this.value)">
        <button onclick="verifSet(document.getElementById('vf-prix').value)">Recalculer</button>
      </div>
      ${f.marcheVu ? `<div class="vf-ok">Prix vérifié par toi : tout le calcul repose dessus.
        <button class="vf-x" onclick="verifSet('')">Revenir à l'estimation</button></div>` : ""}
    </div>`;
}


/* Ce que tu as vu de tes yeux prime sur tout : Discogs, Rebrickable, le modèle. */
export function verifSet(v){
  if(!FICHE) return;
  const n = parseFloat(String(v).replace(",", ".")) || 0;
  FICHE.marcheVu = n > 0 ? n : 0;
  if(FICHE.marcheVu) FICHE.marcheSrc = "vérifié par toi";
  vib();
  fichePaint();
  const bl = $('vf-slot');
  if(bl) bl.innerHTML = verifBloc(FICHE);
}


export function compBloc(comp){
  if(!comp.length) return "";
  return `<div class="cmp">${comp.map(c => {
    const dedans = `${c.prix ? `<b>${c.prix}€</b>` : ""}<span>${esc(c.t)}</span>`;
    return c.url
      ? `<a class="cmp-l" href="${c.url}" target="_blank" rel="noopener">${dedans}<i>voir</i></a>`
      : `<div class="cmp-l muet">${dedans}</div>`;
  }).join("")}</div>
  <div class="cmp-n">Rapporté par l'IA. Ce qui n'a pas de lien n'a pas été vérifié.</div>`;
}


export function legoCarte(c){
  const v = legoValeur(c);
  return `<div class="disc lego">
    <div class="disc-h"><span class="disc-b">Rebrickable</span>
      <b>${esc(c.nom)}</b>
      <i>Set ${esc(c.num)}${c.annee ? " · " + c.annee : ""}</i></div>
    <div class="disc-n">
      <div><b>${c.pieces}</b><span>pièces</span></div>
      <div><b>${c.figs}</b><span>figurines</span></div>
      <div><b>${v.total}€</b><span>complet, sans boîte</span></div>
    </div>
    <div class="disc-l">${c.pieces} × ${v.t.piece.toFixed(2).replace(".", ",")}€ + ${c.figs} × ${v.t.fig}€</div>
    <div class="disc-d">Barème de revendeur, pas une cote : Rebrickable ne publie pas de prix.
      Ajuste-le dans Réglages avec ce que tu encaisses réellement.</div>
    <a class="disc-a" href="https://rebrickable.com/sets/${encodeURIComponent(c.num)}/" target="_blank" rel="noopener">Voir le set</a>
  </div>`;
}


export async function legoGreffe(f, cibleId){
  if(!legoKey()) return;
  const num = legoNumTrouve(f);
  if(!num) return;
  const el = $(cibleId); if(!el) return;
  el.innerHTML = `<div class="disc-load">Recherche du set ${esc(num)} sur Rebrickable…</div>`;
  try{
    const c = await legoSet(num);
    const cur = $(cibleId); if(!cur) return;
    if(!c){ cur.innerHTML = ""; return; }
    cur.innerHTML = legoCarte(c);
    /* Le comptage de pièces devient la référence de calcul : c'est de la donnée,
       pas une estimation. */
    if(FICHE){
      const v = legoValeur(c);
      if(v.total > 0 && !FICHE.marcheVu){
        FICHE.marcheReel = v.total;
        FICHE.marcheSrc = "Rebrickable · " + c.pieces + " pièces, " + c.figs + " figurines";
        fichePaint();
      }
    }
  }catch(err){
    const cur = $(cibleId); if(!cur) return;
    cur.innerHTML = String(err.message) === "CLE"
      ? `<div class="disc-err">Clé Rebrickable refusée — recolle-la dans Réglages.</div>` : "";
  }
}


export function brickCarte(c){
  return `<div class="disc lego">
    <div class="disc-h"><span class="disc-b">Brickset</span>
      <b>${esc(c.nom)}</b>
      <i>Set ${esc(c.num)}${c.annee ? " · " + c.annee : ""}</i></div>
    <div class="disc-n">
      <div><b>${c.pieces}</b><span>pièces</span></div>
      <div><b>${c.figs}</b><span>figurines</span></div>
      <div><b>${c.prixNeuf ? c.prixNeuf + "€" : "—"}</b><span>${c.prixNeuf ? "neuf (" + c.prixDev + ")" : "prix neuf"}</span></div>
    </div>
    <div class="disc-d">Prix neuf officiel LEGO à la sortie du set, pas une cote d'occasion :
      sert de plafond de référence, pas de prix de revente.</div>
    <a class="disc-a" href="${c.url}" target="_blank" rel="noopener">Voir le set</a>
  </div>`;
}


/* On ne cherche un set que si l'objet en est manifestement un, et seulement
   si Rebrickable n'a rien à montrer — voir la note en tête de section. */
export async function brickGreffe(f, cibleId){
  if(!brickKey() || legoKey()) return;
  const num = legoNumTrouve(f);
  if(!num) return;
  const el = $(cibleId); if(!el) return;
  el.innerHTML = `<div class="disc-load">Recherche du set ${esc(num)} sur Brickset…</div>`;
  try{
    const c = await brickSet(num);
    const cur = $(cibleId); if(!cur) return;
    if(!c){ cur.innerHTML = ""; return; }
    cur.innerHTML = brickCarte(c);
    if(FICHE && (c.pieces || c.figs) && !FICHE.marcheVu && !FICHE.marcheReel){
      const t = legoTarifs();
      const total = Math.round(c.pieces * t.piece + c.figs * t.fig);
      if(total > 0){
        FICHE.marcheReel = total;
        FICHE.marcheSrc = "Brickset · " + c.pieces + " pièces, " + c.figs + " figurines";
        fichePaint();
      }
    }
  }catch(err){
    const cur = $(cibleId); if(!cur) return;
    cur.innerHTML = String(err.message) === "CLE"
      ? `<div class="disc-err">Clé Brickset refusée — recolle-la dans Réglages.</div>` : "";
  }
}


/* ══════════ LECTURE VISUELLE ══════════
   Tout est en SVG écrit à la main : rien à télécharger, rien à initialiser,
   ça s'affiche instantanément et fonctionne sans réseau. */

/* Jauge de prix — l'élément le plus utile de l'app.
   Une seule réglette : où tombe le prix demandé par rapport à ton plafond
   et à la revente. Zone verte = tu gagnes, rouge = tu perds. */
export function priceGauge(demande, prixMax, revente, lo, hi){
  const mx = Number(prixMax)||0, rv = Number(revente)||0, d = Number(demande)||0;
  if(!mx && !rv) return "";
  const haut = Math.max(rv, d, mx) * 1.15 || 10;
  const pc = v => Math.max(0, Math.min(100, (v / haut) * 100));

  const pMax = pc(mx), pRev = pc(rv), pD = pc(d);
  /* L'étiquette se recentre pour ne jamais sortir de l'écran,
     alors que le trait reste à sa position exacte. */
  const lab = x => Math.max(16, Math.min(84, x));

  const bande = (lo && hi && hi > lo)
    ? `<i class="g-band" style="left:${pc(lo)}%;width:${Math.max(1.5, pc(hi)-pc(lo))}%"></i>` : "";

  return `<div class="gauge">
    <div class="g-top">
      <span class="g-gold" style="left:${lab(pMax)}%">Ton max ${mx}€</span>
      ${rv ? `<span class="g-right">Revente ${rv}€</span>` : ""}
    </div>
    <div class="g-bar">
      <i class="g-z go" style="width:${pMax}%"></i>
      <i class="g-z mid" style="width:${Math.max(0,pRev-pMax)}%"></i>
      <i class="g-z stop" style="width:${Math.max(0,100-pRev)}%"></i>
      ${bande}
      <i class="g-max" style="left:${pMax}%"></i>
      ${d ? `<i class="g-cur" style="left:${pD}%"></i>` : ""}
    </div>
    <div class="g-bot">
      ${d ? `<span class="g-strong" style="left:${lab(pD)}%">Il demande ${d}€</span>` : ""}
    </div>
    <div class="g-key">
      <span><i class="go"></i>Tu gagnes</span>
      <span><i class="mid"></i>Marge faible</span>
      <span><i class="stop"></i>Tu perds</span>
    </div>
  </div>`;
}


/* Barre de répartition d'un bac : proportions lisibles sans compter. */
export function bacBar(n){
  const tot = n.R + n.N + n.D + n.L;
  if(!tot) return "";
  const seg = (v, cls, lbl) => v
    ? `<div class="bb-s ${cls}" style="flex:${v}" title="${lbl}">${v}</div>` : "";
  return `<div class="bacbar">
    <div class="bb">${seg(n.R,"R","À prendre")}${seg(n.N,"N","À négocier")}${seg(n.D,"D","Déjà")}${seg(n.L,"L","Laisse")}</div>
    <div class="bb-k">
      ${n.R?`<span><i class="R"></i>${n.R} à prendre</span>`:""}
      ${n.N?`<span><i class="N"></i>${n.N} à négocier</span>`:""}
      ${n.D?`<span><i class="D"></i>${n.D} déjà</span>`:""}
      ${n.L?`<span><i class="L"></i>${n.L} laisse</span>`:""}
    </div>
  </div>`;
}


/* ══════════ CONTRE-OFFRE ══════════ */
/* Trois chiffres seulement : ce que tu annonces, ton plafond, quand tu poses. */
export function negoPad(demande, prixMax){
  const d = Number(demande) || 0, mx = Number(prixMax) || 0;
  if(!d && !mx) return "";
  const plaf = mx || Math.round(d * 0.7);
  /* L'ouverture ne dépasse jamais le plafond : annoncer plus haut que son
     propre maximum n'a aucun sens, même quand le vendeur demande beaucoup. */
  const ouvre = Math.max(1, Math.min(Math.round(d * 0.55) || plaf, Math.round(plaf * 0.8)));

  let etat = "", cls = "";
  if(d && plaf){
    if(d <= plaf){ etat = `Déjà sous ton plafond. Tente ${ouvre}€, paye jusqu'à ${d}€.`; cls = "ok"; }
    else if(d <= plaf * 1.6){ etat = `${d - plaf}€ de trop. Négociable.`; cls = "warn"; }
    else { etat = `${d - plaf}€ de trop. Trop loin — repère-le et reviens au remballage.`; cls = "ko"; }
  }
  return `<div class="nego">
    <div class="nego-h"><svg class="ico16"><use href="#i-tag"/></svg>Contre-offre</div>
    <div class="nego-g">
      <div class="ng"><b>${ouvre}€</b><span>Tu annonces</span></div>
      <div class="ng"><b>${plaf}€</b><span>Tu ne dépasses pas</span></div>
      ${d ? `<div class="ng ${cls === "ok" ? "good" : "stop"}"><b>${d}€</b><span>Il demande</span></div>` : ""}
    </div>
    ${etat ? `<div class="nego-v"><span class="${cls}">${etat}</span></div>` : ""}
  </div>`;
}

export let LAST = null;
