// Page du bouchon : matière, spatule et pince, paroi sensible, tension qui se sent,
// habillage, sortie des morceaux vers le bocal, fin de partie et reprise (lots 1 à 5).

import type { Reglages, StockageSimple } from '../reglages/reglages';
import { definirActionsPanneau } from '../reglages/panneau';
import { genererBouchon, type ParamsBouchon } from '../matiere/bouchon';
import { nouvelleGraine } from '../matiere/hasard';
import { Simulation, type TypeOutil } from '../matiere/moteur';
import { lireParamsBouchon, lireParamsMatiere } from '../matiere/parametres';
import { lireReglagesTension, lireVolumes } from '../sensations/parametres-sensations';
import { SonsMatiere } from '../sensations/sons-matiere';
import { PiloteTension } from '../sensations/tension';
import type { CoucheVibration } from '../sensations/vibration';
import { Bocal, dessinerMorceau, formeDuMorceau, rayonDuMorceau } from '../jeu/bocal';
import { brancherCommande } from '../jeu/commande';
import { dessiner } from '../jeu/dessin';
import { disposer, type Disposition } from '../jeu/ecran';
import { Peau } from '../jeu/peau';
import { lirePartie, sauverPartie } from '../jeu/sauvegarde';
import { Sorties } from '../jeu/sortie';

const ATTENTE_FIN = 1.5; // secondes de calme avant que « Nouveau bouchon » apparaisse
const SAUVEGARDE_TOUTES = 2; // secondes

