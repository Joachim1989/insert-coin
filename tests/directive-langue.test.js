// Retour de terrain du 31/08/2026 : le contenu ecrit par Gemini
// lui-meme (titre, explications, notes) restait toujours en francais,
// meme interface basculee en neerlandais - seul le texte de l'app avait
// ete traduit, jamais le prompt envoye au modele.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

function elFactice(){
  return { innerHTML: "", textContent: "", value: "", classList: { add(){}, remove(){}, toggle(){} } };
}

let directiveLangue, callGemini, localeSet;
let aiResults;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  globalThis.window.scrollTo = () => {};
  aiResults = elFactice();
  globalThis.document.getElementById = id => (id === "ai-results" ? aiResults : elFactice());
  ({ directiveLangue, callGemini } = await import("../src/api/gemini.js"));
  ({ localeSet } = await import("../src/i18n/index.js"));
});

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  localStorage.setItem("insertcoin.gemini.key", "clef-test");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("directiveLangue() — décision pure", () => {
  it("français (langue par défaut) : aucune consigne ajoutée", () => {
    localeSet("fr");
    expect(directiveLangue()).toBe("");
  });

  it("néerlandais : une consigne de langue, une seule ligne", () => {
    localeSet("nl");
    expect(directiveLangue()).toBe("\nRéponds dans tous les champs texte en néerlandais.");
  });
});

describe("callGemini() — le prompt réellement envoyé à Gemini", () => {
  it("en français : le texte envoyé est EXACTEMENT le prompt d'origine, au caractère près (zéro risque sur le comportement déjà calibré)", async () => {
    localeSet("fr");
    let corpsEnvoye = null;
    vi.stubGlobal("fetch", vi.fn((url, options) => {
      corpsEnvoye = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"objet":"Test"}' }] }, finishReason: "STOP" }]
        })
      });
    }));

    await callGemini("Identifie cet objet précisément.", [], 'single');

    const texteEnvoye = corpsEnvoye.contents[0].parts[0].text;
    expect(texteEnvoye).toBe("Identifie cet objet précisément.");
  });

  it("en néerlandais : la consigne de langue est ajoutée à la fin du prompt envoyé", async () => {
    localeSet("nl");
    let corpsEnvoye = null;
    vi.stubGlobal("fetch", vi.fn((url, options) => {
      corpsEnvoye = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"objet":"Test"}' }] }, finishReason: "STOP" }]
        })
      });
    }));

    await callGemini("Identifie cet objet précisément.", [], 'single');

    const texteEnvoye = corpsEnvoye.contents[0].parts[0].text;
    expect(texteEnvoye).toBe("Identifie cet objet précisément.\nRéponds dans tous les champs texte en néerlandais.");
    localeSet("fr");
  });
});
