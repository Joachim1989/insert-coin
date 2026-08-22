// Reconstitué à partir du cas réel signalé (lot Skylanders ~15 figurines +
// portail, l'app annonçait 1 € max alors que ce type de lot se vend
// couramment 12-15 € sur Vinted). Ce n'est PAS une capture d'une vraie
// réponse Gemini : c'est l'entrée la plus plausible et la plus charitable —
// le marché du lot est correctement estimé (14 €, dans la fourchette
// observée), un seul élément non confirmé sur la photo. C'est exactement le
// scénario que BRIEF_BASE décrit lui-même comme exemple de lot ("le portail
// sans lequel les figurines ne servent à rien").
export const skylandersLot = {
  objet: "Lot d'environ 15 figurines Skylanders + portail",
  categorie: "jouets",
  lot: true,
  lotNb: 15,
  identification: "Figurines Skylanders (Activision), plusieurs jeux mélangés",
  code: "", codeOu: "moulé sous le socle de chaque figurine",
  attendu: [
    { n: "le portail USB", vu: "non", perte: 65 }
  ],
  impactComplet: "Sans le portail, aucune figurine ne se joue — mais le lot en vrac se vend quand même, à un prix plus bas.",
  echelle: "vrac / complet", etatNote: 3, etatDit: "figurines en bon état d'usage, peinture non écaillée",
  circulation: "courant",
  marche: 14, // cohérent avec les annonces Vinted observées pour ce type de lot (12-15 €)
  gabarit: "moyen",
  confiance: "moyenne",
  comparables: [],
  verifs: [],
  pieges: ["Vérifie que les figurines sont bien de la génération compatible avec le portail."],
  nego: "C'est un lot classique, fréquent en brocante.",
  note: ""
};