/** Affiche la page et renvoie la fonction qui l'arrête quand on la quitte. */
export function afficherJeu(
  racine: HTMLElement,
  reglages: Reglages,
  vibration: CoucheVibration,
  stockage: StockageSimple | null,
): () => void {
  racine.innerHTML = `
    <section class="jeu">
      <canvas class="jeu-toile"></canvas>
      <button class="jeu-bocal" aria-label="Ouvrir le bocal"><canvas width="112" height="112"></canvas></button>
      <a class="jeu-retour" href="#" aria-label="Retour">←</a>
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
  const boutonBocal = racine.querySelector<HTMLButtonElement>('.jeu-bocal')!;
  const iconeBocal = boutonBocal.querySelector('canvas')!.getContext('2d')!;

  const bocal = new Bocal(stockage);
  const sorties = new Sorties();
  const sons = new SonsMatiere();
  const pilote = new PiloteTension(lireReglagesTension(reglages));
  let volumes = lireVolumes(reglages);
  let peau = new Peau();
  let dispo: Disposition = mettreEnPage();

  // Reprise de la partie en cours, sinon un nouveau bouchon.
  let graine: number;
  let paramsBouchon: ParamsBouchon;
  let sim: Simulation;
  const sauvee = lirePartie(stockage);
  if (sauvee) {
    graine = sauvee.graine;
    paramsBouchon = sauvee.bouchon;
    sim = new Simulation(genererBouchon(graine, paramsBouchon), lireParamsMatiere(reglages));
    if (!sim.importer(sauvee.etat)) sim = creer((graine = nouvelleGraine()));
  } else {
    sim = creer((graine = nouvelleGraine()));
    sim.choisirOutil('spatule'); // on commence par chercher où passer dessous
  }
  choisir(sim.outil.type);
  let finDepuis = -1; // instant où le conduit est devenu vide
  dessinerIconeBocal();

  // Le navigateur n'autorise le son qu'après un toucher.
  racine.addEventListener('pointerdown', () => sons.reveiller());

  function creer(g: number): Simulation {
    paramsBouchon = lireParamsBouchon(reglages);
    return new Simulation(genererBouchon(g, paramsBouchon), lireParamsMatiere(reglages));
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
    sim.choisirOutil(type);
    for (const b of boutonsOutil) b.classList.toggle('actif', b.dataset.outil === type);
  }

  function relancer(g: number) {
    graine = g;
    sim = creer(g);
    peau = new Peau();
    finDepuis = -1;
    choisir('spatule'); // on commence par chercher où passer dessous
    boutonNouveau.hidden = true;
    sauver();
  }

  function sauver() {
    sauverPartie(stockage, { version: 1, graine, bouchon: paramsBouchon, etat: sim.exporter() });
  }

  /** Le centre de l'icône du bocal, en pixels (là où tombent les morceaux). */
  function centreBocal(): [number, number] {
    const r = boutonBocal.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  /** L'icône du bocal : un pot dont le fond se remplit de cire à mesure qu'on y met des morceaux. */
  function dessinerIconeBocal() {
    const c = iconeBocal;
    c.clearRect(0, 0, 112, 112);
    const niveau = bocal.remplissage();
    c.save();
    c.beginPath();
    c.roundRect(24, 30, 64, 72, 14);
    c.clip();
    c.fillStyle = 'rgba(255, 255, 255, 0.06)';
    c.fillRect(0, 0, 112, 112);
    if (niveau > 0) {
      c.fillStyle = '#c08a34';
      const h = 6 + 62 * niveau;
      c.fillRect(24, 102 - h, 64, h);
    }
    c.restore();
    c.strokeStyle = '#b9aaa5';
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(24, 30, 64, 72, 14);
    c.stroke();
    c.fillStyle = '#8c7d78';
    c.fillRect(30, 18, 52, 12); // le couvercle
  }

  for (const b of boutonsOutil) b.addEventListener('click', () => choisir(b.dataset.outil as TypeOutil));
  definirActionsPanneau(() => [
    { libelle: 'Nouveau bouchon', faire: () => relancer(nouvelleGraine()) },
    { libelle: `Rejouer le même bouchon (n° ${graine})`, faire: () => relancer(graine) },
  ]);
  boutonNouveau.addEventListener('click', () => relancer(nouvelleGraine()));
  boutonBocal.addEventListener('click', () => ouvrirBocal(racine, bocal, dessinerIconeBocal));

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
  // Sauvegarde quand on quitte l'app (ou qu'elle passe en arrière-plan).
  const surCache = () => {
    if (document.visibilityState === 'hidden') sauver();
  };
  document.addEventListener('visibilitychange', surCache);
  window.addEventListener('pagehide', sauver);

  let actif = true;
  let avant = performance.now();
  let derniereSauvegarde = 0;
  const image = (maintenant: number) => {
    if (!actif) return;
    const temps = maintenant / 1000;
    sim.avancer((maintenant - avant) / 1000);
    avant = maintenant;
    // Poignée d'inspection pour les vérifications automatiques (invisible en jeu).
    (window as unknown as { satisfapp: unknown }).satisfapp = { sim, dispo, peau, bocal };
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
      if (e.type === 'morceauSorti') {
        // Le morceau vient vers la caméra, puis tombe dans le bocal.
        const morceau = formeDuMorceau(sim, e.indices);
        bocal.ajouter(morceau);
        let mx = 0;
        let my = 0;
        for (const i of e.indices) {
          mx += sim.x[i];
          my += sim.y[i];
        }
        sorties.lancer(morceau, dispo.cx + (mx / e.indices.length) * dispo.rayon, dispo.cy + (my / e.indices.length) * dispo.rayon, temps);
        setTimeout(dessinerIconeBocal, 900);
        if (e.part >= reglages.nombre('vib.grandeSortie') / 100) {
          // La grande sortie : tout s'arrête, un décollement ample, puis le silence.
          pilote.grandeSortie(temps);
          sons.couper();
          sons.decollement(volumes.decollement);
        }
        sauver();
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
    if (
      sim.outil.type === 'spatule' &&
      sim.outil.vitesse >= p.spatuleMouvement &&
      sim.distanceALaMatiere(sim.outil.x, sim.outil.y) <= p.margeParoi
    ) {
      frottement = Math.max(frottement, 0.6);
    }
    // La fin : peau claire, silence, puis un seul bouton.
    const vide = sim.pointsRestants() === 0;
    if (vide && finDepuis < 0) finDepuis = temps;
    if (vide && temps - finDepuis > ATTENTE_FIN && !sorties.enCours()) boutonNouveau.hidden = false;
    sons.frottement(vide || pilote.enSilence(temps) ? 0 : frottement * volumes.frottement);

    const dureeRougeur = reglages.nombre('paroi.rougeur');
    peau.nettoyer(temps, dureeRougeur);
    dessiner(ctx, sim, dispo, peau, {
      temps,
      dureeRougeur,
      sursaut: reglages.nombre('paroi.sursaut'),
      blanchiment: reglages.nombre('vue.blanchiment') / 100,
    });
    const [bx, by] = centreBocal();
    sorties.dessiner(ctx, temps, dispo.rayon, bx, by);

    if (temps - derniereSauvegarde > SAUVEGARDE_TOUTES) {
      derniereSauvegarde = temps;
      sauver();
    }
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);

  return () => {
    actif = false;
    sauver();
    debrancher();
    arreterEcoute();
    vibration.arreter();
    sons.couper();
    window.removeEventListener('resize', surRedimension);
    document.removeEventListener('visibilitychange', surCache);
    window.removeEventListener('pagehide', sauver);
    definirActionsPanneau(() => []);
  };
}

/** Le bocal ouvert : chaque morceau gardé, à la même échelle ; le plus gros mis en avant. Pas de chiffre. */
function ouvrirBocal(racine: HTMLElement, bocal: Bocal, rafraichirIcone: () => void): void {
  const fond = document.createElement('div');
  fond.className = 'bocal-ouvert';
  fond.innerHTML = `
    <canvas class="bocal-toile"></canvas>
    <div class="bocal-actions">
      <button class="bocal-vider">Vider le bocal</button>
      <button class="bocal-fermer">Fermer</button>
    </div>`;
  racine.append(fond);
  const toile = fond.querySelector<HTMLCanvasElement>('.bocal-toile')!;
  const ratio = window.devicePixelRatio || 1;
  const l = window.innerWidth;
  const h = window.innerHeight - 90;
  toile.width = Math.round(l * ratio);
  toile.height = Math.round(h * ratio);
  toile.style.width = `${l}px`;
  toile.style.height = `${h}px`;
  const ctx = toile.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const dessinerContenu = () => {
    ctx.clearRect(0, 0, l, h);
    const morceaux = bocal.morceaux;
    if (morceaux.length === 0) {
      ctx.fillStyle = '#6d5f5b';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Le bocal est vide.', l / 2, h / 2);
      return;
    }
    const gros = bocal.plusGros();
    // Le plus gros, en haut, en grand, sur un halo doux.
    const zoneHaut = Math.min(l, h * 0.45);
    const rGros = rayonDuMorceau(morceaux[gros]);
    const echelleGros = (zoneHaut * 0.42) / rGros;
    const halo = ctx.createRadialGradient(l / 2, zoneHaut / 2 + 10, 0, l / 2, zoneHaut / 2 + 10, zoneHaut * 0.55);
    halo.addColorStop(0, 'rgba(255, 220, 150, 0.18)');
    halo.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, l, zoneHaut + 20);
    dessinerMorceau(ctx, morceaux[gros], l / 2, zoneHaut / 2 + 10, echelleGros, '#d9a548');
    // Les autres, du plus gros au plus petit, tous à la même échelle pour comparer leur taille.
    const autres = morceaux.map((m, i) => ({ m, i })).filter(({ i }) => i !== gros);
    autres.sort((a, b) => b.m.part - a.m.part);
    if (autres.length === 0) return;
    const colonnes = Math.max(3, Math.ceil(Math.sqrt(autres.length * (l / (h - zoneHaut)))));
    const case_ = l / colonnes;
    const rMax = Math.max(...autres.map(({ m }) => rayonDuMorceau(m)));
    const echelle = Math.min(echelleGros, (case_ * 0.42) / rMax);
    autres.forEach(({ m }, k) => {
      const x = (k % colonnes) * case_ + case_ / 2;
      const y = zoneHaut + 30 + Math.floor(k / colonnes) * case_ + case_ / 2;
      if (y < h) dessinerMorceau(ctx, m, x, y, echelle);
    });
  };
  dessinerContenu();

  const vider = fond.querySelector<HTMLButtonElement>('.bocal-vider')!;
  let confirmer = false;
  vider.addEventListener('click', () => {
    if (!confirmer) {
      confirmer = true;
      vider.textContent = 'Vider vraiment ?';
      return;
    }
    bocal.vider();
    rafraichirIcone();
    dessinerContenu();
    vider.textContent = 'Vider le bocal';
    confirmer = false;
  });
  fond.querySelector('.bocal-fermer')!.addEventListener('click', () => fond.remove());
}
