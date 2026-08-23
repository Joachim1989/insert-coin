// Non-régression sur le budget de temps réseau (src/util/fetchTimeout.js),
// correctif du 23/08/2026 : aucun appel de l'app n'abandonnait jamais avant
// ça (voir docs/diagnostic-cotation.md). Utilise les timers factices de
// Vitest : aucune vraie attente, le temps est avancé à la main.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAvecDelai, avecDelai } from "../src/util/fetchTimeout.js";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("fetchAvecDelai", () => {
  it("résout normalement quand fetch répond avant le délai", async () => {
    const reponse = { ok: true };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(reponse)));

    const p = fetchAvecDelai("https://exemple.test/x", {}, 5000);
    await expect(p).resolves.toBe(reponse);
  });

  it("passe un signal AbortController à fetch", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAvecDelai("https://exemple.test/x", { method: "GET" }, 5000);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.method).toBe("GET"); // les options d'origine ne sont pas perdues
  });

  it("abandonne après le délai si fetch ne répond jamais (réseau qui traîne, pas coupé)", async () => {
    // Une requête qui ne se résout JAMAIS toute seule — exactement le cas
    // "signal présent, pas de débit" qui ne déclenche aucune erreur
    // navigateur classique. Un vrai fetch() rejette quand son signal
    // s'abandonne : le mock reproduit ce comportement, sinon le test ne
    // prouve rien (une promesse qui ignorerait l'abandon ne serait pas
    // détectée non plus par du vrai code qui ferait la même erreur).
    vi.stubGlobal("fetch", vi.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        reject(err);
      });
    })));

    const p = fetchAvecDelai("https://exemple.test/x", {}, 12000);
    const attente = expect(p).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(12000);
    await attente;
  });

  it("n'abandonne pas avant le délai configuré", async () => {
    let resolveFetch;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolveFetch = r; })));

    const p = fetchAvecDelai("https://exemple.test/x", {}, 12000);
    await vi.advanceTimersByTimeAsync(11000); // juste avant le budget
    resolveFetch({ ok: true });
    await expect(p).resolves.toEqual({ ok: true });
  });
});

describe("avecDelai", () => {
  it("résout avec la valeur de la promesse si elle arrive à temps", async () => {
    const p = avecDelai(Promise.resolve("ok"), 5000, "trop long");
    await expect(p).resolves.toBe("ok");
  });

  it("rejette avec le message fourni si la promesse ne se règle jamais", async () => {
    const jamais = new Promise(() => {});
    const p = avecDelai(jamais, 8000, "Chargement Google impossible (délai dépassé)");
    const attente = expect(p).rejects.toThrow("Chargement Google impossible (délai dépassé)");
    await vi.advanceTimersByTimeAsync(8000);
    await attente;
  });
});
