// Disposition de l'écran de jeu, en portrait.
// Pavé tactile : la vue ronde en haut, la zone du pouce en bas.
// Direct décalé : pas de zone du pouce, la vue ronde s'agrandit.

export type ModeCommande = 'pave' | 'direct';

export interface Disposition {
  mode: ModeCommande;
  largeur: number;
  hauteur: number;
  cx: number; // centre de la vue ronde (pixels)
  cy: number;
  rayon: number; // rayon de la vue ronde (pixels)
  pave: { x: number; y: number; l: number; h: number } | null;
}

const MARGE = 16;

export function disposer(largeur: number, hauteur: number, mode: ModeCommande): Disposition {
  if (mode === 'direct') {
    const rayon = Math.max(60, Math.min((largeur - MARGE) / 2, hauteur * 0.42));
    return { mode, largeur, hauteur, cx: largeur / 2, cy: hauteur * 0.45, rayon, pave: null };
  }
  const rayon = Math.max(60, Math.min((largeur - 2 * MARGE) / 2, hauteur * 0.29));
  const cy = MARGE + 24 + rayon;
  const haut = cy + rayon + MARGE * 1.5;
  return {
    mode,
    largeur,
    hauteur,
    cx: largeur / 2,
    cy,
    rayon,
    pave: { x: MARGE, y: haut, l: largeur - 2 * MARGE, h: Math.max(80, hauteur - haut - MARGE * 2) },
  };
}

/** Pixels de l'écran → coordonnées de la vue (rayon 1, centre 0). */
export function versVue(d: Disposition, px: number, py: number): [number, number] {
  return [(px - d.cx) / d.rayon, (py - d.cy) / d.rayon];
}

export function dansPave(d: Disposition, px: number, py: number): boolean {
  const p = d.pave;
  return p !== null && px >= p.x && px <= p.x + p.l && py >= p.y && py <= p.y + p.h;
}
