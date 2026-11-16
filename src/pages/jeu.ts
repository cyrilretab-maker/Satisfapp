// Page du bouchon (lot 1) : matière brute en gris, pince, deux modes de commande.

import type { Reglages } from '../reglages/reglages';
import { definirActionsPanneau } from '../reglages/panneau';
import { genererBouchon } from '../matiere/bouchon';
import { nouvelleGraine } from '../matiere/hasard';
import { Simulation } from '../matiere/moteur';
import { lireParamsBouchon, lireParamsMatiere } from '../matiere/parametres';
import type { CoucheSon } from '../sensations/son';
import { brancherCommande } from '../jeu/commande';
import { dessiner } from '../jeu/dessin';
import { disposer, type Disposition, type ModeCommande } from '../jeu/ecran';

/** Affiche la page et renvoie la fonction qui l'arrête quand on la quitte. */
export function afficherJeu(racine: HTMLElement, reglages: Reglages, son: CoucheSon): () => void {
  racine.innerHTML = `
    <section class="jeu">
      <canvas class="jeu-toile"></canvas>
      <a class="jeu-retour" href="#">←</a>
      <button class="jeu-nouveau" hidden>Nouveau bouchon</button>
    </section>`;
  const toile = racine.querySelector<HTMLCanvasElement>('.jeu-toile')!;
  const ctx = toile.getContext('2d')!;
  const boutonNouveau = racine.querySelector<HTMLButtonElement>('.jeu-nouveau')!;

  let graine = nouvelleGraine();
  let sim = creer(graine);
  let dispo: Disposition = mettreEnPage();

  function creer(g: number): Simulation {
    return new Simulation(genererBouchon(g, lireParamsBouchon(reglages)), lireParamsMatiere(reglages));
  }

  function mettreEnPage(): Disposition {
    const ratio = window.devicePixelRatio || 1;
    const l = window.innerWidth;
    const h = window.innerHeight;
    toile.width = Math.round(l * ratio);
    toile.height = Math.round(h * ratio);
    toile.style.width = `${l}px`;
    toile.style.height = `${h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return disposer(l, h, reglages.texte('commande.mode') as ModeCommande);
  }

  function relancer(g: number) {
    graine = g;
    sim = creer(g);
    boutonNouveau.hidden = true;
  }

  definirActionsPanneau(() => [
    { libelle: 'Nouveau bouchon', faire: () => relancer(nouvelleGraine()) },
    { libelle: `Rejouer le même bouchon (n° ${graine})`, faire: () => relancer(graine) },
  ]);
  boutonNouveau.addEventListener('click', () => relancer(nouvelleGraine()));

  const debrancher = brancherCommande(
    toile,
    () => sim,
    () => dispo,
    () => ({ sensibilite: reglages.nombre('commande.sensibilite'), decalage: reglages.nombre('commande.decalage') }),
  );

  // Chaque curseur agit tout de suite sur le bouchon en cours.
  const arreterEcoute = reglages.surChangement((id) => {
    sim.params = lireParamsMatiere(reglages);
    if (id === 'commande.mode') dispo = mettreEnPage();
  });
  const surRedimension = () => (dispo = mettreEnPage());
  window.addEventListener('resize', surRedimension);

  let actif = true;
  let avant = performance.now();
  const image = (maintenant: number) => {
    if (!actif) return;
    sim.avancer((maintenant - avant) / 1000);
    // Poignée d'inspection pour les vérifications automatiques (invisible en jeu).
    (window as unknown as { satisfapp: unknown }).satisfapp = { sim, dispo };
    avant = maintenant;
    for (const e of sim.prendreEvenements()) {
      if (e.type === 'pinceFermee' && reglages.oui('general.son')) {
        son.jouerTics([0], reglages.nombre('general.volume') / 100);
      }
    }
    if (sim.pointsRestants() === 0) boutonNouveau.hidden = false;
    dessiner(ctx, sim, dispo);
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);

  return () => {
    actif = false;
    debrancher();
    arreterEcoute();
    window.removeEventListener('resize', surRedimension);
    definirActionsPanneau(() => []);
  };
}
