# DesDés

Plate-forme web (application installable) qui regroupe nos carnets de score de jeux de dés, un quiz de géographie, une course à dessiner et un jeu de neige de culture en 3D.

![Logo](logo.svg)

## Les carnets

| Jeu | Fichier | Joueurs |
| --- | --- | --- |
| **10 000** : ouverture à 1 000, croix (effacées dès qu'on note des points ou le −500 du 1er lancer), reprises, pénalités ; il faut finir à 10 000 pile, dépasser donne une croix, et on ne peut pas reprendre des points qui mèneraient à 10 000 ou plus | `jeux/10000.html` | 2 à 15 |
| **Yam's** : feuille de marque classique, bonus à 63 | `jeux/yams.html` | 1 à 10 |
| **Géographie** : drapeaux et cartes (pays, régions et départements français, États américains), défi du jour, chrono, records et statistiques | `jeux/geo.html` | 1 |
| **Draw Race** : course de monoplaces dont on dessine la trajectoire, 10 circuits inspirés de la F1 | `jeux/drawrace.html` | 1 à 4 (+ adversaires) |
| **Nivoculteur** : construire et faire tourner le réseau de neige de culture d'une station, en 3D (en construction) | `jeux/nivoculteur/index.html` | 1 |

La page d'accueil (`index.html`) permet de choisir un carnet et indique si une partie est en cours (qui mène, à qui c'est le tour).
Chaque partie est enregistrée dans le navigateur de l'appareil : on peut quitter un jeu et le reprendre plus tard.

### Sauvegarde dans un fichier

