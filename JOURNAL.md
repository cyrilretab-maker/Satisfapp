# Journal de construction — Satisfapp

Chaque session repart d'ici. Le plus récent en haut.

## État actuel

- **Lot 2 — Spatule et paroi : VALIDÉ** par Cyril le 2026-11-16. **Prochain : lot 3 (tension qui se sent : vibration, sons, blanchiment), en attente du feu vert.**
  - [x] Impossible de sortir un gros morceau sans avoir fait le tour.
  - [x] Toucher la paroi se remarque sans punir.
- **Lot 1 — Matière brute : VALIDÉ** par Cyril le 2026-11-16.
  - [x] Tirer doucement et tirer fort donnent deux résultats nettement différents (confirmé au doigt par Cyril, 2026-11-16).
  - [x] Mode de commande choisi : **pavé tactile**. Le mode direct décalé a été retiré du code et du panneau.
- **Lot 0 :** validé (rythmes sentis et distingués ; Cyril a donné le feu vert pour le lot 1). Ouverture en mode avion jamais confirmée explicitement.
- **Adresse de test :** https://cyrilretab-maker.github.io/Satisfapp/

### Décisions prises
- Code public, hébergement de test sur GitHub Pages (2026-11-16).
- Vibration web conservée pour l'instant. Leçon : une pulsation de moins de ~100 ms ne se sent pas sur le téléphone de Cyril ; la tension devra jouer surtout sur les pauses.
- Lot 1 sans spatule : le tour commençait déjà décollé. **Depuis le lot 2, le tour est collé à la paroi** (sauf aux points d'entrée) ; le réglage provisoire « Tour déjà décollé » a été retiré.
- **Affichage en dessin 2D simple (Canvas)** au lieu de PixiJS. PixiJS seulement si l'habillage du lot 4 l'exige.

### Choix de règles faits pendant le lot 1 (à faire valider par Cyril)
- **Sortir un morceau :** un morceau qui ne tient plus au fond sort en entier quand la pince l'emmène au-delà du bord de la vue ronde (et non quand son centre en sort : impossible pour un gros morceau tenu par le bord).
- **La cire pincée résiste mieux** (×3 dans la pince et juste autour) : sans ça, la déchirure se faisait toujours collée à la pince, et on n'obtenait jamais de morceau moyen.
- **Changer de direction :** c'est le changement de direction de la traction de la pince qui accélère le décollement de toute la colle sous tension (et non la direction mesurée point par point, sans effet sensible).
- **Prise au milieu d'une zone collée :** la pince n'attrape qu'une miette (les liens autour sont fragilisés à 25 %).

### Choix de règles faits pendant le lot 2 (à faire valider par Cyril)
- **Vue de face :** la paroi du conduit est l'anneau extérieur de la vue (au-delà de 0,95 du rayon) ; le fond est au milieu, derrière le bouchon.
- **Le tour** = la rangée de points au bord du bouchon. Collé à la paroi (3 fois plus raide que la colle du fond). Seule la spatule le décolle ; tirer dessus ne le fait jamais lâcher.
- **Spatule :** chaque petit mouvement use la colle du tour des points sous sa pointe, seulement s'ils touchent un point du tour déjà libre ou une déchirure (on pèle, on ne perce pas). Immobile, elle ne fait rien. Elle ne touche pas au fond.
- **La colle du fond ne lâche que quand on tire à la pince** (sinon le repli du bord la faisait lâcher toute seule pendant le tour).
- **La pince ne tient que la matière déjà décollée** sous sa pointe (sinon la miette restait accrochée à la paroi et ne sortait jamais).
- **Repli en sac :** un point du tour décollé est attiré vers le centre, jusqu'à 0,1 de distance (force et distance réglables).
- **Paroi sensible :** la spatule qui bouge à plus de 0,08 de toute matière touche la peau ; la pince ouverte qui bouge dans l'anneau de la paroi la racle. Pas plus d'un contact toutes les 0,3 s. Réaction : vibration brève (110 ms), sursaut de l'image (4 px), rougeur qui s'estompe en 30 s. Aucune conséquence sur le bouchon.
- **On commence avec la spatule en main** (pour chercher où passer dessous).
- La cire se tasse plus facilement qu'elle ne s'étire (compression 3 fois plus souple), pour que le bord puisse se replier.

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

Ajouts du lot 2 : colle du tour 0,12 (distance de frottement par point) ; repli 0,5 sur 0,1 ; spatule portée 0,07, vitesse minimale 0,1 ; marge de la paroi 0,08 ; points d'entrée 2 × 3 points.

Résultats lot 2 au doigt simulé, sur 6 bouchons : faire le tour avec application prend ~28 s ; sans le tour → rien ne sort ; tour puis traction douce → bouchon entier ; tour puis traction forte → miette (1 %).

Résultats lot 1 au doigt simulé, sur 10 bouchons : tirer fort (3 unités/s) → jamais plus de 5 % du bouchon ; tirer doucement en relâchant quand ça tire trop → bouchon entier 5 fois sur 10, morceaux de 4 à 20 % sinon, en 8 à 55 s.

## Comment c'est rangé (pour reprendre une session)

- `src/reglages/defauts.json` : **toutes** les valeurs de sensation et leurs bornes. Le panneau se construit tout seul à partir de ce fichier (types : curseur, interrupteur, choix).
- `src/reglages/reglages.ts` : lit le fichier, garde sur le téléphone seulement ce que Cyril a modifié.
- `src/reglages/panneau.ts` : panneau caché (trois appuis en haut à droite) ; la page en cours peut y ajouter des actions (Nouveau bouchon, Rejouer le même bouchon).
- `src/matiere/` : **le moteur, sans écran.** `bouchon.ts` fabrique un bouchon à partir d'un numéro de tirage ; `moteur.ts` applique les règles (liens qui cassent au pic, colle du fond qui s'use sous tension modérée, colle du tour, spatule, pince, repli, paroi) ; `parametres.ts` traduit les réglages pour le moteur.
- `src/jeu/` : l'écran de jeu. `ecran.ts` (disposition), `commande.ts` (pavé tactile), `dessin.ts` (formes grises), `peau.ts` (rougeurs et sursaut).
- `src/pages/` : page de lancement, page du bouchon (`jeu.ts`), page de test vibration et son.
- `src/sensations/` : couche vibration (remplaçable par Capacitor), couche son, motifs de rythme.
- `tests/` : tests automatiques (`npm test`). `tests/outils/doigt-simule.ts` = le doigt simulé.
- `.github/workflows/publier.yml` : à chaque envoi sur `main`, tests, puis construction et mise en ligne.
- Outils : Vite 8, TypeScript 7, Vitest 5, vite-plugin-pwa 2. Pas de PixiJS (dessin Canvas 2D).
- La page de jeu expose `window.satisfapp` (simulation en cours) pour les vérifications automatiques.

