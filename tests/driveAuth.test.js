// Non-régression sur driveAuth() (src/api/googledrive.js), correctif du
// 23/08/2026 : un loadGIS() qui échoue (budget de temps dépassé ou toute
// autre cause) devenait un rejet de promesse jamais intercepté par
// driveConnect()/drivePick()/driveSync() (ui/drive.js) — le bouton restait
// silencieusement figé. Teste le module réel (pas de mock de loadGIS lui-
// même) avec un DOM minimal fait à la main : pas besoin de jsdom pour un
// <script> qu'on ne fait qu'injecter et regarder échouer.
import { describe, it, expect, vi, beforeEach } from "vitest";

function domMinimal({ google, echoueScript } = {}){
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  globalThis.window = google ? { google } : {};
  if(google) globalThis.google = google;
  globalThis.document = {
    getElementById: () => null, // pas de champ #drive-cid dans ce test : repli sur driveCid()
    head: { appendChild: () => {} },
    createElement: () => {
      const el = {};
      // Simule le <script> qui échoue à charger (réseau qui traîne, coupé, etc.)
      setTimeout(() => { if(echoueScript && el.onerror) el.onerror(); }, 0);
      return el;
    }
  };
  globalThis.alert = vi.fn();
  return store;
}

beforeEach(() => {
  vi.resetModules(); // driveAuth garde un `tokenClient` de module — repartir propre à chaque test
});

describe("driveAuth", () => {
  it("alerte clairement et retourne null si le chargement de Google échoue, au lieu de rester bloqué en silence", async () => {
    const store = domMinimal({ echoueScript: true });
    store["insertcoin.drive.cid"] = "un-identifiant-de-test";

    const { driveAuth } = await import("../src/api/googledrive.js");
    const resultat = await driveAuth(true);

    expect(resultat).toBeNull();
    expect(globalThis.alert).toHaveBeenCalledTimes(1);
    expect(globalThis.alert.mock.calls[0][0]).toMatch(/Connexion à Google impossible/);
  });

  it("sans identifiant client configuré, alerte et retourne null avant même de tenter de charger Google", async () => {
    domMinimal({ echoueScript: true }); // pas de CID_STORE posé dans le store

    const { driveAuth } = await import("../src/api/googledrive.js");
    const resultat = await driveAuth(true);

    expect(resultat).toBeNull();
    expect(globalThis.alert.mock.calls[0][0]).toMatch(/identifiant client/);
  });

  it("quand Google est déjà chargé (fast-path de loadGIS), ne déclenche pas l'alerte d'échec", async () => {
    const store = domMinimal({ google: { accounts: { oauth2: {
      initTokenClient: ({ callback }) => ({ requestAccessToken: () => callback({ access_token: "jeton-factice", expires_in: 3600 }) })
    } } } });
    store["insertcoin.drive.cid"] = "un-identifiant-de-test";

    const { driveAuth } = await import("../src/api/googledrive.js");
    const resultat = await driveAuth(true);

    expect(resultat).toBe("jeton-factice");
    expect(globalThis.alert).not.toHaveBeenCalled();
  });
});
