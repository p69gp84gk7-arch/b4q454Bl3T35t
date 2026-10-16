# DesDés

Plate-forme web (application installable) qui regroupe nos carnets de score de jeux de dés, un quiz de géographie, une course à dessiner, un jeu de neige de culture en 3D et un bac à sable en 3D, Strates.

![Logo](logo.svg)

## Les carnets

| Jeu | Fichier | Joueurs |
| --- | --- | --- |
| **10 000** : ouverture à 1 000, croix (effacées dès qu'on note des points ou le −500 du 1er lancer), reprises, pénalités ; il faut finir à 10 000 pile, dépasser donne une croix, et on ne peut pas reprendre des points qui mèneraient à 10 000 ou plus | `jeux/10000.html` | 2 à 15 |
| **Yam's** : feuille de marque classique, bonus à 63 | `jeux/yams.html` | 1 à 10 |
| **Géographie** : drapeaux et cartes (pays, régions et départements français, États américains), défi du jour, chrono, records et statistiques | `jeux/geo.html` | 1 |
| **Draw Race** : course de monoplaces dont on dessine la trajectoire, 20 circuits inspirés de la F1, pneus, météo et arrêts au stand ; modes Arcade et Championnat | `jeux/drawrace.html` | 1 à 4 (+ adversaires) |
| **Nivoculteur** : construire et faire tourner le réseau de neige de culture d'une station, en 3D (en construction) | `jeux/nivoculteur/index.html` | 1 |
| **Strates** : bac à sable en 3D, entre Godus et Minecraft : sculpter les couches d'une île, creuser le sous-sol, fabriquer, faire grandir un village, découvrir un archipel | `jeux/strates.html` | 1 |

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

- **Couleurs** (bouton « 🎨 Couleur du tapis », tout en bas, sous les boutons de jeu) : feutre vert, casino, bleu, bois, ardoise avec dés rouges, nuit avec dés noirs. Ce choix est commun aux deux jeux.
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

Deux modes de jeu, au choix en haut du menu :

- **Arcade** : une course, de 1 à 4 joueurs sur le même appareil, contre des adversaires. Tout se règle : circuit, nombre de tours, difficulté, météo.
- **Championnat** : un joueur seul contre 5 pilotes, course après course.

### Championnat

- **Réglages au départ** :
  - nom et couleur du pilote ;
  - difficulté (curseur de 0 à 100 %), **fixée pour tout le championnat** ;
  - nombre de courses, de 2 à 20, avec − et + (ou les raccourcis 5, 8, 12, 20) ; chaque course a lieu sur un circuit différent ;
  - un **minimum de tours** par course (3 à 10) : chaque circuit garde son nombre de tours habituel (2 à 5), relevé à ce minimum si besoin ;
  - météo : variable (chaque course a sa météo, découverte en arrivant sur le circuit) ou toujours sèche ;
  - calendrier : au hasard, ou du plus facile au plus dur.
- **Adversaires** : 5 pilotes tirés parmi 12 noms inspirés de vrais pilotes de F1, chacun avec sa couleur : Max Verstapin, Lewis Hamiltown, Charles Leclaire, Lando Norrish, Oscar Piastrino, Fernando Alonsso, George Russelle, Carlos Sainze, Pierre Gaslight, Esteban Ocone, Yuki Tsunodo, Valtteri Bottass.
  Il y a toujours l'un des trois plus forts. Chaque pilote a sa force (au plus ±1 % de vitesse autour de la difficulté choisie), plus une forme du jour qui change à chaque course.
- **Points** : 25, 18, 15, 12, 10 et 8 du 1er au 6e, et 1 point pour le meilleur tour en course. Un abandon ne rapporte rien.
  Les autres pilotes terminent la course (simulée d'un coup) pour avoir de vrais temps. À égalité de points, le nombre de victoires puis les meilleures places départagent.
- **Avant chaque course**, l'écran du championnat montre :
  - la prochaine course (circuit, nombre de tours, météo à découvrir) ;
  - le calendrier, avec les courses faites et celle à venir ;
  - le classement général, avec les points gagnés à la dernière course.
- **Grille de départ** : dans l'ordre du classement général (au hasard pour la première course).
- **Abandons** :
  - *Abandonner* pendant une course donne 0 point, et les autres finissent la course ;
  - pendant le tracé, on retourne au classement sans pénalité, et la course reste à faire ;
  - *Abandonner le championnat* (sur l'écran du classement ou au menu) efface le championnat en cours.
- **Sauvegarde** : le championnat est gardé sur l'appareil. On peut quitter et reprendre plus tard : le menu propose *Continuer*. L'accueil de DesDés affiche la course et la place.
- **Fin** : classement final et champion. Un **palmarès** garde les derniers championnats (date, nombre de courses, difficulté, place, points).

Le jeu se joue le téléphone à l'horizontale (un message le demande en vertical), pour des pistes plus larges.

1. En Arcade, on choisit :
   - le nombre de joueurs (1 à 4, sur le même appareil), la couleur et les **pneus** de chaque monoplace ;
   - la difficulté des adversaires avec un **curseur** de 0 à 100 % (Facile, Normal, Difficile, Expert, et tous les réglages entre deux) et la **météo** ;
   - le circuit dans le carrousel : 20 circuits inspirés de la F1, de difficulté 1 à 5, de 2 à 5 tours, chacun avec son décor.
   - le **nombre de tours**, de 1 à 10 (le nombre habituel du circuit est proposé). Les records sont gardés à part quand on ne fait pas le nombre habituel.

   La météo réelle du circuit est annoncée dès l'arrivée sur la piste (une météo « Surprise » est découverte à ce moment-là).
2. Chaque joueur dessine ses tours d'affilée, sans lever le doigt, en partant de la ligne à damier (on peut reprendre au bout du trait, ou tout recommencer). La vitesse du doigt devient la vitesse de la voiture : la jauge et la couleur du trait passent du vert (lent) au rouge (rapide). Dans les virages, la voiture freine toute seule avant le virage, mais un virage tracé trop vite la fait déraper (voir *Physique*). Le trait est épais (9 px), pour bien voir sa trajectoire.
3. La course se joue à 4 voitures (les places libres sont prises par des adversaires, qui partent derrière les joueurs). Chaque voiture suit, à chaque tour, le tracé dessiné pour ce tour. Les tours forment un seul chemin continu : au passage de la ligne, la voiture enchaîne directement sur le tracé du tour suivant, sans écart ni saut (avant la ligne et après l'arrivée, elle suit la piste, à la même distance du bord que le début et la fin du tracé). Le **Boost** (vitesse ×1,4 pendant 1,3 s) se recharge : 2 charges au départ, 3 au plus, une charge de plus toutes les 6 s (la petite jauge du bouton montre la recharge). On peut abandonner à tout moment (la partie ne compte pas).

   Les monoplaces sont dessinées en détail, vues de dessus : ailerons avant et arrière avec leurs dérives, museau, pontons et prises d'air, halo, casque du pilote, rétroviseurs, suspensions, roues avec jantes, bande de décoration dans une teinte plus claire.

### Départ au temps de réaction

Option **Départ au temps de réaction** (cochée par défaut), dans le menu de l'Arcade (aussi à plusieurs joueurs) et dans les réglages du Championnat.

- Les 5 feux rouges s'affichent en grand au milieu de l'écran et s'allument un à un. Ils restent allumés un temps au hasard, puis s'éteignent : c'est le départ.
- Sous les feux, chaque joueur a son bouton **🚦 Départ**. Le bouton affiche le temps de réaction mesuré (par exemple « 0,250 s · très bien » ; excellent sous 0,2 s, correct sous 0,45 s, lent au-delà).
- Meilleur est le temps de réaction, plus la voiture démarre tôt et accélère fort dans les premiers mètres.
- Appuyer avant l'extinction des feux est un **faux départ** : la voiture part 1 s après les autres.
- Sans appui, la voiture part toute seule au bout de 1,5 s.
- Les adversaires réagissent en 0,2 à 0,45 s (plus vite aux niveaux élevés).
- Les résultats donnent le temps de réaction de chacun.

Sans l'option, les voitures partent toutes ensemble à l'extinction des feux.

### Physique

- **Dérapage** : un virage tracé plus vite que possible fait glisser la voiture vers l'extérieur. Elle se met en travers, ses pneus fument, elle perd de la vitesse et use ses pneus. Un message prévient.
- **Patinage** : sous la pluie, la voiture accélère moins bien, surtout en pneus lisses (Tendres, Mediums, Durs).
- **La difficulté règle la physique** (×0,6 à 0 %, ×1,4 à 100 %). En simulation sur le Tourniquet, tracer à fond partout au lieu de ralentir avant les virages coûte 0,4 s en Facile, 1,4 s à 50 % et 2,8 s en Expert, et use bien plus les pneus.
- **Hors piste**, la voiture freine fort (75 au plus) et un message s'affiche.
- **Pneus usés** : la vitesse de pointe baisse (jusqu'à −7 % à 100 % d'usure), en plus de l'adhérence.

Les virages sont bordés de vibreurs rouge et blanc, dessinés en bande continue le long du bord. Il n'y en a pas à l'intérieur des épingles très serrées, et rouler dessus use les pneus (seulement là où ils sont dessinés). Les records (5 meilleurs temps et meilleur tour) sont gardés par circuit.

### Adversaires

Ils suivent une **trajectoire de course** calculée pour chaque circuit : un ruban tendu entre les bords de la piste, qui coupe les virages.

Ils font aussi des **erreurs** dans les virages : une glissade qui leur fait perdre de la vitesse, ou une sortie large dans l'herbe (un message l'annonce). Elles sont plus fréquentes aux niveaux faciles (environ une tentative toutes les 2 s de virage en Facile, 8 s en Expert) et 2,5 fois plus fréquentes sous le déluge.

Le curseur mélange les réglages des deux niveaux voisins : à 50 %, par exemple, les adversaires sont entre Normal et Difficile.

| Niveau (curseur) | Trajectoire | Vitesse et adhérence | Pneus |
| --- | --- | --- | --- |
| Facile (0 %) | à mi-chemin entre le milieu de la piste et la trajectoire idéale | 78 % et 80 % | au hasard (secs) |
| Normal (33 %) | presque idéale | 90 % | souvent les bons |
| Difficile (67 %) | idéale | 96 % | les bons |
| Expert (100 %) | idéale | 100 % : un tour parfait | les bons, Boosts dans les longues lignes droites |

En course simulée sur l'Aérodrome, un tracé propre bat Normal, se joue au dixième contre Difficile et perd contre Expert, sauf avec des Boosts bien placés.

### Pneus et météo

| Pneus | Au sec | Sous la pluie |
| --- | --- | --- |
| Tendres (T, rouge) | les plus rapides, mais usure rapide et chute après 3 tours | très glissants |
| Mediums (M, jaune) | rapides, tiennent 5 tours | glissants |
| Durs (D, blanc) | moins d'adhérence, presque pas d'usure | glissants |
| Intermédiaires (I, vert) | lents et vite usés | les meilleurs sous la pluie légère |
| Pluie (P, bleu) | très lents | les meilleurs sous le déluge |

L'adhérence limite la vitesse dans les virages et l'accélération en sortie. Exemple sur le Tourniquet (3 tours) : 35,7 s en Tendres, 36,7 en Mediums, 37,9 en Durs au sec. Sous la pluie : 39,3 s en Intermédiaires contre 41,2 en Tendres.

Météo : Sec, Averse (la pluie arrive pendant la course, entre 30 et 65 % de la distance), Pluie, Déluge, ou Surprise (tirée en arrivant sur le circuit).

- **Grille de départ** : une fois les trajectoires tracées, la grille montre la météo du circuit (pour une averse, le tour où la pluie est attendue). Chaque joueur y choisit ses pneus, avec le conseil de l'ingénieur.
- **Usure des 4 pneus** : pendant la course, le panneau de chaque joueur montre l'usure de chaque pneu (AVG, AVD, ARG, ARD), du vert au rouge. 100 % correspond à la fin de vie du pneu. Le classement donne, pour toutes les voitures, l'usure du pneu le plus abîmé.
  L'usure avance avec la distance, et plus vite :
  - dans les virages pris près de la limite : surtout les pneus extérieurs, et l'avant plus que l'arrière ;
  - en accélérant (arrière) et en freinant fort (avant) ;
  - **sur les vibreurs** : les deux pneus du côté du vibreur s'usent environ 4 fois plus vite ; le panneau affiche « vibreur ! » ;
  - dans l'herbe : les quatre pneus.
  L'adhérence dépend de l'usure moyenne des quatre pneus. Elle chute (Tendres, Mediums) dès qu'un pneu est au bout.
  En simulation, une trajectoire propre à fond use les pneus d'environ une durée de vie par tour (de 0,8 à 1) ; une trajectoire collée aux bords, sur les vibreurs, use de 50 à 65 % plus vite.
  Durées de vie : environ 3 tours pour les Tendres, 5 pour les Mediums, 15 pour les Durs ; Intermédiaires 3 tours au sec et 10 sous la pluie ; Pluie 2,5 tours au sec et 14 sous la pluie.
  **La difficulté règle la vitesse d'usure** : ×0,6 à 0 % (Facile), ×1 à 50 %, ×1,4 à 100 % (Expert). Le menu l'indique sous le curseur.
  La grille de départ donne la durée de vie du pneu choisi avec la météo du jour.
- **Stand** : pendant la course, le bouton 🔧 Stand permet de choisir de nouveaux pneus. Le changement se fait au prochain passage de la ligne : arrêt de 3 s, pneus neufs (l'usure repart de zéro). Un nouveau toucher annule.
  Les adversaires (sauf en Facile) s'arrêtent aussi quand le changement leur fait gagner du temps sur les tours restants, par exemple quand la pluie arrive. La pluie s'affiche sur la piste et les voitures soulèvent des gerbes d'eau. Le classement montre les pneus de chacun, et un message prévient quand les pneus d'un joueur chutent.

### Décors

Chaque circuit a un paysage : montagne avec sapins et névés, parc, campagne et champs, collines d'oliviers, forêt, sapins, désert, dunes et mer, ville, ville de nuit (néons, lampadaires), cerisiers et grande roue, île au milieu de l'eau, lac, port avec bateaux, prairie.
On trouve aussi des tribunes avec le public le long de la ligne droite et des stands en face.
Les décors sont placés automatiquement loin de la piste, toujours au même endroit pour un circuit donné.
Les circuits sont dans `jeux/drawrace/circuits.js` (points de passage et décor), la géométrie et la trajectoire de course dans `jeux/drawrace/piste.js`.

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

## Strates

Bac à sable en 3D (Three.js), dans l'esprit de Godus (un dieu sculpte un terrain en couches, aux couleurs douces, et son peuple y bâtit) mêlé à Minecraft (creuser le sous-sol, récolter, fabriquer). Fichiers : `jeux/strates.html` (page et interface), `jeux/strates/monde.js` (îles, matériaux, eau et lave), `jeux/strates/rendu.js` (3D), `jeux/strates/jeu.js` (règles). Three.js est pris dans `jeux/nivoculteur/three.min.js`.

- **Le monde** : une île de 128 × 128 colonnes, chaque colonne est une pile de blocs fins (68 couches au plus). Le terrain est dessiné couche par couche, comme des courbes de niveau : chaque couche est une fine plaque au contour arrondi (placé entre les colonnes d'après un relief adouci, sans aspect « cube »), et la tranche des falaises montre les strates du sous-sol.
- **Deux modes** : *Nouvelle partie* (avec progression) ou *Bac à sable libre* (tout débloqué, foi et matériaux sans limite).
- **La vue** : uniquement à deux doigts (glisser pour se déplacer, pincer pour zoomer, tourner les doigts pour pivoter, dans le sens des doigts). La vue s'incline en s'approchant, comme dans Godus. Un doigt sert seulement à l'outil. Le bouton 🎯 revient au village. À la souris : clic droit pour tourner, clic du milieu pour se déplacer, molette pour zoomer.
- **Modeler le terrain** (1 point de foi par couche et par case ; pinceau petit, moyen ou grand) :
  - *Sculpter*, comme dans Godus : on pose le doigt sur une couche ; en tirant vers le terrain plus bas, la couche s'étend et le recouvre ; en poussant vers l'intérieur de la couche, elle recule et laisse voir la couche du dessous. Le sens se décide à la première case quittée. Les blocs ajoutés reprennent ceux de la couche tirée, sans les minerais. Sculpter ne remplit pas le sac.
  - *Creuser* : la couche touchée descend d'un cran et le bloc enlevé va dans le sac ; le doigt gardé immobile continue de creuser, de plus en plus profond.
- **Le sous-sol** : sous la terre, la pierre, puis le charbon, le fer, l'or et les cristaux, de plus en plus profond (par filons). La roche-mère, tout en bas, ne se creuse pas. Il faut une pioche pour les blocs durs : en bois (pierre, charbon, grès, basalte, glace), en pierre (fer), en fer (or, cristal, obsidienne).
- **L'eau et la lave coulent** vers les colonnes plus basses. Creuser sous le niveau de la mer près du rivage fait entrer la mer. En creusant, on peut percer une source (l'eau jaillit jusqu'à un peu au-dessus de la source) ou une poche de lave. La lave est visqueuse : au contact de l'eau elle devient de l'obsidienne, et une coulée qui s'arrête refroidit en basalte. La lave brûle arbres et bâtiments, l'eau profonde emporte les bâtiments (sauf le port et le phare).
- **Le village** : les habitants prient (0,5 point de foi par seconde chacun ; 500 au départ, plus avec une fontaine, une statue, un phare ou un temple). Ils bâtissent seuls une cabane quand il y a de la nourriture mais plus de place, sur une case dont les 4 voisines sont au même niveau. Le premier village est sur un terrain rond, aplani. Une naissance environ toutes les 8 s s'il y a de la place et de quoi manger (4 habitants nourris de base, 6 de plus par ferme). Un habitant sans toit part au bout de 90 s. Toucher une maison avec la Main permet de l'améliorer : cabane (2 habitants), maison (4), villa (8). Toucher un arbre donne du bois.
- **Fabriquer** : planches (sans bâtiment), pioches (à l'Atelier), lingots de fer et d'or, verre, briques (au Four).
- **Bâtiments** : cabane, ferme (2 × 2), atelier, four, fontaine, port et phare (au bord de l'eau), statue, temple (2 × 2).
- **Paliers** (selon les habitants de tout l'archipel) : Le premier village (0), Le hameau (6 : pioche en bois, maison, four), Le village (12 : pioche en pierre, fer, verre, fontaine), Le bourg (20 : port, briques, statue, Île des Sables), La petite ville (32 : pioche en fer, or, villa), La ville (45 : temple, Île du Volcan), La cité (60 : phare, Île des Glaces).
- **L'archipel** : avec un port, le bateau mène aux autres îles. Découvrir une île y envoie 2 colons (il faut 4 habitants au moins) ; un port et une cabane les attendent. Le sac et la foi voyagent avec vous, chaque île garde son village. Île Verte (prairies, forêts, fer), Île des Sables (dunes, palmiers, cactus, grès, argile, beaucoup d'or), Île du Volcan (basalte, obsidienne, cristaux ; éruptions toutes les 2 à 5 minutes, pendant 25 s), Île des Glaces (neige, glace, sapins, cristaux).
- **Sauvegarde** : toutes les 30 s et en quittant, dans `strates-partie`. L'île se recalcule à partir de sa graine : seules les colonnes modifiées sont gardées (environ 50 Ko par île). `strates-resume` sert à l'accueil. Le fichier de sauvegarde de DesDés l'emporte aussi. Les parties de la première version (grille de 64) ne sont pas reprises.

## Mise en ligne

Le site est fait de fichiers statiques, sans installation ni compilation.
Avec GitHub Pages : *Settings → Pages → Deploy from a branch*, choisir la branche `main` et le dossier `/ (root)`.

Pour l'installer sur un téléphone : ouvrir le site, puis *Partager → Sur l'écran d'accueil* (iPhone) ou *Installer l'application* (Android).
Une fois ouvert une première fois, il fonctionne aussi sans réseau : toutes les pages, les cartes et les 245 drapeaux sont mis en cache dès l'installation.

## Ajouter un jeu

1. Déposer le carnet dans `jeux/` (un fichier HTML autonome).
2. Y ajouter le lien de retour `<a class="home" href="../index.html">…</a>` et les balises du manifeste, comme dans les deux carnets existants.
3. Ajouter sa carte dans `index.html`.
4. Ajouter le fichier à la liste `SHELL` de `sw.js`.
5. À chaque mise à jour, lancer `sh outils/version.sh` : il change `VERSION` dans `sw.js` et le numéro `?v=` des scripts dans toutes les pages.
   Sans cela, un téléphone peut garder d'anciens scripts avec une nouvelle page. C'est ce qui bloquait le comptage des tours de Draw Race : l'ancien `piste.js` était utilisé avec la nouvelle page.
   Les pages et les scripts sont pris sur le réseau d'abord (le cache ne sert que hors ligne). Seules les images passent d'abord par le cache.
   Quand une nouvelle version s'installe, la page se recharge une fois d'elle-même.

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
jeux/strates.html      jeu Strates (bac à sable en 3D)
jeux/strates/          monde, rendu 3D et règles de Strates
logo.svg               logo (source vectorielle)
icons/                 icônes de l'application (192, 512, masquable, Apple)
manifest.webmanifest   description de l'application installable
sw.js                  fonctionnement hors ligne
```