## Historique

### 2026-11-16 — Lot 2 validé
- Cyril confirme au doigt les deux critères du lot 2.

### 2026-11-16 — Spatule confirmée au doigt
- Cyril : la spatule marche (en partant d'une encoche claire). Restent à confirmer les deux critères du lot 2.

### 2026-11-16 — Retour de Cyril sur le lot 2
- « La spatule ne fait rien » : vérifié par le vrai chemin du pouce, elle agit, mais seulement à portée d'un point d'entrée, sans aucun signe visible. Corrections : portée 0,07 → 0,1 ; points d'entrée 3 → 4 points ; colle du tour 0,12 → 0,06 ; **la matière pâlit progressivement à mesure que sa colle s'use** (7 nuances de gris), pour voir la spatule travailler.
- « Je n'aime pas que ça casse en fil » : nouvelle règle **cassure nette** par défaut (un lien qui ne borde plus aucune surface casse aussi). Réglage « En se déchirant, la cire laisse des fils » (coupé), à rallumer pour la variante chewing-gum.
- 47 tests.

### 2026-11-16 — Lot 2 construit (spatule et paroi)
- Bouchon : tour collé à la paroi, 2 points d'entrée de 3 points. Spatule et pince au choix (deux boutons sous la vue). Repli en sac. Paroi sensible avec vibration, sursaut et rougeur.
- 45 tests automatiques (dont tour, spatule, repli, paroi).

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
