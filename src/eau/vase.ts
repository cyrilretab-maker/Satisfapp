// Le vase : il garde l'eau libérée, coulée par coulée, d'une partie à l'autre.
// Pas de chiffre : la plus grosse coulée d'un seul toucher est simplement mise en avant.

import type { StockageSimple } from '../reglages/reglages';

export const CLE_VASE = 'satisfapp.vase.v1';
const COULEES_MAX = 200;

export class Vase {
  /** Les coulées, en part d'un évier entier (0..1). */
  coulees: number[] = [];

  constructor(private readonly stockage: StockageSimple | null) {
    try {
      const texte = stockage?.getItem(CLE_VASE);
      const lu = texte ? JSON.parse(texte) : [];
      if (Array.isArray(lu)) this.coulees = lu.filter((v) => typeof v === 'number' && v > 0);
    } catch {
      this.coulees = [];
    }
  }

  ajouter(part: number): void {
    if (!(part > 0)) return;
    this.coulees.push(part);
    if (this.coulees.length > COULEES_MAX) {
      // Plein : on oublie la plus petite coulée, jamais la plus grosse.
      let petite = 0;
      this.coulees.forEach((v, i) => {
        if (v < this.coulees[petite]) petite = i;
      });
      this.coulees.splice(petite, 1);
    }
    this.enregistrer();
  }

  vider(): void {
    this.coulees = [];
    this.enregistrer();
  }

  plusGrosse(): number {
    let k = -1;
    this.coulees.forEach((v, i) => {
      if (k < 0 || v > this.coulees[k]) k = i;
    });
    return k;
  }

  /** Remplissage du vase (0..1), pour l'icône : trois éviers le remplissent. */
  remplissage(): number {
    return Math.min(1, this.coulees.reduce((s, v) => s + v, 0) / 3);
  }

  private enregistrer(): void {
    try {
      this.stockage?.setItem(CLE_VASE, JSON.stringify(this.coulees.map((v) => Math.round(v * 1e4) / 1e4)));
    } catch {
      /* stockage plein : le vase reste en mémoire */
    }
  }
}
