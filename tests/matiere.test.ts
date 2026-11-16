// Les règles de la matière, vérifiées avec un doigt simulé (sans écran).
import { describe, expect, it } from 'vitest';
import defauts from '../src/reglages/defauts.json';
import { Reglages, type FichierReglages } from '../src/reglages/reglages';
import { genererBouchon } from '../src/matiere/bouchon';
import { RAYON_PAROI, type Simulation } from '../src/matiere/moteur';
import { lireParamsBouchon } from '../src/matiere/parametres';
import {
  angleDEntree,
  attendre,
  faireLeTour,
  IMAGE,
  nouvelleSimulation,
  plusGrosSorti,
  pointDuBord,
  pointLibreDuBord,
  saisir,
  tirer,
  type Traction,
} from './outils/doigt-simule';

const GRAINES = [1, 2, 3, 4, 5, 6];
const DOUCEMENT: Omit<Traction, 'angle'> = { vitesse: 0.3, duree: 60, zigzag: 0.04, tensionMax: 0.8 };
const FORT: Omit<Traction, 'angle'> = { vitesse: 3, duree: 3 };

/** Une partie : faire le tour (ou non), saisir le bord, tirer. */
function partie(graine: number, geste: Omit<Traction, 'angle'>, tour = true, modifs: Record<string, number> = {}) {
  const sim = nouvelleSimulation(graine, modifs);
  const dureeTour = tour ? faireLeTour(sim) : 0;
  const angle = tour ? graine * 1.3 : angleDEntree(sim);
  const prise = saisir(sim, pointLibreDuBord(sim, angle));
  tirer(sim, { angle, ...geste });
  return { sim, prise, dureeTour, gros: plusGrosSorti(sim) };
}

const compter = (t: Uint8Array) => t.reduce((a, b) => a + b, 0);
const nbDecolles = (sim: Simulation) => sim.n - compter(sim.colleAuFond);
const contacts = (sim: Simulation) => sim.prendreEvenements().filter((e) => e.type === 'paroiTouchee').length;

