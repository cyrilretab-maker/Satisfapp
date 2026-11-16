// Page de test du lot 0 : Cyril doit distinguer trois rythmes de vibration.

import type { Reglages } from '../reglages/reglages';
import { debutsDesPulsations, fabriquerMotif } from '../sensations/rythmes';
import type { CoucheSon } from '../sensations/son';
import type { CoucheVibration } from '../sensations/vibration';

const RYTHMES = [
  { cle: 'lent', nom: 'Lent' },
  { cle: 'moyen', nom: 'Moyen' },
  { cle: 'rapide', nom: 'Rapide' },
] as const;

/** Affiche la page et renvoie la fonction qui coupe tout quand on la quitte. */
export function afficherTestVibration(
  racine: HTMLElement,
  reglages: Reglages,
  vibration: CoucheVibration,
  son: CoucheSon,
): () => void {
  racine.innerHTML = `
    <section class="page test">
      <a class="retour" href="#">← Retour</a>
      <h1>Vibration et son</h1>
      <p class="etat">${
        vibration.disponible
          ? 'Vibration disponible sur ce navigateur.'
          : '⚠ Vibration non disponible ici (il faut Chrome sur Android).'
      }</p>
      <div class="rythmes"></div>
      <button class="arret">Arrêter</button>
      <p class="etat diagnostic"></p>
    </section>`;
  const diagnostic = racine.querySelector<HTMLElement>('.diagnostic')!;

  const arreter = () => {
    vibration.arreter();
    son.arreter();
  };

  const zone = racine.querySelector<HTMLElement>('.rythmes')!;
  for (const r of RYTHMES) {
    const b = document.createElement('button');
    b.className = 'gros-bouton';
    b.textContent = r.nom;
    b.addEventListener('click', () => {
      const motif = fabriquerMotif(
        {
          pulsation: reglages.nombre(`rythmes.${r.cle}.pulsation`),
          pause: reglages.nombre(`rythmes.${r.cle}.pause`),
        },
        reglages.nombre('rythmes.duree'),
      );
      arreter();
      // Diagnostic : dire si le navigateur a accepté ou refusé la vibration.
      if (!reglages.oui('general.vibration')) {
        diagnostic.textContent = 'Vibration coupée dans les réglages.';
      } else if (vibration.jouer(motif)) {
        diagnostic.textContent = `${r.nom} : le navigateur a accepté la vibration (${(motif.length + 1) / 2} pulsations).`;
      } else {
        diagnostic.textContent = `${r.nom} : le navigateur a REFUSÉ la vibration.`;
      }
      if (reglages.oui('general.son')) {
        son.jouerTics(debutsDesPulsations(motif), reglages.nombre('general.volume') / 100);
      }
    });
    zone.append(b);
  }

  racine.querySelector('.arret')!.addEventListener('click', arreter);
  return arreter;
}
