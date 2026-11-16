// Le pilote de la tension : il transforme la tension de la matière (0 à 1) en ordres de
// vibration et de craquements, et gère les silences de la rupture et de la grande sortie.
// Aucun son ni vibration ici : seulement des décisions, faciles à tester.
//
//  Tension faible   → rien (le frottement est géré à part)
//  Tension moyenne  → pulsations lentes, craquements espacés
//  Tension forte    → pulsations rapides, craquements rapprochés et plus aigus
//  Rupture          → arrêt net, puis un seul coup bref
//  Grande sortie    → arrêt net, silence, puis une longue vibration

export interface ReglagesTension {
  seuil: number; // tension (0..1) à partir de laquelle pulsations et craquements commencent
  pulsation: number; // ms : durée d'une pulsation (au moins ~100 ms pour être sentie)
  pauseLente: number; // ms : pause entre deux pulsations au seuil
  pauseRapide: number; // ms : pause entre deux pulsations juste avant la rupture
  craquementLent: number; // ms entre deux craquements au seuil
  craquementRapide: number; // ms entre deux craquements juste avant la rupture
  coupRupture: number; // ms : le coup bref après la rupture
  silenceRupture: number; // ms : silence avant le coup bref, puis avant de reprendre
  silenceSortie: number; // ms : silence de la grande sortie, avant la longue vibration
  vibrationSortie: number; // ms : la longue vibration de la grande sortie
}

export interface Ordres {
  arreter: boolean; // couper net la vibration en cours
  vibrer: number[]; // vibrations à lancer maintenant (durées en ms)
  craquements: number[]; // craquements à jouer maintenant (intensité 0..1 : plus aigu et plus fort)
}

/** Interpole de a (au seuil) à b (tension 1). */
function selonTension(t: number, seuil: number, a: number, b: number): number {
  const k = Math.max(0, Math.min(1, (t - seuil) / Math.max(1e-6, 1 - seuil)));
  return a + (b - a) * k;
}

export class PiloteTension {
  private prochainePulsation = 0;
  private prochainCraquement = 0;
  private silenceJusqua = -Infinity;
  private planifies: { quand: number; duree: number }[] = [];
  private arretDemande = false;

  constructor(public reglages: ReglagesTension) {}

  /** À appeler à chaque image. `temps` en secondes. */
  mettreAJour(temps: number, tension: number): Ordres {
    const r = this.reglages;
    const ordres: Ordres = { arreter: this.arretDemande, vibrer: [], craquements: [] };
    this.arretDemande = false;

    // Coups planifiés (après une rupture ou une grande sortie).
    this.planifies = this.planifies.filter((p) => {
      if (temps < p.quand) return true;
      ordres.vibrer.push(p.duree);
      return false;
    });

    if (temps < this.silenceJusqua || tension < r.seuil) {
      // Prêt à repartir dès que la tension remonte.
      this.prochainePulsation = Math.max(this.prochainePulsation, temps);
      this.prochainCraquement = Math.max(this.prochainCraquement, temps);
      return ordres;
    }
    if (temps >= this.prochainePulsation) {
      ordres.vibrer.push(r.pulsation);
      const pause = selonTension(tension, r.seuil, r.pauseLente, r.pauseRapide);
      this.prochainePulsation = temps + (r.pulsation + pause) / 1000;
    }
    if (temps >= this.prochainCraquement) {
      ordres.craquements.push(Math.max(0, Math.min(1, (tension - r.seuil) / Math.max(1e-6, 1 - r.seuil))));
      this.prochainCraquement = temps + selonTension(tension, r.seuil, r.craquementLent, r.craquementRapide) / 1000;
    }
    return ordres;
  }

  /** Ça vient de casser : arrêt net, puis un seul coup bref. */
  rupture(temps: number): void {
    const r = this.reglages;
    this.arretDemande = true;
    this.planifies = [{ quand: temps + r.silenceRupture / 2000, duree: r.coupRupture }];
    this.silenceJusqua = temps + r.silenceRupture / 1000;
  }

  /** Le gros morceau sort : arrêt net, silence, puis une longue vibration. */
  grandeSortie(temps: number): void {
    const r = this.reglages;
    this.arretDemande = true;
    this.planifies = [{ quand: temps + r.silenceSortie / 1000, duree: r.vibrationSortie }];
    this.silenceJusqua = temps + (r.silenceSortie + r.vibrationSortie) / 1000 + 1;
  }

  /** Vrai pendant un silence (après rupture ou grande sortie) : le frottement se tait aussi. */
  enSilence(temps: number): boolean {
    return temps < this.silenceJusqua;
  }
}
