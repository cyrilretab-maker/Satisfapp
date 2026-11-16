// Disposition de l'écran de jeu, en portrait : la vue ronde en haut, les deux boutons d'outil,
// puis la zone du pouce en bas. (Mode « pavé tactile », choisi par Cyril au lot 1.)

export interface Rectangle {
  x: number;
  y: number;
  l: number;
  h: number;
}

export interface Disposition {
  largeur: number;
  hauteur: number;
  cx: number; // centre de la vue ronde (pixels)
  cy: number;
  rayon: number; // rayon de la vue ronde (pixels)
  boutons: Rectangle; // la rangée des deux boutons d'outil
  pave: Rectangle;
}

const MARGE = 16;
const HAUTEUR_BOUTONS = 48;

export function disposer(largeur: number, hauteur: number): Disposition {
  const rayon = Math.max(60, Math.min((largeur - 2 * MARGE) / 2, hauteur * 0.27));
  const cy = MARGE + 24 + rayon;
  const yBoutons = cy + rayon + MARGE;
  const yPave = yBoutons + HAUTEUR_BOUTONS + MARGE;
  return {
    largeur,
    hauteur,
    cx: largeur / 2,
    cy,
    rayon,
    boutons: { x: MARGE, y: yBoutons, l: largeur - 2 * MARGE, h: HAUTEUR_BOUTONS },
    pave: { x: MARGE, y: yPave, l: largeur - 2 * MARGE, h: Math.max(80, hauteur - yPave - MARGE * 2) },
  };
}

export function dansPave(d: Disposition, px: number, py: number): boolean {
  const p = d.pave;
  return px >= p.x && px <= p.x + p.l && py >= p.y && py <= p.y + p.h;
}
