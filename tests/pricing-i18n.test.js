// Verifie que les libelles d'affichage du moteur de cotation (ETAT_LBL,
// PORT_LBL, ficheVerdict(), attResume() - src/pricing/engine.js) suivent
// la langue active. Autorisation explicite du 31/08/2026 : uniquement
// les libelles, jamais les coefficients ni les formules de calcul (voir
// tests/pricing.test.js, qui continue de verrouiller le calcul lui-meme
// et n'a pas ete touche par ce chantier).
import { describe, it, expect, beforeEach } from "vitest";
import { ETAT_LBL, PORT_LBL, ficheNorm, ficheCalc, ficheVerdict, attResume } from "../src/pricing/engine.js";
import { t, localeSet } from "../src/i18n/index.js";

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
});

describe("ETAT_LBL / PORT_LBL — clés i18n, pas figées à l'import", () => {
  it("ETAT_LBL[3] résolu via t() donne le bon texte selon la langue", () => {
    localeSet("fr");
    expect(t(ETAT_LBL[3])).toBe("Bon");
    localeSet("nl");
    expect(t(ETAT_LBL[3])).toBe("Goed");
    localeSet("en");
    expect(t(ETAT_LBL[3])).toBe("Good");
  });

  it("PORT_LBL['gros'] résolu via t() donne le bon texte selon la langue", () => {
    localeSet("fr");
    expect(t(PORT_LBL.gros)).toBe("Gros colis");
    localeSet("en");
    expect(t(PORT_LBL.gros)).toBe("Large parcel");
    localeSet("fr");
  });
});

describe("ficheVerdict() — .t est une clé i18n, résolue par l'appelant", () => {
  it("RAFLE (fr) / GRAB IT (en) : même verdict .v, texte .t traduit une fois résolu", () => {
    const f = ficheNorm({ marche: 30, etatNote: 3, attendu: [] });
    const c = ficheCalc(f);
    const vd = ficheVerdict(f, c, c.ouverture); // demande <= cible -> RAFLE

    localeSet("fr");
    expect(t(vd.t)).toBe("RAFLE");
    localeSet("en");
    expect(t(vd.t)).toBe("GRAB IT");
    localeSet("fr");
  });
});

describe("attResume() — appelle t() directement, retourne déjà le texte traduit", () => {
  it("rien ne manque, en néerlandais", () => {
    localeSet("nl");
    expect(attResume([{ n: "boîte", vu: "oui", perte: 20 }])).toBe("Niets ontbreekt: geen korting");
    localeSet("fr");
  });

  it("un élément manquant + un à vérifier, en anglais : singulier/pluriel corrects", () => {
    localeSet("en");
    const texte = attResume([
      { n: "manual", vu: "non", perte: 20 },
      { n: "box", vu: "?", perte: 10 }
    ]);
    expect(texte).toContain("Missing found: −20% applied");
    expect(texte).toContain("1 item to check on site");
    localeSet("fr");
  });

  it("plusieurs éléments à vérifier, en français (comportement par défaut inchangé)", () => {
    localeSet("fr");
    const texte = attResume([
      { n: "a", vu: "?", perte: 10 },
      { n: "b", vu: "?", perte: 10 }
    ]);
    expect(texte).toBe("Rien ne manque : aucune décote · 2 éléments à vérifier sur place");
  });
});
