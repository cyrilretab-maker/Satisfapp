// Ce qu'on sent de l'eau, sans regarder : le pilote des vibrations (mini-jeu 2).
// Le téléphone de Cyril ne fait pas sentir les vibrations très courtes (< ~100 ms) :
// comme pour le bouchon, le débit se traduit par le rythme (la pause entre deux pulsations).
//
//  - Doigt dans l'eau : un frémissement léger (pulsations espacées).
//  - L'eau coule dans une route : des pulsations au rythme du débit.
//  - Deux flaques se rejoignent : un coup bref, puis les pulsations ralentissent avec le débit.
//  - La goutte du rebord gonfle : des pulsations qui se rapprochent.
//  - Le toucher final : arrêt net, puis une longue vibration douce qui décroît.

export interface ReglagesVibEau {
  pulsation: number; // ms
  pauseLente: number; // ms
  pauseRapide: number; // ms
  seuil: number; // débit à partir duquel ça vibre
  debitMax: number; // débit des pulsations les plus rapprochées
  fremissement: number; // ms de pause quand le doigt est dans l'eau (0 = rien)
  jonction: number; // ms
  goutte: number; // 0..1 : remplissage de la goutte à partir duquel elle pulse
  finale: number; // ms : première vibration de la décrue finale
}

export interface EtatEauSenti {
  debit: number;
  dansEau: boolean;
  goutte: number; // 0..1
}

const SILENCE_AVANT_FINALE = 0.25; // s : l'arrêt net
const DUREE_FINALE = 2.5; // s : pendant la décrue, plus rien d'autre

export class PiloteEau {
  private prochaine = 0;
  private finaleA = -1;
  private silenceJusqua = -1;

  constructor(public reglages: ReglagesVibEau) {}

  /** Le motif de la longue vibration qui décroît. */
  motifFinal(): number[] {
    const d = this.reglages.finale;
    if (d <= 0) return [];
    const motif: number[] = [];
    let v = d;
    let p = 60;
    while (v >= 60) {
      motif.push(Math.round(v), Math.round(p));
      v *= 0.7;
      p *= 1.4;
    }
    motif.pop();
    return motif;
  }

  /** Le toucher final : arrêt net, puis la décrue. */
  liberation(temps: number): void {
    this.finaleA = temps + SILENCE_AVANT_FINALE;
    this.silenceJusqua = temps + SILENCE_AVANT_FINALE + DUREE_FINALE;
  }

  /** Deux flaques se rejoignent : un coup bref. Renvoie le motif à jouer. */
  jonction(temps: number): number[] {
    if (temps < this.silenceJusqua || this.reglages.jonction <= 0) return [];
    this.prochaine = temps + (this.reglages.jonction + 300) / 1000;
    return [this.reglages.jonction];
  }

  /** À chaque image : renvoie les motifs à jouer (et s'il faut tout arrêter). */
  mettreAJour(temps: number, e: EtatEauSenti): { arreter: boolean; vibrer: number[][] } {
    const r = this.reglages;
    const sortie = { arreter: false, vibrer: [] as number[][] };
    if (this.finaleA >= 0) {
      if (temps < this.finaleA) {
        sortie.arreter = true;
        return sortie;
      }
      const m = this.motifFinal();
      if (m.length) sortie.vibrer.push(m);
      this.finaleA = -1;
      return sortie;
    }
    if (temps < this.silenceJusqua) return sortie;
    // La pause la plus courte parmi ce qui se passe.
    let pause = Infinity;
    if (e.debit >= r.seuil) {
      const k = Math.min(1, (e.debit - r.seuil) / Math.max(1e-6, r.debitMax - r.seuil));
      pause = Math.min(pause, r.pauseLente + (r.pauseRapide - r.pauseLente) * k);
    }
    if (e.goutte >= r.goutte && e.goutte > 0) {
      const k = Math.min(1, (e.goutte - r.goutte) / Math.max(1e-6, 1 - r.goutte));
      pause = Math.min(pause, r.pauseLente + (r.pauseRapide - r.pauseLente) * k);
    }
    if (e.dansEau && r.fremissement > 0) pause = Math.min(pause, r.fremissement);
    if (pause === Infinity || r.pulsation <= 0) return sortie;
    if (temps >= this.prochaine) {
      sortie.vibrer.push([r.pulsation]);
      this.prochaine = temps + (r.pulsation + pause) / 1000;
    }
    return sortie;
  }
}
