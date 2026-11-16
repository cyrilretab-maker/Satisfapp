# Journal de construction — Satisfapp

Chaque session repart d'ici. Le plus récent en haut.

## État actuel

- **Lot 1 — Matière brute : VALIDÉ** par Cyril le 2026-11-16. **Prochain : lot 2 (spatule et paroi), en attente du feu vert.**
  - [x] Tirer doucement et tirer fort donnent deux résultats nettement différents (confirmé au doigt par Cyril, 2026-11-16).
  - [x] Mode de commande choisi : **pavé tactile**. Le mode direct décalé a été retiré du code et du panneau.
- **Lot 0 :** validé (rythmes sentis et distingués ; Cyril a donné le feu vert pour le lot 1). Ouverture en mode avion jamais confirmée explicitement.
- **Adresse de test :** https://cyrilretab-maker.github.io/Satisfapp/

### Décisions prises
- Code public, hébergement de test sur GitHub Pages (2026-11-16).
- Vibration web conservée pour l'instant. Leçon : une pulsation de moins de ~100 ms ne se sent pas sur le téléphone de Cyril ; la tension devra jouer surtout sur les pauses.
- **Lot 1 sans spatule : le tour du bouchon commence déjà décollé** (seule la colle du fond tient). La colle du tour arrive au lot 2 avec la spatule. Réglage « Tour déjà décollé » à couper au lot 2.
- **Affichage en dessin 2D simple (Canvas)** au lieu de PixiJS. PixiJS seulement si l'habillage du lot 4 l'exige.

### Choix de règles faits pendant le lot 1 (à faire valider par Cyril)
- **Sortir un morceau :** un morceau qui ne tient plus au fond sort en entier quand la pince l'emmène au-delà du bord de la vue ronde (et non quand son centre en sort : impossible pour un gros morceau tenu par le bord).
- **La cire pincée résiste mieux** (×3 dans la pince et juste autour) : sans ça, la déchirure se faisait toujours collée à la pince, et on n'obtenait jamais de morceau moyen.
- **Changer de direction :** c'est le changement de direction de la traction de la pince qui accélère le décollement de toute la colle sous tension (et non la direction mesurée point par point, sans effet sensible).
- **Prise au milieu d'une zone collée :** la pince n'attrape qu'une miette (les liens autour sont fragilisés à 25 %).

### Réglages retenus

Rythmes de vibration (lot 0) :

| Rythme | Pulsation | Pause | Pulsations par seconde |
| --- | --- | --- | --- |
| Lent | 300 ms | 650 ms | ≈ 1,05 |
| Moyen | 150 ms | 250 ms | ≈ 2,5 |
| Rapide | 80 ms | 120 ms | ≈ 5 |

Matière (lot 1, valeurs de départ calibrées au doigt simulé, pas encore au vrai doigt) :

| Réglage | Valeur |
| --- | --- |
| Force du geste | 80 |
| Solidité / élasticité | 1 / 60 % |
| Amortissement | 2 |
| Colle du fond : temps / seuil / raideur / bonus direction | 0,1 s / 2 % / 40 / ×3 |
| Pince : pause / taille de prise / renfort / zone renforcée / fragilité sur zone collée | 250 ms / 0,12 / ×3 / ×2 / 25 % |
| Zones faibles : nombre / solidité restante | 3 / 30 % |
| Zones très collées : nombre / intensité | 3 / ×2,5 |
| Taille du bouchon / écart entre points | 82 % / 0,065 |

Résultats au doigt simulé, sur 10 bouchons : tirer fort (3 unités/s) → jamais plus de 5 % du bouchon ; tirer doucement en relâchant quand ça tire trop → bouchon entier 5 fois sur 10, morceaux de 4 à 20 % sinon, en 8 à 55 s.

## Comment c'est rangé (pour reprendre une session)

- `src/reglages/defauts.json` : **toutes** les valeurs de sensation et leurs bornes. Le panneau se construit tout seul à partir de ce fichier (types : curseur, interrupteur, choix).
- `src/reglages/reglages.ts` : lit le fichier, garde sur le téléphone seulement ce que Cyril a modifié.
- `src/reglages/panneau.ts` : panneau caché (trois appuis en haut à droite) ; la page en cours peut y ajouter des actions (Nouveau bouchon, Rejouer le même bouchon).
- `src/matiere/` : **le moteur, sans écran.** `bouchon.ts` fabrique un bouchon à partir d'un numéro de tirage ; `moteur.ts` applique les règles (liens qui cassent au pic, colle du fond qui s'use sous tension modérée, pince) ; `parametres.ts` traduit les réglages pour le moteur.
- `src/jeu/` : l'écran de jeu. `ecran.ts` (disposition), `commande.ts` (pavé tactile), `dessin.ts` (formes grises).
- `src/pages/` : page de lancement, page du bouchon (`jeu.ts`), page de test vibration et son.
- `src/sensations/` : couche vibration (remplaçable par Capacitor), couche son, motifs de rythme.
- `tests/` : tests automatiques (`npm test`). `tests/outils/doigt-simule.ts` = le doigt simulé.
- `.github/workflows/publier.yml` : à chaque envoi sur `main`, tests, puis construction et mise en ligne.
- Outils : Vite 8, TypeScript 7, Vitest 5, vite-plugin-pwa 2. Pas de PixiJS (dessin Canvas 2D).
- La page de jeu expose `window.satisfapp` (simulation en cours) pour les vérifications automatiques.

## Historique

### 2026-11-16 — Lot 1 validé
- Cyril confirme au doigt la différence nette entre tirer doucement et tirer fort, et choisit le pavé tactile. Mode direct retiré.

### 2026-11-16 — Lot 1 construit (matière brute)
- Moteur de matière : nappe de ~580 points et ~1650 liens, petits pas de temps fixes (même gestes = même résultat).
- Bouchon reproductible : forme, zones faibles (lignes courbes cachées), zones très collées, irrégularité de la cire, tous tirés d'un numéro.
- Pince : se ferme après une courte pause sur la matière (petit clic sonore), s'ouvre quand on lève le doigt, la pointe traîne derrière le pouce quand elle tient la matière.
- Deux modes de commande au choix dans le panneau : pavé tactile (par défaut) et direct décalé.
- Panneau : ~30 réglages en 7 groupes, actions « Nouveau bouchon » et « Rejouer le même bouchon (n° …) ».
- Bouton « Nouveau bouchon » quand le conduit est vide.
- 32 tests automatiques, dont 15 sur les règles de la matière.
- Coût du moteur : 0,37 ms par image sur l'ordinateur (marge large pour 60 images/s sur téléphone).

### 2026-11-16 — Lot 0 construit et validé
- App installable hors connexion, page de test vibration et son, panneau de réglages, publication automatique.
- Vibration trop faible au départ : pulsations allongées (300 / 150 / 80 ms), alors senties et distinguées.

### 2026-11-16 — Démarrage
- Lecture complète de `docs/Vision.md` et `docs/Cahier des charges 1 décollement.md`. Dépôt git créé.

## Idées notées pour plus tard (hors lot en cours, à proposer à Cyril)

- **Test à l'aveugle** sur la page de test : un bouton « Au hasard » joue un des trois rythmes sans dire lequel, puis le révèle.
- **Copier le réglage** (prévu au cahier des charges, panneau) : devient très utile avec ~30 curseurs.
- **Collisions entre morceaux** : aujourd'hui un morceau détaché peut passer par-dessus le reste du bouchon.
