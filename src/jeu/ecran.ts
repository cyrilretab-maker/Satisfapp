// Disposition de l'écran de jeu, en portrait : la vue ronde en haut, la zone du pouce en bas.
// (Mode « pavé tactile », choisi par Cyril au lot 1.)

export interface Disposition {
  largeur: number;
  hauteur: number;
  cx: number; // centre de la vue ronde (pixels)
  cy: number;
  rayon: number; // rayon de la vue ronde (pixels)
  pave: { x: number; y: number; l: number; h: number };
}

const MARGE = 16;

export function disposer(largeur: number, hauteur: number): Disposition {
  const rayon = Math.max(60, Math.min((largeur - 2 * MARGE) / 2, hauteur * 0.29));
  const cy = MARGE + 24 + rayon;
  const haut = cy + rayon + MARGE * 1.5;
  return {
    largeur,
    hauteur,
    cx: largeur / 2,
    cy,
    rayon,
    pave: { x: MARGE, y: haut, l: largeur - 2 * MARGE, h: Math.max(80, hauteur - haut - MARGE * 2) },
  };
}

export function dansPave(d: Disposition, px: number, py: number): boolean {
  const p = d.pave;
  return px >= p.x && px <= p.x + p.l && py >= p.y && py <= p.y + p.h;
}
