import { describe, expect, it } from 'vitest';
import defauts from '../src/reglages/defauts.json';
import { Reglages, type FichierReglages } from '../src/reglages/reglages';
import { cadence, debutsDesPulsations, fabriquerMotif, type Rythme } from '../src/sensations/rythmes';

describe('Motifs de vibration', () => {
  it('alterne pulsation et pause, commence et finit par une pulsation', () => {
    const motif = fabriquerMotif({ pulsation: 50, pause: 200 }, 1000);
    expect(motif).toEqual([50, 200, 50, 200, 50, 200, 50]);
    expect(motif.length % 2).toBe(1);
  });

  it('ne dépasse jamais la durée demandée', () => {
    for (const duree of [100, 999, 3000, 7777]) {
      const total = fabriquerMotif({ pulsation: 37, pause: 81 }, duree).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(duree);
    }
  });

  it('donne toujours au moins une pulsation', () => {
    expect(fabriquerMotif({ pulsation: 400, pause: 100 }, 100)).toEqual([400]);
  });

  it('cale le son sur le début de chaque pulsation', () => {
    expect(debutsDesPulsations([50, 200, 50, 200, 50])).toEqual([0, 250, 500]);
  });

  it('même réglage, même motif (règle fiable)', () => {
    const r: Rythme = { pulsation: 42, pause: 123 };
    expect(fabriquerMotif(r, 3000)).toEqual(fabriquerMotif(r, 3000));
  });
});

describe('Les trois rythmes de départ', () => {
  const reglages = new Reglages(defauts as FichierReglages, null);
  const rythme = (cle: string): Rythme => ({
    pulsation: reglages.nombre(`rythmes.${cle}.pulsation`),
    pause: reglages.nombre(`rythmes.${cle}.pause`),
  });

  it('vont du plus lent au plus rapide, avec un écart net entre chaque', () => {
    const lent = cadence(rythme('lent'));
    const moyen = cadence(rythme('moyen'));
    const rapide = cadence(rythme('rapide'));
    // Au moins 1,8 fois plus de pulsations par seconde d'un rythme au suivant.
    expect(moyen / lent).toBeGreaterThan(1.8);
    expect(rapide / moyen).toBeGreaterThan(1.8);
  });

  it('donnent assez de pulsations pendant un essai pour être reconnus', () => {
    const duree = reglages.nombre('rythmes.duree');
    for (const cle of ['lent', 'moyen', 'rapide']) {
      const pulsations = debutsDesPulsations(fabriquerMotif(rythme(cle), duree)).length;
      expect(pulsations).toBeGreaterThanOrEqual(3);
    }
  });
});
