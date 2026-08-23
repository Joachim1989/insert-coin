/* Répartit un montant total au prorata d'une pondération par ligne (ex. la
   revente estimée de chaque pièce d'un lot), avec correction d'arrondi :
   la somme des parts retombe exactement sur le total, jamais un centime
   perdu ou en trop par erreur de flottant.

   Extrait de bacBuy() (src/ui/fiche.js) le 23/08/2026 pour pouvoir être
   testé sans DOM, et réutilisé pour répartir "payé" ET "demandé" avec la
   même règle — correctif du bug jumeau bacBuy()/logFind() : `dem` restait
   à 0 sur un achat de lot (aucune question posée) et pouvait rester à 0 sur
   un achat simple si le prix demandé n'était connu qu'après la négociation
   (aucun champ pour le saisir a posteriori) — faussant silencieusement les
   statistiques de négociation (negoStats() dans src/ui/log.js exclut tout
   dem <= 0). Voir docs/diagnostic-cotation.md pour le détail. */
export function repartirProrata(poids, total){
  if(!Array.isArray(poids) || !poids.length) return [];
  const t = Number(total) || 0;
  const somme = poids.reduce((a, b) => a + (Number(b) || 0), 0);
  let parts = somme > 0
    ? poids.map(v => t * (Number(v) || 0) / somme)
    : poids.map(() => t / poids.length);
  parts = parts.map(x => Math.round(x * 100) / 100);
  /* L'arrondi ne doit pas faire mentir le total : l'écart va sur la ligne
     la plus lourde (la première en cas d'égalité, comme le ferait un humain
     qui répartit des pièces de monnaie sur la table). */
  const ecart = Math.round((t - parts.reduce((a, b) => a + b, 0)) * 100) / 100;
  if(ecart && parts.length){
    let iMax = 0;
    for(let i = 1; i < poids.length; i++){
      if((Number(poids[i]) || 0) > (Number(poids[iMax]) || 0)) iMax = i;
    }
    parts[iMax] = Math.round((parts[iMax] + ecart) * 100) / 100;
  }
  return parts;
}
