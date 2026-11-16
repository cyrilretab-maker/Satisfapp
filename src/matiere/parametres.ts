// Le seul endroit qui traduit les réglages du panneau en paramètres pour le moteur.
// Les valeurs viennent toutes de defauts.json (ou de ce que Cyril a modifié).

import type { Reglages } from '../reglages/reglages';
import type { ParamsBouchon } from './bouchon';
import type { ParamsMatiere } from './moteur';

export function lireParamsMatiere(r: Reglages): ParamsMatiere {
  return {
    solidite: r.nombre('matiere.solidite'),
    elasticite: r.nombre('matiere.elasticite') / 100,
    amortissement: r.nombre('matiere.amortissement'),
    colleDuree: r.nombre('colle.duree'),
    colleSeuil: r.nombre('colle.seuil') / 100,
    colleRaideur: r.nombre('colle.raideur'),
    bonusDirection: r.nombre('colle.direction'),
    tourColle: r.nombre('tour.colle'),
    repli: r.nombre('tour.repli'),
    repliDistance: r.nombre('tour.repliDistance'),
    spatuleRayon: r.nombre('spatule.rayon'),
    spatuleMouvement: r.nombre('spatule.mouvement'),
    margeParoi: r.nombre('paroi.marge'),
    pincePause: r.nombre('pince.pause') / 1000,
    pinceImmobile: r.nombre('pince.immobile'),
    pinceRayon: r.nombre('pince.rayon'),
    pinceFragilite: r.nombre('pince.fragilite') / 100,
    pinceRenfort: r.nombre('pince.renfort'),
    pinceZonePliee: r.nombre('pince.zonePliee'),
    forceGeste: r.nombre('geste.force'),
    inertieOutil: r.nombre('outil.inertie') / 1000,
    sousPas: 8,
  };
}

export function lireParamsBouchon(r: Reglages): ParamsBouchon {
  return {
    taille: r.nombre('bouchon.taille') / 100,
    irregularite: r.nombre('bouchon.irregularite') / 100,
    finesse: r.nombre('bouchon.finesse'),
    zonesFaiblesNombre: r.nombre('bouchon.faiblesNombre'),
    zonesFaiblesSolidite: r.nombre('bouchon.faiblesSolidite') / 100,
    zonesColleesNombre: r.nombre('bouchon.colleesNombre'),
    zonesColleesIntensite: r.nombre('bouchon.colleesIntensite'),
    irregulariteCire: r.nombre('bouchon.irregulariteCire') / 100,
    entreesNombre: r.nombre('bouchon.entreesNombre'),
    entreesTaille: r.nombre('bouchon.entreesTaille'),
  };
}
