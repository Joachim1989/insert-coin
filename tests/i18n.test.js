// Infrastructure i18n (src/i18n/*.js). Chantier du 30/08/2026 : neerlandais
// pour le texte statique de dev.html. Voir docs/publication-play-store.md
// pour le contexte (preparation Play Store).
import { describe, it, expect, beforeEach } from "vitest";
import { DICT } from "../src/i18n/dict.js";
import { t, locale, localeSet, i18nAppliquer, LOCALES, DEFAULT_LOCALE } from "../src/i18n/index.js";

function elFactice(dataset){
  return { dataset, textContent: "", innerHTML: "", placeholder: "", _attrs: {},
    setAttribute(k, v){ this._attrs[k] = v; } };
}

function docFactice(par_selecteur){
  return { querySelectorAll: sel => par_selecteur[sel] || [] };
}

beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
});

describe("locale() / localeSet()", () => {
  it("par défaut, sans rien en storage : la langue par défaut (fr)", () => {
    expect(locale()).toBe(DEFAULT_LOCALE);
  });

  it("localeSet() puis locale() : round-trip", () => {
    localeSet("nl");
    expect(locale()).toBe("nl");
  });

  it("une valeur invalide en storage (langue jamais supportée) retombe sur la langue par défaut", () => {
    localStorage.setItem("insertcoin.locale", "xx");
    expect(locale()).toBe(DEFAULT_LOCALE);
  });

  it("localeSet() ignore une langue non supportée — n'écrase pas un choix valide existant", () => {
    localeSet("nl");
    localeSet("xx");
    expect(locale()).toBe("nl");
  });
});

describe("t()", () => {
  it("clé présente dans la langue active : sa traduction", () => {
    localeSet("nl");
    expect(t("nav.scan")).toBe(DICT.nl["nav.scan"]);
  });

  it("clé absente de la langue active mais présente en français : repli sur le français", () => {
    localeSet("nl");
    // Cas simulé : une clé qui existerait en fr mais pas encore en nl.
    const cleTest = "__test_cle_temporaire__";
    DICT.fr[cleTest] = "Texte français";
    expect(t(cleTest)).toBe("Texte français");
    delete DICT.fr[cleTest];
  });

  it("clé totalement absente (faute de frappe) : la clé elle-même, jamais un texte vide", () => {
    expect(t("cle.qui.nexiste.nulle.part")).toBe("cle.qui.nexiste.nulle.part");
  });

  it("avec vars : substitue {nom} dans la chaîne trouvée", () => {
    localeSet("fr");
    expect(t("shoot.vues_suffix", { n: 3 })).toBe(" · 3 vues");
  });

  it("sans vars : identique à un t(key) classique, {nom} reste littéral si présent", () => {
    localeSet("fr");
    expect(t("shoot.vues_suffix")).toBe(" · {n} vues");
  });

  it("vars avec une clé absente de la chaîne : ignorée sans planter", () => {
    localeSet("fr");
    expect(t("nav.scan", { n: 3, autreClé: "x" })).toBe("Scan");
  });
});

describe("dictionnaire — complétude entre toutes les langues supportées", () => {
  it("chaque langue supportée a une entrée dans DICT", () => {
    LOCALES.forEach(l => expect(DICT[l]).toBeTruthy());
  });

  // Générique sur LOCALES plutôt que fr/nl codés en dur : ce test couvre
  // automatiquement toute langue ajoutée plus tard (anglais le 31/08/2026),
  // sans qu'il faille penser à l'étendre à la main.
  LOCALES.filter(l => l !== DEFAULT_LOCALE).forEach(l => {
    it(`toute clé présente en ${DEFAULT_LOCALE} est aussi présente en ${l} (pas de repli silencieux dans dev.html)`, () => {
      const manquantes = Object.keys(DICT[DEFAULT_LOCALE]).filter(k => !(k in DICT[l]));
      expect(manquantes).toEqual([]);
    });

    it(`toute clé présente en ${l} existe aussi en ${DEFAULT_LOCALE} (pas de clé orpheline)`, () => {
      const orphelines = Object.keys(DICT[l]).filter(k => !(k in DICT[DEFAULT_LOCALE]));
      expect(orphelines).toEqual([]);
    });
  });
});

describe("i18nAppliquer() — application au DOM", () => {
  it("data-i18n : fixe le textContent selon la langue active", () => {
    localeSet("fr");
    const el = elFactice({ i18n: "nav.scan" });
    const doc = docFactice({ "[data-i18n]": [el], "[data-i18n-html]": [], "[data-i18n-placeholder]": [], "[data-i18n-label]": [] });
    i18nAppliquer(doc);
    expect(el.textContent).toBe("Scan");
  });

  it("changement de langue : le même élément reflète la nouvelle langue au prochain passage", () => {
    const el = elFactice({ i18n: "nav.reglages" });
    const doc = docFactice({ "[data-i18n]": [el], "[data-i18n-html]": [], "[data-i18n-placeholder]": [], "[data-i18n-label]": [] });
    localeSet("fr"); i18nAppliquer(doc);
    expect(el.textContent).toBe("Réglages");
    localeSet("nl"); i18nAppliquer(doc);
    expect(el.textContent).toBe("Instellingen");
  });

  it("data-i18n-html : fixe innerHTML (balises préservées)", () => {
    localeSet("fr");
    const el = elFactice({ i18nHtml: "guide.pieges.piles_html" });
    const doc = docFactice({ "[data-i18n]": [], "[data-i18n-html]": [el], "[data-i18n-placeholder]": [], "[data-i18n-label]": [] });
    i18nAppliquer(doc);
    expect(el.innerHTML).toContain("<b>Corrosion de piles :</b>");
  });

  it("data-i18n-placeholder : fixe l'attribut placeholder", () => {
    localeSet("nl");
    const el = elFactice({ i18nPlaceholder: "recherche.placeholder" });
    const doc = docFactice({ "[data-i18n]": [], "[data-i18n-html]": [], "[data-i18n-placeholder]": [el], "[data-i18n-label]": [] });
    i18nAppliquer(doc);
    expect(el.placeholder).toBe(DICT.nl["recherche.placeholder"]);
  });

  it("data-i18n-label : fixe aria-label", () => {
    localeSet("fr");
    const el = elFactice({ i18nLabel: "prix.label" });
    const doc = docFactice({ "[data-i18n]": [], "[data-i18n-html]": [], "[data-i18n-placeholder]": [], "[data-i18n-label]": [el] });
    i18nAppliquer(doc);
    expect(el._attrs["aria-label"]).toBe("Prix demandé");
  });
});
