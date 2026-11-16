# Journal de construction — Satisfapp

Chaque session repart d'ici. Le plus récent en haut.

## État actuel

- **Lot en cours :** 0 — Socle technique. Rythmes sentis et distingués au doigt. **Reste à confirmer :** ouverture en mode avion. Ensuite : feu vert de Cyril pour le lot 1.
- **Décisions prises :** code public, hébergement de test sur GitHub Pages (2026-11-16). Vibration web conservée pour l'instant (elle se sent avec des pulsations longues).
- **Leçon vibration :** la vibration web n'a pas de force réglable. Une pulsation de moins de ~100 ms est trop faible pour être sentie sur le téléphone de Cyril : la tension devra jouer surtout sur les pauses, avec des pulsations assez longues.

### Rythmes retenus (fichier `src/reglages/defauts.json`, depuis le 2026-11-16)

| Rythme | Pulsation | Pause | Pulsations par seconde |
| --- | --- | --- | --- |
| Lent | 300 ms | 650 ms | ≈ 1,05 |
| Moyen | 150 ms | 250 ms | ≈ 2,5 |
| Rapide | 80 ms | 120 ms | ≈ 5 |

Anciennes valeurs (trop faibles, non senties) : 70/650, 50/250, 35/80. Durée d'un essai : 3000 ms. Volume : 60 %.

## Ce qui reste pour valider le lot 0

- [x] Dépôt GitHub `cyrilretab-maker/Satisfapp` créé (public) et code envoyé.
- [x] GitHub Pages activé, adresse de test : https://cyrilretab-maker.github.io/Satisfapp/
- [ ] App installée sur le téléphone, ouverte en mode avion (installée : oui ; mode avion : à confirmer).
- [x] Cyril distingue et sent les trois rythmes (après allongement des pulsations).

### Premier retour de Cyril (2026-11-16)
- App en ligne et installée. Les trois rythmes se distinguent (au son), **mais la vibration est si faible qu'on ne la sent pas**.
- Ajout d'un diagnostic sur la page de test : il dit si le navigateur accepte ou refuse la vibration.
- Piste en cours : allonger les pulsations au panneau (la vibration web n'a pas de réglage de force, seulement des durées) et vérifier l'intensité des vibrations dans les réglages d'Android. Si ça ne suffit pas : passer en app Android (Capacitor), comme prévu par le cahier des charges.

## Comment c'est rangé (pour reprendre une session)

- `src/reglages/defauts.json` : **toutes** les valeurs de sensation et leurs bornes. Le panneau se construit tout seul à partir de ce fichier.
- `src/reglages/reglages.ts` : lit le fichier, garde sur le téléphone seulement ce que Cyril a modifié.
- `src/reglages/panneau.ts` : panneau caché, trois appuis rapides dans le coin en haut à droite.
- `src/sensations/` : couche vibration (remplaçable par Capacitor), couche son (sons fabriqués par le code), motifs de rythme.
- `src/pages/` : page de lancement, page de test vibration et son.
- `tests/` : tests automatiques (`npm test`).
- `.github/workflows/publier.yml` : à chaque envoi sur `main`, tests, puis construction et mise en ligne. Si un test échoue, rien n'est publié.
- Outils : Vite 8, TypeScript 7, Vitest 5, vite-plugin-pwa 2. PixiJS sera ajouté au lot 1 seulement.

## Historique

### 2026-11-16 — Lot 0 construit
- Projet vide, app installable et utilisable hors connexion (PWA, icônes provisoires grises).
- Page de test : trois boutons Lent / Moyen / Rapide (vibration + petit « tic » sonore calé sur chaque pulsation), bouton Arrêter.
- Panneau de réglages : vibration et son activés ou non, volume, durée de l'essai, pulsation et pause de chaque rythme. Bouton « Remettre les valeurs de départ ».
- 17 tests automatiques : réglages (chargement, enregistrement, bornes, stockage abîmé) et rythmes (motifs, écart net entre les trois rythmes).
- Vérifié dans le navigateur de l'ordinateur : affichage, ouverture du panneau, service hors connexion actif.

### 2026-11-16 — Démarrage
- Lecture complète de `docs/Vision.md` et `docs/Cahier des charges 1 décollement.md`.
- Dépôt git local créé.

## Idées notées pour plus tard (hors lot en cours, à proposer à Cyril)

- **Test à l'aveugle** sur la page de test : un bouton « Au hasard » joue un des trois rythmes sans dire lequel, puis le révèle. Il mesurerait directement le critère « distinguer trois rythmes ».
- **Copier le réglage** (prévu au cahier des charges, panneau) : utile tôt pour que Cyril colle ses valeurs dans la conversation.
