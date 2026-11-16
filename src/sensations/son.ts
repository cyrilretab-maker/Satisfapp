// Couche son. Les sons sont fabriqués par le code (pas d'enregistrement pour l'instant).
// Lot 0 : un seul son, un petit « tic » calé sur chaque pulsation.

export interface CoucheSon {
  jouerTics(debuts: number[], volume: number): void;
  arreter(): void;
}

export function creerSonWeb(): CoucheSon {
  let contexte: AudioContext | null = null;
  let enCours: AudioScheduledSourceNode[] = [];

  function obtenirContexte(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    contexte ??= new AudioContext();
    if (contexte.state === 'suspended') void contexte.resume();
    return contexte;
  }

  function arreter() {
    for (const source of enCours) {
      try {
        source.stop();
      } catch {
        /* déjà terminé */
      }
    }
    enCours = [];
  }

  return {
    jouerTics(debuts, volume) {
      arreter();
      const ctx = obtenirContexte();
      if (!ctx || volume <= 0) return;
      const depart = ctx.currentTime + 0.02;
      for (const debut of debuts) {
        const t = depart + debut / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.03);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
        enCours.push(osc);
      }
    },
    arreter,
  };
}
