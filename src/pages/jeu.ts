// Page du bouchon : matière, spatule et pince, paroi sensible, tension qui se sent (lots 1 à 3).

import type { Reglages } from '../reglages/reglages';
import { definirActionsPanneau } from '../reglages/panneau';
import { genererBouchon } from '../matiere/bouchon';
import { nouvelleGraine } from '../matiere/hasard';
import { Simulation, type TypeOutil } from '../matiere/moteur';
import { lireParamsBouchon, lireParamsMatiere } from '../matiere/parametres';
import { lireReglagesTension, lireVolumes } from '../sensations/parametres-sensations';
import { SonsMatiere } from '../sensations/sons-matiere';
import { PiloteTension } from '../sensations/tension';
import type { CoucheVibration } from '../sensations/vibration';
import { brancherCommande } from '../jeu/commande';
import { dessiner } from '../jeu/dessin';
import { disposer, type Disposition } from '../jeu/ecran';
import { Peau } from '../jeu/peau';

/** Affiche la page et renvoie la fonction qui l'arrête quand on la quitte. */
export function afficherJeu(
  racine: HTMLElement,
  reglages: Reglages,
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
  const sons = new SonsMatiere();
  const pilote = new PiloteTension(lireReglagesTension(reglages));
  let volumes = lireVolumes(reglages);
  // Le navigateur n'autorise le son qu'après un toucher.
  racine.addEventListener('pointerdown', () => sons.reveiller());

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
    pilote.reglages = lireReglagesTension(reglages);
    volumes = lireVolumes(reglages);
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
    const vibrer = reglages.oui('general.vibration');
    let casse = false;
    for (const e of sim.prendreEvenements()) {
      if (e.type === 'pinceFermee') sons.tic(volumes.tics, 0.6);
      if (e.type === 'lienCasse' && sim.outil.doigt) casse = true;
      if (e.type === 'tourDecolle') {
        sons.tic(volumes.tics);
        const tic = reglages.nombre('vib.tic');
        if (vibrer && tic > 0 && !pilote.enSilence(temps)) vibration.jouer([tic]);
      }
      if (e.type === 'morceauSorti' && e.part >= reglages.nombre('vib.grandeSortie') / 100) {
        // La grande sortie : tout s'arrête, un décollement ample, puis le silence.
        pilote.grandeSortie(temps);
        sons.couper();
        sons.decollement(volumes.decollement);
      }
      if (e.type === 'paroiTouchee') {
        peau.toucher(e.x, e.y, temps);
        const duree = reglages.nombre('paroi.vibration');
        if (vibrer && duree > 0) vibration.jouer([duree]);
      }
    }
    if (casse && !pilote.enSilence(temps)) {
      pilote.rupture(temps);
      sons.claquement(volumes.claquement);
    }
    // La tension ne compte que quand la pince tire franchement sur la matière.
    const tension = sim.outil.ferme && !sim.outil.faible ? sim.tension() : 0;
    const ordres = pilote.mettreAJour(temps, tension);
    if (ordres.arreter) vibration.arreter();
    if (vibrer) for (const d of ordres.vibrer) vibration.jouer([d]);
    for (const c of ordres.craquements) sons.craquement(c, volumes.craquements);
    // Le frottement doux : tension faible à la pince, ou spatule qui travaille sur la matière.
    const seuil = pilote.reglages.seuil;
    let frottement = tension > 0.02 ? Math.min(1, tension / seuil) : 0;
    const p = sim.params;
    if (sim.outil.type === 'spatule' && sim.outil.vitesse >= p.spatuleMouvement && sim.distanceALaMatiere(sim.outil.x, sim.outil.y) <= p.margeParoi) frottement = Math.max(frottement, 0.6);
    sons.frottement(pilote.enSilence(temps) ? 0 : frottement * volumes.frottement);
    const dureeRougeur = reglages.nombre('paroi.rougeur');
    peau.nettoyer(temps, dureeRougeur);
    if (sim.pointsRestants() === 0) boutonNouveau.hidden = false;
    dessiner(ctx, sim, dispo, peau, {
      temps,
      dureeRougeur,
      sursaut: reglages.nombre('paroi.sursaut'),
      blanchiment: reglages.nombre('vue.blanchiment') / 100,
    });
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);

  return () => {
    actif = false;
    debrancher();
    arreterEcoute();
    vibration.arreter();
    sons.couper();
    window.removeEventListener('resize', surRedimension);
    definirActionsPanneau(() => []);
  };
}
