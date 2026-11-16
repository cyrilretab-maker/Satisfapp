// Page du bouchon : matière en gris, spatule et pince, paroi sensible (lots 1 et 2).

import type { Reglages } from '../reglages/reglages';
import { definirActionsPanneau } from '../reglages/panneau';
import { genererBouchon } from '../matiere/bouchon';
import { nouvelleGraine } from '../matiere/hasard';
import { Simulation, type TypeOutil } from '../matiere/moteur';
import { lireParamsBouchon, lireParamsMatiere } from '../matiere/parametres';
import type { CoucheSon } from '../sensations/son';
import type { CoucheVibration } from '../sensations/vibration';
import { brancherCommande } from '../jeu/commande';
import { dessiner } from '../jeu/dessin';
import { disposer, type Disposition } from '../jeu/ecran';
import { Peau } from '../jeu/peau';

/** Affiche la page et renvoie la fonction qui l'arrête quand on la quitte. */
export function afficherJeu(
  racine: HTMLElement,
  reglages: Reglages,
  son: CoucheSon,
  vibration: CoucheVibration,
): () => void {
  racine.innerHTML = `
    <section class="jeu">
      <canvas class="jeu-toile"></canvas>
      <a class="jeu-retour" href="#">←</a>
      <div class="jeu-outils">
        <button data-outil="spatule">Spatule</button>
        <button data-outil="pince">Pince</button>
      </div>
      <button class="jeu-nouveau" hidden>Nouveau bouchon</button>
    </section>`;
  const toile = racine.querySelector<HTMLCanvasElement>('.jeu-toile')!;
  const ctx = toile.getContext('2d')!;
  const boutonNouveau = racine.querySelector<HTMLButtonElement>('.jeu-nouveau')!;
  const rangeeOutils = racine.querySelector<HTMLElement>('.jeu-outils')!;
  const boutonsOutil = [...rangeeOutils.querySelectorAll<HTMLButtonElement>('button')];

  let graine = nouvelleGraine();
  let sim = creer(graine);
  let peau = new Peau();
  let dispo: Disposition = mettreEnPage();
  let outil: TypeOutil = 'spatule'; // on commence par chercher où passer dessous
  choisir(outil);

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
    const d = disposer(l, h);
    Object.assign(rangeeOutils.style, {
      left: `${d.boutons.x}px`,
      top: `${d.boutons.y}px`,
      width: `${d.boutons.l}px`,
      height: `${d.boutons.h}px`,
    });
    return d;
  }

  function choisir(type: TypeOutil) {
    outil = type;
    sim.choisirOutil(type);
    for (const b of boutonsOutil) b.classList.toggle('actif', b.dataset.outil === type);
  }

  function relancer(g: number) {
    graine = g;
    sim = creer(g);
    peau = new Peau();
    choisir('spatule');
    boutonNouveau.hidden = true;
  }

  for (const b of boutonsOutil) b.addEventListener('click', () => choisir(b.dataset.outil as TypeOutil));
  definirActionsPanneau(() => [
    { libelle: 'Nouveau bouchon', faire: () => relancer(nouvelleGraine()) },
    { libelle: `Rejouer le même bouchon (n° ${graine})`, faire: () => relancer(graine) },
  ]);
  boutonNouveau.addEventListener('click', () => relancer(nouvelleGraine()));

  const debrancher = brancherCommande(
    toile,
    () => sim,
    () => dispo,
    () => reglages.nombre('commande.sensibilite'),
  );

  // Chaque curseur agit tout de suite sur le bouchon en cours.
  const arreterEcoute = reglages.surChangement(() => {
    sim.params = lireParamsMatiere(reglages);
  });
  const surRedimension = () => (dispo = mettreEnPage());
  window.addEventListener('resize', surRedimension);

  let actif = true;
  let avant = performance.now();
  const image = (maintenant: number) => {
    if (!actif) return;
    const temps = maintenant / 1000;
    sim.avancer((maintenant - avant) / 1000);
    avant = maintenant;
    // Poignée d'inspection pour les vérifications automatiques (invisible en jeu).
    (window as unknown as { satisfapp: unknown }).satisfapp = { sim, dispo, peau };
    for (const e of sim.prendreEvenements()) {
      if (e.type === 'pinceFermee' && reglages.oui('general.son')) {
        son.jouerTics([0], reglages.nombre('general.volume') / 100);
      }
      if (e.type === 'paroiTouchee') {
        peau.toucher(e.x, e.y, temps);
        const duree = reglages.nombre('paroi.vibration');
        if (reglages.oui('general.vibration') && duree > 0) vibration.jouer([duree]);
      }
    }
    const dureeRougeur = reglages.nombre('paroi.rougeur');
    peau.nettoyer(temps, dureeRougeur);
    if (sim.pointsRestants() === 0) boutonNouveau.hidden = false;
    dessiner(ctx, sim, dispo, peau, { temps, dureeRougeur, sursaut: reglages.nombre('paroi.sursaut') });
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);

  return () => {
    actif = false;
    debrancher();
    arreterEcoute();
    vibration.arreter();
    window.removeEventListener('resize', surRedimension);
    definirActionsPanneau(() => []);
  };
}
