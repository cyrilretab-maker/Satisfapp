// Les règles de la matière, vérifiées avec un doigt simulé (sans écran).
import { describe, expect, it } from 'vitest';
import defauts from '../src/reglages/defauts.json';
import { Reglages, type FichierReglages } from '../src/reglages/reglages';
import { genererBouchon } from '../src/matiere/bouchon';
import { lireParamsBouchon } from '../src/matiere/parametres';
import {
  attendre,
  nouvelleSimulation,
  plusGrosSorti,
  pointDuBord,
  saisir,
  tirer,
  type Traction,
} from './outils/doigt-simule';

const GRAINES = [1, 2, 3, 4, 5, 6];
const DOUCEMENT: Omit<Traction, 'angle'> = { vitesse: 0.3, duree: 60, zigzag: 0.04, tensionMax: 0.8 };
const FORT: Omit<Traction, 'angle'> = { vitesse: 3, duree: 3 };

function partie(graine: number, geste: Omit<Traction, 'angle'>, modifs: Record<string, number> = {}) {
  const sim = nouvelleSimulation(graine, modifs);
  const angle = graine * 1.3;
  const prise = saisir(sim, pointDuBord(sim, angle));
  tirer(sim, { angle, ...geste });
  return { sim, prise, gros: plusGrosSorti(sim) };
}

function nbDecolles(sim: ReturnType<typeof nouvelleSimulation>): number {
  return sim.n - sim.colleAuFond.reduce((a, b) => a + b, 0);
}

describe('Bouchons reproductibles', () => {
  const params = lireParamsBouchon(new Reglages(defauts as FichierReglages, null));

  it('le même numéro redonne exactement le même bouchon', () => {
    const a = genererBouchon(1234, params);
    const b = genererBouchon(1234, params);
    expect(a.nbPoints).toBe(b.nbPoints);
    expect([...a.x0]).toEqual([...b.x0]);
    expect([...a.lienSolidite]).toEqual([...b.lienSolidite]);
    expect([...a.colle]).toEqual([...b.colle]);
  });

  it('deux numéros différents donnent deux bouchons différents', () => {
    const a = genererBouchon(1, params);
    const b = genererBouchon(2, params);
    expect([...a.lienSolidite]).not.toEqual([...b.lienSolidite]);
  });

  it('chaque bouchon a des zones faibles et des zones très collées', () => {
    const b = genererBouchon(7, params);
    expect(b.lienFaible.some((f) => f === 1)).toBe(true);
    expect(Math.max(...b.colle)).toBeGreaterThan(1.5);
  });

  it('à gestes identiques, résultat identique', () => {
    const a = partie(3, DOUCEMENT);
    const b = partie(3, DOUCEMENT);
    expect(a.sim.morceauxSortis).toEqual(b.sim.morceauxSortis);
    expect([...a.sim.x]).toEqual([...b.sim.x]);
  });
});

describe('Tirer doucement, tirer fort', () => {
  const doux = GRAINES.map((g) => partie(g, DOUCEMENT));
  const forts = GRAINES.map((g) => partie(g, FORT));

  it('la pince se ferme sur le bord du bouchon', () => {
    for (const p of [...doux, ...forts]) expect(p.prise).toBe(true);
  });

  it("tirer fort n'arrache qu'une miette : moins d'un dixième du bouchon", () => {
    for (const p of forts) expect(p.gros).toBeLessThan(0.1);
  });

  it('tirer doucement sort un morceau de plus de la moitié du bouchon au moins une fois sur deux', () => {
    const gros = doux.filter((p) => p.gros > 0.5).length;
    expect(gros).toBeGreaterThanOrEqual(GRAINES.length / 2);
  });

  it('en moyenne, tirer doucement sort des morceaux au moins dix fois plus gros', () => {
    const moyenne = (l: { gros: number }[]) => l.reduce((s, p) => s + p.gros, 0) / l.length;
    expect(moyenne(doux)).toBeGreaterThan(10 * moyenne(forts));
  });
});

describe('Règles de la colle du fond', () => {
  it('sous le seuil de tension, la colle ne lâche jamais, même longtemps', () => {
    const sim = nouvelleSimulation(2, { 'colle.seuil': 90 });
    const avant = nbDecolles(sim);
    saisir(sim, pointDuBord(sim, 0));
    tirer(sim, { angle: 0, vitesse: 0.3, duree: 10, tensionMax: 0.3 });
    expect(nbDecolles(sim) - avant).toBeLessThanOrEqual(sim.outil.prise.length);
  });

  it('sous tension modérée tenue, la colle lâche peu à peu', () => {
    const sim = nouvelleSimulation(2);
    const avant = nbDecolles(sim);
    saisir(sim, pointDuBord(sim, 0));
    tirer(sim, { angle: 0, vitesse: 0.3, duree: 3, tensionMax: 0.6 });
    expect(nbDecolles(sim) - avant).toBeGreaterThan(10);
  });

  it('changer de direction fait lâcher la colle plus vite', () => {
    const compter = (zigzag: number) => {
      // Colle plus lente que d'habitude, pour bien mesurer la différence.
      const sim = nouvelleSimulation(4, { 'colle.duree': 0.6 });
      saisir(sim, pointDuBord(sim, 1));
      tirer(sim, { angle: 1, vitesse: 0.3, duree: 2, tensionMax: 0.6, zigzag });
      return nbDecolles(sim);
    };
    expect(compter(0.06)).toBeGreaterThan(compter(0) * 1.15);
  });
});

describe('La pince', () => {
  it('sans pause, la pince ne se ferme pas', () => {
    const sim = nouvelleSimulation(1);
    const i = pointDuBord(sim, 0);
    sim.placerOutil(sim.x[i], sim.y[i]);
    sim.poserDoigt();
    attendre(sim, sim.params.pincePause / 2);
    expect(sim.outil.ferme).toBe(false);
  });

  it('sur une zone encore collée (au milieu), elle n\'arrache qu\'une miette', () => {
    for (const graine of [1, 2, 3]) {
      const sim = nouvelleSimulation(graine);
      let centre = 0;
      for (let i = 0; i < sim.n; i++) {
        if (Math.hypot(sim.x[i], sim.y[i]) < Math.hypot(sim.x[centre], sim.y[centre])) centre = i;
      }
      expect(saisir(sim, centre)).toBe(true);
      expect(sim.outil.faible).toBe(true);
      tirer(sim, { angle: 0.5, vitesse: 0.3, duree: 20, tensionMax: 0.8 });
      expect(plusGrosSorti(sim)).toBeLessThan(0.02);
    }
  });

  it('lever le doigt ouvre la pince et lâche le morceau', () => {
    const sim = nouvelleSimulation(1);
    saisir(sim, pointDuBord(sim, 0));
    expect(sim.outil.ferme).toBe(true);
    sim.leverDoigt();
    expect(sim.outil.ferme).toBe(false);
    expect(sim.outil.prise).toEqual([]);
  });

  it('un morceau sorti quitte la vue et ne revient pas', () => {
    const { sim } = partie(1, FORT);
    expect(sim.morceauxSortis.length).toBeGreaterThan(0);
    const sortis = sim.sorti.reduce((a, b) => a + b, 0);
    expect(sim.pointsRestants()).toBe(sim.n - sortis);
    expect(sortis).toBeGreaterThan(0);
  });
});
