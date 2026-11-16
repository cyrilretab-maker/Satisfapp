// Traduit les réglages du panneau pour les sensations (vibration, sons, blanchiment).

import type { Reglages } from '../reglages/reglages';
import type { ReglagesTension } from './tension';

export function lireReglagesTension(r: Reglages): ReglagesTension {
  return {
    seuil: r.nombre('vib.seuil') / 100,
    pulsation: r.nombre('vib.pulsation'),
    pauseLente: r.nombre('vib.pauseLente'),
    pauseRapide: r.nombre('vib.pauseRapide'),
    craquementLent: r.nombre('son.craquementLent'),
    craquementRapide: r.nombre('son.craquementRapide'),
    coupRupture: r.nombre('vib.rupture'),
    silenceRupture: r.nombre('vib.silenceRupture'),
    silenceSortie: r.nombre('vib.silenceSortie'),
    vibrationSortie: r.nombre('vib.sortie'),
  };
}

export interface VolumesSons {
  frottement: number;
  craquements: number;
  claquement: number;
  decollement: number;
  tics: number;
}

/** Volumes de chaque famille de sons (0..1), multipliés par le volume général ; 0 si le son est coupé. */
export function lireVolumes(r: Reglages): VolumesSons {
  const g = r.oui('general.son') ? r.nombre('general.volume') / 100 : 0;
  return {
    frottement: g * (r.nombre('son.frottement') / 100),
    craquements: g * (r.nombre('son.craquements') / 100),
    claquement: g * (r.nombre('son.claquement') / 100),
    decollement: g * (r.nombre('son.decollement') / 100),
    tics: g * (r.nombre('son.tics') / 100),
  };
}
