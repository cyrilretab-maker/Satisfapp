// Le deuxième mini-jeu : « l'eau ». On trace au doigt des routes que l'eau suit, sur un égouttoir
// en inox, jusqu'à vider toutes les flaques dans l'évier. Le doigt touche directement l'eau.

import { dessinerEauSimple } from '../eau/dessin-eau';
import { disposerEau, versCases, type DispositionEau } from '../eau/ecran-eau';
import { Eau, type EtatEau } from '../eau/moteur-eau';
import { lireParamsEau, lireParamsEvier } from '../eau/parametres-eau';
import { RenduEauGL } from '../eau/rendu-eau-gl';
import { PiloteEau, type ReglagesVibEau } from '../eau/sensations-eau';
import { SonsEau } from '../eau/sons-eau';
import { Vase } from '../eau/vase';
import { nouvelleGraine } from '../matiere/hasard';
import { definirActionsPanneau } from '../reglages/panneau';
import type { Reglages, StockageSimple } from '../reglages/reglages';
import type { CoucheVibration } from '../sensations/vibration';

export const CLE_EAU = 'satisfapp.eau.v1';
const ATTENTE_FIN = 1.5; // secondes de silence avant le bouton « nouvel évier »
const SAUVEGARDE_TOUTES = 2;

function lireVibEau(r: Reglages): ReglagesVibEau {
  return {
    pulsation: r.nombre('eauVib.pulsation'),
    pauseLente: r.nombre('eauVib.pauseLente'),
    pauseRapide: r.nombre('eauVib.pauseRapide'),
    seuil: r.nombre('eauVib.seuil'),
    debitMax: r.nombre('eauVib.debitMax'),
    fremissement: r.nombre('eauVib.fremissement'),
    jonction: r.nombre('eauVib.jonction'),
    goutte: r.nombre('eauVib.goutte') / 100,
    finale: r.nombre('eauVib.finale'),
  };
}

export function lireEtatEau(stockage: StockageSimple | null): EtatEau | null {
  try {
    const texte = stockage?.getItem(CLE_EAU);
    if (!texte) return null;
    const e = JSON.parse(texte) as EtatEau;
    return e?.version === 1 && typeof e.graine === 'number' && e.evier && typeof e.h === 'string' ? e : null;
  } catch {
    return null;
  }
}

