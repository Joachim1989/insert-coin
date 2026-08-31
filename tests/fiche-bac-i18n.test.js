// Vérifie que le rendu du mode Bac (renderBacResult/bacBar/bacCart/bacBuy,
// src/ui/fiche.js) parle bien la langue active — chantier néerlandais,
// phase 2, tranche 2 (30/08/2026). Continuité directe du travail sur le
// bug "Rien de lisible" (tests/bac-lot-vide.test.js) fait plus tôt dans
// la même session.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

function elFactice(){
  return { innerHTML: "", textContent: "", value: "", classList: { add(){}, remove(){}, toggle(){} } };
}

let renderBacResult, bacBuy, localeSet;
let aiResults;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  aiResults = elFactice();
  globalThis.document.getElementById = id => (id === "ai-results" ? aiResults : null);
  globalThis.document.querySelectorAll = () => [];
  ({ renderBacResult, bacBuy } = await import("../src/ui/fiche.js"));
  ({ localeSet } = await import("../src/i18n/index.js"));
});

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
});

const LOT_EXEMPLE = {
  typeBac: "vinyles",
  resume: "lot correct",
  lot: [
    { nom: "The Wall", artiste: "Pink Floyd", annee: "1979", revente: 15, prixMax: 5, verdict: "R", note: "" },
    { nom: "Autre disque", artiste: "X", annee: "", revente: 3, prixMax: 1, verdict: "L", note: "" }
  ]
};

describe("renderBacResult() — langue active", () => {
  it("en français : les libellés de section sont en français", () => {
    localeSet("fr");
    renderBacResult(LOT_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("MODE BAC");
    expect(aiResults.innerHTML).toContain("<h4>À prendre ");
    expect(aiResults.innerHTML).toContain("<h4>Laisse ");
    expect(aiResults.innerHTML).toContain("Fermer l'analyse");
  });

  it("en néerlandais : les mêmes libellés basculent — pas de français qui traîne", () => {
    localeSet("nl");
    renderBacResult(LOT_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("LOT-MODUS");
    expect(aiResults.innerHTML).toContain("<h4>Te nemen ");
    expect(aiResults.innerHTML).toContain("<h4>Laat liggen ");
    expect(aiResults.innerHTML).toContain("Analyse sluiten");
    // Le nom de l'article (donnée IA, jamais traduit) reste intact.
    expect(aiResults.innerHTML).toContain("The Wall");
  });

  it("lot vide, en néerlandais : l'état 'rien de lisible' est bien en néerlandais", () => {
    localeSet("nl");
    renderBacResult({ typeBac: "", resume: "", lot: [] }, [], null);
    expect(aiResults.innerHTML).toContain("Niets leesbaars");
    expect(aiResults.innerHTML).not.toContain("Rien de lisible");
  });

  it("en anglais (31/08/2026, troisième langue) : mêmes libellés en anglais", () => {
    localeSet("en");
    renderBacResult(LOT_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("LOT MODE");
    expect(aiResults.innerHTML).toContain("<h4>To take ");
    expect(aiResults.innerHTML).toContain("<h4>Skip ");
    expect(aiResults.innerHTML).toContain("Close analysis");
    expect(aiResults.innerHTML).toContain("The Wall");
    localeSet("fr");
  });
});

describe("bacBuy() — prompts traduits, singulier/pluriel corrects", () => {
  it("une seule pièce sélectionnée (verdict R auto-coché) : le prompt singulier, en néerlandais", () => {
    localeSet("nl");
    renderBacResult(LOT_EXEMPLE, [], null); // sélectionne automatiquement "The Wall" (verdict R)

    let promptVu = null;
    globalThis.prompt = (msg) => { if(promptVu === null) promptVu = msg; return "0"; };
    globalThis.localStorage.setItem("insertcoin.log", "[]");

    bacBuy();

    expect(promptVu).toBe("Hoeveel heb je in totaal voor dit stuk betaald?");
  });
});
