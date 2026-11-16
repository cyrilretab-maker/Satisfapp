// La partie en cours reste sur le téléphone : si on quitte, on retrouve le bouchon dans le même état.

import type { ParamsBouchon } from '../matiere/bouchon';
import type { EtatSimulation } from '../matiere/moteur';
import type { StockageSimple } from '../reglages/reglages';

export const CLE_PARTIE = 'satisfapp.partie.v1';

export interface PartieSauvee {
  version: 1;
  graine: number;
  bouchon: ParamsBouchon; // les réglages de forme utilisés pour ce bouchon
  etat: EtatSimulation;
}

export function sauverPartie(stockage: StockageSimple | null, partie: PartieSauvee): void {
  try {
    stockage?.setItem(CLE_PARTIE, JSON.stringify(partie));
  } catch {
    /* stockage plein ou bloqué : tant pis, la partie continue */
  }
}

export function lirePartie(stockage: StockageSimple | null): PartieSauvee | null {
  try {
    const texte = stockage?.getItem(CLE_PARTIE);
    if (!texte) return null;
    const p = JSON.parse(texte) as PartieSauvee;
    if (p?.version !== 1 || typeof p.graine !== 'number' || !p.etat || !p.bouchon) return null;
    return p;
  } catch {
    return null;
  }
}
