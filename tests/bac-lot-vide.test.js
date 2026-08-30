// Non-régression sur le mode Bac systématiquement "Rien de lisible"
// (retour de terrain du 30/08/2026, malgré des photos nettes et des
// codes-barres visibles). Avec la recherche web activée (réglage par
// défaut), Gemini répond SANS schéma imposé (tools et responseSchema sont
// incompatibles, voir buildBody()) — lister plusieurs objets en JSON libre
// est la tâche la plus fragile qu'on lui demande. Avant ce correctif, la
// boucle d'essais de callGemini() acceptait la PREMIÈRE réponse qui
// parsait, même avec un lot vide — la dernière tentative de la chaîne
// (sans recherche web, avec un schéma JSON strict, donc plus fiable pour
// une liste) n'était alors jamais atteinte.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { poserDomMinimal } from "./helpers/domStub.js";

function elementFactice(){
  return { innerHTML: "", textContent: "", value: "", classList: { add(){}, remove(){}, toggle(){} } };
}

let aiResults;

beforeEach(() => {
  poserDomMinimal();
  globalThis.window.scrollTo = () => {};
  aiResults = elementFactice();
  globalThis.document.getElementById = id => (id === "ai-results" ? aiResults : elementFactice());
  localStorage.setItem("insertcoin.gemini.key", "clef-test");
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("lotVide() — décision pure", () => {
  it("mode bac, lot absent : vide", async () => {
    const { lotVide } = await import("../src/api/gemini.js");
    expect(lotVide('bac', {})).toBe(true);
  });

  it("mode bac, lot tableau vide : vide", async () => {
    const { lotVide } = await import("../src/api/gemini.js");
    expect(lotVide('bac', { lot: [] })).toBe(true);
  });

  it("mode bac, lot avec au moins un article : pas vide", async () => {
    const { lotVide } = await import("../src/api/gemini.js");
    expect(lotVide('bac', { lot: [{ nom: "The Wall" }] })).toBe(false);
  });

  it("modes single/multi/stand : jamais considérés vides, même sans lot — ce n'est pas leur format", async () => {
    const { lotVide } = await import("../src/api/gemini.js");
    expect(lotVide('single', {})).toBe(false);
    expect(lotVide('multi', {})).toBe(false);
    expect(lotVide('stand', {})).toBe(false);
  });
});

describe("callGemini('bac') — un lot vide sur un essai ne fait plus arrêter la recherche", () => {
  it("essais avec recherche web vides, essai suivant (schéma strict, sans recherche) avec lot rempli : le lot rempli s'affiche", async () => {
    const reponseGroundeeVide = { typeBac: "vinyles", resume: "rien de net", lot: [] };
    const reponseSchemaRemplie = {
      typeBac: "vinyles", resume: "lot lisible",
      lot: [{ nom: "The Wall", artiste: "Pink Floyd", annee: "1979", revente: 15, prixMax: 5, verdict: "R", note: "" }]
    };
    vi.stubGlobal("fetch", vi.fn((url, options) => {
      const body = JSON.parse(options.body);
      const j = body.tools ? reponseGroundeeVide : reponseSchemaRemplie;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(j) }] }, finishReason: "STOP" }]
        })
      });
    }));

    const { callGemini } = await import("../src/api/gemini.js");
    await callGemini("analyse ce bac", [], 'bac');

    expect(aiResults.innerHTML).toContain("The Wall");
    // Marqueur exact de l'état "rien de lisible" (fiche.js) — pas une
    // recherche de sous-chaîne large, qui matcherait aussi un message de
    // diagnostic interne mentionnant le même mot.
    expect(aiResults.innerHTML).not.toContain('class="empty-state"');
  });

  it("TOUS les essais reviennent avec un lot vide : l'écran affiche honnêtement « Rien de lisible » (pas un échec caché)", async () => {
    const reponseVide = { typeBac: "vinyles", resume: "rien de net", lot: [] };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(reponseVide) }] }, finishReason: "STOP" }]
      })
    })));

    const { callGemini } = await import("../src/api/gemini.js");
    await callGemini("analyse ce bac", [], 'bac');

    expect(aiResults.innerHTML).toContain('class="empty-state"');
    expect(aiResults.innerHTML).toContain("Rien de lisible");
  });
});
