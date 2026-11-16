# Journal de construction — Satisfapp

Chaque session repart d'ici. Le plus récent en haut.

## État actuel

- **Prochaine étape : lot 6 (essai en situation réelle, mené par Cyril lui-même).** Rien à construire avant son retour.
- **Lots 3, 4 et 5 — Tension, habillage, bocal : VALIDÉS** par Cyril le 2026-11-16.
  - [x] Lot 3 : Cyril sent venir la casse les yeux fermés (au doigt simulé : les pulsations commencent plus d'une seconde avant la première déchirure, sur 4 bouchons).
  - [x] Lot 4 : l'écran rappelle les captures de référence, sans paraître sale ni choquant.
  - [x] Lot 5 : une partie complète s'enchaîne sans bouton inutile.
- **Lot 2 — Spatule et paroi : VALIDÉ** par Cyril le 2026-11-16.
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

### Choix faits pendant les lots 3 à 5 (à faire valider par Cyril)
- **La tension ressentie** = l'étirement du lien le plus tendu rapporté à sa limite, seulement quand la pince tient franchement de la matière décollée.
- **Vibration :** pulsations de durée fixe (110 ms, au-dessus du seuil senti par Cyril) ; c'est la **pause** qui raccourcit avec la tension (650 → 70 ms). Elles commencent à 25 % de tension.
- **Rupture** = au moins un lien qui casse pendant que le doigt est posé : arrêt net, claquement, silence, puis un coup bref (140 ms) ; reprise après 0,7 s.
- **Grande sortie** = un morceau d'au moins 35 % du bouchon qui sort : arrêt net, décollement ample, silence 0,7 s, puis une longue vibration (800 ms). La vibration web ne sait pas être « douce » : c'est une vibration longue.
- **Sons fabriqués par le code :** frottement doux (bruit filtré continu), craquements (salves courtes, plus aiguës et rapprochées quand la tension monte), claquement, décollement (glissement qui descend), tic de spatule, clic de pince. Un volume par famille.
- **Blanchiment :** la cire pâlit vers le crème au-delà de 55 % de son étirement maximal (les zones faibles blanchissent donc plus tôt : c'est ainsi qu'on les devine).
- **Habillage :** peau rosée sur la paroi, fond sombre au milieu, cire ambre (collée) à miel (décollée), un peu translucide, bord plus sombre, reflet central de la lumière de la caméra et quelques points humides, vignettage sombre de l'endoscope, outils métalliques. La peau dégagée s'éclaircit en 2,5 s.
- **Sortie :** le morceau grossit (+25 %) en 0,35 s, puis file vers le bocal en 0,55 s.
- **Bocal :** icône en haut à gauche (un pot qui se remplit). Ouvert : le plus gros morceau en grand sur un halo, les autres du plus gros au plus petit, à la même échelle, sans aucun chiffre. « Vider le bocal » demande une confirmation. 100 morceaux au plus (on oublie le plus petit, jamais le plus gros).
- **Fin :** conduit vide → silence, puis « Nouveau bouchon » après 1,5 s de calme.
- **Reprise :** la partie est sauvée toutes les 2 s, à chaque morceau sorti et quand on quitte ; on la retrouve à la réouverture (même terminée).
- La flèche de retour est passée en bas à gauche (le bocal a pris le coin en haut à gauche).
- Un point du tour au bord d'un trou compte comme « à côté d'un bord libre » (sinon il pouvait rester impossible à décoller).

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
- `src/jeu/` : l'écran de jeu. `ecran.ts` (disposition), `commande.ts` (pavé tactile), `dessin.ts` (habillage), `peau.ts` (rougeurs et sursaut), `bocal.ts` (bocal), `sortie.ts` (morceaux qui volent vers le bocal), `sauvegarde.ts` (reprise de partie).
- `src/pages/` : page de lancement, page du bouchon (`jeu.ts`), page de test vibration et son.
- `src/sensations/` : couche vibration (remplaçable par Capacitor), `tension.ts` (pilote : pulsations, craquements, silences), `sons-matiere.ts` (sons fabriqués), `parametres-sensations.ts`, motifs de rythme du lot 0.
- `tests/` : tests automatiques (`npm test`). `tests/outils/doigt-simule.ts` = le doigt simulé.
- `.github/workflows/publier.yml` : à chaque envoi sur `main`, tests, puis construction et mise en ligne.
- Outils : Vite 8, TypeScript 7, Vitest 5, vite-plugin-pwa 2. Pas de PixiJS (dessin Canvas 2D).
- La page de jeu expose `window.satisfapp` (simulation en cours) pour les vérifications automatiques.

## Historique

### 2026-11-16 — Panneau : défiler ne change plus les réglages
- Retour de Cyril : en faisant défiler le panneau, le doigt modifiait les curseurs. Désormais un geste vertical fait défiler la liste ; seul un glissement nettement horizontal règle, et la valeur part de là où elle était (elle ne saute plus sous le doigt). Règle dans src/reglages/glisse.ts. 67 tests.
- En attente : accord de Cyril pour passer le dessin en WebGL (cire lisse en relief, peau d'oreille réaliste).

### 2026-11-16 — Lots 3, 4 et 5 validés
- Cyril : « Oui, tout validé ». Il reste le lot 6, qu'il mène lui-même.

### 2026-11-16 — Retours de Cyril sur les lots 3 à 5
- « Ça s'effrite, trop de matière disparaît » : à chaque déchirure, les triangles abîmés n'étaient plus dessinés (une bande de cire disparaissait à l'écran). Désormais chaque point de matière est aussi dessiné comme un petit disque : la cire reste visible des deux côtés d'une déchirure, et les miettes se voient. Zones faibles moins fragiles (30 → 45 %), cire plus régulière (15 → 10 %).
- « C'est trop long pour retirer la partie une fois décollée » : un gros morceau libre tiré par un ressort de pince faible mettait jusqu'à 8 s à suivre un pouce immobile. **Un morceau qui ne tient plus à rien suit maintenant la pince d'un bloc** (retard réglable, 60 ms).
- « La spatule doit s'enfoncer plus profond, décoller plus que le bord ; de vrais niveaux d'adhérence » : **changement de règle demandé par Cyril** (le cahier des charges disait que la spatule ne décolle pas le fond). La spatule s'enfonce sous la cire de proche en proche depuis ce qui est libre ou affaibli, et **affaiblit la colle du fond jusqu'à 20 %** (réglable ; 0 = elle décolle tout). La pince tient franchement la cire dont la colle est sous 50 %. Le fond a donc des niveaux : pleine colle → affaiblie à la spatule → lâchée en tirant à la pince. Un petit tic plus doux quand un point atteint le plancher.
- 63 tests.
- **Retour de Cyril après essai : « Oui, c'est mieux. »** Ces changements vont dans le bon sens ; réglages gardés tels quels. Les critères des lots 3 à 5 restent à confirmer.

### 2026-11-16 — Lots 3, 4 et 5 construits d'une traite
- Cyril demande d'enchaîner les lots 3, 4 et 5 sans s'arrêter entre eux.
- Lot 3 : pilote de tension, sons fabriqués, blanchiment, tics de spatule. Lot 4 : habillage complet. Lot 5 : sortie animée, bocal permanent, fin de partie, sauvegarde et reprise.
- ~64 réglages au panneau. 60 tests automatiques.

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
- **Autres instruments** (demande de Cyril, 2026-11-16, « pour plus tard ») : coton-tige, aspirateur d'oreille (l'aspirateur est déjà prévu au cahier des charges avec les variantes : il tire la cire molle et ramasse les miettes).
