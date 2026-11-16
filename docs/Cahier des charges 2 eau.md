# Cahier des charges 2 : l'eau

Nov 16, 2026 · @Cyril

Ce deuxième mini-jeu fait tracer au doigt des petites routes que l'eau suit, sur un égouttoir en inox, jusqu'à vider toutes les flaques dans l'évier. Il est réussi quand Cyril retrouve sous son doigt la sensation de son propre évier.

## Périmètre

Un égouttoir, de l'eau, un doigt. Aucun outil.

**Dans ce lot**

- Un égouttoir en inox vu du dessus, en légère pente vers l'évier, avec plusieurs flaques d'eau stagnante.
- Le doigt comme seul outil : il trace des routes que l'eau suit.
- Des flaques qui se rejoignent et s'écoulent l'une dans l'autre.
- Un rebord où l'eau s'accumule en goutte bombée, puis se libère d'un toucher.
- La vibration et le son qui suivent l'eau.
- Le vase qui garde l'eau libérée.
- Les curseurs de l'eau dans le panneau de réglages.
- Une disposition de flaques différente à chaque partie.

**Hors de ce lot**

- La vitre, la feuille et les autres surfaces. Elles sont prévues comme variantes.
- Les rainures de l'égouttoir, la vaisselle, le robinet.
- Le scénario pression.

**Repris du mini-jeu 1, sans le refaire**

- L'app installable et son dépôt GitHub.
- Les couches de vibration, de son et de sauvegarde.
- Le panneau de réglages et ses quatre actions.

Ce mini-jeu se construit après la validation du décollement, comme le prévoit la feuille de route.

## La séquence de référence

Le joueur doit revivre ces neuf étapes. Elles viennent des descriptions de Cyril, pas encore de captures : les vidéos de son propre évier les préciseront.

1. **L'égouttoir au repos.** Plusieurs petites flaques immobiles sur l'inox. Laissées seules, elles ne bougent pas.
2. **Partir d'une flaque.** On pose le doigt dans une flaque et on le fait glisser sur l'inox sec.
3. **La route se crée.** Le doigt laisse une trace mouillée. L'eau s'y engage, avec un léger retard.
4. **La route s'élargit.** Plus l'eau y passe, plus la route devient large.
5. **Deux flaques se rejoignent.** La route atteint une autre flaque. Les deux s'écoulent l'une dans l'autre.
6. **Plusieurs chemins vers le rebord.** On relie les flaques entre elles, puis on mène toute l'eau vers le bord de l'évier.
7. **La goutte gonfle.** Au rebord, l'eau s'accumule et forme une goutte bombée.
8. **Le toucher.** On appuie légèrement sur la goutte, au bord. L'eau suit le doigt, la bulle se dégonfle et s'écoule le long de la paroi.
9. **L'inox vidé.** Il reste quelques gouttelettes à aller chercher.

Le plaisir principal est dans les étapes 2 à 6 : tracer des routes et voir l'eau les suivre. Le rebord est la conclusion, pas le cœur du jeu.

&#91;embedded content: boucle de jeu · 4 étapes, 1 décision, 1 retour\]

On répète la ligne du haut pour chaque flaque. Quand toute l'eau est arrivée au rebord, un toucher libère la goutte.

## L'écran et le geste

Le doigt touche directement l'eau, comme sur un vrai évier. C'est la grande différence avec le décollement, où l'on tient un outil à distance.

- **Toucher direct.** Pas de pavé tactile, pas d'outil. Le doigt cache un peu l'eau sous lui, comme en vrai.
- **L'égouttoir occupe presque tout l'écran**, vu du dessus. La pente descend vers le bas de l'écran.
- **Le rebord traverse le bas de l'écran.** Dessous, on voit la paroi de l'évier, où l'eau ruisselle à la fin.
- **Le vase** est dans un coin, toujours visible.
- **Un seul doigt à la fois.**
- **La vitesse compte.** Un geste lent trace une route continue. Un geste trop rapide la coupe en gouttelettes.
- **La pression ne compte pas.** L'écran ne la mesure pas.

&#91;embedded content: schéma de l'écran · égouttoir, rebord, paroi\]

Le cercle en pointillés représente le doigt en train de tracer une route entre deux flaques.

## Les règles de l'eau

La règle centrale : **l'eau ne va que là où le doigt lui a ouvert un chemin, et elle descend.** Sur l'inox sec, elle reste en flaque. Sur une trace mouillée, elle coule.

**Ce qui tient**

- **La flaque tient.** Sur l'inox sec, l'eau est retenue par son bord. Elle garde sa forme arrondie et ne s'étale pas.
- **Rien ne se perd.** La quantité d'eau ne change jamais, sauf ce qui part dans l'évier.

**Ce qui coule**

