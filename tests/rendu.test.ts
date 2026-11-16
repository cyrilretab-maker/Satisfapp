// Le dessin réaliste : ce qui peut se vérifier sans écran.
import { describe, expect, it } from 'vitest';
import { fabriquerBruit, TAILLE_BRUIT } from '../src/jeu/bruit';
import { nouvelleSimulation } from './outils/doigt-simule';

describe('La texture de bruit (grain de la peau et de la cire)', () => {
  it('se répète sans couture : pas de ligne visible là où elle se raccorde', () => {
    const p = fabriquerBruit();
    const n = TAILLE_BRUIT;
    expect(p.length).toBe(n * n * 4);
    for (let canal = 0; canal < 3; canal++) {
      let ecartBord = 0;
      let ecartMilieu = 0;
      for (let j = 0; j < n; j++) {
        ecartBord += Math.abs(p[4 * (j * n + n - 1) + canal] - p[4 * (j * n) + canal]);
        ecartMilieu += Math.abs(p[4 * (j * n + n / 2) + canal] - p[4 * (j * n + n / 2 - 1) + canal]);
      }
      // Le raccord n'est pas plus marqué qu'un pas ordinaire au milieu de la texture.
      expect(ecartBord).toBeLessThanOrEqual(ecartMilieu * 2 + n);
    }
  });
});

describe('La fluidité', () => {
  it("l'image peut glisser entre deux pas sans changer la matière", () => {
    const a = nouvelleSimulation(3);
    const b = nouvelleSimulation(3);
    for (let k = 0; k < 50; k++) {
      a.avancer(1 / 60);
      b.avancer(1 / 120);
      b.fractionDePas();
      b.avancer(1 / 120);
    }
    expect(a.fractionDePas()).toBeGreaterThanOrEqual(0);
    expect(a.fractionDePas()).toBeLessThanOrEqual(1);
    for (let i = 0; i < a.n; i++) {
      expect(a.xAvant[i]).toBeTypeOf('number');
      expect(Math.abs(a.x[i] - b.x[i])).toBeLessThan(1e-9);
    }
  });
});
