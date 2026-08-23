// Non-régression : priceGauge()/negoPad() (src/ui/fiche.js) n'ont jamais
// été branchées (confirmé mort depuis avant le découpage, voir
// docs/diagnostic-cotation.md) et faisaient doublon avec ce que la fiche
// affiche déjà cinq fois (le TON MAX géant, fichePrix, ficheAction...).
// Supprimées plutôt que branchées, sur recommandation explicite.
import { describe, it, expect, beforeAll } from "vitest";

let ficheModule;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  ficheModule = await import("../src/ui/fiche.js");
});

describe("Code mort retiré (correctif du 23/08/2026)", () => {
  it("priceGauge n'est plus exportée", () => {
    expect(ficheModule.priceGauge).toBeUndefined();
  });

  it("negoPad n'est plus exportée", () => {
    expect(ficheModule.negoPad).toBeUndefined();
  });

  it("bacBar reste exportée (utilisée par renderBacResult, à ne pas confondre avec les deux ci-dessus)", () => {
    expect(typeof ficheModule.bacBar).toBe("function");
  });
});