- **Le doigt mouille.** Là où il passe, l'inox reste mouillé quelques secondes. C'est la route.
- **Le doigt entraîne un peu d'eau.** En sortant d'une flaque, il tire un filet derrière lui.
- **L'eau suit la route.** Elle s'y engage après une courte hésitation, puis avance.
- **La route s'élargit avec le débit.** Un filet reste fin. Un vrai écoulement creuse une route large.
- **L'eau descend.** Elle suit la pente. Une route qui remonte se mouille, mais ne se remplit pas.
- **Les flaques se rejoignent.** Quand une route relie deux flaques, la plus haute se vide dans la plus basse.

**Ce qui résiste**

- **La route sèche.** Si l'eau ne la suit pas, la trace disparaît en quelques secondes.
- **La route se coupe.** Si le doigt va trop vite, la trace se brise en gouttelettes isolées. Il faut repartir d'une flaque.
- **Une petite flaque ne va pas loin.** Elle s'épuise en mouillant sa route. Il faut d'abord rassembler l'eau.

Ces résistances sont la tension de ce mini-jeu. Elles jouent le rôle de la cire qui se déchire dans le décollement : rien n'est perdu, on y retourne.

Ces règles ne changent pas pendant une partie. À gestes identiques, résultat identique.

## Les signaux

On doit sentir l'eau couler même sans regarder : le débit s'entend et vibre.

| Moment | Ce qu'on voit | Ce qu'on entend | Ce qu'on sent |
| --- | --- | --- | --- |
| Doigt sur l'inox sec | Une trace mate et mouillée | Un frottement très doux | Rien |
| Doigt dans l'eau | L'eau se creuse et suit le doigt | Un clapotis léger | Un frémissement léger |
| L'eau s'engage dans une route | Un filet avance, la route s'élargit | Un petit ruissellement | Des pulsations fines, au rythme du débit |
| Deux flaques se rejoignent | Un pont se forme et s'élargit, les niveaux s'égalisent | Un « plop », puis un écoulement | Un coup bref, puis des pulsations qui ralentissent |
| La route se coupe | La trace se brise en gouttelettes | Presque rien | Rien |
| La goutte du rebord gonfle | Elle bombe, brille, tremble légèrement | Le silence | Des pulsations qui se rapprochent |
| Le toucher final | La goutte se dégonfle, l'eau file le long de la paroi | Un ruissellement ample qui s'éteint, puis une dernière goutte | Arrêt net, puis une longue vibration douce qui décroît |

Le crissement d'un doigt sur l'inox sec peut être désagréable. Ce son est très doux par défaut et peut être coupé.

## Le rebord, la libération, la collecte et la fin

Le rebord retient l'eau jusqu'au toucher du doigt. C'est la seule grande décharge de la partie.

- **Le rebord retient.** L'eau qui arrive au bord s'y accumule en goutte bombée. Plus on en amène, plus elle gonfle.
- **Plusieurs gouttes.** Chaque route qui arrive au rebord forme sa goutte. Deux gouttes voisines fusionnent.
- **Le trop-plein.** Une goutte qui dépasse sa limite déborde seule, en mince filet. Rien n'est perdu, mais la grande coulée est manquée.
- **Le toucher.** Un appui léger sur la goutte, puis un glissement vers la paroi. L'eau suit le doigt et toute la goutte se vide.
- **La paroi.** On voit l'eau descendre le long de la paroi de l'évier, jusqu'en bas de l'écran.
- **Le vase.** Il reçoit l'eau libérée. La plus grosse coulée d'un seul toucher est mise en avant.
- **Les finitions.** Les gouttelettes restantes se rassemblent et se mènent au rebord de la même façon.
- **La fin.** Inox vide, silence, puis un seul bouton : nouvel évier. Pas de note, pas d'étoiles.
- **La reprise.** Si on quitte en cours de partie, on retrouve l'évier dans le même état.

## Le panneau de réglages

Le mini-jeu ajoute ses propres curseurs au panneau existant. Aucun réglage de sensation ne reste caché dans le code.

| Curseur | Ce qu'il change |
| --- | --- |
| Pente | La vitesse à laquelle l'eau descend |
| Accroche de l'eau | La facilité avec laquelle une flaque reste en place sur l'inox sec |
| Durée d'une trace | Le temps avant qu'une route non suivie sèche |
| Largeur du doigt | La largeur de la trace |
| Eau entraînée | La quantité d'eau que le doigt tire derrière lui |
| Vitesse limite | La vitesse du doigt au-delà de laquelle la route se coupe |
| Hésitation | Le délai avant que l'eau s'engage dans une route |
| Fluidité | La vitesse d'écoulement dans une route |
| Élargissement | La vitesse à laquelle le débit élargit la route |
| Flaques | Leur nombre, leur taille, leur écart |
| Capacité du rebord | La quantité d'eau retenue avant le trop-plein |
| Vibration | Les seuils et les rythmes des pulsations |
| Sons | Le volume de chaque famille de sons |

