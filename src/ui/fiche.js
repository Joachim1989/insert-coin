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
import { t } from "../i18n/index.js";

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
    if(r) r.textContent = c.net ? t("fiche.revente_nette", {n: c.net}) : t("fiche.marche_inconnu");
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
    <b>${t("fiche.prix_verifier.titre")}</b>
    <span>${t("fiche.prix_verifier.texte")}</span>
    <div class="vf-g vf-court">${VERIF_SITES.slice(0, 3).map(x => {
      const q = verifQuery(f, x.pref);
      return `<a class="vf" href="${x.url(q)}" target="_blank" rel="noopener"><b>${x.nom}</b><i>${x.note}</i></a>`;
    }).join("")}</div>
    <div class="vf-row">
      <input id="vf-prix-h" type="number" inputmode="decimal" placeholder="${t("fiche.prix_constate_placeholder")}"
        onchange="verifSet(this.value)">
      <button onclick="verifSet(document.getElementById('vf-prix-h').value)">${t("fiche.recalculer")}</button>
    </div>
  </div>`;
  if(!c.plafond) return `<div class="acte-plat"><b>${t("fiche.passe_ton_chemin.titre")}</b>
    <span>${t("fiche.passe_ton_chemin.texte")}</span></div>`;

  const incertain = f.attendu.filter(x => x.vu === "?");
  const absent = attManquants(f.attendu);
  let alerte = "";
  if(incertain.length) alerte = t("fiche.verifie_dabord", {items: incertain.slice(0,2).map(x => x.n).join(", ")});

  /* Sur un lot, un chiffre nu est ambigu : 1 € la figurine ou 1 € le tas ?
     On le dit, et on donne le prix unitaire pour pouvoir négocier au détail. */
  const pour = f.lot ? (f.lotNb ? t("fiche.pour_lot_n", {n: f.lotNb}) : t("fiche.pour_lot")) : "";
  const unite = (f.lot && f.lotNb > 1)
    ? t("fiche.soit_prix_piece", {prix: (c.plafond / f.lotNb).toFixed(2).replace(".", ",")})
    : "";

  let phrase, cls = "oui";
  if(dem && dem <= c.ouverture){ phrase = t("fiche.demande_ne_negocie", {dem}); }
  else if(dem && dem > c.plafond){ phrase = t("fiche.demande_repose", {dem}); cls = "non"; }
  else if(dem){ phrase = t("fiche.propose_monter", {ouv: c.ouverture, plaf: c.plafond, pour}); }
  else { phrase = t("fiche.propose_ne_depasse", {ouv: c.ouverture, plaf: c.plafond, pour}); }

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
  l.push(`<b>${c.base}€</b> — ${f.marcheVu ? t("fiche.prix_tu_as_constate") : t("fiche.ce_qui_se_vend_bon_etat")}${f.marcheSrc ? " (" + esc(f.marcheSrc) + ")" : ""}${f.lot && f.lotNb ? t("fiche.lot_entier_suffix") : ""}`);
  if(c.ce > 1) l.push(`<b>+${Math.round((c.ce - 1) * 100)}%</b> — ${esc(t("fiche.meilleur_etat_courant", {etat: ETAT_LBL[f.etat].toLowerCase()}))}`);
  else if(c.ce < 1) l.push(`<b>−${Math.round((1 - c.ce) * 100)}%</b> — ${esc(t("fiche.etat_x", {etat: ETAT_LBL[f.etat].toLowerCase()}))}`);
  absent.forEach(x => l.push(`<b>−${x.perte}%</b> — ${esc(t("fiche.manque", {nom: x.n}))}`));
  if(c.port) l.push(`<b>−${c.port}€</b> — ${t("fiche.cout_envoi")}`);
  l.push(`= <b>${c.net}€</b> ${t("fiche.dans_poche_revente")}`);
  l.push(`<b>÷3</b> — ${t("fiche.regle_tiers")}`);
  return `<details class="pq"><summary>${esc(t("fiche.pourquoi_plafond", {plafond: c.plafond}))}</summary>
    <ol>${l.map(x => `<li>${x}</li>`).join("")}</ol></details>`;
}


export function ficheReglages(f, c){
  const b = (n) => `<button class="et${f.etat === n ? " on" : ""}" onclick="ficheEtatSet(${n})">
    <b>${n}</b><span>${ETAT_LBL[n]}</span></button>`;
  return `
    <div class="reg" id="fiche-reglages">
      <div class="reg-t">${t("fiche.etat_reel.titre")} <i>${f.echelle ? esc(f.echelle) : t("fiche.etat_reel.que_tu_constates")} ${t("fiche.etat_reel.note3")}</i></div>
      <div class="reg-et">${[5,4,3,2,1].map(b).join("")}</div>
      ${f.etatDit ? `<div class="reg-dit">${esc(t("fiche.vu_photo", {texte: f.etatDit}))}</div>` : ""}
    </div>`;
}


export function fichePrix(f, c, dem){
  if(!c.base) return `<div class="px-vide">${t("fiche.px.aucun_marche")}</div>`;
  const ligne = (cls, lbl, val, aide) =>
    `<div class="px ${cls}"><div class="px-l">${lbl}</div><div class="px-v">${val}€</div><div class="px-a">${aide}</div></div>`;
  const grille = c.echelonne
    ? `<div class="px-grid">
        ${ligne("o", t("fiche.px.tu_annonces"), c.ouverture, t("fiche.px.premier_chiffre"))}
        ${ligne("c", t("fiche.px.tu_vises"), c.cible, t("fiche.px.accord_normal"))}
        ${ligne("p", t("fiche.px.tu_te_leves"), c.plafond, t("fiche.px.au_dela_tu_perds"))}
      </div>`
    : `<div class="px-petit">
        <b>${c.plafond ? esc(t("fiche.px.plafond_max", {plafond: c.plafond})) : t("fiche.px.seulement_donne")}</b>
        <span>${c.plafond
          ? esc(t("fiche.px.rien_a_negocier", {ouv: c.ouverture, plaf: c.plafond}))
          : t("fiche.px.marge_insuffisante")}</span>
      </div>`;
  return `
    ${grille}
    <div class="px-calc">
      <b>${c.base}€</b> ${t("fiche.px.le_marche")}${f.marcheSrc ? " (" + esc(f.marcheSrc) + ")" : ""}
      · <b>×${c.ce}</b> ${t("fiche.px.etat_court")} · <b>×${c.cc}</b> ${t("fiche.px.completude")}
      ${c.port ? ` · <b>−${c.port}€</b> ${t("fiche.px.de_volume")}` : ""}
      → <b>${c.net}€</b> ${t("fiche.px.nets_pour_toi")}${f.lot && f.lotNb > 1 ? esc(t("fiche.px.le_lot_de", {n: f.lotNb})) : ""}
    </div>
    ${dem ? `<div class="px-dem">${esc(dem <= c.cible
      ? t("fiche.px.dem_sous_cible", {dem})
      : dem <= c.plafond
        ? t("fiche.px.dem_negociable", {dem, plaf: c.plafond})
        : t("fiche.px.dem_repose", {dem, plaf: c.plafond}))}</div>` : ""}`;
}


/* Cles i18n, pas le texte lui-meme : comme MODE_DIT/MODE_BTN
   (capture.js), un objet litteral evalue une seule fois a l'import
   aurait fige la langue active au chargement du module. t() est appele
   au moment de l'usage, dans ficheCorps(). */
export const CIRC_MOT = {rare:["fiche.circ.rare","r"], "peu courant":["fiche.circ.peu_courant","r"],
                  courant:["fiche.circ.courant","c"], massif:["fiche.circ.massif","c"]};


export function ficheCorps(f){
  const ci = CIRC_MOT[f.circulation];
  /* Un seul bloc ouvert : le reste attend. Sur un stand, on lit trois lignes,
     on parle, et on ne fait défiler que si quelque chose cloche. */
  const bloc = (id, titre, corps, ouvert) => corps
    ? `<details class="bl"${ouvert ? " open" : ""}><summary>${titre}</summary><div class="bl-in">${corps}</div></details>`
    : "";

  const listes = (arr) => arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

  return `
    ${bloc("ck", t("fiche.corps.doit_etre_la") + (f.attendu.length ? ` <i>${f.attendu.length}</i>` : ""),
      f.attendu.length
        ? `<div class="fi-ck">${f.attendu.map((x,i) =>
            `<label class="v-${x.vu === "oui" ? "o" : x.vu === "non" ? "n" : "q"}">
              <input type="checkbox"${x.vu === "oui" ? " checked" : ""} onchange="ficheCoche(${i}, this.checked)">
              <span>${esc(x.n)}
                ${x.vu === "non" ? `<i>${esc(t("fiche.absent_valeur", {perte: x.perte}))}</i>`
                : x.vu === "?" ? `<i>${esc(t("fiche.non_visible", {perte: x.perte}))}</i>`
                : `<i>${t("fiche.present")}</i>`}</span></label>`).join("")}</div>
           <div class="fi-ck-n" id="fiche-ck-n">${attResume(f.attendu)}</div>
           ${f.impactComplet ? `<div class="fi-imp">${esc(f.impactComplet)}</div>` : ""}`
        : "", true)}

    ${bloc("vf", t("fiche.corps.verifier_prix"),
      `<div id="vf-slot">${verifBloc(f)}</div>${compBloc(f.comparables)}`, !ficheCalc(f).base)}

    ${bloc("dg", t("fiche.corps.couter_cher") + (f.pieges.length ? ` <i>${f.pieges.length}</i>` : ""),
      listes(f.pieges) + listes(f.verifs), f.pieges.length > 0)}

    ${bloc("et", t("fiche.corps.etat_photo_menti"), ficheReglages(f, ficheCalc(f)), false)}

    ${bloc("id", t("fiche.corps.identification"),
      (f.code ? `<div class="fi-code">${esc(f.code)}</div>
                 <button class="fi-cp" onclick="ficheCopieCode()">${t("fiche.corps.copier_reference")}</button>`
              : `<div class="fi-vide">${f.codeOu ? esc(f.codeOu) : t("fiche.corps.aucune_reference")}</div>`)
      + (f.identification ? `<div class="ident">${esc(f.identification)}</div>` : "")
      + (ci ? `<div class="fi-circ ${ci[1]}">${t(ci[0])}</div>` : "")
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
  if(!arg) arg = t("fiche.titre_tres_courant");
  if(!/[.!?]$/.test(arg)) arg += ".";
  return c.plafond ? arg + t("fiche.je_ten_donne", {ouv: c.ouverture}) : arg;
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
    if(it) it.textContent = coche ? t("fiche.present") : t("fiche.absent_valeur", {perte: FICHE.attendu[i].perte});
  }
  const el = $('fiche-ck-n');
  if(el) el.textContent = attResume(FICHE.attendu);
  vib(); fichePaint();
}


