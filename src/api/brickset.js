import { brickKey, brickRelay, brickCacheGet, brickCacheSet } from "../storage/local.js";
import { legoNum } from "./rebrickable.js";

export const BRICK_API   = "https://brickset.com/api/v3.asmx";


/* Le relais : un Cloudflare Worker gratuit qui rejoue la requête vers
   Brickset et ajoute l'en-tête CORS qui manque. Il ne fait rien d'autre —
   pas de stockage, pas de journalisation, il ne voit passer que ce que cette
   app lui envoie déjà. Collé tel quel dans l'éditeur du dashboard Cloudflare. */
export const BRICK_RELAY_CODE = `export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = "https://brickset.com/api/v3.asmx" + url.pathname + url.search;
    const upstream = await fetch(target, { headers: { "Accept": "application/json" } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};`;


export let BRICK_LAST = 0;

export async function brickGet(method, params){
  const k = brickKey();
  if(!k) throw new Error("Aucune clé Brickset");
  if(!navigator.onLine) throw new Error("Hors réseau");
  const attente = 900 - (Date.now() - BRICK_LAST);
  if(attente > 0) await new Promise(r => setTimeout(r, attente));
  BRICK_LAST = Date.now();
  const base = brickRelay() || BRICK_API;
  const q = new URLSearchParams({apiKey: k, ...(params || {})});
  const r = await fetch(base + "/" + method + "?" + q.toString());
  if(!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  /* Toutes les réponses Brickset portent un statut : "success" ou "error"
     avec un message, quel que soit le code HTTP renvoyé. */
  if(d.status !== "success"){
    const msg = d.message || "";
    throw new Error(/invalid|key/i.test(msg) ? "CLE" : (msg || "Erreur Brickset"));
  }
  return d;
}


/* Le nom exact du champ de prix a changé d'une version de l'API à l'autre ;
   on essaie plusieurs chemins plausibles et on n'affiche que ce qui répond
   vraiment — jamais un prix inventé sous un mauvais nom de champ. */
export function brickPrixNeuf(s){
  const essais = [
    ["EU", s.LEGOCom && s.LEGOCom.EU && s.LEGOCom.EU.retailPrice],
    ["DE", s.LEGOCom && s.LEGOCom.DE && s.LEGOCom.DE.retailPrice],
    ["EU", s.EURetailPrice], ["DE", s.DERetailPrice]
  ];
  for(const [dev, v] of essais){ const n = Number(v); if(n > 0) return {val: Math.round(n), dev}; }
  return {val: 0, dev: ""};
}


export async function brickSet(num){
  const cle = "b:" + legoNum(num);
  const cache = brickCacheGet(cle);
  if(cache !== null) return cache;

  const d = await brickGet("getSets", {userHash: "", params: JSON.stringify({setNumber: legoNum(num)})});
  const s = (d.sets || [])[0];
  if(!s){ brickCacheSet(cle, false); return false; }

  const prix = brickPrixNeuf(s);
  const cote = {
    num: s.number ? (s.number + "-" + (s.numberVariant || 1)) : legoNum(num),
    nom: s.name || "", annee: s.year || "",
    pieces: Number(s.pieces) || 0, figs: Number(s.minifigs) || 0,
    prixNeuf: prix.val, prixDev: prix.dev,
    url: s.bricksetURL || ("https://brickset.com/sets/" + legoNum(num))
  };
  brickCacheSet(cle, cote);
  return cote;
}
