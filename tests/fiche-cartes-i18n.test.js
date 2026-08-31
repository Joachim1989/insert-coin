// Verifie que les cartes de cote (discCarte/legoCarte/brickCarte,
// src/ui/fiche.js) et le mode Stand parlent la langue active - chantier
// neerlandais, phase 2, tranche 4 (30/08/2026).
//
// Mise a jour du 31/08/2026 : discLire() (src/api/discogs.js) calculait
// lui-meme du texte francais en dur (rarete, demande), hors de portee de
// la tranche 4 (qui ne touchait que fiche.js). Autorisation explicite
// obtenue le meme jour pour l'etendre a ce fichier — voir le describe
// "discLire()" plus bas, qui remplace l'ancienne limite assumee par une
// vraie couverture.
import { describe, it, expect, beforeAll } from "vitest";

let discCarte, legoCarte, brickCarte, standItemsHtml, localeSet;
let discLire;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  ({ discCarte, legoCarte, brickCarte, standItemsHtml } = await import("../src/ui/fiche.js"));
  ({ discLire } = await import("../src/api/discogs.js"));
  ({ localeSet } = await import("../src/i18n/index.js"));
});

const DISC_EXEMPLE = { artiste: "Pink Floyd", titre: "The Wall", annee: "1979", label: "Harvest",
  format: "LP", bas: 20, envente: 12, ont: 500, veulent: 100, url: "https://discogs.example" };

const LEGO_EXEMPLE = { nom: "Millennium Falcon", num: "75192", annee: "2017",
  pieces: 7541, figs: 8 };

const BRICK_EXEMPLE = { nom: "Millennium Falcon", num: "75192", annee: "2017",
  pieces: 7541, figs: 8, prixNeuf: 850, prixDev: "USD", url: "https://brickset.example" };

describe("discCarte() — langue active", () => {
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

  it("en néerlandais : le texte calculé par discLire() (rareté, demande) suit aussi la langue — plus une limite assumée depuis le 31/08/2026", () => {
    localeSet("nl");
    // envente:12 (>0, <=40) -> "Seulement N en vente" ; ont:500, veulent:100
    // -> ratio 0.2 (<0.4, mais ont>0) -> "Peu demandé".
    const html = discCarte(DISC_EXEMPLE);
    expect(html).toContain("Slechts 12 te koop");
    expect(html).toContain("Weinig gevraagd");
    expect(html).not.toContain("Seulement 12 en vente");
    localeSet("fr");
  });
});

describe("discLire() — langue active, en isolation", () => {
  it("pressage massif (>150 en vente), en anglais : phrase complète avec le nombre intact", () => {
    localeSet("en");
    const l = discLire({ ont: 500, veulent: 600, envente: 200, bas: 20 });
    expect(l.rarete).toBe("Mass pressing — 200 for sale");
    expect(l.demande).toContain("More people want it than own it");
    localeSet("fr");
  });

  it("aucun exemplaire en vente, en français (comportement par défaut inchangé)", () => {
    localeSet("fr");
    const l = discLire({ ont: 10, veulent: 2, envente: 0, bas: 0 });
    expect(l.rarete).toBe("Aucun exemplaire en vente");
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
