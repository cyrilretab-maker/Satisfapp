// Le dessin simple de l'eau (Canvas 2D, formes grises) : sert quand la puce graphique manque,
// ou quand on décoche « dessin réaliste ». L'inox gris, la trace mouillée plus sombre, l'eau bleu-gris.

import type { DispositionEau } from './ecran-eau';
import { NX, NY, type Eau } from './moteur-eau';

let image: ImageData | null = null;
let petite: HTMLCanvasElement | null = null;

export function dessinerEauSimple(ctx: CanvasRenderingContext2D, eau: Eau, d: DispositionEau, temps: number): void {
  ctx.fillStyle = '#141010';
  ctx.fillRect(0, 0, d.largeur, d.hauteur);
  if (!petite) {
    petite = document.createElement('canvas');
    petite.width = NX;
    petite.height = NY;
  }
  const c = petite.getContext('2d')!;
  if (!image) image = c.createImageData(NX, NY);
  const px = image.data;
  for (let k = 0; k < NX * NY; k++) {
    const h = eau.h[k];
    const mouille = eau.mouille[k] > 0 ? 1 : 0;
    let g = 150 - mouille * 22;
    let r = g;
    let b = g;
    if (h > 0.03) {
      const a = Math.min(1, h / 1.2);
      r = r * (1 - a) + 70 * a;
      g = g * (1 - a) + 95 * a;
      b = b * (1 - a) + 125 * a;
    }
    px[4 * k] = r;
    px[4 * k + 1] = g;
    px[4 * k + 2] = b;
    px[4 * k + 3] = 255;
  }
  c.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(petite, d.ox, d.oy, NX * d.taille, NY * d.taille);
  // Le rebord, puis la paroi de l'évier.
  const yRebord = d.oy + NY * d.taille;
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(d.ox, yRebord - 2, NX * d.taille, 4);
  ctx.fillStyle = '#4d4d4d';
  ctx.fillRect(d.ox, yRebord + 2, NX * d.taille, d.paroiH);
  ctx.strokeStyle = 'rgba(110, 140, 170, 0.9)';
  for (let x = 0; x < NX; x++) {
    const f = eau.paroi[x];
    if (f < 0.02) continue;
    ctx.lineWidth = Math.min(4, 1 + f * 2);
    ctx.beginPath();
    const X = d.ox + (x + 0.5) * d.taille;
    const decal = (temps * 120) % 20;
    for (let y = yRebord + 2 - decal; y < yRebord + d.paroiH; y += 20) {
      ctx.moveTo(X, Math.max(yRebord + 2, y));
      ctx.lineTo(X, Math.min(yRebord + d.paroiH, y + 14));
    }
    ctx.stroke();
  }
}
