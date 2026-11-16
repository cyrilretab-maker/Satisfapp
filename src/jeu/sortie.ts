// La sortie d'un morceau : il grossit légèrement, comme s'il venait vers la caméra,
// puis file et tombe dans le bocal.

import { dessinerMorceau, type MorceauGarde } from './bocal';

interface Vol {
  morceau: MorceauGarde;
  x: number; // départ (pixels)
  y: number;
  debut: number; // secondes
}

const GROSSIR = 0.35; // secondes à venir vers la caméra
const TOMBER = 0.55; // secondes pour rejoindre le bocal

export class Sorties {
  private vols: Vol[] = [];

  lancer(morceau: MorceauGarde, x: number, y: number, temps: number): void {
    this.vols.push({ morceau, x, y, debut: temps });
  }

  /** Dessine les morceaux en vol vers le bocal (bx, by). `echelle` = pixels par unité de vue. */
  dessiner(ctx: CanvasRenderingContext2D, temps: number, echelle: number, bx: number, by: number): void {
    this.vols = this.vols.filter((v) => temps - v.debut < GROSSIR + TOMBER);
    for (const v of this.vols) {
      const t = temps - v.debut;
      let x = v.x;
      let y = v.y;
      let taille = 1 + 0.25 * Math.min(1, t / GROSSIR);
      let opacite = 1;
      if (t > GROSSIR) {
        const k = (t - GROSSIR) / TOMBER;
        const doux = k * k * (3 - 2 * k);
        x = v.x + (bx - v.x) * doux;
        y = v.y + (by - v.y) * doux;
        taille = 1.25 * (1 - 0.9 * doux);
        opacite = 1 - 0.4 * doux;
      }
      ctx.globalAlpha = opacite;
      dessinerMorceau(ctx, v.morceau, x, y, echelle * taille, '#cf9a3f');
      ctx.globalAlpha = 1;
    }
  }

  enCours(): boolean {
    return this.vols.length > 0;
  }
}
