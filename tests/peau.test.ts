import { describe, expect, it } from 'vitest';
import { Peau } from '../src/jeu/peau';

describe('La peau après un contact', () => {
  it('la rougeur apparaît à l\'endroit touché puis s\'estompe toute seule', () => {
    const peau = new Peau();
    peau.toucher(0.9, 0.1, 10);
    const r = peau.rougeurs[0];
    expect(r.x).toBe(0.9);
    expect(peau.intensite(r, 10, 30)).toBe(1);
    expect(peau.intensite(r, 25, 30)).toBeCloseTo(0.5);
    expect(peau.intensite(r, 41, 30)).toBe(0);
    peau.nettoyer(41, 30);
    expect(peau.rougeurs).toEqual([]);
  });

  it('le sursaut est bref, et coupé quand son réglage est à 0', () => {
    const peau = new Peau();
    peau.toucher(0, 0, 5);
    const [dx, dy] = peau.sursaut(5.02, 4);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
    expect(peau.sursaut(5.02, 0)).toEqual([0, 0]);
    expect(peau.sursaut(6, 4)).toEqual([0, 0]);
  });
});