Une page web ne peut pas écrire seule dans les fichiers du téléphone. Le bloc **Sauvegarde dans mes fichiers** (accueil, Géographie, réglages du Yam's, bas du carnet du 10 000) a deux boutons :

- **Exporter** crée un fichier `desdes-sauvegarde-AAAA-MM-JJ.json` avec toutes les parties, records et statistiques. Sur iPhone, le partage s'ouvre : choisir *Enregistrer dans Fichiers*. Ailleurs, le fichier est téléchargé.
- **Importer** recharge un fichier exporté, après confirmation : les données de l'appareil sont remplacées.

Le code est dans `jeux/sauvegarde.js`.

### Yam's

- Une case rayée est barrée d'une seule barre oblique.
- Les cases qui restent à remplir sont teintées. La colonne du joueur qui doit jouer est plus marquée et son nom est souligné.
- La ligne des noms reste visible quand on fait défiler la feuille.
- Le bouton **Réglages** permet de :
  - cacher les totaux (ils réapparaissent à la fin de la partie) ;
  - choisir la couleur du carton (Classique, Vieux papier, Ardoise, Menthe, Nuit) ;
  - faire d'un joueur un robot (facile, moyen ou fort) ;
  - voir les statistiques par joueur (parties, victoires, record, moyenne) ;
  - exporter ou importer la sauvegarde.

### 10 000

- La barre de score est plus épaisse. Toucher un joueur (ou sa barre) ouvre sa **fiche** en plein écran : score en grand, reste à faire, croix, et le bloc du tour pour jouer depuis la fiche.
  Une fois le tour noté, la fiche montre le résultat et un bouton **Joueur suivant**. On peut aussi balayer pour passer d'un joueur à l'autre.
- Le bouton pour reprendre les points du joueur précédent est doré, plus grand et clignote doucement, dans le carnet comme sur le tapis.
- On peut ajouter des robots (facile, moyen, fort) dans la liste des joueurs.
- *Statistiques et sauvegarde* (bas de page) : parties, victoires et score moyen par joueur. *Couleur du carnet* : vert, bordeaux, bleu nuit, bois, ardoise.

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

- **Couleurs** (bouton « 🎨 Couleur du tapis », sous le tapis) : feutre vert, casino, bleu, bois, ardoise avec dés rouges, nuit avec dés noirs. Ce choix est commun aux deux jeux.
- **Conseils** (Yam's, bouton 💡) : après chaque lancer, les dés à garder sont entourés de jaune.
  Le plateau donne aussi les chances de faire chaque figure encore libre (brelan, carré, full, suites, Yam's) à la fin du tour.
  Après le dernier lancer, la case conseillée est marquée d'une étoile.
  Le calcul est exact : il essaie toutes les façons de garder les dés sur les lancers restants. Il tient compte des cases libres du joueur et du bonus de 63.
- **Figure à 5 dés** (10 000) : quand tous les dés lancés rapportent, la figure s'affiche (« Suite ! », « Cinq 3 ! »…) avec ses points pendant 2 s avant que les dés passent de côté.
- **Robot** : à son tour, le plateau s'ouvre et le robot lance les dés lui-même. On voit ce qu'il garde, puis il note son score dans le carnet. *Arrêter le robot* interrompt son tour.
  Les décisions sont dans `jeux/ia.js`. En simulation :
  - au Yam's, un robot fait en moyenne 152 points en facile, 185 en moyen et 198 en fort ;
  - au 10 000, il atteint 10 000 en 39, 36 et 34 tours en moyenne.

Le plateau repart de zéro dès qu'un score est noté dans le carnet. Le code est dans `jeux/plateau.js`, partagé par les deux jeux.

## Géographie

Quatre terrains de jeu :

| Terrain | Éléments | Zones |
| --- | --- | --- |
| Pays du monde | 195 pays : membres de l'ONU, Vatican et Palestine | les continents, ou tous mélangés |
| Régions de France | 18 régions, outre-mer en encarts | — |
| Départements | 101 départements, outre-mer en encarts | toute la France, une région, ou l'outre-mer |
| États-Unis | 50 États, Alaska et Hawaï en encarts | — |

Les jeux proposés :

- **Drapeaux** (pays et États) : un drapeau et quatre noms (pays du même continent) ; il faut trouver le bon.
- **Mélange** (pays et États) : drapeaux et carte en alternance.
- **Numéros** (départements) : le numéro d'un département, ou l'inverse ; les propositions sont des départements voisins.
- On joue **10 ou 20 questions tirées au hasard, ou toutes**.
- **Défi du jour** : 12 questions, les mêmes pour tout le monde ce jour-là (4 drapeaux, 4 pays sur la carte, 2 départements, 2 États).
  Seul le premier essai du jour compte. Le nombre de jours d'affilée est affiché.
- **Statistiques** : parties jouées, pourcentage de réponses justes du premier coup, et une liste **À revoir** des pays et départements les plus souvent ratés (un élément sort de la liste quand on le trouve du premier coup).
- **Carte** : un nom de pays ; il faut le toucher sur la carte (on peut zoomer en pinçant ou avec les boutons, et se déplacer en glissant). Trois essais par pays, puis la réponse s'affiche. Les tout petits pays ont un repère rond pour pouvoir les toucher.

Le chrono tourne pendant toute la partie. Les 5 meilleurs résultats de chaque jeu et de chaque zone sont gardés sur l'appareil (score du premier coup, puis temps).

La carte du monde rattache à leur pays les morceaux que la source sépare : l'Australie avec les îles Ashmore-et-Cartier, le Somaliland avec la Somalie, et Chypre du Nord avec Chypre.
Avant ce correctif, l'Australie était presque invisible et la corne de l'Afrique fausse.

Les données (`jeux/geo/monde.js`, `france.js`, `usa.js`, `drapeaux/` et `drapeaux-us/`) sont produites par `outils/construire-geo.mjs`.
Sources : IGN Admin Express via france-geojson (Licence ouverte), U.S. Census Bureau via us-atlas (domaine public), drapeaux des États us-state-flags (ISC), Natural Earth via world-atlas (domaine public), mledoze/countries via world-countries (licence ODbL), drapeaux flag-icons (licence MIT), noms français du CLDR.

## Draw Race

Le jeu se joue le téléphone à l'horizontale (un message le demande en vertical), pour des pistes plus larges.

1. On choisit le nombre de joueurs (1 à 4, sur le même appareil), la couleur de chaque monoplace, le niveau des adversaires, puis le circuit dans le carrousel (10 circuits inspirés de la F1, difficulté de 1 à 5, de 2 à 5 tours).
2. Chaque joueur dessine ses tours d'affilée, sans lever le doigt, en partant de la ligne à damier (on peut reprendre au bout du trait, ou tout recommencer). La vitesse du doigt devient la vitesse de la voiture : la jauge et la couleur du trait passent du vert (lent) au rouge (rapide). Dans les virages, la voiture ralentit toute seule : pas de dérapage.
3. La course se joue à 4 voitures (les places libres sont prises par des adversaires, qui partent derrière les joueurs). Chaque voiture suit, à chaque tour, le tracé dessiné pour ce tour. Chaque joueur a 3 Boosts (vitesse ×1,4 pendant 1,3 s). On peut abandonner à tout moment (la partie ne compte pas).

Hors piste, la voiture ralentit. Les virages sont bordés de vibreurs rouge et blanc. Les records (5 meilleurs temps et meilleur tour) sont gardés par circuit.
Les circuits sont dans `jeux/drawrace/circuits.js` (points de passage), la géométrie dans `jeux/drawrace/piste.js`.

## Nivoculteur

Jeu 3D (Three.js) sur le métier de nivoculteur : construire le réseau (regards, canons, conduites, câbles) avec un budget, produire la neige la nuit, gagner de l'argent avec la neige tombée sur la piste.
Il est construit étape par étape ; le projet, les règles et l'avancement sont décrits dans `jeux/nivoculteur/CLAUDE.md`.

- La page `jeux/nivoculteur/index.html` charge les scripts du dossier `jeux/nivoculteur/js/` ; le jeu s'ouvre aussi seul, en double-cliquant sur la page, sur un ordinateur (garder le dossier entier).
- `three.min.js` (Three.js 0.149.0, licence MIT) est posé à côté pour jouer sans internet.
- Tous les chiffres réglables (prix, pressions, débits, durées, vent) sont dans `js/config.js` (`CONFIG`, catalogue des enneigeurs et supports), les niveaux dans `js/niveaux.js`.
- Nuits (3 min = 12 h, vitesse ×1 / ×3 / ×10) : « Lancer la nuit » (barre du bas ou poste de travail) fait produire les canons prêts ; le vent déporte la neige, seule la neige tombée sur la piste rapporte ; la retenue se vide. Toucher un regard ouvre sa fiche, à gauche sur grand écran ou en volet du bas sur téléphone, et centre la vue sur le canon (curseurs de direction et d'inclinaison, jauge de pression, remplacement de l'enneigeur). Quand l'objectif est atteint, une dameuse prépare la piste.
- Barre du bas rangée en trois menus : Construire (outils du réseau, pistes, télésièges), Gestion (poste de travail, administration), Affichage (vue sous-sol, infos des canons, recentrer, options) ; l'outil en main est rappelé au-dessus de la barre.
- Poste de travail (menu Gestion, ou toucher l'écran du pupitre dans la salle de pompage) : pompes en automatique ou en manuel, vanne principale, pressions, alarmes, et marche/arrêt de chaque canon.
- Grand domaine (carrière et bac à sable) : deux fois plus large, versant doux à gauche et raide à droite ; on y trace des pistes (couleur selon la pente) et on pose des télésièges, qu'on peut mettre en marche. La neige se paie une fois damée : le matin, la dameuse sort du garage et étale les tas ; une dameuse plus grosse étale plus mais coûte cher.
- Exploitation : faire tourner toute la station, saison après saison (neige la nuit, damage le matin, skieurs la journée) ; Administration (prix du forfait, personnel par métier, gazole des dameuses) ; pannes des télésièges ; but : la meilleure satisfaction des clients. La station des Deux Vallons part de zéro (2 M€) : un front de neige plat délimité en bleu, deux vallons (un doux pour les débutants, un raide avec un mur noir), un domaine bordé de piquets orange ; on y pose télésièges et téléskis (leur arrivée devient un plateau), on trace gratuitement des pistes terrassées qui peuvent se rejoindre (jonctions), et on ouvre des commerces (location, restaurant, école de ski, bar, magasin, garderie, puis l'hôtel) qui se débloquent au fil de la saison. Une journée de ski dure 5 minutes (9 h → 17 h). L'argent vient des forfaits, des commerces et des secours sur piste (plus de blessés sur les pistes faciles, mais un secours y est moins bien payé que sur une rouge ou une noire).
- Carrière : une station qui grandit en 20 étapes (réseau et argent gardés) ; chaque étape demande des m³ sur les pistes et des recettes en un nombre de nuits, et débloque du matériel (pompes, canons, tours, compresseur, perches), puis viennent les pannes.
- Tutoriels : un menu permet de choisir le niveau 1 (la salle de pompage : pompes et vanne à la main, sans coup de bélier) le niveau 2 (construire le réseau) le niveau 3 (les perches et l'air comprimé : outil « Air » depuis le compresseur, compresseur piloté au poste, électricité facturée chaque nuit) le niveau 4 (les pannes : fuites, moteurs, buses gelées, disjoncteurs, pompes, à réparer depuis le poste de travail), ou le bac à sable (tout débloqué ; outils Piste et Remontée pour tracer ses pistes et poser des télésièges ; bouton Options : argent illimité ou non, vent, pannes et leurs types, eau et électricité payantes ou non). Les pannes en cours s'affichent dans le coin en haut à droite. L'eau remise chaque jour dans la retenue est payante. La partie et les niveaux réussis sont gardés sur l'appareil (clés `nivo-partie-…` et `nivo-progression`). Les débits sont en m³/h.
- Modifier : démonter un canon ou un départ ajouté (une partie de l'argent revient), retirer une conduite ou un câble, déplacer un regard, ajouter un départ électrique ; tout s'annule. Objectifs en haut à gauche, compteurs dans un bandeau repliable en haut.
- Construction : outils « + Regard », « Eau » (depuis la salle de pompage ou un regard alimenté), « Électricité » (depuis un départ électrique près des bâtiments ou un regard alimenté) ; un devis s'affiche avant chaque achat (tranchée commune moins chère, pression prévue) ; vue sous-sol, annuler, tout effacer.
- `index.html?test` affiche les vérifications de la simulation ; `index.html?modeles` (bouton « Modèles 3D ») montre chaque modèle 3D seul : ventilateurs, perches, regard, salle de pompage, compresseur d'air, dameuses, garage, armoire électrique.

## Mise en ligne

Le site est fait de fichiers statiques, sans installation ni compilation.
Avec GitHub Pages : *Settings → Pages → Deploy from a branch*, choisir la branche `main` et le dossier `/ (root)`.

Pour l'installer sur un téléphone : ouvrir le site, puis *Partager → Sur l'écran d'accueil* (iPhone) ou *Installer l'application* (Android).
Une fois ouvert une première fois, il fonctionne aussi sans réseau : toutes les pages, les cartes et les 245 drapeaux sont mis en cache dès l'installation.

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
jeux/ia.js             robots et conseils (Yam's, 10 000)
jeux/sauvegarde.js     export et import de toutes les données dans un fichier
jeux/geo.html          jeu de géographie
jeux/geo/              données de la carte et drapeaux
outils/                script qui fabrique les données de géographie
jeux/drawrace.html     jeu Draw Race
jeux/drawrace/         circuits et géométrie de Draw Race
jeux/nivoculteur/      jeu Nivoculteur (page, Three.js, CLAUDE.md)
logo.svg               logo (source vectorielle)
icons/                 icônes de l'application (192, 512, masquable, Apple)
manifest.webmanifest   description de l'application installable
sw.js                  fonctionnement hors ligne
```
