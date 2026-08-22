import { legoKey, legoCacheGet, legoCacheSet, legoTarifs } from "../storage/local.js";

export const LEGO_API   = "https://rebrickable.com/api/v3/lego";


export let LEGO_LAST = 0;

export async function legoGet(chemin, params){
  const k = legoKey();
  if(!k) throw new Error("Aucune clé Rebrickable");
  if(!navigator.onLine) throw new Error("Hors réseau");
  const attente = 900 - (Date.now() - LEGO_LAST);
  if(attente > 0) await new Promise(r => setTimeout(r, attente));
  LEGO_LAST = Date.now();
  const q = new URLSearchParams({...(params || {}), key: k});
  const r = await fetch(LEGO_API + chemin + "?" + q.toString());
  if(r.status === 401 || r.status === 403) throw new Error("CLE");
  if(r.status === 404) return null;
  if(r.status === 429) throw new Error("Trop de requêtes — attends une minute");
  if(!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}


/* Rebrickable numérote « 75192-1 » : le suffixe est la version du set. */
export function legoNum(n){
  const t = String(n || "").trim();
  return /-\d+$/.test(t) ? t : t + "-1";
}


export async function legoSet(num){
  const cle = "l:" + legoNum(num);
  const cache = legoCacheGet(cle);
  if(cache !== null) return cache;

  const s = await legoGet("/sets/" + legoNum(num) + "/");
  if(!s || !s.set_num){ legoCacheSet(cle, false); return false; }

  /* Les figurines pèsent lourd dans le prix d'un set d'occasion : on va les
     compter plutôt que de les deviner. */
  let figs = 0;
  try{
    const m = await legoGet("/sets/" + legoNum(num) + "/minifigs/", {page_size: 100});
    if(m && Array.isArray(m.results)) figs = m.results.reduce((t, x) => t + (Number(x.quantity) || 1), 0);
  }catch(e){}

  const cote = {
    num: s.set_num, nom: s.name || "", annee: s.year || "",
    pieces: Number(s.num_parts) || 0, figs,
    img: s.set_img_url || ""
  };
  legoCacheSet(cle, cote);
  return cote;
}


/* La conversion en euros. Elle est affichée en toutes lettres : c'est une
   règle de pouce, pas une cote de marché, et elle doit pouvoir être contestée. */
export function legoValeur(c){
  const t = legoTarifs();
  const parts = c.pieces * t.piece;
  const figs = c.figs * t.fig;
  return {parts, figs, total: Math.round(parts + figs), t};
}


/* On ne cherche un set que si l'objet en est manifestement un. */
export function legoNumTrouve(f){
  const txt = ((f.objet || "") + " " + (f.categorie || "") + " " + (f.identification || ""));
  if(!/lego/i.test(txt)) return null;
  const src = (f.code || "") + " " + txt;
  const m = src.match(/\b(\d{4,7})(?:-\d+)?\b/);
  return m ? m[1] : null;
}
