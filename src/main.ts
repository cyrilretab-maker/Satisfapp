import './style.css';
import { registerSW } from 'virtual:pwa-register';
import defauts from './reglages/defauts.json';
import { Reglages, type FichierReglages } from './reglages/reglages';
import { installerPanneau } from './reglages/panneau';
import { creerVibrationWeb } from './sensations/vibration';
import { creerSonWeb } from './sensations/son';
import { afficherAccueil } from './pages/accueil';
import { afficherTestVibration } from './pages/test-vibration';
import { afficherJeu } from './pages/jeu';
import { afficherEau } from './pages/eau';

registerSW({ immediate: true }); // rend l'app utilisable hors connexion

function stockageDuTelephone(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const reglages = new Reglages(defauts as FichierReglages, stockageDuTelephone());
const vibration = creerVibrationWeb();
const son = creerSonWeb();
const racine = document.getElementById('app')!;

installerPanneau(reglages, document.getElementById('coin-reglages')!);

let quitterPage: (() => void) | undefined;
function router(): void {
  quitterPage?.();
  quitterPage = undefined;
  if (location.hash === '#jeu') {
    quitterPage = afficherJeu(racine, reglages, vibration, stockageDuTelephone());
  } else if (location.hash === '#eau') {
    quitterPage = afficherEau(racine, reglages, vibration, stockageDuTelephone());
  } else if (location.hash === '#test') {
    quitterPage = afficherTestVibration(racine, reglages, vibration, son);
  } else {
    afficherAccueil(racine);
  }
}
window.addEventListener('hashchange', router);
router();
