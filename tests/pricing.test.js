// Tests de non-régression sur le moteur de cotation (src/pricing/engine.js),
// à partir des trois erreurs réelles observées sur le terrain. Le moteur est
// pur (aucun appel réseau) : les "réponses API" sont des fixtures qui
// représentent ce que Gemini a plausiblement renvoyé — voir tests/fixtures/
// pour la justification de chaque valeur.
//
// Ces trois tests sont volontairement ROUGES aujourd'hui. Ne pas les faire
// passer avant d'avoir lu docs/diagnostic-cotation.md et validé la cause
// avec l'utilisateur : voir la consigne de l'étape 3.
import { describe, it, expect } from "vitest";
import { ficheNorm, ficheCalc } from "../src/pricing/engine.js";
import { skylandersLot } from "./fixtures/skylanders-lot.js";
import { rememberMePS3 } from "./fixtures/remember-me-ps3.js";
import { topGunOST } from "./fixtures/top-gun-ost.js";

describe("Cas réel 1 — Lot Skylanders (sous-évaluation massive)", () => {
  it("chiffre exact aujourd'hui : reproduit le 1 € signalé sur le terrain", () => {
    const c = ficheCalc(ficheNorm(skylandersLot));
    // Ce test-ci est VERT : il documente le bug, il ne le cache pas.
    // Un marché correctement estimé à 14 € (cohérent avec les 12-15 €
    // observés) ressort à 1 € de plafond, à cause du cumul état × complétude
    // × port sur un lot où un seul élément est "non confirmé sur la photo".
    expect(c.plafond).toBe(1);
  });

  it("le plafond ne devrait pas être quasi nul pour un lot dont le marché est correctement estimé", () => {
    const c = ficheCalc(ficheNorm(skylandersLot));
    // Le marché (14 €) est déjà, par construction du prompt, "le prix du LOT
    // ENTIER tel qu'il est, en vrac, sans boîtes" — la décote de complétude
    // s'applique donc par-dessus un prix qui a déjà encaissé l'état vrac du
    // lot. Sans cette double pénalisation, un plafond ≈ marché/3 (14/3 ≈ 4-5€)
    // serait cohérent avec la règle du tiers que l'app applique partout
    // ailleurs. Échoue aujourd'hui : 1 (attendu : au moins 4).
    expect(c.plafond).toBeGreaterThanOrEqual(4);
  });
});

describe("Cas réel 2 — Remember Me PS3 (sous-évaluation)", () => {
  it("chiffre exact aujourd'hui : reproduit le 6 € signalé sur le terrain", () => {
    const c = ficheCalc(ficheNorm(rememberMePS3));
    // Marché correctement estimé à 20 € (cohérent avec Vinted), état
    // standard, rien de manquant : le pipeline (× état 1, × complétude 1,
    // − port 2€, ÷ 3) donne exactement 6. Ce n'est pas une erreur
    // arithmétique du moteur — c'est la règle du tiers appliquée
    // fidèlement. Test vert : il prouve que l'entrée était raisonnable.
    expect(c.plafond).toBe(6);
    expect(c.net).toBe(18); // la "revente nette" reste, elle, fidèle au marché
  });

  it("hypothèse à valider : le plafond ne devrait pas descendre sous la moitié de la revente nette sur un objet bien identifié, sans rien de manquant", () => {
    const c = ficheCalc(ficheNorm(rememberMePS3));
    // Cette attente est une HYPOTHÈSE DE TRAVAIL, pas une certitude : à
    // discuter en étape 3 avant de coder quoi que ce soit. Elle reflète que,
    // pour un objet identifié avec confiance et rien à décoter, la règle du
    // tiers écrase le prix affiché ("TON MAX", en gros, tout en haut de la
    // fiche) à un niveau qui se lit comme une estimation de valeur plutôt
    // que comme un plafond de négociation. Échoue aujourd'hui : 6 (attendu :
    // au moins 9, la moitié de 18).
    expect(c.plafond).toBeGreaterThanOrEqual(c.net / 2);
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
