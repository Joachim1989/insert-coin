// Vérifie que capture.js (src/ui/capture.js) parle bien la langue active :
// MODE_DIT/MODE_BTN (figés à l'import avant ce correctif, voir le
// commentaire dans le code source) et les messages d'alerte.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

function elFactice(){
  return { dataset: {}, textContent: "", classList: { toggle(){}, add(){}, remove(){} } };
}

let modeSet, queuePush, localeSet;
let modeDitEl;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();

  modeDitEl = elFactice();
  const modesButtons = [elFactice(), elFactice(), elFactice()];
  globalThis.document.getElementById = id => (id === "mode-dit" ? modeDitEl : null);
  globalThis.document.querySelectorAll = sel => (sel === "#modes .md" ? modesButtons : []);

  ({ modeSet, queuePush } = await import("../src/ui/capture.js"));
  ({ localeSet } = await import("../src/i18n/index.js"));
});

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  globalThis.alert = () => {};
});

describe("modeSet() — MODE_DIT suit la langue active", () => {
  it("en français : la description du mode bac est en français", () => {
    localeSet("fr");
    modeSet("bac");
    expect(modeDitEl.textContent).toBe("Une photo par pièce, ou une photo de plusieurs pièces. Chacune sera chiffrée.");
  });

  it("en néerlandais : le même appel donne le texte néerlandais — pas figé à l'import du module", () => {
    localeSet("nl");
    modeSet("bac");
    expect(modeDitEl.textContent).toBe("Eén foto per stuk, of één foto van meerdere stukken. Elk stuk krijgt een prijs.");
  });
});

describe("queuePush() — alertes traduites", () => {
  it("file pleine (4 objets déjà en attente) : message d'alerte dans la langue active", () => {
    localeSet("nl");
    localStorage.setItem("insertcoin.queue", JSON.stringify([
      { d: 1, promptText: "a", images: [], mode: "single" },
      { d: 2, promptText: "b", images: [], mode: "single" },
      { d: 3, promptText: "c", images: [], mode: "single" },
      { d: 4, promptText: "d", images: [], mode: "single" }
    ]));
    let vu = null;
    globalThis.alert = (msg) => { vu = msg; };

    const ok = queuePush("nouvelle recherche", [], "single", null);

    expect(ok).toBe(false);
    expect(vu).toBe("Wachtrij vol (4 objecten). Start opnieuw zodra je weer bereik hebt.");
  });
});
