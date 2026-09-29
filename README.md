# DesDés

Plate-forme web (application installable) qui regroupe nos carnets de score de jeux de dés.

![Logo](logo.svg)

## Les carnets

| Jeu | Fichier | Joueurs |
| --- | --- | --- |
| **10 000** : ouverture à 1 000, croix (effacées dès qu'on note des points ou le −500 du 1er lancer), reprises, pénalités ; il faut finir à 10 000 pile, dépasser donne une croix | `jeux/10000.html` | 2 à 15 |
| **Yam's** : feuille de marque classique, bonus à 63 | `jeux/yams.html` | 1 à 10 |

La page d'accueil (`index.html`) permet de choisir un carnet et indique si une partie est en cours (qui mène, à qui c'est le tour).
Chaque partie est enregistrée dans le navigateur de l'appareil : on peut quitter un jeu et le reprendre plus tard.

## Plateau de dés

Si on a oublié les dés, le bouton rouge **Dés** de chaque carnet ouvre un tapis avec 5 dés : on les lance en glissant le doigt sur le tapis (ou avec le bouton *Lancer*), et on touche un dé pour le garder.

- **Yam's** : 3 lancers au plus par tour ; on garde ou reprend les dés de son choix entre deux lancers.
  Après chaque lancer, le plateau reconnaît les figures (brelan, full, suites, Yam's…) et propose les cases libres du joueur avec leurs points ; un toucher note le score dans la feuille. On peut aussi rayer une case.
- **10 000** : lancers sans limite ; il faut mettre de côté au moins un dé qui rapporte avant de relancer (bouton pour mettre de côté tout ce qui compte). Les points passent dans le tour du carnet à chaque relance, et « Garder les points » les inscrit.
  - Si tous les dés lancés rapportent, les points sont ajoutés et la relance des 5 dés est obligatoire.
  - Si les 2 derniers dés font un double (2, 3, 4 ou 6), relance obligatoire des 5 dés, sans points. Un double 1 ou 5 rapporte ses points, puis relance des 5.
  - Si aucun dé ne rapporte, le plateau propose de noter le raté.
  - Quand un joueur reprend les points du précédent, il ne lance que les dés que celui-ci avait laissés (par exemple 2 dés pour 2 700 points gardés avec 2 dés restants). Il doit lancer et marquer des points avant de pouvoir garder : on ne peut pas reprendre un score et le noter sans jouer (règle appliquée aussi dans le carnet).

Les dés ne se chevauchent jamais sur le tapis : après chaque lancer, ceux qui se touchent sont légèrement écartés.

Le plateau repart de zéro dès qu'un score est noté dans le carnet. Le code est dans `jeux/plateau.js`, partagé par les deux jeux.

## Mise en ligne

Le site est fait de fichiers statiques, sans installation ni compilation.
Avec GitHub Pages : *Settings → Pages → Deploy from a branch*, choisir la branche `main` et le dossier `/ (root)`.

Pour l'installer sur un téléphone : ouvrir le site, puis *Partager → Sur l'écran d'accueil* (iPhone) ou *Installer l'application* (Android).
Une fois ouvert une première fois, il fonctionne aussi sans réseau.

## Ajouter un jeu

1. Déposer le carnet dans `jeux/` (un fichier HTML autonome).
2. Y ajouter le lien de retour `<a class="home" href="../index.html">…</a>` et les balises du manifeste, comme dans les deux carnets existants.
3. Ajouter sa carte dans `index.html`.
4. Ajouter le fichier à la liste `SHELL` de `sw.js` et changer `VERSION` pour que les téléphones récupèrent la mise à jour.

## Fichiers

```
index.html             accueil : choix du jeu
jeux/10000.html        carnet du 10 000
jeux/yams.html         feuille de Yam's
jeux/plateau.js        plateau de 5 dés à lancer, commun aux deux jeux
logo.svg               logo (source vectorielle)
icons/                 icônes de l'application (192, 512, masquable, Apple)
manifest.webmanifest   description de l'application installable
sw.js                  fonctionnement hors ligne
```
