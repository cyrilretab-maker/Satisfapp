// Couche vibration, séparée du jeu : si la vibration web est trop grossière,
// on remplacera seulement ce fichier (par exemple par Capacitor) sans toucher au reste.

export interface CoucheVibration {
  readonly disponible: boolean;
  jouer(motif: number[]): void;
  arreter(): void;
}

export function creerVibrationWeb(): CoucheVibration {
  const disponible = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return {
    disponible,
    jouer(motif) {
      if (disponible) navigator.vibrate(motif);
    },
    arreter() {
      if (disponible) navigator.vibrate(0);
    },
  };
}
