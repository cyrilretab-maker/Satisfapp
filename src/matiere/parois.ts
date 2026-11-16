// La cire collée sur les parois du conduit (V2-3).
//
// Près de l'entrée de l'oreille, ce ne sont que des traces : la paroi est salie, collante par endroits.
// Plus on s'enfonce, plus la cire s'épaissit, jusqu'au bouchon du fond.
// La paroi est un anneau « déroulé » (voir jeu/perspective.ts) découpé en petites cases.
// Chaque case garde quatre quantités (0..1) :
//  - croûte : plaques sèches et dures, qu'il faut racler à la spatule (elles s'émiettent) ;
//  - collant : traînées de pâte collante, qui partent à la spatule ou au coton-tige, lentement ;
//  - liquide : cire molle et humide, que le coton-tige absorbe et que l'aspirateur aspire ;
//  - miettes : ce que la spatule a raclé, qui reste là : aspirateur, coton-tige ou pince.

import { creerHasard } from './hasard';

export const ANGLES = 128;
export const RANGS = 32;
const PAROI_DEBUT = 0.95; // = FOND (jeu/perspective.ts)
const PAROI_FIN = 1.35; // = ENTREE

export type OutilParoi = 'spatule' | 'pince' | 'coton' | 'aspirateur';

export interface ParamsParois {
  croute: number; // distance de raclage pour enlever une plaque épaisse
  collant: number; // distance de frottement pour enlever une traînée collante
  liquide: number; // distance de frottement du coton-tige pour absorber le liquide
  aspiration: number; // quantité aspirée par seconde
}

/** Un bruit doux qui se referme sur lui-même autour du conduit. */
function bruit(hasard: () => number, fa: number, fw: number): (a: number, w: number) => number {
  const g = new Float32Array(fa * (fw + 1));
  for (let i = 0; i < g.length; i++) g[i] = hasard();
  const v = (i: number, j: number) => g[Math.min(fw, Math.max(0, j)) * fa + (((i % fa) + fa) % fa)];
  return (a, w) => {
    const x = a * fa;
    const y = w * fw;
    const i = Math.floor(x);
    const j = Math.floor(y);
    let u = x - i;
    let t = y - j;
    u = u * u * (3 - 2 * u);
    t = t * t * (3 - 2 * t);
    const h1 = v(i, j) + (v(i + 1, j) - v(i, j)) * u;
    const h2 = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * u;
    return h1 + (h2 - h1) * t;
  };
}

