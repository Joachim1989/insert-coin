// Demande du 01/09/2026 : le calendrier des brocantes (calFetch()) restait
// codé en dur sur "Binche, 50 km" quel que soit le réglage Région ajouté en
// Phase 1 (voir tests/directive-region.test.js) — les deux réglages
// couvrent le même besoin ("où es-tu basé ?"), autant les relier plutôt que
// dupliquer un second champ "ta ville".
// Même occasion pour élargir les sources cherchées : Facebook (événements
// et groupes locaux) et la presse régionale ratent beaucoup de petites
// brocantes communales que les gros agendas ne référencent pas.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

let calBrief, calLieu, calSousTitreVars;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  ({ calBrief, calLieu, calSousTitreVars } = await import("../src/ui/calendar.js"));
});

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
});

describe("calBrief() — décision pure, aucun réseau", () => {
  it("aucune région configurée : Binche par défaut, avec l'hypothèse géographique BE/nord de la France", () => {
    const b = calBrief("2026-09-01");
    expect(b).toContain("Binche (7130, Belgique)");
    expect(b).toContain("nord de la France (Nord, Aisne, Ardennes)");
    expect(b).toContain("distance approximative depuis Binche");
  });

  it("région configurée : remplace Binche partout, sans l'hypothèse géographique figée sur la Belgique/le nord de la France", () => {
    localStorage.setItem("insertcoin.region", "Toulouse, France");
    const b = calBrief("2026-09-01");
    expect(b).toContain("Toulouse, France");
    expect(b).not.toContain("Binche");
    expect(b).not.toContain("nord de la France (Nord, Aisne, Ardennes)");
    expect(b).toContain("distance approximative depuis Toulouse, France");
  });

  it("dans les deux cas : sources élargies (Facebook, presse régionale) en plus des agendas déjà utilisés", () => {
    const b = calBrief("2026-09-01");
    expect(b).toContain("Facebook");
    expect(b).toMatch(/presse régionale|Sudinfo|La Voix du Nord/);
    // Les sources d'origine restent présentes, rien retiré.
    expect(b).toContain("quefaire.be");
    expect(b).toContain("brocabrac.fr");
    expect(b).toContain("vide-greniers.org");
    expect(b).toContain("brocantes.be");
  });

  it("la date du jour reçue en paramètre se retrouve telle quelle dans le prompt", () => {
    const b = calBrief("2026-09-01");
    expect(b).toContain("Nous sommes le 2026-09-01");
  });
});

describe("calSousTitreVars() — variables du sous-titre affiché (demande du 01/09/2026 : liste déroulante BE/FR)", () => {
  // aucuneRegion, pas un fragment de texte en dur : la traduction elle-même
  // (cal.sous_titre_pays) se résout via t() dans calSousTitrePaint(), pas ici
  // — cette fonction reste indépendante de la langue active.
  it("aucune région configurée : lieu = Binche, l'hypothèse Belgique/France reste affichée", () => {
    expect(calSousTitreVars()).toEqual({ lieu: "Binche", aucuneRegion: true });
  });

  it("région configurée (ex. choisie dans la liste déroulante) : lieu = la région, plus d'hypothèse figée sur Belgique/France", () => {
    localStorage.setItem("insertcoin.region", "Charleroi, Belgique");
    expect(calLieu()).toBe("Charleroi, Belgique");
    expect(calSousTitreVars()).toEqual({ lieu: "Charleroi, Belgique", aucuneRegion: false });
  });
});