export function ficheCopieCode(){
  if(!FICHE || !FICHE.code) return;
  const code = FICHE.code;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(() => { vib(); alert(t("fiche.reference_copiee", {code})); });
  } else prompt(t("fiche.copie_reference_prompt"), code);
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
    f.marcheSrc = t("fiche.ta_vente_reelle") + (cote.d ? " · " + new Date(cote.d).toLocaleDateString('fr-BE') : "");
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
  const cTxt = t({h:"fiche.cote.verifiee", m:"fiche.cote.confiante", f:"fiche.cote.estimation"}[cKey]);

  const imgHtml = (images && images.length)
    ? `<div class="aithumb-container">` + images.map(im => `<img src="${im.url}" class="aithumb">`).join('') + `</div>`
    : "";

  const rq = (f.objet || "") + " " + (f.identification || "");
  const dupHtml = collBanner(rq);

  $('ai-results').innerHTML = dupHtml + `
    <div class="aicard">
      ${imgHtml}
      <div class="aihead ${vd.v}" id="fiche-head">
        <div class="p"><div class="num">${c.plafond ? c.plafond + "€" : "—"}</div><div class="cap">${t("fiche.ton_max")}</div></div>
        <div class="t">
          <div class="v">${vd.t}</div>
          <div class="o">${esc(f.objet)}</div>
          <div class="r">${c.net ? esc(t("fiche.revente_nette", {n: c.net})) : t("fiche.marche_inconnu")}</div>
        </div>
      </div>
      ${f.pieges.length ? `<div class="piege-top">⚠ <b>${esc(f.pieges[0])}</b>${f.pieges.length > 1
        ? `<span>${f.pieges.length > 2 ? esc(t("fiche.pieges_plus_plusieurs", {n: f.pieges.length - 1})) : t("fiche.pieges_plus_un")}</span>` : ""}</div>` : ""}
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
        <input id="log-dem" type="number" inputmode="decimal" placeholder="${t("fiche.demande_placeholder")}"
          title="${t("fiche.demande_title")}">
        <input id="log-price" type="number" inputmode="decimal" placeholder="${t("fiche.paye_placeholder")}">
        <button class="act act-buy" onclick="logFind()">
          <svg class="ico16"><use href="#i-cash"/></svg>${t("fiche.je_lachete")}</button>
      </div>
      <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">${t("fiche.fermer")}</button>
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


/* Correctif du 23/08/2026 (voir docs/diagnostic-cotation.md, "Un stand
   est un cul-de-sac") : c'était le seul écran de l'app à afficher un
   montant en euros hors du pipeline ficheCalc — une revente brute, jamais
   décotée (état, complétude, port, circulation), jamais croisée avec le
   journal ou la collection. Tranché : on garde le repérage rapide, on
   retire les montants. Extraite pure (aucun accès DOM) pour être testable
   sans navigateur — testée dans tests/fiche-stand.test.js. */
export function standItemsHtml(reperes){
  if(!reperes || !reperes.length) return "<li>Rien de très évident à première vue.</li>";
  return reperes.map(obj => `
    <li style="margin-bottom:10px;">
      <b style="color:var(--gold)">${esc(obj.nom || "Objet non nommé")}</b><br>
      ${obj.interet ? `<span style="font-size:12px; color:var(--text-muted)">${esc(obj.interet)}</span>` : ""}
      ${obj.verifsStand ? `<br><i style="font-size:11px; color:#ff9800;">Verif: ${esc(obj.verifsStand)}</i>` : ''}
    </li>`).join('');
}


export function renderStandResult(j, image, avis) {
  /* Le mode Stand est celui où le JSON revient le plus souvent amputé :
     aucune clé n'est supposée présente. */
  const vg = String(j.verdictGlobal || "");
  const v = vg.toLowerCase().includes('fouill') ? 'S' : 'L';
  
  const reperes = Array.isArray(j.objetsReperes) ? j.objetsReperes.filter(Boolean) : [];
  const itemsHtml = standItemsHtml(reperes);

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
      <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">${t("analyse.fermer")}</button>
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
      <div class="bac-v">${r.dup ? t("bac.deja_badge") : cls}</div>
      <div class="bac-tick">${coche ? "☑" : "☐"}</div>
      <div class="bac-c">
        <div class="bac-n">${esc(o.nom || "—")}</div>
        <div class="bac-a">${esc(o.artiste || "")}${o.annee ? " · " + esc(o.annee) : ""}</div>
        ${r.flou ? `<div class="bac-warn">${esc(t("bac.ressemble", {titre: r.flou.e.t}))}</div>` : ""}
        ${o.note ? `<div class="bac-note">${esc(o.note)}</div>` : ""}
        ${!r.dup && discToken() && discMusique((o.artiste||"") + " " + (o.nom||""))
          ? `<button class="bac-disc" onclick="event.stopPropagation();bacDisc(${idx})">${t("bac.cote_discogs")}</button>
             <div id="disc-bac-${idx}"></div>` : ""}
      </div>
      <div class="bac-p">
        ${r.dup ? `<span class="bac-dup">${t("bac.en_collection")}</span>`
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
        <div class="p"><div class="num">${lot.length}</div><div class="cap">${t("bac.lus")}</div></div>
        <div class="t">
          <div class="v">${t("bac.mode_bac")}${j.typeBac ? " · " + esc(j.typeBac).toUpperCase() : ""}</div>
          <div class="o">${esc(t("bac.n_a_prendre", {n: pris.length}))}${doub.length ? esc(t("bac.deja_chez_toi", {n: doub.length})) : ""}</div>
          ${valeur ? `<div class="r">${esc(t("bac.valeur_a_prendre", {n: valeur}))}</div>` : ""}
        </div>
      </div>
      ${avis ? `<div class="avis">⚠︎ ${esc(avis)}</div>` : ""}
      <div class="aibody">
        ${bacBar({R:pris.length, N:nego.length, D:doub.length, L:laisse.length})}
        ${j.resume ? `<div class="saywrap">${esc(j.resume)}</div>` : ""}
        ${bloc(t("bac.section.prendre"), pris)}
        ${bloc(t("bac.section.negocier"), nego, t("bac.section.negocier_sub"))}
        ${bloc(t("bac.section.deja"), doub, t("bac.section.deja_sub"))}
        ${bloc(t("bac.section.laisse"), laisse)}
        ${!lot.length ? `<div class="empty-state"><svg class="ico-big"><use href="#i-crate"/></svg>
          <b>${t("bac.vide.titre")}</b><p>${t("bac.vide.sub")}</p></div>` : ""}
      </div>
      ${lot.length ? bacCart() : ""}
      <button class="dismiss" onclick="document.getElementById('ai-results').innerHTML=''">${t("analyse.fermer")}</button>
    </div>`;
}


