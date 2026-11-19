# Satisfapp : consignes pour Claude Code

## Ce qu'est l'app

Une app mobile (PWA) gratuite, sans pub, qui fait monter une tension puis la libère, pensée d'abord pour les personnes autistes. La V1 a trois mini-jeux : le bouchon (décollement), l'eau, la pression. Lire `docs/Vision.md` avant tout travail de fond.

## Par où commencer

1. Lire `JOURNAL.md` : chaque session repart de là. Le plus récent est en haut.
2. Lire le cahier des charges du mini-jeu concerné dans `docs/`.

## Technique

- TypeScript, Vite (avec `vite-plugin-pwa`), tests avec Vitest. Node 24.
- Commandes : `npm ci`, `npm test`, `npm run build`, `npm run dev`, `npm run preview`.
- Code dans `src/` (dossiers `eau`, `jeu`, `matiere`, `pages`, `reglages`, `sensations`), tests dans `tests/`.
- Les chemins de l'app sont relatifs (`base: './'`) pour qu'elle marche à n'importe quelle adresse (GitHub Pages aujourd'hui, le site de La Compagnie du Rétablissement plus tard).
- La mise en ligne est automatique à chaque envoi sur `main`, et seulement si les tests passent. Ne pas modifier `.github/workflows/publier.yml` sans demander.

## Façon de travailler avec Cyril

- Cyril ne code pas : expliquer simplement, sans jargon, et dire ce qui a été fait en une ou deux phrases.
- Le travail est découpé en lots, chacun avec un critère que Cyril peut ressentir ou vérifier. Un lot n'est « validé » que quand Cyril l'a dit. Ne pas le déclarer validé de ton côté.
- Après chaque lot : mettre à jour `JOURNAL.md` (état actuel en haut), faire passer les tests, committer.
- Ce que Cyril doit essayer au doigt (essais en situation réelle) est mené par lui, pas simulé.

## À ne jamais faire

- Ajouter de la publicité, du suivi des utilisateurs ou une collecte de données : l'app n'en a pas, par principe.
- Mettre une clé, un mot de passe ou une donnée personnelle dans le dossier.
- Supprimer un fichier directement : ce qu'on ne garde pas va dans un dossier `_A_SUPPRIMER_AAAA-MM-JJ` que Cyril vide lui-même.
