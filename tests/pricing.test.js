// Tests de non-régression sur le moteur de cotation (src/pricing/engine.js),
// à partir des trois erreurs réelles observées sur le terrain. Le moteur est
// pur (aucun appel réseau) : les "réponses API" sont des fixtures qui
// représentent ce que Gemini a plausiblement renvoyé — voir tests/fixtures/
// pour la justification de chaque valeur.
//
// État au 22/08/2026, après tranchage avec l'utilisateur :
//   - Cas 1 (Skylanders) : CORRIGÉ (plafond de 25% sur attCoef, gated à un
//     seul élément manquant sur un lot) et verrouillé en vert.
//   - Cas 2 (Remember Me) : n'était pas un bug — test verrouillé en vert,
//     ne pas le "corriger".
//   - Cas 3 (Top Gun) : le test de non-amplification est vert (prouve que
//     le moteur n'est pas en cause) ; le test "circulation" reste rouge en
//     filet de sécurité, à câbler seulement après avoir confirmé pourquoi
//     Discogs ne remplace pas l'estimation IA sur ce cas précis.
// Voir docs/diagnostic-cotation.md pour le détail.
import { describe, it, expect } from "vitest";
import { ficheNorm, ficheCalc } from "../src/pricing/engine.js";
import { skylandersLot } from "./fixtures/skylanders-lot.js";
import { rememberMePS3 } from "./fixtures/remember-me-ps3.js";
import { topGunOST } from "./fixtures/top-gun-ost.js";
import { lotBoitesVides } from "./fixtures/lot-boites-vides.js";

describe("Cas réel 1 — Lot Skylanders (CORRIGÉ : plafond de 25% sur les lots à un seul élément manquant)", () => {
  // L'ancien test de cette place ("chiffre exact aujourd'hui : reproduit le
  // 1 € signalé sur le terrain") documentait le bug tel quel — il est retiré
  // maintenant que le correctif est écrit, remplacé par le test ci-dessous
  // qui verrouille la valeur CORRECTE. Attention transverse honorée : ce
  // n'était pas un test à contourner, il devait être réécrit vers le
  // comportement attendu au moment de la correction — c'est fait.
  it("plafond correct une fois le double comptage corrigé : 3 € (prix d'achat max, pas la valeur de revente)", () => {
    const c = ficheCalc(ficheNorm(skylandersLot));
    // Règle validée avec l'utilisateur le 22/08/2026, écrite dans attCoef
    // (src/pricing/engine.js) : sur un lot, la décote de complétude est
    // plafonnée à 25 % — même plafond et même raisonnement que
    // PORT_PART_MAX, qui existe déjà pour la même raison côté port. Ce
    // plafond ne protège QUE le cas "un seul élément partagé constaté
    // absent" (ex. le portail d'un lot de figurines) : dès qu'un DEUXIÈME
    // élément est confirmé absent sur le même lot, la décote complète
    // s'applique de nouveau, sans plafond — un lot dont plusieurs pièces
    // manquent n'a plus le profil d'un accessoire partagé, il ressemble à
    // plusieurs pièces vraiment cassées (voir le test garde-fou ci-dessous).
    //
    // Comme pour le cas 2, ce 3 € est un PRIX D'ACHAT MAXIMUM ("tu ne payes
    // pas plus que ça"), pas une estimation de la valeur du lot — ne pas
    // confondre les deux au moment de lire ce nombre.
    //
    // Calcul : base=14, état×1, port=min(3, 14×0.25)=3,
    // complétude = 1 − min(65,25)/100 = 0.75 → brut=10.5, net=7.5,
    // plafond=round(7.5/3)=3. Avant le correctif : 1€ (65% appliqués sans
    // plafond, cf. git history de ce fichier pour l'ancien test caractérisant
    // le bug).
    expect(c.plafond).toBe(3);
  });

  it("garde-fou : le plafond de 25 % ne s'applique PAS quand plusieurs éléments manquent — un lot vraiment vide reste proche de zéro", () => {
    const c = ficheCalc(ficheNorm(lotBoitesVides));
    // Verrouille le garde-fou : deux éléments distincts sont constatés
    // absents ici (les disques ET les notices), pas un accessoire partagé
    // unique — le plafond de 25 % décrit ci-dessus ne s'applique que sur UN
    // SEUL élément manquant. Si ce test devient rouge, le plafond masque une
    // vraie perte : ne pas élargir la condition de gate sans en reparler.
    expect(c.plafond).toBe(0);
  });
});

