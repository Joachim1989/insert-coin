// Non-régression : legoGreffe()/brickGreffe() (src/ui/fiche.js) alignées sur
// discGreffe(), correctif du 23/08/2026 (voir docs/diagnostic-cotation.md).
// Avant : seule l'erreur "CLE" (jeton/clé refusé) avait un message — toute
// autre cause (panne réseau, timeout, HTTP 500...) retombait sur une carte
// vide, exactement le même écran qu'un "pas configuré" ou un "rien trouvé"
// légitime. discGreffe() distinguait déjà ces cas ; il n'y a aucune raison
// que Rebrickable/Brickset fassent moins bien.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { poserDomMinimal } from "./helpers/domStub.js";

function elementFactice(){
  return { innerHTML: "" };
}

beforeEach(() => {
  poserDomMinimal();
  localStorage.setItem("insertcoin.rebrickable.key", "cle-test");
  localStorage.setItem("insertcoin.brickset.key", "cle-test-brick");
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("legoGreffe() — messages d'erreur distincts, alignés sur discGreffe()", () => {
  it("panne réseau : message explicite, pas un silence qui ressemble à « rien trouvé »", async () => {
    const el = elementFactice();
    globalThis.document.getElementById = id => (id === "lego-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Failed to fetch"))));

    const { legoGreffe } = await import("../src/ui/fiche.js");
    await legoGreffe({ objet: "LEGO 75192", categorie: "jouets", code: "75192" }, "lego-slot");

    expect(el.innerHTML).not.toBe("");
    expect(el.innerHTML.toLowerCase()).toMatch(/réseau|injoignable/);
  });

  it("clé refusée : message spécifique conservé (déjà correct avant)", async () => {
    const el = elementFactice();
    globalThis.document.getElementById = id => (id === "lego-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })));

    const { legoGreffe } = await import("../src/ui/fiche.js");
    await legoGreffe({ objet: "LEGO 75192", categorie: "jouets", code: "75192" }, "lego-slot");

    expect(el.innerHTML).toContain("refusée");
  });

  it("erreur générique (ex. HTTP 500) : le message réel s'affiche, pas un silence", async () => {
    const el = elementFactice();
    globalThis.document.getElementById = id => (id === "lego-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })));

    const { legoGreffe } = await import("../src/ui/fiche.js");
    await legoGreffe({ objet: "LEGO 75192", categorie: "jouets", code: "75192" }, "lego-slot");

    expect(el.innerHTML).not.toBe("");
    expect(el.innerHTML).toContain("500");
  });
});

describe("brickGreffe() — mêmes garanties que legoGreffe()", () => {
  it("panne réseau : message explicite", async () => {
    // brickGreffe() ne se déclenche que si legoKey() est VIDE (voir la garde
    // en tête de fonction : if(!brickKey() || legoKey()) return;) — à
    // l'inverse du beforeEach global, qui pose les deux clés pour les tests
    // Rebrickable ci-dessus.
    localStorage.removeItem("insertcoin.rebrickable.key");
    const el = elementFactice();
    globalThis.document.getElementById = id => (id === "brick-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Failed to fetch"))));

    const { brickGreffe } = await import("../src/ui/fiche.js");
    await brickGreffe({ objet: "LEGO 75192", categorie: "jouets", code: "75192" }, "brick-slot");

    expect(el.innerHTML).not.toBe("");
    expect(el.innerHTML.toLowerCase()).toMatch(/réseau|injoignable/);
  });
});