/** Bouge la spatule en petits cercles autour d'un endroit, pendant un certain temps. */
function frotter(sim: Simulation, x: number, y: number, secondes: number, amplitude = 0.015): void {
  sim.choisirOutil('spatule');
  sim.placerOutil(x, y);
  sim.poserDoigt();
  for (let t = 0; t < secondes; t += IMAGE) {
    const a = sim.temps * Math.PI * 2 * 4;
    sim.definirCible(x + amplitude * Math.cos(a), y + amplitude * Math.sin(a));
    sim.avancer(IMAGE);
  }
  sim.leverDoigt();
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
    expect([...a.entree]).toEqual([...b.entree]);
  });

  it('deux numéros différents donnent deux bouchons différents', () => {
    const a = genererBouchon(1, params);
    const b = genererBouchon(2, params);
    expect([...a.lienSolidite]).not.toEqual([...b.lienSolidite]);
  });

  it('chaque bouchon a un tour, des points d\'entrée, des zones faibles et des zones très collées', () => {
    const b = genererBouchon(7, params);
    expect(compter(b.bord)).toBeGreaterThan(30);
    expect(compter(b.entree)).toBe(params.entreesNombre * params.entreesTaille);
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

describe('Faire le tour, puis tirer doucement ou fort', () => {
  const sansTour = GRAINES.map((g) => partie(g, DOUCEMENT, false));
  const doux = GRAINES.map((g) => partie(g, DOUCEMENT));
  const forts = GRAINES.map((g) => partie(g, FORT));

  it('un joueur appliqué fait le tour à la spatule en moins d\'une minute', () => {
    for (const p of doux) expect(p.dureeTour).toBeLessThan(60);
  });

  it("sans avoir fait le tour, on n'arrache qu'une miette : moins d'un dixième du bouchon", () => {
    for (const p of sansTour) expect(p.gros).toBeLessThan(0.1);
  });

  it('la pince se ferme sur le bord décollé', () => {
    for (const p of [...doux, ...forts]) expect(p.prise).toBe(true);
  });

  it("tirer fort n'arrache qu'une miette : moins d'un dixième du bouchon", () => {
    for (const p of forts) expect(p.gros).toBeLessThan(0.1);
  });

  it('tirer doucement après le tour sort un morceau de plus de la moitié du bouchon au moins une fois sur deux', () => {
    expect(doux.filter((p) => p.gros > 0.5).length).toBeGreaterThanOrEqual(GRAINES.length / 2);
  });
});

describe('La spatule et le tour', () => {
  it("immobile, la spatule ne décolle rien (ce sont les petits mouvements qui décollent)", () => {
    const sim = nouvelleSimulation(1);
    const i = pointDuBord(sim, angleDEntree(sim));
    const avant = sim.tourRestant();
    frotter(sim, sim.x[i], sim.y[i], 5, 0);
    expect(sim.tourRestant()).toBe(avant);
  });

  it('en bougeant à côté d\'un point d\'entrée, elle décolle le tour point par point', () => {
    const sim = nouvelleSimulation(1);
    const i = pointDuBord(sim, angleDEntree(sim));
    const avant = sim.tourRestant();
    frotter(sim, sim.x[i], sim.y[i], 4);
    const evenements = sim.prendreEvenements().filter((e) => e.type === 'tourDecolle').length;
    expect(sim.tourRestant()).toBeLessThan(avant);
    expect(evenements).toBe(avant - sim.tourRestant()); // un événement (futur « tic ») par point
  });

  it('loin de tout bord libre, elle ne perce pas : le tour reste collé', () => {
    const sim = nouvelleSimulation(1);
    const angle = angleDEntree(sim) + Math.PI; // à l'opposé du point d'entrée
    const i = pointDuBord(sim, angle);
    expect(sim.aCoteDUnBordLibre(i)).toBe(false);
    const avant = sim.tourRestant();
    frotter(sim, sim.x[i], sim.y[i], 5);
    expect(sim.tourRestant()).toBe(avant);
  });

  it('la spatule ne décolle pas le fond, et la colle du fond ne lâche pas toute seule', () => {
    const sim = nouvelleSimulation(2);
    const avant = nbDecolles(sim);
    faireLeTour(sim);
    attendre(sim, 5);
    expect(nbDecolles(sim)).toBe(avant);
  });

  it('un bord décollé se replie vers le centre, sans se déchirer', () => {
    const sim = nouvelleSimulation(3);
    faireLeTour(sim);
    attendre(sim, 2);
    let retrait = 0;
    let k = 0;
    for (let i = 0; i < sim.n; i++) {
      if (!sim.b.bord[i]) continue;
      retrait += Math.hypot(sim.b.x0[i], sim.b.y0[i]) - Math.hypot(sim.x[i], sim.y[i]);
      k++;
    }
    expect(retrait / k).toBeGreaterThan(0.03);
    expect(sim.lienOk.length - compter(sim.lienOk)).toBeLessThan(10);
  });
});

describe('Règles de la colle du fond', () => {
  it('sous le seuil de tension, la colle ne lâche jamais, même longtemps', () => {
    const sim = nouvelleSimulation(2, { 'colle.seuil': 90, 'tour.repli': 0 }); // sans repli, pour isoler la règle
    faireLeTour(sim);
    const avant = nbDecolles(sim);
    saisir(sim, pointLibreDuBord(sim, 0));
    // Traction très légère (un point peut recevoir la force de plusieurs liens à la fois).
    tirer(sim, { angle: 0, vitesse: 0.03, duree: 10, tensionMax: 0.1 });
    expect(nbDecolles(sim) - avant).toBe(0);
  });

  it('sous tension modérée tenue, la colle lâche peu à peu', () => {
    const sim = nouvelleSimulation(2);
    faireLeTour(sim);
    const avant = nbDecolles(sim);
    saisir(sim, pointLibreDuBord(sim, 0));
    tirer(sim, { angle: 0, vitesse: 0.3, duree: 3, tensionMax: 0.6 });
    expect(nbDecolles(sim) - avant).toBeGreaterThan(10);
  });

  it('changer de direction fait lâcher la colle plus vite', () => {
    const mesurer = (zigzag: number) => {
      // Colle plus lente que d'habitude, pour bien mesurer la différence.
      const sim = nouvelleSimulation(4, { 'colle.duree': 0.6, 'spatule.plancher': 90 }); // spatule sans effet sur le fond, pour isoler la règle
      faireLeTour(sim);
      saisir(sim, pointLibreDuBord(sim, 1));
      tirer(sim, { angle: 1, vitesse: 0.3, duree: 2, tensionMax: 0.6, zigzag });
      return nbDecolles(sim);
    };
    expect(mesurer(0.06)).toBeGreaterThan(mesurer(0) * 1.15);
  });
});

describe('La pince', () => {
  it('sans pause, la pince ne se ferme pas', () => {
    const sim = nouvelleSimulation(1);
    const i = pointDuBord(sim, angleDEntree(sim));
    sim.placerOutil(sim.x[i], sim.y[i]);
    sim.poserDoigt();
    attendre(sim, sim.params.pincePause / 2);
    expect(sim.outil.ferme).toBe(false);
  });

  it("sur une zone encore collée (au milieu), elle n'arrache qu'une miette", () => {
    for (const graine of [1, 2, 3]) {
      const sim = nouvelleSimulation(graine);
      faireLeTour(sim);
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
    saisir(sim, pointDuBord(sim, angleDEntree(sim)));
    expect(sim.outil.ferme).toBe(true);
    sim.leverDoigt();
    expect(sim.outil.ferme).toBe(false);
    expect(sim.outil.prise).toEqual([]);
  });

  it('un morceau sorti quitte la vue et ne revient pas', () => {
    const { sim } = partie(1, FORT);
    expect(sim.morceauxSortis.length).toBeGreaterThan(0);
    const sortis = compter(sim.sorti);
    expect(sim.pointsRestants()).toBe(sim.n - sortis);
    expect(sortis).toBeGreaterThan(0);
  });
});

describe('La paroi sensible', () => {
  it('la spatule qui travaille sur la matière ne touche pas la peau', () => {
    const sim = nouvelleSimulation(1);
    const i = pointDuBord(sim, angleDEntree(sim));
    frotter(sim, sim.x[i], sim.y[i], 2);
    expect(contacts(sim)).toBe(0);
  });

  it('la spatule qui déborde sur la peau la touche : cela se remarque', () => {
    const sim = nouvelleSimulation(1);
    const a = angleDEntree(sim);
    frotter(sim, Math.cos(a) * 0.94, Math.sin(a) * 0.94, 2);
    expect(contacts(sim)).toBeGreaterThan(0);
  });

  it('immobile sur la peau, rien ne se passe', () => {
    const sim = nouvelleSimulation(1);
    frotter(sim, 0.94, 0, 2, 0);
    expect(contacts(sim)).toBe(0);
  });

  it('la pince ouverte qui racle la paroi la touche ; au milieu, non', () => {
    const racler = (r: number) => {
      const sim = nouvelleSimulation(1);
      sim.placerOutil(r, 0);
      sim.poserDoigt();
      for (let t = 0; t < 1; t += IMAGE) {
        sim.definirCible(r * Math.cos(t * 2), r * Math.sin(t * 2));
        sim.avancer(IMAGE);
      }
      return contacts(sim);
    };
    expect(racler((RAYON_PAROI + 1) / 2)).toBeGreaterThan(0);
    expect(racler(0.5)).toBe(0);
  });

  it('toucher la paroi ne punit pas : rien du bouchon ne change', () => {
    const sim = nouvelleSimulation(1);
    const avantTour = sim.tourRestant();
    const avantFond = nbDecolles(sim);
    frotter(sim, 0.96, 0, 3, 0.02);
    expect(sim.tourRestant()).toBe(avantTour);
    expect(nbDecolles(sim)).toBe(avantFond);
    expect(sim.lienOk.every((l) => l === 1)).toBe(true);
  });
});

describe('Cassure nette et spatule imprécise', () => {
  const fils = (sim: Simulation) => {
    let k = 0;
    for (let l = 0; l < sim.b.lienA.length; l++) {
      if (!sim.lienOk[l] || sim.sorti[sim.b.lienA[l]] || sim.sorti[sim.b.lienB[l]]) continue;
      const t1 = sim.b.lienTriangles[2 * l];
      const t2 = sim.b.lienTriangles[2 * l + 1];
      if (t1 >= 0 && !sim.triangleIntact(t1) && (t2 < 0 || !sim.triangleIntact(t2))) k++;
    }
    return k;
  };

  it('par défaut, la cire casse net : aucun fil ne reste après une déchirure', () => {
    for (const g of [1, 2, 3]) {
      const { sim } = partie(g, FORT);
      expect(sim.lienOk.length - compter(sim.lienOk)).toBeGreaterThan(0);
      expect(fils(sim)).toBe(0);
    }
  });

  it('la spatule décolle le tour même si la pointe est un peu à côté du bord', () => {
    for (const ecart of [-0.05, 0.05]) {
      const sim = nouvelleSimulation(1);
      const a = angleDEntree(sim);
      const i = pointDuBord(sim, a + 0.12); // juste à côté du point d'entrée
      const r = Math.hypot(sim.x[i], sim.y[i]) + ecart;
      const ang = Math.atan2(sim.y[i], sim.x[i]);
      const avant = sim.tourRestant();
      frotter(sim, Math.cos(ang) * r, Math.sin(ang) * r, 4);
      expect(sim.tourRestant()).toBeLessThan(avant);
    }
  });
});

describe('La spatule sous la cire (niveaux d\x27adhérence)', () => {
  it('elle affaiblit la colle du fond de proche en proche, sans la décoller complètement', () => {
    const sim = nouvelleSimulation(1);
    const a = angleDEntree(sim);
    const i = pointDuBord(sim, a);
    // On frotte en s'enfonçant vers le centre, à partir du point d'entrée.
    for (const k of [0, 0.08, 0.16]) frotter(sim, sim.b.x0[i] * (1 - k), sim.b.y0[i] * (1 - k), 3);
    const plancher = sim.params.spatulePlancher;
    let affaiblis = 0;
    for (let j = 0; j < sim.n; j++) {
      if (!sim.colleAuFond[j]) continue;
      expect(sim.sante[j]).toBeGreaterThanOrEqual(plancher - 1e-9);
      if (sim.sante[j] < 0.99) affaiblis++;
    }
    expect(affaiblis).toBeGreaterThan(3);
    expect(nbDecolles(sim)).toBe(sim.n - compter(sim.colleAuFond)); // rien de décollé en plus du tour
    expect(sim.prendreEvenements().some((e) => e.type === 'fondAffaibli')).toBe(true);
  });

  it('au milieu, loin de tout bord libre, elle ne s\x27enfonce pas', () => {
    const sim = nouvelleSimulation(1);
    let centre = 0;
    for (let j = 0; j < sim.n; j++) if (Math.hypot(sim.x[j], sim.y[j]) < Math.hypot(sim.x[centre], sim.y[centre])) centre = j;
    frotter(sim, sim.x[centre], sim.y[centre], 4);
    expect(sim.sante.every((v, j) => !sim.colleAuFond[j] || v === 1)).toBe(true);
  });

  it('la pince tient franchement la cire affaiblie par la spatule', () => {
    const sim = nouvelleSimulation(1);
    const a = angleDEntree(sim);
    const i = pointDuBord(sim, a);
    for (const k of [0, 0.08, 0.16]) frotter(sim, sim.b.x0[i] * (1 - k), sim.b.y0[i] * (1 - k), 3);
    let affaibli = -1;
    for (let j = 0; j < sim.n; j++) if (sim.colleAuFond[j] && sim.sante[j] <= sim.params.prisePossible) affaibli = j;
    expect(affaibli).toBeGreaterThanOrEqual(0);
    sim.choisirOutil('pince');
    expect(saisir(sim, affaibli)).toBe(true);
    expect(sim.outil.faible).toBe(false);
  });
});
