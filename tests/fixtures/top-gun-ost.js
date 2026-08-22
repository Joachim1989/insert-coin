// Reconstitué à partir du cas réel signalé (bande originale vinyle de Top
// Gun, l'app annonçait 20 € alors que la cote réelle est de 3 à 5 € — c'est
// d'ailleurs très exactement ce que dit la propre base de repères locale de
// l'app pour ce titre : voir src/data/localBase.js, entrée "B.O.
// blockbuster — Top Gun, Dirty Dancing, Grease, Flashdance" : achat 2 €,
// revente 4 €. C'est un pressage massif, sans valeur de collection.
//
// Contrairement aux deux autres cas, ici on ne peut PAS reconstituer une
// entrée "plausible et correcte" qui reproduit 20 € : le moteur de cotation
// ne fait que réduire marche (÷3 après décotes), jamais l'amplifier au-delà
// de ×1.8 (état neuf). Un marché correctement estimé à 4 € ne peut
// mathématiquement pas ressortir à 20 € du pipeline. La feuille "20 €" ne
// peut donc venir que d'une estimation `marche` déjà fausse — ce que ce
// fixture représente délibérément, pour vérifier autre chose : est-ce que le
// moteur SE SERT au moins du signal "circulation" que le modèle a lui-même
// renvoyé pour tempérer une estimation qu'il vient de qualifier de
// "pressage massif" ?
export function topGunOST(circulation) {
  return {
    objet: "Bande originale Top Gun",
    categorie: "vinyles",
    lot: false, lotNb: 0,
    identification: "33 tours, bande originale du film",
    code: "", codeOu: "matrice gravée près de l'étiquette",
    attendu: [],
    impactComplet: "",
    echelle: "Goldmine (M, NM, VG+, VG, G)", etatNote: 3, etatDit: "pochette et disque en bon état d'usage",
    circulation, // "massif" dans le cas réel — pressé par millions
    marche: 20,  // hypothèse : c'est ce chiffre-là, déjà faux, que l'IA a renvoyé
    gabarit: "pochette",
    confiance: "faible",
    comparables: [],
    verifs: [],
    pieges: [],
    nego: "",
    note: ""
  };
}