describe("Cas réel 2 — Remember Me PS3 (PAS un bug : règle du tiers verrouillée)", () => {
  // Tranché avec l'utilisateur le 22/08/2026 : ce n'était pas une erreur.
  // "TON MAX" est le prix que le chineur paie sur le stand, pas une
  // estimation de la valeur de l'objet — c'est une règle personnelle
  // explicite ("tu n'achètes jamais au-dessus du tiers"), pas un accident de
  // calcul. Ce test verrouille ce comportement : s'il devient rouge un jour,
  // c'est qu'on a touché la règle du tiers sans le vouloir, pas qu'on a
  // "corrigé" un bug — ne pas le faire passer en changeant l'attente sans en
  // reparler d'abord.
  //
  // Le vrai défaut identifié n'est pas dans ce module : c'est visuel. Le
  // chiffre géant en haut de la fiche ("TON MAX") est le prix d'achat ; la
  // revente nette (18€ ici, cohérente avec les 20€ vus sur Vinted) est
  // affichée en petit, plus bas. Tâche séparée, pas de code ici : voir
  // docs/diagnostic-cotation.md, section "Suivi".
  it("marché 20€, rien de manquant, état normal → net 18€, plafond (max à payer) 6€", () => {
    const c = ficheCalc(ficheNorm(rememberMePS3));
    expect(c.net).toBe(18);
    expect(c.plafond).toBe(6);
  });
});

describe("Cas réel 3 — Bande originale Top Gun (sur-évaluation, mécanisme différent)", () => {
  it("le moteur ne peut PAS, par construction, amplifier un marché correct en 20 € — la cause n'est donc pas ici", () => {
    // Preuve par le calcul : même avec le meilleur état possible (neuf/
    // scellé, coefficient ×1.8) et rien de manquant, un marché correctement
    // estimé à 4-5 € (la vraie cote, cf. src/data/localBase.js) ne peut pas
    // dépasser environ 4.5 * 1.8 / 3 ≈ 2.7 € de plafond. Le "20 €" rapporté
    // ne peut donc venir que d'un `marche` déjà faux en amont (estimation
    // IA), jamais d'un bug arithmétique de ficheCalc.
    const optimiste = ficheNorm({ ...topGunOST("massif"), marche: 4.5, etatNote: 5 });
    const c = ficheCalc(optimiste);
    expect(c.plafond).toBeLessThan(5);
  });

  it("le moteur ignore complètement 'circulation' — un pressage massif n'est pas tempéré, même quand le modèle le signale lui-même", () => {
    // C'est le vrai défaut testable ici : le modèle a la donnée qualitative
    // ("circulation": "massif") au même moment qu'il donne son estimation
    // chiffrée, mais ficheCalc n'y touche jamais. Deux fiches identiques sauf
    // sur "circulation" devraient produire des plafonds différents — un
    // pressage massif devrait peser moins qu'un pressage rare, à marché
    // affiché égal. Échoue aujourd'hui : les deux valent exactement le même
    // plafond (6), quelle que soit "circulation".
    const massif = ficheCalc(ficheNorm(topGunOST("massif")));
    const rare   = ficheCalc(ficheNorm(topGunOST("rare")));
    expect(massif.plafond).toBeLessThan(rare.plafond);
  });
});
