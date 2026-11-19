# Reprendre Satisfapp sur un PC neuf

À suivre dans l'ordre. Si tout se passe bien, l'app tourne en dix minutes.

## 1. Ce qu'il faut installer

- **Node.js 24** (c'est la version utilisée par la mise en ligne automatique, donc connue pour fonctionner). Il apporte `npm`.
- **Git**.

## 2. Récupérer le dossier

Deux sources possibles, dans cet ordre :

1. Le dépôt GitHub `Satisfapp` (compte `cyrilretab-maker`) : `git clone https://github.com/cyrilretab-maker/Satisfapp.git`
2. À défaut, la copie de sauvegarde sur le disque K: (dossier SAUVEGARDE-APPS), ou le fichier `.bundle` dans K:\BUNDLES : `git clone Satisfapp_AAAA-MM-JJ.bundle Satisfapp`

## 3. Réinstaller

Dans le dossier de l'app :

1. `npm ci` : recrée `node_modules` à partir de `package-lock.json`, avec exactement les mêmes versions.
2. `npm test` : doit afficher que tous les tests passent.
3. `npm run build` : fabrique `dist/`.
4. `npm run dev` : lance l'app pour l'essayer.

Si `npm test` ou `npm run build` échoue, ne rien modifier : vérifier d'abord la version de Node (`node -v` doit commencer par 24).

## 4. Remettre la mise en ligne

La mise en ligne est automatique : un envoi (`git push`) sur la branche `main` lance les tests, la construction, puis la publication sur GitHub Pages (réglage : Settings, puis Pages, source « GitHub Actions »). Rien d'autre à configurer, il n'y a aucune clé.

## 5. Si l'accès à Claude est perdu

Tout le savoir du projet est dans le dossier :

- `JOURNAL.md` : l'état et l'historique de la construction.
- `docs/Vision.md` et les trois cahiers des charges : le but et les règles de chaque mini-jeu.
- `CLAUDE.md` : les consignes à donner à n'importe quelle IA qui reprendrait le travail.

## Ce qu'on ne trouve pas ici

Pas de clé, pas de mot de passe, pas de donnée : l'app n'en a pas besoin.
