// Les deux modes de commande, à comparer au lot 1.
//  - Pavé tactile : le pouce glisse dans la zone du bas, l'outil fait le même déplacement en haut.
//  - Direct décalé : on touche la vue, la pointe de l'outil apparaît un peu au-dessus du doigt.
// Un seul doigt compte à la fois. Lever le doigt ouvre la pince.

import type { Simulation } from '../matiere/moteur';
import { dansPave, versVue, type Disposition } from './ecran';

export interface ReglagesCommande {
  sensibilite: number; // pavé : distance parcourue par l'outil pour un même glissé
  decalage: number; // direct : pixels entre le doigt et la pointe de l'outil
}

export function brancherCommande(
  surface: HTMLElement,
  lireSimulation: () => Simulation,
  lireDisposition: () => Disposition,
  lireReglages: () => ReglagesCommande,
): () => void {
  let doigt: number | null = null;
  let dernierX = 0;
  let dernierY = 0;

  const pointeDirecte = (px: number, py: number): [number, number] =>
    versVue(lireDisposition(), px, py - lireReglages().decalage);

  const poser = (e: PointerEvent) => {
    if (doigt !== null) return;
    const d = lireDisposition();
    const sim = lireSimulation();
    if (d.mode === 'pave') {
      if (!dansPave(d, e.clientX, e.clientY)) return;
      sim.definirCible(sim.outil.x, sim.outil.y);
    } else {
      const [x, y] = pointeDirecte(e.clientX, e.clientY);
      sim.placerOutil(x, y);
    }
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
    const d = lireDisposition();
    const sim = lireSimulation();
    if (d.mode === 'pave') {
      const k = lireReglages().sensibilite / d.rayon;
      sim.definirCible(sim.outil.cibleX + (e.clientX - dernierX) * k, sim.outil.cibleY + (e.clientY - dernierY) * k);
    } else {
      const [x, y] = pointeDirecte(e.clientX, e.clientY);
      sim.definirCible(x, y);
    }
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
