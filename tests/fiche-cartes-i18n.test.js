// Verifie que les cartes de cote (discCarte/legoCarte/brickCarte,
// src/ui/fiche.js) et le mode Stand parlent la langue active - chantier
// neerlandais, phase 2, tranche 4 (30/08/2026).
//
// Limite assumee, pas cachee : discLire() (src/api/discogs.js) calcule
// lui-meme du texte francais en dur (rarete, demande) - hors de portee
// de cette tranche, qui ne touche que fiche.js. Ce texte reste donc en
// francais meme cote nl ; verifie explicitement plus bas plutot que
// suppose.
import { describe, it, expect, beforeAll } from "vitest";

let discCarte, legoCarte, brickCarte, standItemsHtml, localeSet;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  ({ discCarte, legoCarte, brickCarte, standItemsHtml } = await import("../src/ui/fiche.js"));
  ({ localeSet } = await import("../src/i18n/index.js"));
});

const DISC_EXEMPLE = { artiste: "Pink Floyd", titre: "The Wall", annee: "1979", label: "Harvest",
  format: "LP", bas: 20, envente: 12, ont: 500, veulent: 100, url: "https://discogs.example" };

const LEGO_EXEMPLE = { nom: "Millennium Falcon", num: "75192", annee: "2017",
  pieces: 7541, figs: 8 };

const BRICK_EXEMPLE = { nom: "Millennium Falcon", num: "75192", annee: "2017",
  pieces: 7541, figs: 8, prixNeuf: 850, prixDev: "USD", url: "https://brickset.example" };

describe("discCarte() — langue active, texte de discLire() volontairement laissé de côté", () => {
  it("en néerlandais : les libellés autour des chiffres basculent", () => {
    localeSet("nl");
    const html = discCarte(DISC_EXEMPLE);
    expect(html).toContain("goedkoopste te koop");
    expect(html).toContain("exemplaren beschikbaar");
    expect(html).toContain("Discogs-fiche openen");
    // Donnée réelle (artiste/titre), jamais traduite.
    expect(html).toContain("Pink Floyd");
    expect(html).toContain("The Wall");
  });
});

describe("legoCarte() — langue active", () => {
  it("en néerlandais, figurines connues : libellés en néerlandais, chiffres intacts", () => {
    localeSet("nl");
    const html = legoCarte(LEGO_EXEMPLE);
    expect(html).toContain("onderdelen");
    expect(html).toContain("poppetjes");
    expect(html).toContain("compleet, zonder doos");
    expect(html).toContain("Set bekijken");
    expect(html).toContain("7541");
    expect(html).toContain("8");
    expect(html).not.toContain("onbekend"); // figurines connues, pas "inconnu"
  });

  it("en néerlandais, figurines inconnues (coupure réseau, figsConnu:false) : 'onbekend', jamais un faux zéro", () => {
    localeSet("nl");
    const html = legoCarte({ ...LEGO_EXEMPLE, figsConnu: false });
    expect(html).toContain("onbekend");
    expect(html).toContain("minstens"); // "au moins {n}€"
    expect(html).toContain("poppetjes niet geteld (netwerk)");
  });
});

describe("brickCarte() — langue active", () => {
  it("en néerlandais : libellés en néerlandais, marque Brickset intacte", () => {
    localeSet("nl");
    const html = brickCarte(BRICK_EXEMPLE);
    expect(html).toContain("onderdelen");
    expect(html).toContain("poppetjes");
    expect(html).toContain("nieuw (USD)");
    expect(html).toContain("Set bekijken");
    expect(html).toContain("Brickset");
  });
});

describe("standItemsHtml() — langue active (complète tests/fiche-stand.test.js, qui ne teste que le français)", () => {
  it("en néerlandais : message de repli et libellé 'sans nom' traduits", () => {
    localeSet("nl");
    expect(standItemsHtml([])).toContain("Niets echt opvallends");
    expect(standItemsHtml([{ interet: "x" }])).toContain("Object zonder naam");
    localeSet("fr");
  });
});
