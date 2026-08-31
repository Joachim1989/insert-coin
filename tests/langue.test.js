// Vérifie le branchement langueSet()/langueApply() (src/ui/settings.js) —
// la couche fine qui relie le choix de langue à locale()/i18nAppliquer()
// (déjà testés en isolation dans tests/i18n.test.js) et à l'état visuel du
// sélecteur #langue-seg (même mécanique que #theme-seg).
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

function elFactice(){
  return { dataset: {}, textContent: "", innerHTML: "", placeholder: "", _attrs: {},
    setAttribute(k, v){ this._attrs[k] = v; },
    getAttribute(k){ return this._attrs[k]; } };
}

let langueSet, langueApply, locale;

beforeAll(async () => {
  const { poserDomMinimal } = await import("./helpers/domStub.js");
  poserDomMinimal();

  // Deux boutons factices pour #langue-seg, comme dans dev.html, et un
  // élément marqué data-i18n pour vérifier que langueApply() appelle bien
  // i18nAppliquer() (pas seulement l'état visuel des boutons).
  const btnFr = elFactice(); btnFr.dataset.l = "fr";
  const btnNl = elFactice(); btnNl.dataset.l = "nl";
  const btnEn = elFactice(); btnEn.dataset.l = "en";
  const navScan = elFactice(); navScan.dataset.i18n = "nav.reglages";
  globalThis.document.querySelectorAll = sel =>
    sel === "#langue-seg button" ? [btnFr, btnNl, btnEn]
    : sel === "[data-i18n]" ? [navScan]
    : [];
  globalThis.document.querySelector = () => null;
  globalThis.__btns = { btnFr, btnNl, btnEn, navScan };

  ({ langueSet, langueApply } = await import("../src/ui/settings.js"));
  ({ locale } = await import("../src/i18n/index.js"));
});

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
});

describe("langueSet() / langueApply()", () => {
  it("langueSet('nl') change bien la langue active (locale())", () => {
    langueSet("nl");
    expect(locale()).toBe("nl");
  });

  it("langueSet('nl') met aria-pressed=true sur le bouton nl, false sur fr", () => {
    langueSet("nl");
    expect(globalThis.__btns.btnNl._attrs["aria-pressed"]).toBe(true);
    expect(globalThis.__btns.btnFr._attrs["aria-pressed"]).toBe(false);
  });

  it("langueSet('nl') appelle bien i18nAppliquer() — le texte statique change réellement, pas seulement l'état des boutons", () => {
    langueSet("fr");
    expect(globalThis.__btns.navScan.textContent).toBe("Réglages");
    langueSet("nl");
    expect(globalThis.__btns.navScan.textContent).toBe("Instellingen");
    langueSet("fr");
  });

  it("langueApply() seul (sans changer le storage) reflète la langue déjà active — utilisé au démarrage", () => {
    globalThis.localStorage.setItem("insertcoin.locale", "fr");
    langueApply("fr");
    expect(globalThis.__btns.btnFr._attrs["aria-pressed"]).toBe(true);
    expect(globalThis.__btns.btnNl._attrs["aria-pressed"]).toBe(false);
  });

  it("langueSet('en') — troisième langue (31/08/2026) : bascule bien le texte et l'état des boutons", () => {
    langueSet("en");
    expect(locale()).toBe("en");
    expect(globalThis.__btns.navScan.textContent).toBe("Settings");
    expect(globalThis.__btns.btnEn._attrs["aria-pressed"]).toBe(true);
    expect(globalThis.__btns.btnFr._attrs["aria-pressed"]).toBe(false);
    langueSet("fr");
  });
});
