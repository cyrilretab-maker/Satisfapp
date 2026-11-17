// Disposition de l'écran de l'eau, en portrait : l'égouttoir occupe presque tout l'écran,
// le rebord traverse le bas, et dessous on voit la paroi de l'évier. Le vase est en haut à gauche.

import { NX, NY } from './moteur-eau';

export interface DispositionEau {
  largeur: number;
  hauteur: number;
  ox: number; // coin haut-gauche de l'égouttoir (pixels)
  oy: number;
  taille: number; // pixels par case
  paroiH: number; // hauteur de la paroi de l'évier sous le rebord (pixels)
}

export function disposerEau(largeur: number, hauteur: number): DispositionEau {
  const haut = 68; // la place du vase et du retour
  const paroiH = Math.max(60, Math.round(hauteur * 0.1));
  const dispo = hauteur - haut - paroiH - 8;
  const taille = Math.max(2, Math.min((largeur - 16) / NX, dispo / NY));
  return {
    largeur,
    hauteur,
    ox: (largeur - NX * taille) / 2,
    oy: haut,
    taille,
    paroiH,
  };
}

/** Pixels de l'écran → cases de l'égouttoir (le doigt peut aller sous le rebord, sur la paroi). */
export function versCases(d: DispositionEau, px: number, py: number): [number, number] {
  return [(px - d.ox) / d.taille - 0.5, (py - d.oy) / d.taille - 0.5];
}
