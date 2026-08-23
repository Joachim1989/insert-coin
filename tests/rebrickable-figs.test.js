// Non-régression sur legoSet()/legoValeur() (src/api/rebrickable.js), et
// legoCarte() (src/ui/fiche.js) — correctif du 23/08/2026 (voir
// docs/diagnostic-cotation.md, "Rebrickable 0 figurine"). Avant : une
// coupure réseau entre l'appel "set" et l'appel "minifigs" laissait
// figs=0 (catch vide), un prix calculé comme si le set n'avait vraiment
// aucune figurine — silencieux, affiché avec la même confiance qu'un vrai
// 0. Un set à plusieurs figurines (~3€/figurine) voit sa cote sous-évaluée
// sans qu'aucun signal ne le montre.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { poserDomMinimal } from "./helpers/domStub.js";

beforeEach(() => {
  poserDomMinimal();
  localStorage.setItem("insertcoin.rebrickable.key", "cle-de-test");
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("legoSet() — figurines inconnues distinguées de zéro figurine réel", () => {
  it("figsConnu:false quand l'appel minifigs échoue (réseau), figs à 0 sans le présenter comme certain", async () => {
    let appel = 0;
    vi.stubGlobal("fetch", vi.fn((url) => {
      appel++;
      if(String(url).includes("/minifigs/")) return Promise.reject(new Error("Failed to fetch"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ set_num: "75192-1", name: "Millennium Falcon", year: 2017, num_parts: 7541, set_img_url: "" }) });
    }));

    const { legoSet } = await import("../src/api/rebrickable.js");
    const cote = await legoSet("75192");

    expect(cote.figs).toBe(0);
    expect(cote.figsConnu).toBe(false); // c'est ça, la distinction qui manquait
    expect(appel).toBe(2); // les deux appels ont bien été tentés
  });

  it("figsConnu:true et le vrai compte quand l'appel minifigs réussit", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if(String(url).includes("/minifigs/")){
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ quantity: 5 }, { quantity: 2 }] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ set_num: "75192-1", name: "Millennium Falcon", year: 2017, num_parts: 7541, set_img_url: "" }) });
    }));

    const { legoSet } = await import("../src/api/rebrickable.js");
    const cote = await legoSet("75192");

    expect(cote.figs).toBe(7);
    expect(cote.figsConnu).toBe(true);
  });

  it("figsConnu:true avec figs:0 quand le set n'a VRAIMENT aucune figurine (résultat vide, pas une erreur)", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if(String(url).includes("/minifigs/")){
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ set_num: "4321-1", name: "Set sans figurine", year: 2020, num_parts: 200, set_img_url: "" }) });
    }));

    const { legoSet } = await import("../src/api/rebrickable.js");
    const cote = await legoSet("4321");

    expect(cote.figs).toBe(0);
    expect(cote.figsConnu).toBe(true); // vrai zéro, pas une inconnue
  });
});

describe("legoValeur() — n'inclut pas les figurines dans le total quand elles sont inconnues", () => {
  it("figsConnu:false → total exclut la part figurines, ne prétend pas savoir", async () => {
    const { legoValeur } = await import("../src/api/rebrickable.js");
    const c = { pieces: 1000, figs: 0, figsConnu: false };
    const v = legoValeur(c);
    expect(v.figs).toBe(0);
    expect(v.figsConnu).toBe(false);
  });

  it("figsConnu:true avec figs:0 → total à 0 pour les figurines, mais marqué connu", async () => {
    const { legoValeur } = await import("../src/api/rebrickable.js");
    const c = { pieces: 1000, figs: 0, figsConnu: true };
    const v = legoValeur(c);
    expect(v.figsConnu).toBe(true);
  });
});

describe("legoCarte() — affiche « inconnu » plutôt que « 0 » quand figsConnu est faux", () => {
  it("figurines inconnues : le texte dit « inconnu », pas « 0 », et le total est qualifié", async () => {
    poserDomMinimal();
    const { legoCarte } = await import("../src/ui/fiche.js");
    const html = legoCarte({ num: "75192-1", nom: "Millennium Falcon", annee: 2017, pieces: 7541, figs: 0, figsConnu: false });
    expect(html).toContain("inconnu");
    expect(html).not.toMatch(/<b>0<\/b>\s*<span>figurines/);
    expect(html).toMatch(/au moins/i);
  });

  it("figurines vraiment nulles : affiche 0 normalement, sans qualificatif d'incertitude", async () => {
    poserDomMinimal();
    const { legoCarte } = await import("../src/ui/fiche.js");
    const html = legoCarte({ num: "4321-1", nom: "Set sans figurine", annee: 2020, pieces: 200, figs: 0, figsConnu: true });
    expect(html).not.toContain("inconnu");
    expect(html).not.toMatch(/au moins/i);
  });
});
