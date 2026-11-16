// V2 : le conduit en profondeur, les natures de cire, la cire des parois, les instruments.
import { describe, expect, it } from 'vitest';
import { genererBouchon } from '../src/matiere/bouchon';
import { COMPACTE, DURE, COLLANTE, MOLLE } from '../src/matiere/bouchon';
import { Simulation } from '../src/matiere/moteur';
import { ANGLES, Parois, RANGS } from '../src/matiere/parois';
import { ENTREE, FOND, rayonEcran, versMatiere, versVue } from '../src/jeu/perspective';
import { attendre, IMAGE, nouvelleSimulation, saisir } from './outils/doigt-simule';

/** Fait aller et venir un outil autour d'un endroit, le doigt posé. */
function frotterAvec(sim: Simulation, outil: 'spatule' | 'coton' | 'aspirateur', x: number, y: number, secondes: number, amplitude = 0.04) {
  sim.choisirOutil(outil);
  sim.placerOutil(x, y);
  sim.poserDoigt();
  for (let t = 0; t < secondes; t += IMAGE) {
    sim.definirCible(x + amplitude * Math.cos(t * 9), y + amplitude * Math.sin(t * 7));
    sim.avancer(IMAGE);
  }
  sim.leverDoigt();
}

/** Le point d'une nature donnée le plus proche du centre de sa tache (bien à l'intérieur). */
function pointDeNature(sim: Simulation, nature: number): number {
  let meilleur = -1;
  let voisinsMax = -1;
  for (let i = 0; i < sim.n; i++) {
    if (sim.b.nature[i] !== nature) continue;
    let pareils = 0;
    for (let j = 0; j < sim.n; j++) {
      if (sim.b.nature[j] === nature && Math.hypot(sim.x[j] - sim.x[i], sim.y[j] - sim.y[i]) < 0.15) pareils++;
    }
    if (pareils > voisinsMax) {
      voisinsMax = pareils;
      meilleur = i;
    }
  }
  return meilleur;
}

describe('V2-1 : le conduit en profondeur', () => {
  it('la vue et la matière se correspondent dans les deux sens, même quand le conduit bouge', () => {
    for (const v of [
      { fond: 0.62, fuiteX: 0, fuiteY: 0 },
      { fond: 0.5, fuiteX: 0.03, fuiteY: -0.04 },
    ]) {
      for (const [x, y] of [
        [0, 0.3],
        [0.5, -0.6],
        [-0.9, 0.2],
        [1.1, 0.4],
        [-0.3, -1.25],
      ]) {
        const [vx, vy] = versVue(x, y, v);
        const [mx, my] = versMatiere(vx, vy, v);
        expect(mx).toBeCloseTo(x, 6);
        expect(my).toBeCloseTo(y, 6);
      }
    }
  });

  it('le fond paraît petit, la paroi fuit vers lui, l\'entrée touche le bord de la vue', () => {
    expect(rayonEcran(FOND, 0.62)).toBeCloseTo(0.62, 6);
    expect(rayonEcran(ENTREE, 0.62)).toBeCloseTo(1, 6);
    // Sur la paroi, un même pas en profondeur prend plus de place près de l'entrée (perspective).
    const pres = rayonEcran(ENTREE, 0.62) - rayonEcran(ENTREE - 0.1, 0.62);
    const loin = rayonEcran(FOND + 0.1, 0.62) - rayonEcran(FOND, 0.62);
    expect(pres).toBeGreaterThan(loin * 1.5);
  });
});