/* Le panier : ce que tu emportes réellement du bac, et à quel prix.
   Sans lui, un lot négocié en bloc devait être ressaisi pièce par pièce. */
export function bacCart(){
  if(BAC_ACHETE){
    return `<div class="bac-cart done"><div class="bc-t">
      <b>${t("bac.cart.enregistre")}</b>
      <span>${t("bac.cart.journal_maj")}</span></div></div>`;
  }
  const sel = [...BAC_SEL].map(i => BAC_ROWS[i]).filter(Boolean);
  const val = sel.reduce((s,r) => s + (Number(r.o.revente)||0), 0);
  const max = sel.reduce((s,r) => s + (Number(r.o.prixMax)||0), 0);
  return `<div class="bac-cart">
    <div class="bc-t">
      <b>${esc(t(sel.length > 1 ? "bac.cart.resume_plusieurs" : "bac.cart.resume_un", {n: sel.length, val}))}</b>
      <span>${sel.length ? esc(t("bac.cart.ne_depasse_pas", {max})) : t("bac.cart.coche")}</span>
    </div>
    <button class="${sel.length ? "" : "off"}" onclick="bacBuy()">${t("bac.cart.jai_achete")}</button>
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
  if(!sel.length){ alert(t("bac.buy.coche_dabord")); return; }

  const tot = parseFloat(prompt(
    t(sel.length > 1 ? "bac.buy.prompt_paye_plusieurs" : "bac.buy.prompt_paye_un", {n: sel.length}), "") || "");
  if(isNaN(tot) || tot < 0) return;

  /* Correctif du 23/08/2026 (voir docs/diagnostic-cotation.md) : avant, rien
     ne demandait le prix annoncé par le vendeur avant négociation sur un
     achat de lot — dem valait toujours 0, donc negoStats() (src/ui/log.js)
     excluait silencieusement TOUS les achats de lot de tes statistiques de
     négociation, y compris la négociation groupée que l'app recommande
     elle-même en premier conseil. Facultatif, comme sur un achat simple :
     laisse vide si tu ne sais plus ce qui était demandé. */
  const totDem = parseFloat(prompt(
    t(sel.length > 1 ? "bac.buy.prompt_demande_plusieurs" : "bac.buy.prompt_demande_un", {n: sel.length}), "") || "");

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
    /* Le budget de temps de discGet() (10s, voir src/util/fetchTimeout.js)
       produit une AbortError distincte d'une vraie panne CORS — les
       confondre sous le même message CORS aurait été trompeur (correctif
       du 23/08/2026, voir docs/diagnostic-cotation.md). */
    cur.innerHTML = String(err.message) === "JETON"
      ? `<div class="disc-err">Jeton Discogs refusé — recolle-le dans Réglages.</div>`
      : /AbortError|aborted/i.test(String(err.name || err.message))
        ? `<div class="disc-err">Discogs n'a pas répondu à temps (réseau lent). Réessaie.</div>`
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
  /* Correctif du 23/08/2026 : figsConnu:false (coupure réseau sur le
     comptage des minifigs) ne doit jamais ressembler à "0 figurine
     confirmée" — voir legoSet()/legoValeur() (src/api/rebrickable.js). */
  const figsTxt = v.figsConnu ? String(c.figs) : "inconnu";
  const totalTxt = v.figsConnu ? `${v.total}€` : `au moins ${v.total}€`;
  const ligneDetail = v.figsConnu
    ? `${c.pieces} × ${v.t.piece.toFixed(2).replace(".", ",")}€ + ${c.figs} × ${v.t.fig}€`
    : `${c.pieces} × ${v.t.piece.toFixed(2).replace(".", ",")}€ + figurines non comptées (réseau)`;
  return `<div class="disc lego">
    <div class="disc-h"><span class="disc-b">Rebrickable</span>
      <b>${esc(c.nom)}</b>
      <i>Set ${esc(c.num)}${c.annee ? " · " + c.annee : ""}</i></div>
    <div class="disc-n">
      <div><b>${c.pieces}</b><span>pièces</span></div>
      <div><b>${figsTxt}</b><span>figurines</span></div>
      <div><b>${totalTxt}</b><span>complet, sans boîte</span></div>
    </div>
    <div class="disc-l">${ligneDetail}</div>
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
        /* Même correctif que legoCarte() : ne pas afficher "0 figurine"
           comme si c'était confirmé quand c'est en fait inconnu. */
        FICHE.marcheSrc = "Rebrickable · " + c.pieces + " pièces, "
          + (v.figsConnu ? c.figs + " figurines" : "figurines non comptées");
        fichePaint();
      }
    }
  }catch(err){
    const cur = $(cibleId); if(!cur) return;
    /* Alignée sur discGreffe() (correctif du 23/08/2026, voir
       docs/diagnostic-cotation.md) : "CLE" gardait déjà son message, mais
       toute autre cause (panne réseau, timeout, HTTP 500...) retombait sur
       une carte vide — le même écran qu'un "rien trouvé" légitime. */
    cur.innerHTML = String(err.message) === "CLE"
      ? `<div class="disc-err">Clé Rebrickable refusée — recolle-la dans Réglages.</div>`
      : /Failed to fetch|NetworkError|AbortError|aborted/i.test(String(err.message))
        ? `<div class="disc-err">Rebrickable injoignable (réseau).</div>`
        : `<div class="disc-err">${esc(err.message)}</div>`;
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
    /* Alignée sur discGreffe() (correctif du 23/08/2026). */
    cur.innerHTML = String(err.message) === "CLE"
      ? `<div class="disc-err">Clé Brickset refusée — recolle-la dans Réglages.</div>`
      : /Failed to fetch|NetworkError|AbortError|aborted/i.test(String(err.message))
        ? `<div class="disc-err">Brickset injoignable (réseau).</div>`
        : `<div class="disc-err">${esc(err.message)}</div>`;
  }
}


/* ══════════ LECTURE VISUELLE ══════════
   Tout est en SVG écrit à la main : rien à télécharger, rien à initialiser,
   ça s'affiche instantanément et fonctionne sans réseau. */

/* Barre de répartition d'un bac : proportions lisibles sans compter. */
export function bacBar(n){
  const tot = n.R + n.N + n.D + n.L;
  if(!tot) return "";
  const seg = (v, cls, lbl) => v
    ? `<div class="bb-s ${cls}" style="flex:${v}" title="${lbl}">${v}</div>` : "";
  return `<div class="bacbar">
    <div class="bb">${seg(n.R,"R",t("bac.section.prendre"))}${seg(n.N,"N",t("bac.section.negocier"))}${seg(n.D,"D",t("bac.section.deja_court"))}${seg(n.L,"L",t("bac.section.laisse"))}</div>
    <div class="bb-k">
      ${n.R?`<span><i class="R"></i>${esc(t("bac.bar.a_prendre", {n: n.R}))}</span>`:""}
      ${n.N?`<span><i class="N"></i>${esc(t("bac.bar.a_negocier", {n: n.N}))}</span>`:""}
      ${n.D?`<span><i class="D"></i>${esc(t("bac.bar.deja", {n: n.D}))}</span>`:""}
      ${n.L?`<span><i class="L"></i>${esc(t("bac.bar.laisse", {n: n.L}))}</span>`:""}
    </div>
  </div>`;
}


export let LAST = null;
