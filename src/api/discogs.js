import { norm, collTokens, collScore } from "../util/text.js";
import { discToken, discCacheGet, discCacheSet } from "../storage/local.js";

export const DISC_API   = "https://api.discogs.com";


/* Discogs autorise 60 requêtes par minute. On espace d'une seconde : on ne se
   fera jamais couper, même en enchaînant les pochettes d'un bac. */
export let DISC_LAST = 0;

export async function discThrottle(){
  const attente = 1100 - (Date.now() - DISC_LAST);
  if(attente > 0) await new Promise(r => setTimeout(r, attente));
  DISC_LAST = Date.now();
}


export async function discGet(chemin, params){
  const t = discToken();
  if(!t) throw new Error("Aucun jeton Discogs");
  if(!navigator.onLine) throw new Error("Hors réseau");
  await discThrottle();
  const q = new URLSearchParams({...(params||{}), token: t});
  const r = await fetch(DISC_API + chemin + "?" + q.toString());
  if(r.status === 401 || r.status === 403) throw new Error("JETON");
  if(r.status === 429) throw new Error("Trop de requêtes — attends une minute");
  if(!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}


/* Discogs répond toujours quelque chose : sans contrôle, « Just Dance 4 Wii »
   tomberait sur une bande originale et donnerait une cote absurde. On exige
   donc un vrai recouvrement de mots entre la demande et le titre trouvé. */
export function discPertinent(query, hit){
  const qt = collTokens(query);
  if(qt.length < 2) return 0;
  return collScore(qt, collTokens((hit.title || "") + " " + (hit.year || "")));
}


/* Discogs ne référence que de la musique. Interroger l'API pour une manette
   Master System, c'est deux requêtes perdues et un risque de faux positif sur
   une bande originale homonyme. */
export const DISC_NON = /(wii|switch|playstation|ps[1-5]\b|xbox|nintendo|gamecube|dreamcast|megadrive|game ?boy|nes\b|snes\b|psp\b|ds\b|cartouche|manette|console|lego|playmobil|funko|figurine|puzzle|pokemon|magic the gathering|yu-?gi-?oh)/i;

export const DISC_OUI = /(vinyle?|vinyl|33 ?tours?|45 ?tours?|lp\b|ep\b|maxi|album|cd\b|pressage|discogs)/i;

export function discMusique(txt){
  const t = String(txt || "");
  if(t.trim().length < 3) return false;
  if(DISC_OUI.test(t)) return true;
  return !DISC_NON.test(t);
}


export async function discCote(query){
  const cle = "d:" + norm(query).slice(0, 80);
  const cache = discCacheGet(cle);
  if(cache !== null) return cache;

  const s = await discGet("/database/search", {q: query, type: "release", per_page: 8});
  const hits = (s.results || []).filter(x => x && x.id);
  if(!hits.length){ discCacheSet(cle, false); return false; }

  let best = null;
  hits.forEach(h => {
    const sc = discPertinent(query, h);
    if(!best || sc > best.sc) best = {sc, h};
  });
  /* En dessous de ce seuil, c'est un homonyme : mieux vaut ne rien afficher
     qu'un chiffre faux. */
  if(!best || best.sc < 0.45){ discCacheSet(cle, false); return false; }

  const r = await discGet("/releases/" + best.h.id, {curr_abbr: "EUR"});
  const com = r.community || {};
  const cote = {
    id: r.id,
    titre: r.title || best.h.title || "",
    artiste: (r.artists || []).map(a => a.name).join(", "),
    annee: r.year || best.h.year || "",
    label: ((r.labels || [])[0] || {}).name || "",
    format: (best.h.format || []).join(", "),
    bas: Number(r.lowest_price) || 0,
    envente: Number(r.num_for_sale) || 0,
    ont: Number(com.have) || 0,
    veulent: Number(com.want) || 0,
    url: "https://www.discogs.com/release/" + r.id
  };
  discCacheSet(cle, cote);
  return cote;
}


/* Lecture des chiffres. C'est ici que la donnée devient une décision. */
export function discLire(c){
  const ratio = c.ont ? c.veulent / c.ont : 0;
  let rarete, rcls;
  if(c.envente === 0 && c.ont < 500){ rarete = "Aucun exemplaire en vente"; rcls = "r"; }
  else if(c.envente > 150){ rarete = "Pressage massif — " + c.envente + " en vente"; rcls = "c"; }
  else if(c.envente > 40){ rarete = c.envente + " exemplaires en vente"; rcls = "c"; }
  else if(c.envente > 0){ rarete = "Seulement " + c.envente + " en vente"; rcls = "r"; }
  else { rarete = "Marché introuvable"; rcls = ""; }

  let demande = "";
  if(ratio >= 1) demande = "Plus de gens le veulent que ne le possèdent (×" + ratio.toFixed(1) + ")";
  else if(ratio >= 0.4) demande = "Demande correcte (" + Math.round(ratio*100) + " veulent pour 100 qui l'ont)";
  else if(c.ont > 0) demande = "Peu demandé (" + Math.round(ratio*100) + " pour 100)";

  /* Pour vendre, il faut passer sous le moins cher déjà en ligne : la revente
     réaliste n'est pas le prix affiché sur Discogs, c'est un cran en dessous.
     Et plus il y a d'exemplaires en vente, plus il faut mordre. */
  let coef = c.envente > 150 ? 0.7 : c.envente > 40 ? 0.8 : 0.9;
  const revente = c.bas ? Math.round(c.bas * coef) : 0;
  const prixMax = revente ? Math.max(1, Math.round(revente / 3)) : 0;

  return {ratio, rarete, rcls, demande, revente, prixMax, coef};
}
