// Le bocal : il garde chaque morceau sorti, avec sa forme et sa taille, d'une partie à l'autre.
// Pas de chiffre affiché : le plus gros morceau d'un seul tenant est simplement mis en avant.

import type { Simulation } from '../matiere/moteur';
import type { StockageSimple } from '../reglages/reglages';

export interface MorceauGarde {
  part: number; // part du bouchon (0..1) : sert seulement à trouver le plus gros
  pts: number[]; // x, y, x, y… autour de son centre, en unités de vue (taille réelle)
  tris: number[]; // 3 indices de points par triangle
}

export const CLE_BOCAL = 'satisfapp.bocal.v1';
const MORCEAUX_MAX = 100; // un bouchon entier pèse ~20 Ko : le bocal reste loin de la limite du téléphone

/** La forme d'un morceau au moment où il sort : ses points (recentrés) et ses triangles intacts. */
export function formeDuMorceau(sim: Simulation, indices: number[]): MorceauGarde {
  const local = new Map<number, number>();
  indices.forEach((i, k) => local.set(i, k));
  let cx = 0;
  let cy = 0;
  for (const i of indices) {
    cx += sim.x[i];
    cy += sim.y[i];
  }
  cx /= Math.max(1, indices.length);
  cy /= Math.max(1, indices.length);
  const pts: number[] = [];
  for (const i of indices) pts.push(Math.round((sim.x[i] - cx) * 1000) / 1000, Math.round((sim.y[i] - cy) * 1000) / 1000);
  const tris: number[] = [];
  const b = sim.b;
  for (let t = 0; t < b.triangles.length / 3; t++) {
    const a = local.get(b.triangles[3 * t]);
    const c = local.get(b.triangles[3 * t + 1]);
    const e = local.get(b.triangles[3 * t + 2]);
    if (a === undefined || c === undefined || e === undefined || !sim.triangleIntact(t)) continue;
    tris.push(a, c, e);
  }
  return { part: indices.length / sim.n, pts, tris };
}

export class Bocal {
  morceaux: MorceauGarde[] = [];

  constructor(private readonly stockage: StockageSimple | null) {
    try {
      const texte = stockage?.getItem(CLE_BOCAL);
      const lu = texte ? JSON.parse(texte) : [];
      if (Array.isArray(lu)) this.morceaux = lu.filter((m) => m && Array.isArray(m.pts) && Array.isArray(m.tris));
    } catch {
      this.morceaux = [];
    }
  }

  ajouter(m: MorceauGarde): void {
    this.morceaux.push(m);
    if (this.morceaux.length > MORCEAUX_MAX) {
      // Le bocal est plein : on oublie le plus petit (jamais le plus gros).
      let petit = 0;
      this.morceaux.forEach((x, i) => {
        if (x.part < this.morceaux[petit].part) petit = i;
      });
      this.morceaux.splice(petit, 1);
    }
    this.enregistrer();
  }

  vider(): void {
    this.morceaux = [];
    this.enregistrer();
  }

  /** Indice du plus gros morceau, ou -1 si le bocal est vide. */
  plusGros(): number {
    let k = -1;
    this.morceaux.forEach((m, i) => {
      if (k < 0 || m.part > this.morceaux[k].part) k = i;
    });
    return k;
  }

  /** Remplissage du bocal (0..1), pour l'icône. */
  remplissage(): number {
    return Math.min(1, this.morceaux.reduce((s, m) => s + m.part, 0) / 2);
  }

  private enregistrer(): void {
    try {
      this.stockage?.setItem(CLE_BOCAL, JSON.stringify(this.morceaux));
    } catch {
      /* stockage plein : le bocal reste en mémoire pour cette session */
    }
  }
}

/** Dessine un morceau (centré en x, y), à l'échelle donnée (pixels par unité de vue). */
export function dessinerMorceau(
  ctx: CanvasRenderingContext2D,
  m: MorceauGarde,
  x: number,
  y: number,
  echelle: number,
  couleur = '#c08a34',
): void {
  ctx.fillStyle = couleur;
  ctx.strokeStyle = couleur;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  if (m.tris.length === 0) {
    // Une miette : quelques points sans surface.
    for (let k = 0; k < m.pts.length; k += 2) {
      ctx.beginPath();
      ctx.arc(x + m.pts[k] * echelle, y + m.pts[k + 1] * echelle, Math.max(1.5, echelle * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const chemin = new Path2D();
  for (let t = 0; t < m.tris.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const p = m.tris[t + k];
      const px = x + m.pts[2 * p] * echelle;
      const py = y + m.pts[2 * p + 1] * echelle;
      if (k === 0) chemin.moveTo(px, py);
      else chemin.lineTo(px, py);
    }
    chemin.closePath();
  }
  ctx.fill(chemin);
  ctx.stroke(chemin);
}

/** Rayon d'un morceau (unités de vue), pour le mettre à l'échelle. */
export function rayonDuMorceau(m: MorceauGarde): number {
  let r = 0.02;
  for (let k = 0; k < m.pts.length; k += 2) r = Math.max(r, Math.hypot(m.pts[k], m.pts[k + 1]));
  return r;
}
