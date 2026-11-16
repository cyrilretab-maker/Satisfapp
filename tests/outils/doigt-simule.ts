// Un doigt simulé, pour tester les règles de la matière sans écran.

import defauts from '../../src/reglages/defauts.json';
import { Reglages, type FichierReglages } from '../../src/reglages/reglages';
import { genererBouchon } from '../../src/matiere/bouchon';
import { Simulation } from '../../src/matiere/moteur';
import { lireParamsBouchon, lireParamsMatiere } from '../../src/matiere/parametres';

export const IMAGE = 1 / 60;

export function nouvelleSimulation(graine: number, modifs: Record<string, number> = {}): Simulation {
  const r = new Reglages(defauts as FichierReglages, null);
  for (const [id, v] of Object.entries(modifs)) r.ecrire(id, v);
  return new Simulation(genererBouchon(graine, lireParamsBouchon(r)), lireParamsMatiere(r));
}

export function attendre(sim: Simulation, secondes: number): void {
  for (let t = 0; t < secondes; t += IMAGE) sim.avancer(IMAGE);
}

/** Le point de la matière le plus loin dans une direction (le bord du bouchon de ce côté). */
export function pointDuBord(sim: Simulation, angle: number): number {
  const [cx, cy] = [Math.cos(angle), Math.sin(angle)];
  let meilleur = -1;
  let max = -Infinity;
  for (let i = 0; i < sim.n; i++) {
    if (sim.sorti[i]) continue;
    const proj = sim.x[i] * cx + sim.y[i] * cy;
    if (proj > max) {
      max = proj;
      meilleur = i;
    }
  }
  return meilleur;
}

/** Pose le doigt sur un point, marque la pause : la pince se ferme. */
export function saisir(sim: Simulation, i: number): boolean {
  sim.placerOutil(sim.x[i], sim.y[i]);
  sim.poserDoigt();
  attendre(sim, sim.params.pincePause + 0.1);
  return sim.outil.ferme;
}

export interface Traction {
  angle: number; // direction de traction
  vitesse: number; // vitesse du pouce (unités de vue par seconde)
  duree: number; // secondes maximum
  zigzag?: number; // amplitude d'un va-et-vient perpendiculaire (changer de direction)
  /** Doigt « attentif » : ne tire plus quand la tension dépasse ce niveau (0..1). */
  tensionMax?: number;
}

/** Tire avec la pince fermée, jusqu'à la sortie d'un morceau ou la fin du temps. */
export function tirer(sim: Simulation, t: Traction): void {
  const [ux, uy] = [Math.cos(t.angle), Math.sin(t.angle)];
  const sortisAvant = sim.morceauxSortis.length;
  let cx = sim.outil.cibleX;
  let cy = sim.outil.cibleY;
  for (let temps = 0; temps < t.duree; temps += IMAGE) {
    if (!sim.outil.ferme || sim.morceauxSortis.length > sortisAvant) break;
    if (t.tensionMax === undefined || sim.tension() < t.tensionMax) {
      cx += ux * t.vitesse * IMAGE;
      cy += uy * t.vitesse * IMAGE;
    } else {
      // Le doigt attentif sent que ça va casser : il relâche un peu, vers la pointe de l'outil.
      const dx = sim.outil.x - cx;
      const dy = sim.outil.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const recul = Math.min(d, t.vitesse * IMAGE);
      cx += (dx / d) * recul;
      cy += (dy / d) * recul;
    }
    const z = t.zigzag ? t.zigzag * Math.sin(temps * Math.PI * 2 * 0.7) : 0;
    sim.definirCible(cx - uy * z, cy + ux * z);
    sim.avancer(IMAGE);
  }
}

/** Plus gros morceau sorti (part du bouchon), 0 si aucun. */
export function plusGrosSorti(sim: Simulation): number {
  return sim.morceauxSortis.reduce((a, b) => Math.max(a, b), 0);
}

/** Angle (depuis le centre) d'un point d'entrée du bouchon. */
export function angleDEntree(sim: Simulation): number {
  for (let i = 0; i < sim.n; i++) if (sim.b.entree[i]) return Math.atan2(sim.b.y0[i], sim.b.x0[i]);
  return 0;
}

/**
 * Fait le tour à la spatule comme un joueur appliqué : va au point du tour décollable le plus
 * proche, le travaille par petits mouvements jusqu'à ce qu'il lâche, puis passe au suivant.
 * Renvoie la durée en secondes.
 */
export function faireLeTour(sim: Simulation, dureeMax = 120, vitesse = 0.6): number {
  sim.choisirOutil('spatule');
  const t0 = sim.temps;
  const prochain = (): number => {
    let meilleur = -1;
    let dMin = Infinity;
    for (let i = 0; i < sim.n; i++) {
      if (!sim.colleAuTour[i] || !sim.aCoteDUnBordLibre(i)) continue;
      const d = Math.hypot(sim.x[i] - sim.outil.x, sim.y[i] - sim.outil.y);
      if (d < dMin) {
        dMin = d;
        meilleur = i;
      }
    }
    return meilleur;
  };
  const premier = prochain();
  if (premier >= 0) sim.placerOutil(sim.x[premier], sim.y[premier]);
  sim.poserDoigt();
  let cx = sim.outil.x;
  let cy = sim.outil.y;
  while (sim.tourRestant() > 0 && sim.temps - t0 < dureeMax) {
    const i = prochain();
    if (i < 0) break;
    const dx = sim.x[i] - cx;
    const dy = sim.y[i] - cy;
    const d = Math.hypot(dx, dy);
    const pas = Math.min(d, vitesse * IMAGE);
    if (d > 1e-6) {
      cx += (dx / d) * pas;
      cy += (dy / d) * pas;
    }
    // Petits va-et-vient sur place (la spatule n'agit qu'en bougeant).
    const t = sim.temps * Math.PI * 2 * 4;
    sim.definirCible(cx + 0.015 * Math.cos(t), cy + 0.015 * Math.sin(t));
    sim.avancer(IMAGE);
  }
  sim.leverDoigt();
  sim.choisirOutil('pince');
  return sim.temps - t0;
}

/** Le point du bord déjà décollé le plus loin dans une direction (là où un joueur saisit). */
export function pointLibreDuBord(sim: Simulation, angle: number): number {
  const [cx, cy] = [Math.cos(angle), Math.sin(angle)];
  let meilleur = -1;
  let max = -Infinity;
  for (let i = 0; i < sim.n; i++) {
    if (sim.sorti[i] || !sim.b.bord[i] || !sim.estLibre(i)) continue;
    const proj = sim.x[i] * cx + sim.y[i] * cy;
    if (proj > max) {
      max = proj;
      meilleur = i;
    }
  }
  return meilleur >= 0 ? meilleur : pointDuBord(sim, angle);
}
