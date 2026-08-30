// Verifie que TOUT ce que dev.html marque comme traduisible (data-i18n*)
// a bien une entree dans le dictionnaire, dans les deux langues — sans
// ca, une faute de frappe dans une cle (dev.html vs dict.js) retomberait
// silencieusement sur la cle elle-meme affichee a l'ecran (voir t(), qui
// fait ca exprès pour ne jamais planter, mais un ecran qui affiche
// "guide.rebrickable.titre" au lieu d'un vrai texte doit être attrape ici,
// pas decouvert sur le terrain).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DICT } from "../src/i18n/dict.js";

const html = fs.readFileSync(path.resolve(__dirname, "../dev.html"), "utf8");

function extraireCles(attr){
  const re = new RegExp(attr + '="([^"]+)"', "g");
  const cles = [];
  let m;
  while((m = re.exec(html))) cles.push(m[1]);
  return cles;
}

const toutesLesCles = [
  ...extraireCles("data-i18n"),
  ...extraireCles("data-i18n-html"),
  ...extraireCles("data-i18n-placeholder"),
  ...extraireCles("data-i18n-label")
];

describe("dev.html — couverture i18n", () => {
  it("au moins une clé data-i18n* est présente (le chantier a bien été fait, pas juste l'infra)", () => {
    expect(toutesLesCles.length).toBeGreaterThan(50);
  });

  it("chaque clé référencée dans dev.html existe en français", () => {
    const manquantes = toutesLesCles.filter(k => !(k in DICT.fr));
    expect(manquantes).toEqual([]);
  });

  it("chaque clé référencée dans dev.html existe en néerlandais", () => {
    const manquantes = toutesLesCles.filter(k => !(k in DICT.nl));
    expect(manquantes).toEqual([]);
  });

  it("data-i18n-html n'est utilisé que là où la traduction en a vraiment besoin — une balise, ou une entité HTML (&rarr; etc.) qu'un simple textContent afficherait telle quelle au lieu de l'interpréter", () => {
    const cles = extraireCles("data-i18n-html");
    cles.forEach(k => {
      expect(DICT.fr[k]).toMatch(/<[a-z]|&[a-z]+;/i);
    });
  });
});