Les quatre actions du panneau restent les mêmes : ouvrir par un geste caché, enregistrer comme variante, copier le réglage, rejouer le même évier.

## Variantes déjà prévues

Ce lot construit la première. Les autres réutilisent le moteur de l'eau, avec d'autres réglages et quelques ajouts.

| Variante | Ce qui la caractérise | Ajout nécessaire |
| --- | --- | --- |
| L'égouttoir en inox (ce lot) | Surface presque plate, flaques immobiles, rebord qui retient. | Aucun |
| La vitre sous la pluie | Surface verticale. Les gouttes tiennent, puis dévalent quand elles grossissent. Le doigt les relie. | Une pente forte, des gouttes qui arrivent par le haut |
| La feuille | Surface qui repousse l'eau. Elle reste en perles rondes qui roulent, guidées par les nervures. | Des perles qui roulent, un relief |
| Un autre évier | Un égouttoir à rainures, ou une autre matière. | Un relief en rainures |

Le code doit donc prévoir, sans les construire, une pente réglable jusqu'à la verticale et une carte de relief.

## Recommandations techniques

Ce sont des recommandations, pas des obligations. Opus peut proposer mieux, en expliquant pourquoi avant de changer.

- **Réutiliser le socle.** Même app, même panneau, mêmes couches de vibration, de son et de sauvegarde. Seul le moteur de l'eau est nouveau.
- **Deux moteurs séparés.** Le moteur de l'eau ne dépend pas de celui du décollement. Chacun peut évoluer sans casser l'autre.
- **Une grille vue du dessus.** Chaque case connaît sa hauteur d'eau et son état, sec ou mouillé. L'eau passe d'une case à l'autre selon la pente et les différences de hauteur.
- **L'accroche.** L'eau n'entre dans une case sèche que si elle dépasse un seuil. C'est ce seuil qui fait tenir les flaques et le rebord.
- **Une tension de surface approchée.** Pas de calcul physique exact. Un lissage qui arrondit les bords suffit pour l'effet.
- **La conservation.** Un test automatique vérifie en permanence que le volume total ne change pas.
- **L'affichage.** L'eau est dessinée à partir de sa hauteur : bords brillants, reflets, inox visible au travers.
- **La fluidité.** 60 images par seconde sur un téléphone Android de milieu de gamme. Commencer par un calcul simple, et ne le déplacer sur la carte graphique que si la fluidité l'exige.
- **Évier reproductible.** Chaque disposition naît d'un numéro de tirage. Le même numéro redonne le même évier.
- **Tests automatiques au doigt simulé.** Une flaque seule ne bouge pas. Un tracé lent relie deux flaques. Un tracé rapide coupe la route. Le volume est conservé.

Le point le plus risqué est le réalisme du mouvement de l'eau. Il se joue au lot 1, en formes grises, avant tout habillage.

## Lots de construction

Sept lots, dans cet ordre. Opus s'arrête à la fin de chacun et attend le retour de Cyril. Les lots 1 à 3 se jouent en formes grises.

| Lot | Contenu | Validé quand |
| --- | --- | --- |
| 0. Raccord au socle | Un nouvel écran dans l'app existante. Les curseurs de l'eau, encore sans effet. | On passe du décollement à l'eau depuis l'écran de choix. Le décollement fonctionne toujours. |
| 1. L'eau brute | Des flaques grises qui tiennent. Le doigt qui trace. L'eau qui suit. Deux flaques qui se rejoignent. | Un tracé lent relie deux flaques. Un tracé trop rapide coupe la route. Cyril reconnaît la route qui s'élargit. |
| 2. La pente et le rebord | L'écoulement vers le bas. La goutte bombée. Le trop-plein. Le toucher final et la paroi. | Toute l'eau peut être menée au rebord. La goutte tient jusqu'au toucher, puis se vide d'un coup. |
| 3. L'eau qui se sent | Vibration et sons. | Cyril sent une flaque se vider dans une autre les yeux fermés. |
| 4. Habillage | Inox brossé, eau transparente, reflets, traces mates. | L'écran rappelle un vrai égouttoir mouillé. |
| 5. Collecte et fin | Vase, fin de partie, nouvel évier, sauvegarde. | Une partie complète s'enchaîne sans bouton inutile. |
| 6. Test réel | Dix minutes en salle d'attente. Réglages finaux. Enregistrement de la variante de base. | Cyril retrouve la sensation de son évier et n'a pas envie d'arrêter. |

Le lot 1 est le plus long et le plus important. Si l'eau grise ne suit pas le doigt de façon crédible, aucun reflet ne la sauvera.

## Critères de réussite

