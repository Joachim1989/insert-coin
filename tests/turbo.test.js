import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { poserDomMinimal } from "./helpers/domStub.js";

let turboPanier, turboPrixDefaut, turboSetUnitPrice,
    turboToggleItem, turboRemoveItem, isSoundEnabled, setSoundEnabled;

beforeAll(async () => {
  poserDomMinimal();
  const turboMod = await import("../src/ui/turbo.js");
  turboPanier = turboMod.turboPanier;
  turboPrixDefaut = turboMod.turboPrixDefaut;
  turboSetUnitPrice = turboMod.turboSetUnitPrice;
  turboToggleItem = turboMod.turboToggleItem;
  turboRemoveItem = turboMod.turboRemoveItem;

  const soundMod = await import("../src/util/sound.js");
  isSoundEnabled = soundMod.isSoundEnabled;
  setSoundEnabled = soundMod.setSoundEnabled;
});

describe("Mode Terrain Turbo — Tests unitaires", () => {
  beforeEach(() => {
    // Reset state
    turboSetUnitPrice(3);
    setSoundEnabled(true);
  });

  it("gère l'activation et la désactivation du son", () => {
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it("modifie le prix unitaire par défaut", async () => {
    const { getTurboPrixDefaut } = await import("../src/ui/turbo.js");
    turboSetUnitPrice(5);
    expect(getTurboPrixDefaut()).toBe(5);
    turboSetUnitPrice(2);
    expect(getTurboPrixDefaut()).toBe(2);
  });

  it("permet de cocher, décocher et supprimer des articles du panier", () => {
    const item1 = { id: "test_1", nom: "Zelda", cote: 35, prixDemande: 3, selected: true };
    const item2 = { id: "test_2", nom: "Mario", cote: 25, prixDemande: 3, selected: true };
    turboPanier.length = 0;
    turboPanier.push(item1, item2);

    expect(turboPanier.length).toBe(2);
    expect(turboPanier[0].selected).toBe(true);

    turboToggleItem("test_1");
    expect(turboPanier.find(x => x.id === "test_1").selected).toBe(false);

    turboRemoveItem("test_2");
    expect(turboPanier.length).toBe(1);
    expect(turboPanier[0].id).toBe("test_1");
  });
});
