// Non-régression sur driveSync() (src/ui/drive.js), correctif du
// 23/08/2026 (voir docs/diagnostic-cotation.md, "synchro Drive
// silencieusement partielle"). Avant : chaque fichier en échec tombait
// dans un catch qui ne faisait qu'un console.warn — invisible sur le
// terrain — ET la synchro AUTOMATIQUE (au démarrage, le cas le plus
// fréquent) n'affichait jamais rien du tout, même en cas d'échec total
// d'un fichier. SYNC_STORE (date de "dernière synchro") était mis à jour
// même quand un fichier avait échoué, laissant croire à une collection
// à jour alors qu'elle ne l'était pas.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { poserDomMinimal } from "./helpers/domStub.js";

function elementFactice(){ return { innerHTML: "" }; }
// SYNC_STORE (src/storage/local.js) vaut "insertcoin.drive.sync" —
// clé utilisée partout ci-dessous.
const SYNC_KEY = "insertcoin.drive.sync";

beforeEach(() => {
  poserDomMinimal();
  // driveAuth() (src/api/googledrive.js) exige un identifiant client AVANT
  // même de regarder le jeton en cache — sans ça, il alerte et rend null.
  localStorage.setItem("insertcoin.drive.cid", "identifiant-de-test");
  localStorage.setItem("insertcoin.drive.tok", JSON.stringify({ t: "jeton-test", exp: Date.now() + 3600000 }));
  localStorage.setItem("insertcoin.drive.files", JSON.stringify([
    { id: "ok-1", name: "vinyles.csv", mime: "text/csv", kind: "vinyles" },
    { id: "echec-1", name: "jeux.csv", mime: "text/csv", kind: "jeux" }
  ]));
  globalThis.alert = vi.fn();
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("driveSync() — échec partiel signalé, pas marqué comme synchro réussie", () => {
  it("un fichier en échec : SYNC_STORE n'est PAS mis à jour (la prochaine synchro auto réessaiera)", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if(String(url).includes("echec-1")) return Promise.reject(new Error("Failed to fetch"));
      return Promise.resolve({ ok: true, text: () => Promise.resolve("artiste,titre\nPink Floyd,The Wall\n") });
    }));
    const collState = elementFactice();
    globalThis.document.getElementById = id => (id === "coll-state" ? collState : null);

    const { driveSync } = await import("../src/ui/drive.js");
    await driveSync(false); // synchro automatique, pas manuelle — c'est le cas le plus fréquent

    expect(localStorage.getItem(SYNC_KEY)).toBeNull();
  });

  it("un fichier en échec : le message d'échec s'affiche même en synchro automatique (pas seulement manuelle)", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if(String(url).includes("echec-1")) return Promise.reject(new Error("Failed to fetch"));
      return Promise.resolve({ ok: true, text: () => Promise.resolve("artiste,titre\nPink Floyd,The Wall\n") });
    }));
    const collState = elementFactice();
    globalThis.document.getElementById = id => (id === "coll-state" ? collState : null);
    globalThis.alert = vi.fn(); // ne doit PAS être appelé (manuel=false)

    const { driveSync } = await import("../src/ui/drive.js");
    await driveSync(false);

    expect(collState.innerHTML.toLowerCase()).toMatch(/incomplèt|échec/);
    expect(globalThis.alert).not.toHaveBeenCalled(); // pas d'alert intrusif en automatique
  });

  it("les fichiers réussis sont quand même gardés (pas tout perdu à cause d'un seul échec)", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => {
      if(String(url).includes("echec-1")) return Promise.reject(new Error("Failed to fetch"));
      return Promise.resolve({ ok: true, text: () => Promise.resolve("artiste,titre\nPink Floyd,The Wall\n") });
    }));
    // Spécifique à l'id : sinon "drive-cid" reçoit aussi l'élément factice
    // (sans .value) et driveAuth() plante avant même d'atteindre le réseau.
    globalThis.document.getElementById = id => (id === "coll-state" ? elementFactice() : null);

    const { driveSync } = await import("../src/ui/drive.js");
    await driveSync(false);

    const coll = JSON.parse(localStorage.getItem("insertcoin.collection") || "[]");
    expect(coll.length).toBeGreaterThan(0);
  });

  it("tout réussit : SYNC_STORE est mis à jour normalement (aucune régression sur le cas nominal)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve("artiste,titre\nPink Floyd,The Wall\n") })));
    globalThis.document.getElementById = id => (id === "coll-state" ? elementFactice() : null);

    const { driveSync } = await import("../src/ui/drive.js");
    await driveSync(false);

    expect(localStorage.getItem(SYNC_KEY)).not.toBeNull();
  });
});