describe('V2-2 : trois natures de cire', () => {
  it('un bouchon a de la cire compacte, dure, collante et molle, toujours la même pour un même numéro', () => {
    const sim = nouvelleSimulation(7);
    for (const n of [COMPACTE, DURE, COLLANTE, MOLLE]) expect(sim.b.nature.filter((v) => v === n).length).toBeGreaterThan(5);
    expect([...nouvelleSimulation(7).b.nature]).toEqual([...sim.b.nature]);
  });

  it('les anciens bouchons (sans natures) gardent exactement leur forme', () => {
    const sim = nouvelleSimulation(7, { 'bouchon.duresNombre': 0, 'bouchon.collantesNombre': 0, 'bouchon.mollesNombre': 0 });
    const avec = nouvelleSimulation(7);
    expect([...sim.b.x0]).toEqual([...avec.b.x0]);
    expect([...sim.b.lienSolidite]).toEqual([...avec.b.lienSolidite]);
    expect(sim.b.nature.every((v) => v === COMPACTE)).toBe(true);
  });

  it('la dure casse pour un étirement plus petit, la collante tient plus fort', () => {
    const sim = nouvelleSimulation(7);
    const b = sim.b;
    let dure = -1;
    let compacte = -1;
    for (let l = 0; l < b.lienA.length; l++) {
      const [na, nb] = [b.nature[b.lienA[l]], b.nature[b.lienB[l]]];
      if (na === DURE && nb === DURE && dure < 0) dure = l;
      if (na === COMPACTE && nb === COMPACTE && compacte < 0) compacte = l;
    }
    expect(sim.limite(dure) / b.lienSolidite[dure]).toBeLessThan(sim.limite(compacte) / b.lienSolidite[compacte]);
    const c = pointDeNature(sim, COLLANTE);
    expect(sim.colleDe(c)).toBeGreaterThan(b.colle[c] * 2);
  });

  it('la pince n\'a pas de prise sur la cire molle', () => {
    const sim = nouvelleSimulation(7);
    for (let i = 0; i < sim.n; i++) {
      sim.colleAuFond[i] = 0;
      sim.colleAuTour[i] = 0;
    }
    const m = pointDeNature(sim, MOLLE);
    sim.params = { ...sim.params, pinceRayon: 0.03 };
    saisir(sim, m);
    expect(sim.outil.prise.every((i) => sim.b.nature[i] !== MOLLE)).toBe(true);
  });

  it('le coton-tige boit la cire molle, pas la compacte', () => {
    const sim = nouvelleSimulation(7);
    const m = pointDeNature(sim, MOLLE);
    const molleAvant = sim.b.nature.filter((v, i) => v === MOLLE && !sim.sorti[i]).length;
    frotterAvec(sim, 'coton', sim.x[m], sim.y[m], 4);
    const molleApres = sim.b.nature.filter((v, i) => v === MOLLE && !sim.sorti[i]).length;
    expect(molleApres).toBeLessThan(molleAvant);
    for (let i = 0; i < sim.n; i++) if (sim.sorti[i]) expect(sim.b.nature[i]).toBe(MOLLE);
  });

  it('l\'aspirateur aspire la cire molle même collée, et pas la cire compacte collée', () => {
    const sim = nouvelleSimulation(7);
    const m = pointDeNature(sim, MOLLE);
    frotterAvec(sim, 'aspirateur', sim.x[m], sim.y[m], 3, 0.03);
    expect(sim.sorti[m]).toBe(1);
    for (let i = 0; i < sim.n; i++) if (sim.sorti[i]) expect(sim.b.nature[i]).toBe(MOLLE);
  });

  it('l\'aspirateur avale une miette libre d\'un coup', () => {
    const sim = nouvelleSimulation(7);
    const c = pointDeNature(sim, COMPACTE);
    // Une miette : un point isolé, qui ne tient à rien.
    const b = sim.b;
    for (let k = b.voisinsDebut[c]; k < b.voisinsDebut[c + 1]; k++) sim.lienOk[b.voisinsLien[k]] = 0;
    sim.colleAuFond[c] = 0;
    sim.colleAuTour[c] = 0;
    sim.calculerMorceaux();
    frotterAvec(sim, 'aspirateur', sim.x[c], sim.y[c], 0.3, 0);
    expect(sim.sorti[c]).toBe(1);
  });

  it('la cire molle se sépare sans craquement ni vibration de casse', () => {
    const sim = nouvelleSimulation(7);
    const b = sim.b;
    for (let l = 0; l < b.lienA.length; l++) {
      if (!sim.lienMou(l)) continue;
      // On l'étire de force au-delà de sa limite.
      const a = b.lienA[l];
      sim.x[a] += 0.2;
    }
    sim.prendreEvenements();
    sim.avancer(IMAGE);
    const casses = sim.prendreEvenements().filter((e) => e.type === 'lienCasse') as { lien: number }[];
    expect(casses.every((e) => !sim.lienMou(e.lien))).toBe(true);
  });
});

