// Fabrication des motifs de vibration. Aucune valeur ici : tout vient des réglages.
// Un motif web est une liste de durées en millisecondes : vibre, pause, vibre, pause...

export interface Rythme {
  pulsation: number; // durée d'une pulsation (ms)
  pause: number; // silence entre deux pulsations (ms)
}

/** Répète pulsation + pause sans dépasser la durée totale. Commence et finit par une pulsation. */
export function fabriquerMotif(rythme: Rythme, dureeTotale: number): number[] {
  const pulsation = Math.max(1, Math.round(rythme.pulsation));
  const pause = Math.max(1, Math.round(rythme.pause));
  const motif: number[] = [];
  let temps = 0;
  while (temps + pulsation <= dureeTotale) {
    if (motif.length > 0) motif.push(pause);
    motif.push(pulsation);
    temps += pulsation + pause;
  }
  if (motif.length === 0) motif.push(pulsation); // au moins une pulsation
  return motif;
}

/** Instants (ms depuis le début) où commence chaque pulsation : sert à caler le son sur la vibration. */
export function debutsDesPulsations(motif: number[]): number[] {
  const debuts: number[] = [];
  let temps = 0;
  motif.forEach((duree, i) => {
    if (i % 2 === 0) debuts.push(temps);
    temps += duree;
  });
  return debuts;
}

/** Nombre de pulsations par seconde : ce que le doigt perçoit comme « rythme ». */
export function cadence(rythme: Rythme): number {
  return 1000 / (rythme.pulsation + rythme.pause);
}
