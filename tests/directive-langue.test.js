// Retour de terrain du 31/08/2026 : le contenu ecrit par Gemini
// lui-meme (titre, explications, notes) restait toujours en francais,
// meme interface basculee en neerlandais - seul le texte de l'app avait
// ete traduit, jamais le prompt envoye au modele.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

function elFactice(){
  return { innerHTML: "", textContent: "", value: "", dataset: {},
    classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){} };
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

  it("néerlandais : une consigne de langue, citant des noms de champ concrets", () => {
    localeSet("nl");
    const d = directiveLangue();
    expect(d).toContain("néerlandais");
    expect(d).toContain('"resume"');
    expect(d).toContain('"note"');
  });

  it("anglais (31/08/2026, troisième langue) : même mécanique, aucun code dupliqué à vérifier", () => {
    localeSet("en");
    const d = directiveLangue();
    expect(d).toContain("anglais");
    expect(d).toContain('"resume"');
    localeSet("fr");
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

  it("en néerlandais : la consigne de langue est placée EN TÊTE du prompt envoyé (deuxième retour de terrain : reléguée en fin de prompt, elle semblait avoir moins de poids)", async () => {
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
    expect(texteEnvoye.startsWith("IMPORTANT")).toBe(true);
    expect(texteEnvoye).toContain("néerlandais");
    expect(texteEnvoye.endsWith("Identifie cet objet précisément.")).toBe(true);
    localeSet("fr");
  });

  it("un résultat déjà en cache EN FRANÇAIS ne court-circuite plus la requête une fois basculé en néerlandais (retour de terrain du 31/08/2026 : c'est ce qui faisait croire que le correctif ne marchait pas)", async () => {
    const cacheKey = "t:testquery|";
    // Simule une recherche mise en cache AVANT ce correctif (clé brute,
    // sans langue — c'est le format que produisait le code bogué, donc
    // aussi celui de toute vraie entrée déjà présente sur un téléphone
    // au moment du basculement). Le cache vit 24h, voir
    // cacheGet()/storage/local.js.
    localStorage.setItem("insertcoin.cache2", JSON.stringify({
      [cacheKey]: { t: Date.now(), j: { objet: "Résultat français en cache" } }
    }));

    localeSet("nl");
    let fetchAppele = false;
    vi.stubGlobal("fetch", vi.fn(() => {
      fetchAppele = true;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '{"objet":"Resultaat"}' }] }, finishReason: "STOP" }]
        })
      });
    }));

    await callGemini("Identifie cet objet précisément.", [], 'single', false, cacheKey);

    // Sans le correctif, ceci resterait false : le cache francais aurait
    // repondu directement, sans jamais rappeler Gemini ni voir la
    // consigne de langue.
    expect(fetchAppele).toBe(true);
    localeSet("fr");
  });
});
