// Commande « pavé tactile » (choisie par Cyril au lot 1) :
// le pouce glisse dans la zone du bas, l'outil fait le même déplacement dans la vue ronde.
// Un seul doigt compte à la fois. Lever le doigt ouvre la pince.

import type { Simulation } from '../matiere/moteur';
import { dansPave, type Disposition } from './ecran';

export function brancherCommande(
  surface: HTMLElement,
  lireSimulation: () => Simulation,
  lireDisposition: () => Disposition,
  lireSensibilite: () => number,
): () => void {
  let doigt: number | null = null;
  let dernierX = 0;
  let dernierY = 0;

  const poser = (e: PointerEvent) => {
    if (doigt !== null) return;
    if (!dansPave(lireDisposition(), e.clientX, e.clientY)) return;
    const sim = lireSimulation();
    sim.definirCible(sim.outil.x, sim.outil.y);
    doigt = e.pointerId;
    dernierX = e.clientX;
    dernierY = e.clientY;
    try {
      surface.setPointerCapture(e.pointerId); // garder le doigt même s'il sort de la zone
    } catch {
      /* doigt simulé : pas de capture possible */
    }
    sim.poserDoigt();
    e.preventDefault();
  };

  const bouger = (e: PointerEvent) => {
    if (e.pointerId !== doigt) return;
    const sim = lireSimulation();
    const k = lireSensibilite() / lireDisposition().rayon;
    sim.definirCible(sim.outil.cibleX + (e.clientX - dernierX) * k, sim.outil.cibleY + (e.clientY - dernierY) * k);
    dernierX = e.clientX;
    dernierY = e.clientY;
    e.preventDefault();
  };

  const lever = (e: PointerEvent) => {
    if (e.pointerId !== doigt) return;
    doigt = null;
    lireSimulation().leverDoigt();
  };

  surface.addEventListener('pointerdown', poser);
  surface.addEventListener('pointermove', bouger);
  surface.addEventListener('pointerup', lever);
  surface.addEventListener('pointercancel', lever);
  return () => {
    surface.removeEventListener('pointerdown', poser);
    surface.removeEventListener('pointermove', bouger);
    surface.removeEventListener('pointerup', lever);
    surface.removeEventListener('pointercancel', lever);
  };
}
