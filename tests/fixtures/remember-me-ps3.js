// Reconstitué à partir du cas réel signalé (Remember Me sur PS3, l'app
// annonçait 6 € alors que les annonces Vinted tournent autour de 20 €).
// Le marché ici est mis à 20 € — cohérent avec ce que le chineur a
// effectivement vu — dans un état standard (note 3, la référence du barème),
// sans rien de manquant. Aucun élément inventé : ce jeu n'a pas de pièce
// détachable notable (pas de figurine, pas de code à usage unique dans
// l'édition standard).
export const rememberMePS3 = {
  objet: "Remember Me",
  categorie: "jeux video",
  lot: false, lotNb: 0,
  identification: "PS3, édition standard",
  code: "", codeOu: "au dos du boîtier, sous le code-barres",
  attendu: [],
  impactComplet: "",
  echelle: "CIB / en boîte / nu", etatNote: 3, etatDit: "boîtier et disque en bon état d'usage",
  circulation: "peu courant",
  marche: 20, // cohérent avec les annonces Vinted observées
  gabarit: "petit",
  confiance: "moyenne",
  comparables: [],
  verifs: [],
  pieges: [],
  nego: "Ce titre est resté sous-coté longtemps avant de devenir recherché.",
  note: ""
};
