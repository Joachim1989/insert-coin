// Non-régression sur des suppressions de marquage statique (dev.html).
// Ces assertions lisent le fichier source directement — pas de DOM, pas de
// rendu : c'est exactement ce qu'il faut pour prouver qu'un élément
// supprimé est bien absent, sans reconstruire un navigateur.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const devHtml = fs.readFileSync(path.join(import.meta.dirname, "..", "dev.html"), "utf8");

describe("Boutons macro « Vrai ou faux ? » / « Complet ? » (correctif du 23/08/2026)", () => {
  // Tranché avec l'utilisatrice : "Complet ?" est redondant avec attendu[]
  // (déjà posé sur chaque fiche) ; "Vrai ou faux ?" se pressait avant la
  // photo, au seul moment où le doute n'existe pas encore, et les photos
  // sont jetées après l'envoi — impossible à repositionner après coup.
  // Voir docs/diagnostic-cotation.md.
  it("le bouton Vrai ou faux ? n'existe plus", () => {
    expect(devHtml).not.toContain("Vrai ou faux ?");
    expect(devHtml).not.toContain("contrefaçon ou un original");
  });

  it("le bouton Complet ? n'existe plus", () => {
    expect(devHtml).not.toContain(">Complet ?<");
    expect(devHtml).not.toContain("considéré complet (CIB)");
  });

  it("le reste du bloc « Autres façons de chercher » (recherche libre) est toujours là", () => {
    expect(devHtml).toContain('id="q"');
    expect(devHtml).toContain('id="ask"');
  });
});
