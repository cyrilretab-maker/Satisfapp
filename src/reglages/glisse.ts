// Comment un doigt posé sur un curseur du panneau est compris.
// Défiler la liste (geste vertical) ne doit jamais changer un réglage :
// seul un glissement nettement horizontal fait bouger la valeur, à partir de là où elle était.

export const SEUIL_GLISSE = 10; // pixels à parcourir avant de décider

export type Intention = 'attendre' | 'glisser' | 'defiler';

/** Décide, d'après le déplacement depuis l'appui, si le doigt règle le curseur ou fait défiler. */
export function intention(dx: number, dy: number): Intention {
  if (Math.hypot(dx, dy) < SEUIL_GLISSE) return 'attendre';
  return Math.abs(dx) > 1.5 * Math.abs(dy) ? 'glisser' : 'defiler';
}

/** Nouvelle valeur après un glissement de dx pixels sur un curseur large de `largeur` pixels. */
export function valeurApresGlisse(
  depart: number,
  dx: number,
  largeur: number,
  min: number,
  max: number,
  pas: number,
): number {
  const brute = depart + (dx / Math.max(1, largeur)) * (max - min);
  const arrondie = Math.round((brute - min) / pas) * pas + min;
  const bornee = Math.min(max, Math.max(min, arrondie));
  return Number(bornee.toFixed(6));
}
