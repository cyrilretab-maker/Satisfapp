// Lot 5 : le bocal, la sauvegarde de la partie, et l'absence de situation bloquée.
import { describe, expect, it } from 'vitest';
import { Bocal, CLE_BOCAL, formeDuMorceau } from '../src/jeu/bocal';
import { lirePartie, sauverPartie } from '../src/jeu/sauvegarde';
import { genererBouchon } from '../src/matiere/bouchon';
import { Simulation } from '../src/matiere/moteur';
import type { StockageSimple } from '../src/reglages/reglages';
import {
  angleDEntree,
  faireLeTour,
  nouvelleSimulation,
  pointLibreDuBord,
  saisir,
  tirer,
} from './outils/doigt-simule';

function fauxTelephone(): StockageSimple & { donnees: Record<string, string> } {
  const donnees: Record<string, string> = {};
  return {
    donnees,
    getItem: (c) => donnees[c] ?? null,
    setItem: (c, v) => {
      donnees[c] = v;
    },
    removeItem: (c) => {
      delete donnees[c];
    },
  };
}

/** Une partie où le tour est fait puis un morceau est tiré doucement. */
function partieAvecSortie(graine: number) {
  const sim = nouvelleSimulation(graine);
  faireLeTour(sim);
  saisir(sim, pointLibreDuBord(sim, graine * 1.3));
  sim.prendreEvenements();
  tirer(sim, { angle: graine * 1.3, vitesse: 0.3, duree: 60, zigzag: 0.04, tensionMax: 0.8 });
  const sorties = sim.prendreEvenements().filter((e) => e.type === 'morceauSorti');
  return { sim, sorties };
}

describe('Le bocal', () => {
  it('garde la forme et la taille de chaque morceau sorti', () => {
    const { sim, sorties } = partieAvecSortie(1);
    expect(sorties.length).toBeGreaterThan(0);
    const e = sorties[0];
    if (e.type !== 'morceauSorti') throw new Error();
    const m = formeDuMorceau(sim, e.indices);
    expect(m.pts.length).toBe(2 * e.indices.length);
    expect(m.tris.length).toBeGreaterThan(0);
    expect(m.part).toBeCloseTo(e.part);
  });

  it('se garde d\'une partie à l\'autre, met en avant le plus gros, et se vide quand on veut', () => {
    const tel = fauxTelephone();
    const bocal = new Bocal(tel);
    bocal.ajouter({ part: 0.02, pts: [0, 0], tris: [] });
    bocal.ajouter({ part: 0.8, pts: [0, 0, 0.1, 0, 0, 0.1], tris: [0, 1, 2] });
    bocal.ajouter({ part: 0.1, pts: [0, 0], tris: [] });
    const relu = new Bocal(tel);
    expect(relu.morceaux.length).toBe(3);
    expect(relu.plusGros()).toBe(1);
    relu.vider();
    expect(new Bocal(tel).morceaux).toEqual([]);
  });

  it('un bocal abîmé ne bloque pas l\'app', () => {
    const tel = fauxTelephone();
    tel.setItem(CLE_BOCAL, '{pas du json');
    expect(new Bocal(tel).morceaux).toEqual([]);
  });

  it('plein, il oublie le plus petit morceau, jamais le plus gros', () => {
    const bocal = new Bocal(null);
    bocal.ajouter({ part: 0.9, pts: [0, 0], tris: [] });
    for (let k = 0; k < 200; k++) bocal.ajouter({ part: 0.01 + k / 10000, pts: [0, 0], tris: [] });
    expect(bocal.morceaux.length).toBeLessThanOrEqual(100);
    expect(bocal.morceaux[bocal.plusGros()].part).toBe(0.9);
  });
});

describe('La reprise de partie', () => {
  it('on retrouve le bouchon exactement dans le même état', () => {
    const sim = nouvelleSimulation(5);
    faireLeTour(sim, 10);
    const a = angleDEntree(sim);
    saisir(sim, pointLibreDuBord(sim, a));
    tirer(sim, { angle: a, vitesse: 3, duree: 1 });
    const tel = fauxTelephone();
    sauverPartie(tel, { version: 1, graine: 5, bouchon: sim.b.params, etat: sim.exporter() });

    const lu = lirePartie(tel)!;
    const reprise = new Simulation(genererBouchon(lu.graine, lu.bouchon), sim.params);
    expect(reprise.importer(lu.etat)).toBe(true);
    expect([...reprise.lienOk]).toEqual([...sim.lienOk]);
    expect([...reprise.colleAuTour]).toEqual([...sim.colleAuTour]);
    expect([...reprise.colleAuFond]).toEqual([...sim.colleAuFond]);
    expect([...reprise.sorti]).toEqual([...sim.sorti]);
    expect(reprise.morceauxSortis).toEqual(sim.morceauxSortis);
    for (let i = 0; i < sim.n; i++) expect(reprise.x[i]).toBeCloseTo(sim.x[i], 4);
  });

  it('une sauvegarde illisible est ignorée', () => {
    const tel = fauxTelephone();
    tel.setItem('satisfapp.partie.v1', 'n\'importe quoi');
    expect(lirePartie(tel)).toBeNull();
  });
});

describe('Aucune situation bloquée', () => {
  it('un point du tour au bord d\'un trou peut toujours être décollé à la spatule', () => {
    const { sim } = partieAvecSortie(2);
    for (let i = 0; i < sim.n; i++) {
      if (!sim.colleAuTour[i] || sim.sorti[i]) continue;
      expect(sim.aCoteDUnBordLibre(i)).toBe(true);
    }
  });
});
