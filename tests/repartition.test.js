// Non-régression sur repartirProrata (src/util/repartition.js), extraite le
// 23/08/2026 du correctif bacBuy()/logFind() (dem:0 sur les achats de lot,
// voir docs/diagnostic-cotation.md). Cette fonction reproduit exactement le
// calcul déjà en production dans bacBuy() pour "payé" — ces tests prouvent
// qu'elle se comporte identiquement, avant de la réutiliser aussi pour
// "demandé".
import { describe, it, expect } from "vitest";
import { repartirProrata } from "../src/util/repartition.js";

describe("repartirProrata", () => {
  it("répartit au prorata des poids, sans perte d'arrondi", () => {
    // Cas réel : trois pièces d'un lot Skylanders, revente estimée 20/15/5,
    // payé 12€ au total. Prorata brut : 6, 4.5, 1.5 — déjà rond, pas de
    // correction d'écart à observer ici (cas simple d'abord).
    const parts = repartirProrata([20, 15, 5], 12);
    expect(parts).toEqual([6, 4.5, 1.5]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(12, 2);
  });

  it("corrige l'écart d'arrondi sur la ligne au poids le plus élevé", () => {
    // 10€ répartis sur trois poids égaux (10, 10, 10) → 3.33 chacun,
    // somme 9.99 : il manque 0.01, qui doit revenir à la première ligne
    // (poids maximal, première en cas d'égalité).
    const parts = repartirProrata([10, 10, 10], 10);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(parts[0]).toBe(3.34);
    expect(parts[1]).toBe(3.33);
    expect(parts[2]).toBe(3.33);
  });

  it("répartit à parts égales quand tous les poids sont nuls (lot sans revente connue)", () => {
    const parts = repartirProrata([0, 0], 10);
    expect(parts).toEqual([5, 5]);
  });

  it("total 0 (achat gratuit / rien demandé) : toutes les parts à 0", () => {
    expect(repartirProrata([20, 15, 5], 0)).toEqual([0, 0, 0]);
  });

  it("un seul élément : toute la part lui revient", () => {
    expect(repartirProrata([42], 8)).toEqual([8]);
  });

  it("tableau vide : aucune part à distribuer", () => {
    expect(repartirProrata([], 10)).toEqual([]);
  });
});
