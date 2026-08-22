// Fixture de garde-fou pour le plafond de 25 % proposé sur le cas 1
// (Skylanders) : vérifie que le plafond ne masque pas une perte légitime.
// Un lot de boîtes de jeux Wii dont les disques ET les notices manquent —
// deux éléments distincts constatés absents, pas un seul accessoire
// partagé. Le lot est proche du sans-valeur (des boîtes vides), et doit le
// rester après correction.
export const lotBoitesVides = {
  objet: "Lot de 5 boîtiers de jeux Wii vides",
  categorie: "jeux video",
  lot: true, lotNb: 5,
  identification: "boîtiers Wii, aucun disque visible à l'intérieur",
  code: "", codeOu: "",
  attendu: [
    { n: "les disques à l'intérieur des boîtiers", vu: "non", perte: 70 },
    { n: "les notices", vu: "non", perte: 20 }
  ],
  impactComplet: "Des boîtiers vides valent presque uniquement le plastique.",
  echelle: "CIB / en boîte / nu", etatNote: 3, etatDit: "boîtiers en bon état, rien à l'intérieur",
  circulation: "massif",
  marche: 10, // même un lot de boîtiers vides a une petite valeur de contenant
  gabarit: "moyen",
  confiance: "haute",
  comparables: [],
  verifs: [],
  pieges: ["Vérifie qu'aucun disque n'est resté coincé sous l'insert."],
  nego: "",
  note: ""
};
