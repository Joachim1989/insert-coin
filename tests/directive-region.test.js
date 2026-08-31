// Phase 1 de la note stratégique du 31/08/2026 (freemium/région) : un objet
// identique se vend différemment selon le marché local. Même mécanique que
// directiveLangue() (voir tests/directive-langue.test.js) : une consigne
// ajoutée EN TÊTE du prompt, seulement si une région est configurée — chaîne
// vide sinon, zéro risque sur le comportement déjà calibré sans réglage.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

function elFactice(){
  return { innerHTML: "", textContent: "", value: "", dataset: {},
    classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){} };
}

let directiveRegion, callGemini, localeSet;
let aiResults;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  globalThis.window.scrollTo = () => {};
  aiResults = elFactice();
  globalThis.document.getElementById = id => (id === "ai-results" ? aiResults : elFactice());
  ({ directiveRegion, callGemini } = await import("../src/api/gemini.js"));
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
  localeSet("fr");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("directiveRegion() — décision pure", () => {
  it("aucune région configurée : aucune consigne ajoutée", () => {
    expect(directiveRegion()).toBe("");
  });

  it("région vide après trim (espaces seuls) : traitée comme non configurée", () => {
    localStorage.setItem("insertcoin.region", "   ");
    expect(directiveRegion()).toBe("");
  });

  it("région configurée : la consigne cite la région exacte, présentée comme une orientation", () => {
    localStorage.setItem("insertcoin.region", "Binche, Belgique");
    const d = directiveRegion();
    expect(d).toContain("Binche, Belgique");
    expect(d).toMatch(/orientation|pas une garantie/i);
  });
});

describe("callGemini() — le prompt réellement envoyé à Gemini", () => {
  it("sans région configurée : le texte envoyé est EXACTEMENT le prompt d'origine, au caractère près", async () => {
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

  it("avec une région configurée : la consigne est placée EN TÊTE du prompt envoyé, avant celle de langue", async () => {
    localStorage.setItem("insertcoin.region", "Binche, Belgique");
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
    expect(texteEnvoye.startsWith("Binche, Belgique") || texteEnvoye.indexOf("Binche, Belgique") < texteEnvoye.indexOf("IMPORTANT")).toBe(true);
    expect(texteEnvoye).toContain("néerlandais");
    expect(texteEnvoye.endsWith("Identifie cet objet précisément.")).toBe(true);
    localeSet("fr");
  });
});
