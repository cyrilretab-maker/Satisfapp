// Une texture de bruit qui se répète sans couture, calculée une fois au démarrage.
// Elle donne son grain à la peau et ses bosses à la cire. Quatre canaux, quatre finesses :
// R = grandes ondulations, G = moyennes, B = grain fin, A = pores (petits points).

import { creerHasard } from '../matiere/hasard';

export const TAILLE_BRUIT = 256;

/** Bruit de valeurs périodique : une grille de f×f valeurs au hasard, lissée. */
function couche(f: number, hasard: () => number): (x: number, y: number) => number {
  const grille = new Float32Array(f * f);
  for (let i = 0; i < grille.length; i++) grille[i] = hasard();
  const v = (i: number, j: number) => grille[((j + f) % f) * f + ((i + f) % f)];
  return (x, y) => {
    const gx = x * f;
    const gy = y * f;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    let u = gx - i;
    let w = gy - j;
    u = u * u * (3 - 2 * u);
    w = w * w * (3 - 2 * w);
    const a = v(i, j) + (v(i + 1, j) - v(i, j)) * u;
    const b = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * u;
    return a + (b - a) * w;
  };
}

/** Les pixels RGBA (0..255) de la texture de bruit. */
export function fabriquerBruit(graine = 7): Uint8Array {
  const h = creerHasard(graine);
  const n = TAILLE_BRUIT;
  const grandes = [couche(4, h), couche(8, h), couche(16, h)];
  const moyennes = [couche(16, h), couche(32, h)];
  const fines = [couche(64, h), couche(128, h)];
  const pores = couche(96, h);
  const pixels = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const y = j / n;
      const r = grandes[0](x, y) * 0.55 + grandes[1](x, y) * 0.3 + grandes[2](x, y) * 0.15;
      const g = moyennes[0](x, y) * 0.65 + moyennes[1](x, y) * 0.35;
      const b = fines[0](x, y) * 0.6 + fines[1](x, y) * 0.4;
      const p = pores(x, y);
      const k = 4 * (j * n + i);
      pixels[k] = Math.round(r * 255);
      pixels[k + 1] = Math.round(g * 255);
      pixels[k + 2] = Math.round(b * 255);
      pixels[k + 3] = Math.round(Math.max(0, Math.min(1, (p - 0.72) / 0.18)) * 255);
    }
  }
  return pixels;
}