describe('V2-3 : la cire des parois', () => {
  it('plus épaisse vers le fond, quelques traces près de l\'entrée', () => {
    const p = new Parois(3, 0.7);
    const rang = (j: number) => {
      let s = 0;
      for (let i = 0; i < ANGLES; i++) {
        const k = j * ANGLES + i;
        s += p.croute[k] + p.collant[k] + p.liquide[k];
      }
      return s;
    };
    expect(rang(2)).toBeGreaterThan(rang(RANGS - 3) * 3);
    expect(p.total()).toBeGreaterThan(0);
    expect(new Parois(3, 0).total()).toBe(0);
  });

  it('chaque saleté a son instrument : on peut tout nettoyer', () => {
    const p = new Parois(3, 0.7);
    const params = { croute: 0.35, collant: 0.8, liquide: 0.12, aspiration: 2.4 };
    const balayer = (outil: 'spatule' | 'coton' | 'aspirateur', passes: number) => {
      for (let k = 0; k < passes; k++) {
        for (let s = FOND + 0.01; s < ENTREE; s += 0.03) {
          for (let a = 0; a < Math.PI * 2; a += 0.03) {
            p.travailler(outil, Math.cos(a) * s, Math.sin(a) * s, 0.06, 0.03, 1 / 60, params);
          }
        }
      }
    };
    const croute = () => p.croute.reduce((x, y) => x + y, 0);
    const avant = croute();
    balayer('spatule', 12);
    expect(croute()).toBeLessThan(avant * 0.02);
    expect(p.miettes.reduce((x, y) => x + y, 0)).toBeGreaterThan(0); // la spatule laisse des miettes
    balayer('aspirateur', 6);
    balayer('coton', 12);
    expect(p.reste()).toBeLessThan(0.03);
  });

  it('racler une paroi sale ne fait pas mal ; frotter la peau propre se remarque', () => {
    const sale = nouvelleSimulation(3);
    // Une case bien sale de la paroi, près du fond.
    let cible: [number, number] = [0, 0];
    let max = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const [x, y] = [Math.cos(a) * 1.0, Math.sin(a) * 1.0];
      const v = sale.parois.saleteEn(x, y);
      if (v > max) {
        max = v;
        cible = [x, y];
      }
    }
    sale.prendreEvenements();
    frotterAvec(sale, 'spatule', cible[0], cible[1], 0.5, 0.01);
    expect(sale.prendreEvenements().some((e) => e.type === 'paroiTouchee')).toBe(false);

    const propre = nouvelleSimulation(3, { 'parois.quantite': 0 });
    propre.prendreEvenements();
    frotterAvec(propre, 'spatule', 0, 1.2, 1);
    expect(propre.prendreEvenements().some((e) => e.type === 'paroiTouchee')).toBe(true);
    // Le coton-tige est doux : jamais de contact.
    propre.prendreEvenements();
    frotterAvec(propre, 'coton', 0, 1.2, 1);
    expect(propre.prendreEvenements().some((e) => e.type === 'paroiTouchee')).toBe(false);
  });
});

describe('V2 : la partie', () => {
  it('la cire des parois et la cire molle se retrouvent après une reprise de partie', () => {
    const sim = nouvelleSimulation(4);
    const m = pointDeNature(sim, MOLLE);
    frotterAvec(sim, 'coton', sim.x[m], sim.y[m], 1);
    frotterAvec(sim, 'spatule', 0, 1.05, 2);
    const etat = JSON.parse(JSON.stringify(sim.exporter()));
    const reprise = new Simulation(genererBouchon(sim.b.graine, sim.b.params), sim.params);
    expect(reprise.importer(etat)).toBe(true);
    expect(reprise.parois.total()).toBeCloseTo(sim.parois.total(), 0);
    for (let i = 0; i < sim.n; i++) expect(reprise.quantite[i]).toBeCloseTo(sim.quantite[i], 4);
  });

  it('l\'oreille n\'est propre que quand le fond et les parois le sont', () => {
    const sim = nouvelleSimulation(4);
    expect(sim.toutPropre()).toBe(false);
    for (let i = 0; i < sim.n; i++) sim.sorti[i] = 1;
    expect(sim.toutPropre()).toBe(false); // il reste les parois
    sim.parois.croute.fill(0);
    sim.parois.collant.fill(0);
    sim.parois.liquide.fill(0);
    sim.parois.miettes.fill(0);
    expect(sim.toutPropre()).toBe(true);
    attendre(sim, 0.1);
  });
});
