// ══════════════════ COTES JEUX VIDÉO (PriceCharting) ══════════════════
// Demande du 02/09/2026. La référence du secteur pour les prix réels de jeux
// vidéo d'occasion, par palier d'état (nu / en boîte complet / neuf scellé —
// exactement l'échelle déjà utilisée par BRIEF_BASE, src/api/gemini.js,
// "CIB / en boîte / nu pour le jeu vidéo"). Seule différence notable avec
// Discogs/Rebrickable/Brickset : leur API est PAYANTE (voir la note déjà
// présente avant ce chantier dans src/ui/fiche.js, verifQuery()). Même
// mécanique BYOK malgré tout.
//
// PriceCharting répond en DOLLARS US, jamais convertis. Contrairement à
// Discogs (curr_abbr:"EUR") et Brickset/Rebrickable (toujours réellement en
// euros, voir brickPrixNeuf()), il n'existe ici aucune conversion fiable à
// portée de main sans introduire un taux figé qui se périme silencieusement.
// Décision : ne JAMAIS afficher ces prix avec un symbole €, et ne jamais les
// injecter dans FICHE.marcheReel (voir pcGreffe(), src/ui/fiche.js) — carte
// purement informative, prix en $ explicites.
import { pcToken, pcCacheGet, pcCacheSet } from "../storage/local.js";
import { fetchAvecDelai } from "../util/fetchTimeout.js";

export const PC_API = "https://www.pricecharting.com/api";


/* Même registre que DISC_OUI/DISC_NON (src/api/discogs.js) : mots-clés de
   plateformes et de vocabulaire jeu vidéo. Volontairement permissif — un
   faux négatif (pas de carte affichée) coûte moins cher qu'un faux positif
   (requête payante gaspillée sur un objet qui n'est manifestement pas un
   jeu vidéo). */
export const PC_OUI = /(wii ?u?|switch|playstation|ps[1-5]\b|psp\b|\bps vita\b|xbox|nintendo|gamecube|dreamcast|saturn|megadrive|game ?boy|nes\b|snes\b|\bn64\b|\b3ds\b|\bds\b|atari|sega|amiga|commodore|master system|neo ?geo|jeu vid[ée]o|video ?game|cartouche|manette de jeu)/i;

export function pcJeuVideo(txt){
  const s = String(txt || "");
  if(s.trim().length < 3) return false;
  return PC_OUI.test(s);
}


export let PC_LAST = 0;

export async function pcGet(params){
  const key = pcToken();
  if(!key) throw new Error("Aucune clé PriceCharting");
  if(!navigator.onLine) throw new Error("Hors réseau");
  /* Même espacement que Rebrickable (900ms) : lecture simple, pas d'upload. */
  const attente = 900 - (Date.now() - PC_LAST);
  if(attente > 0) await new Promise(r => setTimeout(r, attente));
  PC_LAST = Date.now();
  const q = new URLSearchParams({...(params || {}), t: key});
  /* Budget de temps : 10s, même motif que discGet()/legoGet() (correctif du
     23/08/2026, voir src/util/fetchTimeout.js). */
  const r = await fetchAvecDelai(PC_API + "/products?" + q.toString(), {}, 10000);
  if(r.status === 401 || r.status === 403) throw new Error("CLE");
  if(r.status === 429) throw new Error("Trop de requêtes — attends une minute");
  if(!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}


/* Note honnête : les noms de champs ci-dessous ("loose-price", "cib-price",
   "new-price", "product-name", "console-name") suivent la documentation
   PriceCharting telle que connue au moment d'écrire ce fichier, mais n'ont
   pas pu être vérifiés en direct contre une vraie clé (API payante, aucune
   clé de test disponible ici). Si pcTest() (src/ui/settings.js) revient
   avec des champs vides malgré une clé valide et un jeu connu, c'est le
   premier endroit à corriger — voir aussi la réponse brute que pcTest()
   affiche en cas de doute. */
export async function pcCote(query){
  const cle = "p:" + String(query || "").trim().toLowerCase().slice(0, 80);
  const cache = pcCacheGet(cle);
  if(cache !== null) return cache;

  const s = await pcGet({q: query});
  const hits = Array.isArray(s.products) ? s.products.filter(x => x && x.id) : [];
  if(!hits.length){ pcCacheSet(cle, false); return false; }

  /* Pas de score de pertinence maison ici (contrairement à discPertinent) :
     PriceCharting fait déjà correspondre par titre côté serveur, le premier
     résultat est le plus pertinent selon leur propre recherche. */
  const h = hits[0];
  const cote = {
    id: h.id,
    nom: h["product-name"] || query,
    console: h["console-name"] || "",
    loose: centsToUnite(h["loose-price"]),
    cib: centsToUnite(h["cib-price"]),
    neuf: centsToUnite(h["new-price"]),
    url: "https://www.pricecharting.com/game/" + encodeURIComponent(h.id)
  };
  pcCacheSet(cle, cote);
  return cote;
}

function centsToUnite(v){
  const n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n) / 100 : 0;
}