Le lot est réussi quand Cyril retrouve son évier sous son doigt. Les chiffres ci-dessous sont des valeurs de départ, à ajuster au panneau de réglages.

**La route**

- Une flaque laissée seule ne bouge pas, même après une minute.
- L'eau s'engage dans la route avec un léger retard visible, puis la route s'élargit.
- Un tracé lent donne toujours une route continue. Un tracé trop rapide la coupe toujours. Entre les deux, la limite se sent.

**La rencontre**

- Deux flaques reliées s'égalisent en 1 à 3 secondes.
- La plus haute se vide dans la plus basse, jamais l'inverse.
- Le moment où le pont se forme se remarque : un son, un coup bref.

**La libération**

- La goutte du rebord tient tant qu'on ne la touche pas, sauf trop-plein.
- Un toucher la vide entièrement, en 1 à 3 secondes.
- On voit l'eau descendre le long de la paroi jusqu'au bout.

**Le confort**

- Une partie dure entre 2 et 6 minutes.
- Aucune eau n'apparaît ni ne disparaît.
- Aucune flaque piégée : toute l'eau peut toujours être menée au rebord.
- Aucune publicité, aucun compte, aucun message qui interrompt le geste.

**Le test final**

- Dix minutes en salle d'attente. Cyril retrouve la sensation de son évier et n'a pas envie d'arrêter.

## Hypothèses à confirmer

Ces choix ne viennent pas de Cyril. Ils ont été posés pour avancer, et chacun peut être corrigé avant le lot concerné.

- [ ] **La vue.** L'égouttoir est vu du dessus. La pente descend vers le bas de l'écran. Le rebord est en bas, la paroi de l'évier visible dessous.
- [ ] **Le toucher direct**, sans pavé tactile. Le doigt cache un peu l'eau, comme en vrai.
- [ ] **Un seul doigt** à la fois.
- [ ] **La route sèche** en quelques secondes si l'eau ne la suit pas.
- [ ] **La vitesse coupe la route.** Trop rapide, la trace se brise en gouttelettes.
- [ ] **L'eau ne remonte jamais** la pente.
- [ ] **Une surface lisse**, sans les rainures d'un vrai égouttoir.
- [ ] **Le trop-plein.** Une goutte trop grosse déborde seule, en mince filet.
- [ ] **Le vase** met en avant la plus grosse coulée, sans chiffre ni record.
- [ ] **Le son du doigt sur l'inox sec** est très doux par défaut.
- [ ] **Les durées** des critères de réussite : 1 à 3 secondes, 2 à 6 minutes.

## Message de lancement pour Claude Code

À coller dans Claude Code, avec Opus 5.5, une fois le décollement validé.

Avant de le coller :

1. Exporter cet onglet en Markdown et le placer dans le dossier `docs` du projet, sous le nom `CDC-2-eau.md`.
2. Filmer son propre évier : une route tracée entre deux flaques, la goutte au rebord, le toucher final. Placer ces courtes vidéos dans `docs/references`.
3. Cocher ou corriger les hypothèses de la section précédente.

```text
On passe au deuxième mini-jeu de Satisfapp : « Faire couler ». On trace au doigt des petites routes que l'eau suit, sur un égouttoir en inox, jusqu'à vider toutes les flaques dans l'évier.

Lis en entier docs/CDC-2-eau.md, puis relis docs/VISION.md et JOURNAL.md. Le cahier des charges fait autorité. En cas de doute ou de contradiction, pose-moi la question au lieu de deviner. Si le dossier docs/references contient des vidéos de mon évier, extrais-en des images pour t'en servir de référence.

Ce qui ne change pas :
- Je ne code pas. Explique-moi chaque étape en français simple.
- Avance lot par lot, dans l'ordre. Arrête-toi à la fin de chaque lot, dis-moi quoi tester et quoi ressentir, et attends mon retour.
- Tous les réglages de sensation passent par le panneau de réglages, jamais écrits en dur dans le code.
- La sensation passe avant l'apparence : les premiers lots sont en formes grises.
- Vérifie les règles avec des tests automatiques avant de me demander un test au doigt.
- N'ajoute rien qui n'est pas dans le lot en cours.

Ce qui est nouveau :
- Réutilise le socle du mini-jeu 1 : app, vibration, sons, réglages, sauvegarde. Ne le réécris pas. Si un morceau du socle doit changer, dis-le moi avant.
- Le moteur de l'eau est nouveau. Garde-le séparé du moteur du décollement.
- À la fin de chaque lot, vérifie que le mini-jeu 1 fonctionne toujours.

Commence par me résumer en dix lignes ce que tu as compris, puis propose ton plan pour le lot 0.
```

Si le décollement n'est pas encore validé, ce message attend. Les leçons du premier mini-jeu, en particulier sur la vibration, peuvent amener à corriger ce cahier des charges.
