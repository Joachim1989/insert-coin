// Vérifie que le rendu du mode Objet (renderResult/ficheAction/ficheParce/
// fichePrix/ficheCorps, src/ui/fiche.js) parle bien la langue active —
// chantier néerlandais, phase 2, tranche 3 (30/08/2026) : les phrases de
// négociation, la partie la plus dense et la plus utilisée de l'app.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

function elFactice(){
  return {
    innerHTML: "", textContent: "", value: "", dataset: {},
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(){},
    querySelector(){ return null; }
  };
}

let renderResult, localeSet;
let aiResults, priceEl;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  aiResults = elFactice();
  priceEl = elFactice();
  globalThis.document.getElementById = id =>
    id === "ai-results" ? aiResults : id === "price" ? priceEl : null;
  ({ renderResult } = await import("../src/ui/fiche.js"));
  ({ localeSet } = await import("../src/i18n/index.js"));
});

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  priceEl.value = "";
  priceEl.dataset = {};
});

// Un objet simple, sans lot, avec un prix de marché exploitable — pour
// exercer ficheAction()/fichePrix()/ficheParce() (la branche "grille de
// prix" complète, pas juste les cas limites "pas de prix"/"passe ton
// chemin").
const OBJET_EXEMPLE = {
  objet: "Disque test",
  categorie: "vinyle",
  lot: false, lotNb: 0,
  code: "", codeOu: "",
  attendu: [],
  impactComplet: "",
  echelle: "", etatDit: "",
  circulation: "courant",
  marche: 30,
  gabarit: "pochette",
  confiance: "haute",
  verifs: [], pieges: [], nego: "Un argument sans montant",
  note: "",
  etatNote: 3,
  comparables: []
};

describe("renderResult() — langue active (mode Objet/Multi)", () => {
  it("en français : la grille de prix et l'en-tête sont en français", () => {
    localeSet("fr");
    renderResult(OBJET_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("TON MAX");
    expect(aiResults.innerHTML).toContain("Tu annonces");
    expect(aiResults.innerHTML).toContain("Tu vises");
    expect(aiResults.innerHTML).toContain("Je l'achète");
    expect(aiResults.innerHTML).toContain("Demandé €");
  });

  it("en néerlandais : les mêmes éléments basculent — les données (objet, note) restent intactes", () => {
    localeSet("nl");
    renderResult(OBJET_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("JOUW MAX");
    expect(aiResults.innerHTML).toContain("Je noemt");
    expect(aiResults.innerHTML).toContain("Je mikt op");
    expect(aiResults.innerHTML).toContain("Ik koop het");
    expect(aiResults.innerHTML).toContain("Gevraagd €");
    expect(aiResults.innerHTML).toContain("Disque test"); // donnée IA, jamais traduite
  });

  it("sans prix de marché (marche:0) : le bloc 'prix à vérifier' bascule en néerlandais", () => {
    localeSet("nl");
    renderResult({ ...OBJET_EXEMPLE, marche: 0 }, [], null);
    expect(aiResults.innerHTML).toContain("Prijs te controleren");
    expect(aiResults.innerHTML).not.toContain("Prix à vérifier");
  });

  it("prix demandé au-dessus du plafond : la phrase 'Repose-le' est en néerlandais", () => {
    localeSet("nl");
    priceEl.value = "9999"; // très au-dessus de n'importe quel plafond raisonnable
    renderResult(OBJET_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("Laat het liggen");
  });

  it("en anglais (31/08/2026, troisième langue) : mêmes éléments en anglais", () => {
    localeSet("en");
    renderResult(OBJET_EXEMPLE, [], null);
    expect(aiResults.innerHTML).toContain("YOUR MAX");
    expect(aiResults.innerHTML).toContain("You state");
    expect(aiResults.innerHTML).toContain("Buy it");
    expect(aiResults.innerHTML).toContain("Asked €");
    expect(aiResults.innerHTML).toContain("Disque test");
    localeSet("fr");
  });
});
