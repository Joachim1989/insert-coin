// Non-régression sur le mode "Un stand" (src/ui/fiche.js), correctif du
// 23/08/2026 (voir docs/diagnostic-cotation.md) : c'est le seul écran de
// l'app qui affichait un montant en euros hors du pipeline ficheCalc — une
// "Revente ≈ X€" par objet repéré, jamais décotée (état, complétude, port,
// circulation), jamais croisée avec le journal ou la collection. Tranché
// avec l'utilisatrice : on garde l'écran (repérage rapide), on retire les
// montants (le seul vrai prix vient du mode "Un objet").
//
// Import dynamique après le stub DOM : les imports statiques sont hissés
// avant tout le reste d'un module (y compris un appel de fonction écrit
// avant eux dans le fichier), donc fiche.js évaluerait sa chaîne
// d'imports (jusqu'à capture.js et son window.addEventListener de
// niveau module) avant que le stub n'existe si on l'importait en haut.
import { describe, it, expect, beforeAll } from "vitest";

let standItemsHtml;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();
  ({ standItemsHtml } = await import("../src/ui/fiche.js"));
});

describe("standItemsHtml", () => {
  it("n'affiche plus de montant en euros même quand le modèle en fournit un", () => {
    const html = standItemsHtml([
      { nom: "Ampli Marantz", reventeEstimee: 150, interet: "Lourd, bon signe" }
    ]);
    expect(html).not.toMatch(/€/);
    expect(html).not.toMatch(/[Rr]evente/);
  });

  it("garde le nom et l'intérêt de l'objet repéré", () => {
    const html = standItemsHtml([
      { nom: "Ampli Marantz", interet: "Lourd, bon signe" }
    ]);
    expect(html).toContain("Ampli Marantz");
    expect(html).toContain("Lourd, bon signe");
  });

  it("garde la vérification suggérée si le modèle en donne une", () => {
    const html = standItemsHtml([
      { nom: "Reflex Nikon", verifsStand: "Déclenche à toutes les vitesses" }
    ]);
    expect(html).toContain("Déclenche à toutes les vitesses");
  });

  it("message de repli quand rien n'est repéré", () => {
    expect(standItemsHtml([])).toMatch(/[Rr]ien de très évident/);
    expect(standItemsHtml(null)).toMatch(/[Rr]ien de très évident/);
  });
});
