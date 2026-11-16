// L'état de la peau du conduit : les rougeurs laissées par les contacts, et le sursaut de l'image.
// Toucher la peau se remarque, mais ne punit pas : la rougeur s'estompe seule.

export interface Rougeur {
  x: number; // position dans la vue (rayon 1)
  y: number;
  debut: number; // secondes
}

const ROUGEURS_MAX = 60;
const DUREE_SURSAUT = 0.35; // secondes

export class Peau {
  rougeurs: Rougeur[] = [];
  private debutSursaut = -Infinity;

  /** Un contact avec la paroi à cet endroit, à cet instant. */
  toucher(x: number, y: number, temps: number): void {
    this.rougeurs.push({ x, y, debut: temps });
    if (this.rougeurs.length > ROUGEURS_MAX) this.rougeurs.shift();
    this.debutSursaut = temps;
  }

  /** Force de la rougeur, de 1 (toute fraîche) à 0 (disparue). */
  intensite(r: Rougeur, temps: number, duree: number): number {
    return Math.max(0, 1 - (temps - r.debut) / Math.max(0.1, duree));
  }

  /** Oublie les rougeurs disparues. */
  nettoyer(temps: number, duree: number): void {
    this.rougeurs = this.rougeurs.filter((r) => this.intensite(r, temps, duree) > 0);
  }

  /** Décalage de l'image (pixels) pendant le sursaut ; 0 si l'amplitude est coupée. */
  sursaut(temps: number, amplitude: number): [number, number] {
    const t = temps - this.debutSursaut;
    if (amplitude <= 0 || t < 0 || t > DUREE_SURSAUT) return [0, 0];
    const force = amplitude * Math.exp(-t / (DUREE_SURSAUT / 3));
    return [force * Math.sin(t * 95), force * Math.cos(t * 70)];
  }
}
