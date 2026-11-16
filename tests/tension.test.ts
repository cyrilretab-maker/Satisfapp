import { describe, expect, it } from 'vitest';
import defauts from '../src/reglages/defauts.json';
import { Reglages, type FichierReglages } from '../src/reglages/reglages';
import { PiloteTension } from '../src/sensations/tension';
import { lireReglagesTension } from '../src/sensations/parametres-sensations';
import { faireLeTour, IMAGE, nouvelleSimulation, pointLibreDuBord, saisir } from './outils/doigt-simule';

const reglages = lireReglagesTension(new Reglages(defauts as FichierReglages, null));

/** Fait tourner le pilote à tension constante, renvoie les instants des pulsations. */
function pulsations(tension: number, secondes = 4): number[] {
  const p = new PiloteTension(reglages);
  const instants: number[] = [];
  for (let t = 0; t < secondes; t += IMAGE) if (p.mettreAJour(t, tension).vibrer.length) instants.push(t);
  return instants;
}

describe('La vibration suit la tension', () => {
  it('sous le seuil, rien', () => {
    expect(pulsations(reglages.seuil * 0.9)).toEqual([]);
  });

  it('les pulsations se rapprochent quand la tension monte', () => {
    const lentes = pulsations(reglages.seuil + 0.05).length;
    const moyennes = pulsations(0.6).length;
    const rapides = pulsations(0.98).length;
    expect(lentes).toBeGreaterThan(0);
    expect(moyennes).toBeGreaterThan(lentes);
    expect(rapides).toBeGreaterThan(moyennes);
  });

  it('les craquements se rapprochent et deviennent plus aigus', () => {
    const p = new PiloteTension(reglages);
    const faible: number[] = [];
    const forte: number[] = [];
    for (let t = 0; t < 3; t += IMAGE) faible.push(...p.mettreAJour(t, 0.4).craquements);
    const q = new PiloteTension(reglages);
    for (let t = 0; t < 3; t += IMAGE) forte.push(...q.mettreAJour(t, 0.95).craquements);
    expect(forte.length).toBeGreaterThan(faible.length);
    expect(Math.max(...forte)).toBeGreaterThan(Math.max(...faible));
  });

  it('à la rupture : arrêt net, puis un seul coup bref, puis rien pendant le silence', () => {
    const p = new PiloteTension(reglages);
    p.mettreAJour(0, 0.9);
    p.rupture(1);
    const premier = p.mettreAJour(1, 0.9);
    expect(premier.arreter).toBe(true);
    expect(premier.vibrer).toEqual([]);
    const coups: number[] = [];
    for (let t = 1 + IMAGE; t < 1 + reglages.silenceRupture / 1000 - IMAGE; t += IMAGE) coups.push(...p.mettreAJour(t, 0.9).vibrer);
    expect(coups).toEqual([reglages.coupRupture]);
  });

  it('à la grande sortie : arrêt net, silence, puis une longue vibration', () => {
    const p = new PiloteTension(reglages);
    p.grandeSortie(0);
    expect(p.mettreAJour(0, 0).arreter).toBe(true);
    const coups: { t: number; d: number }[] = [];
    const fin = (reglages.silenceSortie + reglages.vibrationSortie) / 1000 + 0.9; // avant la reprise
    for (let t = IMAGE; t < fin; t += IMAGE) for (const d of p.mettreAJour(t, 0.9).vibrer) coups.push({ t, d });
    expect(coups.length).toBe(1);
    expect(coups[0].t).toBeGreaterThanOrEqual(reglages.silenceSortie / 1000);
    expect(coups[0].d).toBe(reglages.vibrationSortie);
  });
});

describe('La casse se sent venir', () => {
  it('en tirant régulièrement, les pulsations commencent plus d\'une seconde avant la première déchirure', () => {
    for (const g of [1, 2, 3, 4]) {
      const sim = nouvelleSimulation(g);
      faireLeTour(sim);
      const angle = g * 1.3;
      saisir(sim, pointLibreDuBord(sim, angle));
      sim.prendreEvenements();
      let debut = -1;
      let casse = -1;
      let cx = sim.outil.cibleX;
      let cy = sim.outil.cibleY;
      for (let t = 0; t < 30 && casse < 0; t += IMAGE) {
        cx += Math.cos(angle) * 0.1 * IMAGE; // traction régulière, sans relâcher
        cy += Math.sin(angle) * 0.1 * IMAGE;
        sim.definirCible(cx, cy);
        sim.avancer(IMAGE);
        if (debut < 0 && sim.tension() >= reglages.seuil) debut = sim.temps;
        // Seules comptent les déchirures causées par la traction (près de la pince) : loin d'elle,
        // un bord replié en sac peut céder tout seul (déjà le cas en V1 pendant le tour).
        const pres = (e: { type: string; lien?: number }) => {
          if (e.type !== 'lienCasse' || e.lien === undefined) return false;
          const a = sim.b.lienA[e.lien];
          return Math.hypot(sim.x[a] - sim.outil.x, sim.y[a] - sim.outil.y) < 0.6;
        };
        if (sim.prendreEvenements().some(pres)) casse = sim.temps;
      }
      expect(casse).toBeGreaterThan(0);
      expect(casse - debut).toBeGreaterThanOrEqual(1);
    }
  });
});
