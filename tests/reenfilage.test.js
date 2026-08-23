// Non-régression sur devraitReenfiler() (src/api/gemini.js), correctif du
// 23/08/2026 (voir docs/diagnostic-cotation.md, "objet en file qui
// disparaît"). Avant : callGemini() ne remettait JAMAIS en file un job qui
// venait déjà de la file (condition `&& !fromQueue`) — un réseau qui
// flanche (revient un instant, retombe en pleine requête) faisait perdre
// l'objet en silence, sans jamais le renvoyer dans la file ni prévenir
// qui que ce soit. Fonction extraite pure : la décision "faut-il remettre
// en file" ne dépend que du message d'erreur et du nombre de tentatives
// déjà faites, testable sans réseau ni DOM.
import { describe, it, expect, beforeAll } from "vitest";

let devraitReenfiler, TENTATIVES_MAX;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  ({ devraitReenfiler, TENTATIVES_MAX } = await import("../src/api/gemini.js"));
});

describe("devraitReenfiler", () => {
  it("erreur réseau, aucune tentative encore faite : oui", () => {
    expect(devraitReenfiler("Failed to fetch", 0)).toBe(true);
  });

  it("erreur réseau, déjà venu de la file une fois (tentatives=1) : oui, tant qu'on est sous le plafond", () => {
    // C'est exactement le cas qui manquait avant : un job déjà repassé une
    // fois par la file doit pouvoir y repasser encore, jusqu'au plafond -
    // pas juste une fois.
    expect(devraitReenfiler("Failed to fetch", 1)).toBe(true);
  });

  it("erreur réseau, plafond de tentatives atteint : non — on arrête, pour ne pas boucler indéfiniment sur un réseau mort", () => {
    expect(devraitReenfiler("Failed to fetch", TENTATIVES_MAX)).toBe(false);
    expect(devraitReenfiler("NetworkError when attempting to fetch", TENTATIVES_MAX)).toBe(false);
  });

  it("erreur non réseau (ex. clé refusée) : non, quel que soit le nombre de tentatives — remettre en file ne réparera rien", () => {
    expect(devraitReenfiler("HTTP 403 — API_KEY_INVALID", 0)).toBe(false);
  });

  it("le plafond existe et est un nombre fini et raisonnable (pas 0, pas illimité)", () => {
    expect(TENTATIVES_MAX).toBeGreaterThan(0);
    expect(TENTATIVES_MAX).toBeLessThan(10);
  });
});
