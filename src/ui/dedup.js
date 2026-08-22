import { esc, collTokens, collScore } from "../util/text.js";
import { collRead } from "../storage/local.js";

export function collMatch(query){
  const coll = collRead();
  if(!coll.length) return null;
  const qt = collTokens(query);
  if(qt.length < 2) return null;
  const qs = new Set(qt);

  let best = null;
  for(const e of coll){
    const at = collTokens(e.a || "");
    const tt = collTokens(e.t || "");

    /* Le titre doit apparaître, sinon « Alain Souchon Rame » déclencherait
       une alerte sur « Alain Souchon — Jamais content ». */
    let tHit = 0; tt.forEach(w => { if(qs.has(w)) tHit++; });
    if(tt.length && !tHit) continue;

    const aSc = at.length ? collScore(qt, at) : 0;
    const tSc = tt.length ? collScore(qt, tt) : 0;
    const sc  = tt.length ? (0.35 * aSc + 0.65 * tSc) : aSc;
    const couvert = tt.length ? (tHit / tt.length) : 0;

    if(!best || sc > best.sc) best = {sc, e, couvert, aSc};
  }
  if(!best || best.sc < 0.40) return null;

  /* Certain = titre entièrement retrouvé ET artiste concordant — mais un
     album éponyme (« Bruel » de Patrick Bruel) ne peut pas être confirmé
     par le seul nom de l'artiste : il faut un mot propre au titre. */
  const at = collTokens(best.e.a || "");
  const tt = collTokens(best.e.t || "");
  const propre = tt.some(w => !at.includes(w) && qs.has(w));
  best.sur = best.couvert >= 0.99 && best.aSc >= 0.4 && (propre || !tt.length);
  if(!propre && tt.length && tt.every(w => at.includes(w))) return null;
  return best;
}


/* Niveau artiste : sur un stand on tape d'abord un nom, pas un titre.
   « Patrick Bruel » ne prouve aucun doublon, mais savoir lesquels tu as
   déjà est justement ce qui permet de décider, pouce sur le bac. */
export function collArtist(query){
  const coll = collRead();
  if(!coll.length) return null;
  const qs = new Set(collTokens(query));
  if(!qs.size) return null;

  const groupes = {};
  for(const e of coll){
    const at = collTokens(e.a || "");
    if(!at.length) continue;
    /* Tous les mots de l'artiste doivent être dans la recherche.
       Un artiste en un seul mot doit être assez long pour ne pas
       déclencher sur n'importe quoi. */
    if(at.length === 1 && at[0].length < 4) continue;
    if(!at.every(w => qs.has(w))) continue;
    const k = at.join(" ");
    (groupes[k] = groupes[k] || {nom: e.a, kind: e.k, titres: []}).titres.push(e.t || "—");
  }
  const cles = Object.keys(groupes);
  if(!cles.length) return null;
  cles.sort((a,b) => groupes[b].titres.length - groupes[a].titres.length);
  return groupes[cles[0]];
}


export function collBanner(query){
  const m = collMatch(query);
  if(m){
    const cls = m.sur ? "dup-sure" : "dup-maybe";
    const quoi = m.e.k === "jeux" ? "CE JEU" : "CE DISQUE";
    const titre = m.sur ? ("TU AS DÉJÀ " + quoi) : "PEUT-ÊTRE UN DOUBLON";
    return `<div class="dupbox ${cls}">
      <div class="dt">${titre}</div>
      <div class="dd">${esc(m.e.a || "")} — ${esc(m.e.t || "")}</div>
      ${m.sur ? "" : `<div class="dn">Correspondance partielle : vérifie l'édition avant de renoncer.</div>`}
    </div>`;
  }

  const g = collArtist(query);
  if(g){
    const n = g.titres.length;
    const mot = g.kind === "jeux"
      ? (n > 1 ? "jeux sur cette console" : "jeu sur cette console")
      : (n > 1 ? "disques de cet artiste" : "disque de cet artiste");
    const liste = g.titres.slice(0, 8).map(t => `<li>${esc(t)}</li>`).join("");
    const reste = n > 8 ? `<li class="plus">et ${n - 8} autre${n - 8 > 1 ? "s" : ""}…</li>` : "";
    return `<div class="dupbox dup-artist">
      <div class="dt">${n} ${mot}</div>
      <div class="dd">${esc(g.nom)}</div>
      <ul class="dup-list">${liste}${reste}</ul>
      <div class="dn">Pas de doublon détecté sur ce titre précis — ajoute-le à ta recherche pour en être sûr.</div>
    </div>`;
  }
  return "";
}
