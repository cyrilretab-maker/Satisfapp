// Le conduit vu en profondeur (V2).
//
// La matière est calculée « à plat », en unités de matière :
//  - le fond du conduit est le disque de rayon FOND (0,95) : c'est là qu'est le bouchon ;
//  - la paroi du conduit est l'anneau entre FOND et ENTREE (1,35), « déroulé » :
//    plus on s'éloigne du centre, plus on remonte vers l'entrée de l'oreille.
// L'image replie cet anneau en tunnel : le fond paraît petit et lointain, la paroi fuit vers lui.
// Le même calcul existe dans le dessin par la puce graphique (rendu-gl.ts) : garder les deux pareils.

export const FOND = 0.95;
export const ENTREE = 1.35;

export interface Vue3D {
  /** Rayon du fond à l'écran (part du rayon de la vue) : plus petit = conduit plus profond. */
  fond: number;
  /** Décalage du point de fuite (unités de vue) : l'effet 3D quand l'outil bouge. */
  fuiteX: number;
  fuiteY: number;
}

/** Rayon à l'écran (0..1, sans décalage) d'un endroit à la distance s du centre (unités de matière). */
export function rayonEcran(s: number, fond: number): number {
  if (s <= FOND) return (s / FOND) * fond;
  const z = 1 - Math.min(1, (s - FOND) / (ENTREE - FOND)); // profondeur : 1 au fond, 0 à l'entrée
  const K = 1 / fond - 1;
  const u = 1 / (1 + K * z);
  return s > ENTREE ? u * (1 + (s - ENTREE) * 0.3) : u;
}

/** Distance au centre (unités de matière) d'un rayon à l'écran (inverse de rayonEcran). */
export function rayonMatiere(u: number, fond: number): number {
  if (u <= fond) return (u / fond) * FOND;
  if (u >= 1) return ENTREE + (u - 1) / 0.3;
  const K = 1 / fond - 1;
  const z = (1 / u - 1) / K;
  return FOND + (1 - z) * (ENTREE - FOND);
}

/** Endroit de la matière → endroit dans la vue (unités de vue, rayon 1). */
export function versVue(x: number, y: number, v: Vue3D): [number, number] {
  const s = Math.hypot(x, y);
  const u = rayonEcran(s, v.fond);
  const dx = s > 1e-9 ? x / s : 0;
  const dy = s > 1e-9 ? y / s : 0;
  return [v.fuiteX * (1 - u) + dx * u, v.fuiteY * (1 - u) + dy * u];
}

/** Endroit dans la vue → endroit de la matière (inverse de versVue). */
export function versMatiere(px: number, py: number, v: Vue3D): [number, number] {
  const ax = px - v.fuiteX;
  const ay = py - v.fuiteY;
  const ac = ax * v.fuiteX + ay * v.fuiteY;
  const c2 = v.fuiteX * v.fuiteX + v.fuiteY * v.fuiteY;
  const u = (ac + Math.sqrt(Math.max(0, ac * ac + (1 - c2) * (ax * ax + ay * ay)))) / Math.max(1e-6, 1 - c2);
  if (u < 1e-9) return [0, 0];
  const dx = (ax + v.fuiteX * u) / u;
  const dy = (ay + v.fuiteY * u) / u;
  const s = rayonMatiere(u, v.fond);
  return [dx * s, dy * s];
}

/** Combien de pixels de vue pour une unité de matière, autour de cet endroit (pour la taille des outils). */
export function echelleLocale(x: number, y: number, v: Vue3D): number {
  // La taille apparente suit la distance à la caméra : celle du rayon de l'anneau à cette profondeur.
  const s = Math.max(FOND, Math.hypot(x, y));
  return rayonEcran(s, v.fond) / s;
}
