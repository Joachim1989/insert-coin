// Integration PriceCharting (jeux video), demande du 02/09/2026. API PAYANTE
// cote de leur part (voir la note deja presente dans fiche.js avant ce
// chantier : "PriceCharting fait payer la sienne") - contrairement a
// Discogs/Rebrickable/Brickset, aucun palier gratuit. Meme mecanique BYOK
// que les 3 autres malgre tout : qui a une cle en profite, les autres
// gardent le comportement actuel (estimation Gemini seule), rien ne change
// pour eux.
//
// Choix delibere : PriceCharting renvoie des prix en DOLLARS US, jamais
// convertis. Contrairement a Discogs (curr_abbr:"EUR") et Brickset/Rebrickable
// (toujours reellement en euros, voir brickPrixNeuf()), il n'y a ici aucune
// conversion fiable a portee de main sans introduire un taux fige qui
// se perime silencieusement. pcGreffe() n'ecrase donc JAMAIS FICHE.marcheReel
// (contrairement a discGreffe()/legoGreffe()) : carte purement informative,
// prix affiches en $ explicitement, jamais confondus avec des euros.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { poserDomMinimal } from "./helpers/domStub.js";
import { localeSet } from "../src/i18n/index.js";

let pcJeuVideo;

beforeEach(async () => {
  poserDomMinimal();
  ({ pcJeuVideo } = await import("../src/api/pricecharting.js"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("pcJeuVideo() — decision pure, meme registre que discMusique()", () => {
  it("texte trop court : jamais declenche (evite un faux positif sur une recherche vide)", () => {
    expect(pcJeuVideo("ab")).toBe(false);
  });

  it("plateformes/mots-cles jeu video : declenche", () => {
    expect(pcJeuVideo("Zelda Ocarina of Time Nintendo 64")).toBe(true);
    expect(pcJeuVideo("Super Mario World SNES cartouche")).toBe(true);
    expect(pcJeuVideo("Final Fantasy VII PS1 complet")).toBe(true);
  });

  it("objet manifestement pas un jeu video : ne declenche pas", () => {
    expect(pcJeuVideo("Théière en porcelaine de Boch Keramis")).toBe(false);
    expect(pcJeuVideo("Vélo de course vintage Eddy Merckx")).toBe(false);
  });
});

describe("pcGreffe() — memes garanties d'erreur que discGreffe()/legoGreffe() (voir tests/greffe-erreurs.test.js)", () => {
  beforeEach(() => {
    localStorage.setItem("insertcoin.pricecharting.key", "cle-test-pc");
  });

  it("panne réseau : message explicite, pas un silence", async () => {
    const el = { innerHTML: "" };
    globalThis.document.getElementById = id => (id === "pc-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Failed to fetch"))));

    const { pcGreffe } = await import("../src/ui/fiche.js");
    await pcGreffe("Zelda Ocarina of Time N64", "pc-slot");

    expect(el.innerHTML).not.toBe("");
    expect(el.innerHTML.toLowerCase()).toMatch(/réseau|injoignable/);
  });

  it("clé refusée : message spécifique", async () => {
    const el = { innerHTML: "" };
    globalThis.document.getElementById = id => (id === "pc-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })));

    const { pcGreffe } = await import("../src/ui/fiche.js");
    await pcGreffe("Zelda Ocarina of Time N64", "pc-slot");

    expect(el.innerHTML).toContain("refusée");
  });

  it("sans clé configurée : ne fait rien (pas d'appel réseau, pas d'erreur affichée)", async () => {
    localStorage.removeItem("insertcoin.pricecharting.key");
    const el = { innerHTML: "" };
    globalThis.document.getElementById = id => (id === "pc-slot" ? el : null);
    const fetchEspion = vi.fn();
    vi.stubGlobal("fetch", fetchEspion);

    const { pcGreffe } = await import("../src/ui/fiche.js");
    await pcGreffe("Zelda Ocarina of Time N64", "pc-slot");

    expect(fetchEspion).not.toHaveBeenCalled();
    expect(el.innerHTML).toBe("");
  });

  it("clé refusée, en néerlandais : message traduit (même chantier que legoGreffe/brickGreffe)", async () => {
    localeSet("nl");
    const el = { innerHTML: "" };
    globalThis.document.getElementById = id => (id === "pc-slot" ? el : null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })));

    const { pcGreffe } = await import("../src/ui/fiche.js");
    await pcGreffe("Zelda Ocarina of Time N64", "pc-slot");

    expect(el.innerHTML).toContain("geweigerd");
    expect(el.innerHTML).not.toContain("refusée");
    localeSet("fr");
  });
});

describe("pcCarte() — prix toujours affichés en $ explicite, jamais en €", () => {
  it("n'affiche jamais le symbole € (la source est en dollars US, pas en euros)", async () => {
    const { pcCarte } = await import("../src/ui/fiche.js");
    const html = pcCarte({ nom: "The Legend of Zelda: Ocarina of Time", console: "Nintendo 64",
      loose: 45, cib: 90, neuf: 350, url: "https://www.pricecharting.com/game/example" });
    expect(html).not.toContain("€");
    expect(html).toContain("$");
  });
});
