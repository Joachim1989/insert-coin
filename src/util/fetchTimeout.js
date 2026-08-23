/* Aucun appel réseau de l'app n'avait de budget de temps avant ce correctif
   (23/08/2026, voir docs/diagnostic-cotation.md) : un réseau qui répond mal
   au lieu de couper franchement pouvait laisser l'app attendre
   indéfiniment — navigator.onLine reste vrai tant qu'il y a une association
   réseau, même sans débit réel. Deux aides ici, réutilisées par tous les
   clients API (Gemini, Discogs, Rebrickable, Drive) :
   - fetchAvecDelai() : fetch() + AbortController, abandonne après `ms`.
   - avecDelai() : fait courir n'importe quelle promesse (ex. le chargement
     d'un <script> externe, qui n'est pas un fetch()) contre un délai. */

export function fetchAvecDelai(url, options, ms){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export function avecDelai(promesse, ms, message){
  let t;
  const delai = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(message || `Délai dépassé (${ms} ms)`)), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(t));
}
