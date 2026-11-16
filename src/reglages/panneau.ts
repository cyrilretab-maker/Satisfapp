// Le panneau de réglages caché : trois appuis rapides dans le coin en haut à droite.
// Il se construit tout seul à partir du fichier de données : un nouveau réglage
// ajouté dans defauts.json apparaît ici sans autre code.

import type { DefinitionReglage, Reglages } from './reglages';

/** Une action proposée en haut du panneau par la page en cours (ex. « Nouveau bouchon »). */
export interface ActionPanneau {
  libelle: string;
  faire: () => void;
}

let actionsDeLaPage: () => ActionPanneau[] = () => [];

/** La page en cours déclare ses actions ; elles apparaissent en haut du panneau. */
export function definirActionsPanneau(fournir: () => ActionPanneau[]): void {
  actionsDeLaPage = fournir;
}

const APPUIS_POUR_OUVRIR = 3;
const FENETRE_APPUIS = 1200; // ms : les trois appuis doivent tenir dans ce délai

export function installerPanneau(reglages: Reglages, coin: HTMLElement): void {
  let appuis: number[] = [];
  coin.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const maintenant = performance.now();
    appuis = appuis.filter((t) => maintenant - t < FENETRE_APPUIS);
    appuis.push(maintenant);
    if (appuis.length >= APPUIS_POUR_OUVRIR) {
      appuis = [];
      ouvrir(reglages);
    }
  });
}

function ouvrir(reglages: Reglages): void {
  if (document.getElementById('panneau')) return;
  const panneau = document.createElement('div');
  panneau.id = 'panneau';

  const entete = document.createElement('div');
  entete.className = 'panneau-entete';
  const titre = document.createElement('h2');
  titre.textContent = 'Réglages';
  entete.append(titre, bouton('Fermer', () => panneau.remove()));
  panneau.append(entete);

  const contenu = document.createElement('div');
  contenu.className = 'panneau-contenu';
  panneau.append(contenu);

  const dessiner = () => {
    contenu.replaceChildren();
    const actions = actionsDeLaPage();
    if (actions.length > 0) {
      const zone = document.createElement('div');
      zone.className = 'panneau-actions';
      for (const a of actions) {
        zone.append(
          bouton(a.libelle, () => {
            a.faire();
            panneau.remove();
          }),
        );
      }
      contenu.append(zone);
    }
    for (const groupe of reglages.fichier.groupes) {
      const membres = reglages.liste().filter((d) => d.groupe === groupe.id);
      if (membres.length === 0) continue;
      const h3 = document.createElement('h3');
      h3.textContent = groupe.titre;
      contenu.append(h3);
      for (const def of membres) contenu.append(ligne(reglages, def));
    }
    contenu.append(
      bouton('Remettre les valeurs de départ', () => {
        reglages.toutRemettre();
        dessiner();
      }),
    );
  };
  dessiner();
  document.body.append(panneau);
}

function ligne(reglages: Reglages, def: DefinitionReglage): HTMLElement {
  const bloc = document.createElement('label');
  bloc.className = 'reglage';
  const nom = document.createElement('span');
  nom.className = 'reglage-nom';
  nom.textContent = def.libelle;
  if (def.prochainBouchon) {
    const note = document.createElement('small');
    note.className = 'reglage-note';
    note.textContent = ' (prochain bouchon)';
    nom.append(note);
  }

  if (def.type === 'choix') {
    const choix = document.createElement('span');
    choix.className = 'reglage-choix';
    for (const o of def.options) {
      const b = bouton(o.libelle, () => {
        reglages.ecrire(def.id, o.valeur);
        choix.querySelectorAll('button').forEach((x) => x.classList.toggle('actif', x === b));
      });
      b.classList.toggle('actif', reglages.texte(def.id) === o.valeur);
      choix.append(b);
    }
    bloc.append(nom, choix);
    return bloc;
  }

  if (def.type === 'interrupteur') {
    const caseACocher = document.createElement('input');
    caseACocher.type = 'checkbox';
    caseACocher.checked = reglages.oui(def.id);
    caseACocher.addEventListener('change', () => reglages.ecrire(def.id, caseACocher.checked));
    bloc.classList.add('reglage-interrupteur');
    bloc.append(nom, caseACocher);
    return bloc;
  }

  const valeur = document.createElement('span');
  valeur.className = 'reglage-valeur';
  const curseur = document.createElement('input');
  curseur.type = 'range';
  curseur.min = String(def.min);
  curseur.max = String(def.max);
  curseur.step = String(def.pas);
  curseur.value = String(reglages.nombre(def.id));
  const afficher = () => {
    valeur.textContent = `${reglages.nombre(def.id)} ${def.unite ?? ''}`;
  };
  afficher();
  curseur.addEventListener('input', () => {
    reglages.ecrire(def.id, Number(curseur.value));
    afficher();
  });
  const haut = document.createElement('span');
  haut.className = 'reglage-haut';
  haut.append(nom, valeur);
  bloc.append(haut, curseur);
  return bloc;
}

function bouton(texte: string, action: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = texte;
  b.addEventListener('click', action);
  return b;
}