export function afficherEau(
  racine: HTMLElement,
  reglages: Reglages,
  vibration: CoucheVibration,
  stockage: StockageSimple | null,
): () => void {
  racine.innerHTML = `
    <section class="jeu eau">
      <canvas class="jeu-fond"></canvas>
      <canvas class="jeu-toile"></canvas>
      <button class="jeu-bocal" aria-label="Ouvrir le vase"><canvas width="112" height="112"></canvas></button>
      <a class="jeu-retour" href="#" aria-label="Retour">←</a>
      <button class="jeu-nouveau" hidden>Nouvel évier</button>
    </section>`;
  const toile = racine.querySelector<HTMLCanvasElement>('.jeu-toile')!;
  const fond = racine.querySelector<HTMLCanvasElement>('.jeu-fond')!;
  const ctx = toile.getContext('2d')!;
  const boutonNouveau = racine.querySelector<HTMLButtonElement>('.jeu-nouveau')!;
  const boutonVase = racine.querySelector<HTMLButtonElement>('.jeu-bocal')!;
  const iconeVase = boutonVase.querySelector('canvas')!.getContext('2d')!;
  const vase = new Vase(stockage);
  const sons = new SonsEau();
  const pilote = new PiloteEau(lireVibEau(reglages));
  let rendu: RenduEauGL | null | undefined;
  let dispo: DispositionEau = mettreEnPage();

  // Reprise de l'évier en cours, sinon un nouvel évier.
  let eau: Eau;
  const sauve = lireEtatEau(stockage);
  if (sauve) {
    eau = new Eau(sauve.graine, sauve.evier, lireParamsEau(reglages));
    if (!eau.importer(sauve)) eau = creer(nouvelleGraine());
  } else {
    eau = creer(nouvelleGraine());
  }
  let finDepuis = -1;
  dessinerIconeVase();

  function creer(g: number): Eau {
    return new Eau(g, lireParamsEvier(reglages), lireParamsEau(reglages));
  }

  function mettreEnPage(): DispositionEau {
    const ratio = window.devicePixelRatio || 1;
    const l = window.innerWidth;
    const h = window.innerHeight;
    for (const c of [toile, fond]) {
      c.width = Math.round(l * ratio);
      c.height = Math.round(h * ratio);
      c.style.width = `${l}px`;
      c.style.height = `${h}px`;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const d = disposerEau(l, h);
    return d;
  }

  function relancer(g: number) {
    eau = creer(g);
    finDepuis = -1;
    boutonNouveau.hidden = true;
    sauver();
  }

  function sauver() {
    try {
      stockage?.setItem(CLE_EAU, JSON.stringify(eau.exporter()));
    } catch {
      /* stockage plein : tant pis */
    }
  }

  /** L'icône du vase : un verre qui se remplit d'eau. */
  function dessinerIconeVase() {
    const c = iconeVase;
    c.clearRect(0, 0, 112, 112);
    c.save();
    c.beginPath();
    c.moveTo(30, 22);
    c.lineTo(82, 22);
    c.lineTo(76, 100);
    c.lineTo(36, 100);
    c.closePath();
    c.clip();
    c.fillStyle = 'rgba(255, 255, 255, 0.06)';
    c.fillRect(0, 0, 112, 112);
    const niveau = vase.remplissage();
    if (niveau > 0) {
      c.fillStyle = 'rgba(120, 170, 220, 0.85)';
      const h = 6 + 72 * niveau;
      c.fillRect(0, 100 - h, 112, h);
    }
    c.restore();
    c.strokeStyle = '#b9c4cc';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(30, 22);
    c.lineTo(82, 22);
    c.lineTo(76, 100);
    c.lineTo(36, 100);
    c.closePath();
    c.stroke();
  }

  // Le doigt, directement sur l'eau. Un seul doigt à la fois.
  let doigt: number | null = null;
  const poser = (e: PointerEvent) => {
    sons.reveiller();
    if (doigt !== null) return;
    const [x, y] = versCases(dispo, e.clientX, e.clientY);
    if (y < -2) return;
    doigt = e.pointerId;
    try {
      toile.setPointerCapture(e.pointerId);
    } catch {
      /* doigt simulé */
    }
    eau.poserDoigt(x, y);
    e.preventDefault();
  };
  const bouger = (e: PointerEvent) => {
    if (e.pointerId !== doigt) return;
    const [x, y] = versCases(dispo, e.clientX, e.clientY);
    eau.deplacerDoigt(x, y);
    e.preventDefault();
  };
  const lever = (e: PointerEvent) => {
    if (e.pointerId !== doigt) return;
    doigt = null;
    eau.leverDoigt();
  };
  toile.addEventListener('pointerdown', poser);
  toile.addEventListener('pointermove', bouger);
  toile.addEventListener('pointerup', lever);
  toile.addEventListener('pointercancel', lever);

  definirActionsPanneau(() => [
    { libelle: 'Nouvel évier', faire: () => relancer(nouvelleGraine()) },
    { libelle: `Rejouer le même évier (n° ${eau.graine})`, faire: () => relancer(eau.graine) },
  ]);
  boutonNouveau.addEventListener('click', () => relancer(nouvelleGraine()));
  boutonVase.addEventListener('click', () => ouvrirVase(racine, vase, dessinerIconeVase));

  const arreterEcoute = reglages.surChangement(() => {
    eau.params = lireParamsEau(reglages);
    pilote.reglages = lireVibEau(reglages);
  });
  const surRedimension = () => (dispo = mettreEnPage());
  window.addEventListener('resize', surRedimension);
  const surCache = () => {
    if (document.visibilityState === 'hidden') sauver();
  };
  document.addEventListener('visibilitychange', surCache);
  window.addEventListener('pagehide', sauver);

  const volume = (id: string) =>
    reglages.oui('general.son') ? (reglages.nombre('general.volume') / 100) * (reglages.nombre(id) / 100) : 0;

  let actif = true;
  let avant = performance.now();
  let derniereSauvegarde = 0;
  const image = (maintenant: number) => {
    if (!actif) return;
    const temps = maintenant / 1000;
    eau.avancer((maintenant - avant) / 1000);
    avant = maintenant;
    (window as unknown as { satisfapp: unknown }).satisfapp = { eau, dispo };
    const vibrer = reglages.oui('general.vibration');
    for (const e of eau.prendreEvenements()) {
      if (e.type === 'jonction') {
        sons.plop(volume('eauSon.plop'));
        const m = pilote.jonction(temps);
        if (vibrer && m.length) vibration.jouer(m);
      }
      if (e.type === 'liberation') {
        pilote.liberation(temps);
        vibration.arreter();
        sons.couper();
        sons.coulee(volume('eauSon.coulee'));
      }
      if (e.type === 'coulee') {
        vase.ajouter(e.volume / Math.max(1e-6, eau.depart));
        setTimeout(dessinerIconeVase, 600);
        sauver();
      }
      if (e.type === 'tropPlein') sons.goutte(volume('eauSon.coulee') * 0.5);
    }
    const d = eau.doigt;
    const debit = eau.debitTotal();
    const dansEau = d.pose && d.dansEau > 0.3;
    const ordres = pilote.mettreAJour(temps, { debit, dansEau, goutte: eau.goutte() });
    if (ordres.arreter) vibration.arreter();
    if (vibrer) for (const m of ordres.vibrer) vibration.jouer(m);
    // Les sons continus. Pendant que la goutte gonfle seule : le silence.
    const max = reglages.nombre('eauVib.debitMax');
    sons.ruissellement(Math.min(1, debit / Math.max(1, max)) * volume('eauSon.ruissellement'));
    sons.clapotis(dansEau ? Math.min(1, d.vitesse / 30) * volume('eauSon.clapotis') : 0);
    sons.frottement(d.pose && !dansEau ? Math.min(1, d.vitesse / 40) * volume('eauSon.frottement') : 0);

    // La fin : inox vide, silence, puis un seul bouton.
    const vide = eau.estVide(reglages.nombre('eau.fin') / 100);
    if (vide && finDepuis < 0) finDepuis = temps;
    if (!vide) finDepuis = -1;
    if (vide && temps - finDepuis > ATTENTE_FIN) boutonNouveau.hidden = false;

    // L'image.
    if (reglages.oui('eauVue.realiste') && rendu === undefined) rendu = RenduEauGL.creer(fond);
    const gl = reglages.oui('eauVue.realiste') && rendu && !rendu.perdu ? rendu : null;
    if (gl) {
      ctx.clearRect(0, 0, dispo.largeur, dispo.hauteur);
      gl.dessiner(eau, dispo, {
        ratio: window.devicePixelRatio || 1,
        temps,
        lissage: reglages.nombre('eauVue.lissage'),
        reflets: reglages.nombre('eauVue.reflets'),
        refraction: reglages.nombre('eauVue.refraction'),
        traces: reglages.nombre('eauVue.traces'),
        dureeTrace: eau.params.dureeTrace,
      });
    } else {
      dessinerEauSimple(ctx, eau, dispo, temps);
    }
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
    sons.couper();
    vibration.arreter();
    arreterEcoute();
    toile.removeEventListener('pointerdown', poser);
    toile.removeEventListener('pointermove', bouger);
    toile.removeEventListener('pointerup', lever);
    toile.removeEventListener('pointercancel', lever);
    window.removeEventListener('resize', surRedimension);
    document.removeEventListener('visibilitychange', surCache);
    window.removeEventListener('pagehide', sauver);
    definirActionsPanneau(() => []);
  };
}

/** Le vase ouvert : chaque coulée est une goutte, la plus grosse au premier plan. Pas de chiffre. */
function ouvrirVase(racine: HTMLElement, vase: Vase, apres: () => void): void {
  const fond = document.createElement('div');
  fond.className = 'bocal-ouvert';
  fond.innerHTML = `
    <canvas class="bocal-toile"></canvas>
    <div class="bocal-actions">
      <button class="bocal-vider">Vider</button>
      <button class="bocal-fermer">Fermer</button>
    </div>`;
  racine.append(fond);
  const toile = fond.querySelector<HTMLCanvasElement>('.bocal-toile')!;
  const ratio = window.devicePixelRatio || 1;
  const l = window.innerWidth;
  const h = window.innerHeight - 90;
  toile.width = l * ratio;
  toile.height = h * ratio;
  toile.style.width = `${l}px`;
  toile.style.height = `${h}px`;
  const c = toile.getContext('2d')!;
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  const dessiner = () => {
    c.clearRect(0, 0, l, h);
    const k = vase.plusGrosse();
    const goutte = (x: number, y: number, r: number, mise: boolean) => {
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, mise ? 'rgba(220, 240, 255, 0.95)' : 'rgba(200, 225, 245, 0.8)');
      g.addColorStop(1, mise ? 'rgba(90, 140, 190, 0.9)' : 'rgba(90, 130, 170, 0.6)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, y - r * 1.5);
      c.bezierCurveTo(x + r * 0.9, y - r * 0.5, x + r, y + r * 0.2, x, y + r);
      c.bezierCurveTo(x - r, y + r * 0.2, x - r * 0.9, y - r * 0.5, x, y - r * 1.5);
      c.fill();
    };
    if (k < 0) {
      c.fillStyle = '#8c7d78';
      c.font = '16px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText('Le vase est vide.', l / 2, h / 2);
      return;
    }
    goutte(l / 2, h * 0.3, Math.min(l, h) * (0.08 + 0.18 * Math.sqrt(vase.coulees[k])), true);
    let i = 0;
    vase.coulees.forEach((v, j) => {
      if (j === k) return;
      const colonnes = 8;
      const x = (l / (colonnes + 1)) * ((i % colonnes) + 1);
      const y = h * 0.62 + Math.floor(i / colonnes) * 34;
      if (y < h - 10) goutte(x, y, 5 + 22 * Math.sqrt(v), false);
      i++;
    });
  };
  dessiner();
  const fermer = () => {
    fond.remove();
    apres();
  };
  fond.querySelector('.bocal-fermer')!.addEventListener('click', fermer);
  const vider = fond.querySelector<HTMLButtonElement>('.bocal-vider')!;
  vider.addEventListener('click', () => {
    if (vider.dataset.sur !== '1') {
      vider.dataset.sur = '1';
      vider.textContent = 'Vraiment vider ?';
      return;
    }
    vase.vider();
    vider.dataset.sur = '';
    vider.textContent = 'Vider';
    dessiner();
  });
}
