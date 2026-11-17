// Le seul endroit qui traduit les réglages du panneau en paramètres pour le moteur de l'eau.

import type { Reglages } from '../reglages/reglages';
import type { ParamsEau, ParamsEvier } from './moteur-eau';

export function lireParamsEau(r: Reglages): ParamsEau {
  return {
    pente: r.nombre('eau.pente'),
    accroche: r.nombre('eau.accroche'),
    dureeTrace: r.nombre('eau.dureeTrace'),
    largeurDoigt: r.nombre('eau.largeurDoigt'),
    eauEntrainee: r.nombre('eau.entrainee'),
    vitesseLimite: r.nombre('eau.vitesseLimite'),
    hesitation: r.nombre('eau.hesitation') / 1000,
    fluidite: r.nombre('eau.fluidite'),
    elargissement: r.nombre('eau.elargissement'),
    film: r.nombre('eau.film'),
    capaciteRebord: r.nombre('eau.capacite'),
    debordement: r.nombre('eau.debordement'),
    vidange: r.nombre('eau.vidange'),
  };
}

export function lireParamsEvier(r: Reglages): ParamsEvier {
  return {
    flaques: r.nombre('evier.flaques'),
    taille: r.nombre('evier.taille'),
    ecart: r.nombre('evier.ecart'),
    hauteur: r.nombre('evier.hauteur'),
  };
}