const lisse = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Parois {
  readonly croute = new Float32Array(ANGLES * RANGS);
  readonly collant = new Float32Array(ANGLES * RANGS);
  readonly liquide = new Float32Array(ANGLES * RANGS);
  readonly miettes = new Float32Array(ANGLES * RANGS);
  /** Quantité de départ (pour savoir quand la paroi est propre). */
  readonly depart: number;
  /** Augmente à chaque changement (l'image ne renvoie la texture que si besoin). */
  version = 0;

  constructor(graine: number, quantite: number) {
    const h = creerHasard((graine ^ 0x5bd1e995) >>> 0);
    const plaques = bruit(h, 7, 3);
    const details = bruit(h, 19, 7);
    const trainees = bruit(h, 11, 2);
    const gouttes = bruit(h, 31, 10);
    const eclats = bruit(h, 41, 12);
    for (let j = 0; j < RANGS; j++) {
      const w = (j + 0.5) / RANGS; // 0 = au fond, contre le bouchon ; 1 = à l'entrée
      const profil = quantite * Math.pow(1 - w, 1.4); // de plus en plus épais vers le fond
      for (let i = 0; i < ANGLES; i++) {
        const a = (i + 0.5) / ANGLES;
        const k = j * ANGLES + i;
        const p = plaques(a, w) * 0.7 + details(a, w) * 0.3;
        // Plaques sèches : là où le bruit dépasse un seuil qui baisse vers le fond (la cire s'y accumule).
        this.croute[k] = profil > 0 ? lisse(0.62 - profil * 0.45, 0.72 - profil * 0.45, p) * Math.min(1, 0.4 + profil * 1.2) : 0;
        // Traînées collantes, étirées le long du conduit.
        const tr = trainees(a, w * 0.5);
        this.collant[k] = quantite * lisse(0.55, 0.75, tr) * (0.25 + 0.75 * (1 - w)) * (1 - this.croute[k] * 0.7);
        // Gouttes et flaques de cire molle, plutôt vers le fond.
        this.liquide[k] = quantite * lisse(0.6, 0.78, gouttes(a, w)) * (0.3 + 0.7 * (1 - w));
        // Quelques éclats secs près de l'entrée.
        this.miettes[k] = quantite * 0.6 * lisse(0.78, 0.9, eclats(a, w)) * w;
      }
    }
    this.depart = this.total();
  }

  total(): number {
    let s = 0;
    for (let k = 0; k < this.croute.length; k++) s += this.croute[k] + this.collant[k] + this.liquide[k] + this.miettes[k];
    return s;
  }

  /** Part de la cire des parois qui reste (0..1). */
  reste(): number {
    return this.depart > 0 ? this.total() / this.depart : 0;
  }

  /** Ce qu'il y a sur la paroi à cet endroit (0 = peau propre), ou -1 si l'endroit n'est pas sur la paroi. */
  saleteEn(x: number, y: number): number {
    const k = this.case(x, y);
    if (k < 0) return -1;
    return this.croute[k] + this.collant[k] + this.liquide[k] + this.miettes[k];
  }

  private case(x: number, y: number): number {
    const s = Math.hypot(x, y);
    if (s < PAROI_DEBUT || s > PAROI_FIN) return -1;
    const j = Math.min(RANGS - 1, Math.floor(((s - PAROI_DEBUT) / (PAROI_FIN - PAROI_DEBUT)) * RANGS));
    const a = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1;
    const i = Math.min(ANGLES - 1, Math.floor(a * ANGLES));
    return j * ANGLES + i;
  }

  /**
   * Un outil travaille la paroi autour de (x, y), dans un rayon donné (unités de matière).
   * `mouvement` = distance parcourue pendant ce pas ; `dt` = durée du pas.
   * Renvoie la quantité de cire enlevée ou déplacée (pour le son).
   */
  travailler(outil: OutilParoi, x: number, y: number, rayon: number, mouvement: number, dt: number, p: ParamsParois): number {
    const s0 = Math.hypot(x, y);
    if (s0 + rayon < PAROI_DEBUT || s0 - rayon > PAROI_FIN) return 0;
    const hauteur = PAROI_FIN - PAROI_DEBUT;
    const j0 = Math.max(0, Math.floor(((s0 - rayon - PAROI_DEBUT) / hauteur) * RANGS));
    const j1 = Math.min(RANGS - 1, Math.floor(((s0 + rayon - PAROI_DEBUT) / hauteur) * RANGS));
    const a0 = Math.atan2(y, x);
    const da = Math.min(Math.PI, rayon / Math.max(0.5, s0));
    const i0 = Math.floor(((a0 - da) / (Math.PI * 2)) * ANGLES);
    const i1 = Math.ceil(((a0 + da) / (Math.PI * 2)) * ANGLES);
    let travail = 0;
    for (let j = j0; j <= j1; j++) {
      const s = PAROI_DEBUT + ((j + 0.5) / RANGS) * hauteur;
      for (let ii = i0; ii <= i1; ii++) {
        const i = ((ii % ANGLES) + ANGLES) % ANGLES;
        const a = ((i + 0.5) / ANGLES) * Math.PI * 2;
        const d = Math.hypot(Math.cos(a) * s - x, Math.sin(a) * s - y);
        if (d > rayon) continue;
        const poids = 1 - d / rayon;
        const k = j * ANGLES + i;
        const avant = this.croute[k] + this.collant[k] + this.liquide[k] + this.miettes[k];
        if (outil === 'spatule') {
          // Racler : la croûte s'émiette (les miettes restent), le collant s'use lentement, le liquide s'étale.
          const enleve = Math.min(this.croute[k], (mouvement / Math.max(1e-4, p.croute)) * poids);
          this.croute[k] -= enleve;
          this.miettes[k] = Math.min(1, this.miettes[k] + enleve * 0.7);
          this.collant[k] = Math.max(0, this.collant[k] - (mouvement / Math.max(1e-4, p.collant)) * poids);
          this.liquide[k] = Math.max(0, this.liquide[k] - (mouvement / Math.max(1e-4, p.liquide * 4)) * poids);
        } else if (outil === 'coton') {
          // Essuyer : le coton boit le liquide, emporte le collant et une partie des miettes. La croûte résiste.
          this.liquide[k] = Math.max(0, this.liquide[k] - (mouvement / Math.max(1e-4, p.liquide)) * poids);
          this.collant[k] = Math.max(0, this.collant[k] - (mouvement / Math.max(1e-4, p.collant * 1.5)) * poids);
          this.miettes[k] = Math.max(0, this.miettes[k] - (mouvement / Math.max(1e-4, p.liquide * 2)) * poids);
        } else if (outil === 'aspirateur') {
          // Aspirer : le liquide et les miettes partent, pas ce qui est collé.
          this.liquide[k] = Math.max(0, this.liquide[k] - dt * p.aspiration * poids);
          this.miettes[k] = Math.max(0, this.miettes[k] - dt * p.aspiration * 1.5 * poids);
        } else {
          // La pince ramasse les miettes sous ses mors.
          this.miettes[k] = 0;
        }
        travail += avant - (this.croute[k] + this.collant[k] + this.liquide[k] + this.miettes[k]);
        if (outil === 'spatule') travail += Math.min(this.miettes[k], 0.02) * poids; // racler fait du bruit
      }
    }
    if (travail > 0) this.version++;
    return travail;
  }

  /** La texture de la paroi : R = croûte, G = collant, B = liquide, A = miettes (0..255). */
  texture(cible: Uint8Array): void {
    for (let k = 0; k < this.croute.length; k++) {
      cible[4 * k] = Math.round(Math.min(1, this.croute[k]) * 255);
      cible[4 * k + 1] = Math.round(Math.min(1, this.collant[k]) * 255);
      cible[4 * k + 2] = Math.round(Math.min(1, this.liquide[k]) * 255);
      cible[4 * k + 3] = Math.round(Math.min(1, this.miettes[k]) * 255);
    }
  }

  exporter(): string {
    const octets = new Uint8Array(this.croute.length * 4);
    this.texture(octets);
    let texte = '';
    for (let k = 0; k < octets.length; k++) texte += String.fromCharCode(octets[k]);
    return btoa(texte);
  }

  importer(texte: string): boolean {
    try {
      const brut = atob(texte);
      if (brut.length !== this.croute.length * 4) return false;
      for (let k = 0; k < this.croute.length; k++) {
        this.croute[k] = brut.charCodeAt(4 * k) / 255;
        this.collant[k] = brut.charCodeAt(4 * k + 1) / 255;
        this.liquide[k] = brut.charCodeAt(4 * k + 2) / 255;
        this.miettes[k] = brut.charCodeAt(4 * k + 3) / 255;
      }
      this.version++;
      return true;
    } catch {
      return false;
    }
  }
}
