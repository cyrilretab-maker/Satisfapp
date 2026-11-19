# Satisfapp

App mobile gratuite et sans pub qui fait une seule chose : faire monter une tension, puis la libérer. Elle s'adresse d'abord aux personnes autistes qui se régulent par des gestes fins et répétitifs.

La V1 contient trois mini-jeux, construits dans cet ordre : le décollement (le bouchon), l'eau, la pression.

## Ce que contient ce dossier

- `src/` : le code de l'app (TypeScript).
- `tests/` : les tests automatiques.
- `docs/` : la vision et un cahier des charges par mini-jeu.
- `JOURNAL.md` : l'état du projet, session après session. C'est le premier fichier à lire pour reprendre.
- `CLAUDE.md` : les consignes pour Claude Code (ou une autre IA) qui travaille sur l'app.
- `REPRISE.md` : comment réinstaller l'app sur un PC neuf.
- `.github/workflows/publier.yml` : la mise en ligne automatique.

## Lancer l'app sur ce PC

Ouvrir un terminal dans ce dossier, puis :

1. `npm install` (une seule fois, ou après un changement de dépendances)
2. `npm run dev`

L'adresse s'affiche dans le terminal. Comme l'app se lance avec `--host`, elle est aussi ouverte aux appareils du même réseau : on peut donc l'essayer au doigt sur un téléphone.

## Où elle est en ligne

Elle est publiée sur GitHub Pages, depuis le dépôt `Satisfapp`, à chaque envoi sur la branche `main`, et seulement si tous les tests passent.

## Ce qui n'est pas dans ce dossier

- `node_modules/` et `dist/` : ils se recréent tout seuls (voir REPRISE.md).
- Aucune donnée personnelle, aucun mot de passe, aucune clé : l'app n'en utilise pas.
