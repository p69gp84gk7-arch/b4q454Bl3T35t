# Nivoculteur — jeu de neige de culture

Jeu 3D de gestion et de construction sur le métier de nivoculteur (technicien de production de neige de culture).
Il fait partie de la plate-forme DesDés (carte sur l'accueil `../../index.html`), mais s'ouvre aussi seul en double-cliquant sur `index.html`.

L'utilisateur est nivoculteur de métier, pas développeur : le jeu doit être crédible techniquement mais simple à jouer.
Expliquer les choix simplement, sans jargon non expliqué, et **demander avant toute décision importante**.
Avancer étape par étape : proposer un plan court, attendre la validation, puis coder ; à la fin de chaque étape, dire comment tester et mettre ce fichier à jour.

## Vision

Enneiger les pistes d'une station avant la date d'ouverture, puis tenir la saison, en construisant et en faisant fonctionner un réseau de neige de culture, avec un budget limité (esprit « jeu de construction de ponts »).

Boucle : **construire** le jour (regards, canons, conduites d'eau, câbles) → **produire** la nuit (pression, eau, tas de neige) → **damer** le matin (la dameuse étale les tas sur les pistes) → **gagner** (seule la neige damée sur les pistes rapporte) → **agrandir / réparer**.

## Règles techniques

- `index.html` contient le HTML et le CSS ; le JavaScript est découpé en fichiers dans `js/`, chargés dans l'ordre par des balises `<script>` classiques. Pas de npm, pas de Vite, pas de TypeScript, **pas de modules ES (`import`)** : le jeu doit s'ouvrir en double-cliquant sur `index.html` (`file://`), en gardant le dossier entier.
- Les fichiers partagent les mêmes noms globaux (`const` de premier niveau). **Aucun fichier ne doit utiliser Three.js au moment de son chargement** (seulement dans des fonctions), pour que le message d'erreur et le mode test marchent sans Three.js.
- **Three.js 0.149.0** en script classique : d'abord la copie locale `three.min.js` (jeu hors ligne), sinon le CDN jsdelivr.
- Graphismes **low-poly** (ombrage plat), toutes les formes créées par le code : pas de modèle 3D ni d'image externe (les textures éventuelles sont dessinées par le code dans un canvas).
- Commandes tactiles (choix de l'utilisateur) : **un doigt = se déplacer** ; deux doigts = pincer pour zoomer, tourner pour pivoter, glisser vers le haut / le bas pour incliner ; toucher court = action. Souris : glisser = tourner, molette = zoom, clic droit (ou Maj) = déplacer. La vitrine garde « un doigt = tourner » (`unDoigt` de `creerCommandes`).
- Page adaptée au téléphone (portrait et paysage) et à l'ordinateur.
- Performances : réutiliser géométries et matériaux, objets répétés en `InstancedMesh`, peu de particules.
- Sauvegarde dans `localStorage`, toujours dans un `try/catch` (à partir de l'étape 5 ; clés préfixées `nivo-`).
- **Toute l'interface est en français.** **Débits toujours en m³/h** (demande de l'utilisateur), pressions en bar.
- **Chaque texte reste dans sa capsule** (cases de la barre, boutons, panneaux) : vérifier aux largeurs 360, 390, 430, 768 et 1 280 px, le jour, la nuit, avec une fiche ouverte et dans la vitrine. Sur petit écran, les cases prennent la largeur de leur contenu (retour à la ligne si besoin) et le budget s'affiche en k€.
- Unité : **1 unité 3D = 1 mètre**. Axe x de gauche à droite, axe z du haut de la pente (négatif) vers le bas (positif), y = altitude − altitude du bas.

### Fichiers (chargés dans cet ordre)

| Fichier | Contenu |
|---|---|
| `js/config.js` | `CONFIG` (tous les chiffres réglables), `CATALOGUE` (enneigeurs), `SUPPORTS` (trépied, tour, tour haute) |
| `js/niveaux.js` | terrain, piste, retenue, salle de pompage, départs électriques, télésiège, `LEVELS` |
| `js/simulation.js` | logique pure, sans Three.js, et `testsSimulation()` |
| `js/modeles.js` | toutes les formes 3D |
| `js/effets.js` | ciel, étoiles, lune, lumières, jets de neige et brouillard |
| `js/interface.js` | messages, barre du bas, devis, fiches, panneaux |
| `js/jeu.js` | rendu, caméra et commandes, le terrain de jeu (construction, fiches, nuits) |
| `js/vitrine.js` | la vitrine des modèles (`?modeles`) |
| `js/demarrage.js` | choisit le mode (jeu, vitrine, test) — toujours en dernier |

Tester la simulation sans navigateur : concaténer `config.js`, `niveaux.js` et `simulation.js` puis appeler `testsSimulation()` avec Node.

### Sections (les numéros restent dans les en-têtes des fichiers)

1. `CONFIG` : tous les chiffres réglables, commentés en français (valeurs provisoires, à ajuster par l'utilisateur).
2. `LEVELS` : description des niveaux (terrain, pistes, pompage, retenue, départs électriques, budget, objectif).
3. `SIMULATION` : logique pure, **jamais de Three.js** (pression, coûts, terrain, pistes, réseau construit, et plus tard neige, pannes). Contient `testsSimulation()`.
   Réseau : `creerReseau`, `poserRegard`, `devisTranchee`, `ajouterTranchee`, `annulerAction` (par « lot » = une action du joueur), `alimentes(res, 'eau'|'cable'|'air')` (sources : `SOURCES`), `longueursEau` / `longueursReseau`, `etatRegard` (eau, électricité, air pour une perche, pression prévue, ce qui manque), `directionVersPiste`.
4. `MODELES 3D` : terrain (petites facettes sur le domaine, grandes facettes pour les montagnes), sapins, rochers, jalons, retenue, canon, regard, armoire électrique, salle de pompage, compresseur d'air, télésiège, ventilateurs et perches.
   Les pièces fixes d'un objet sont posées dans un `Atelier` puis fusionnées en une seule forme ; les pièces qui bougent (hélice, trappe, aiguilles, ventilateurs, voyants, gyrophares) restent à part.
   Chaque modèle a ses fonctions : `orienterCanon`, `etatCanon`, `animerCanon` ; `ouvrirRegard`, `animerRegard` ; `etatSallePompage`, `animerSallePompage`, `voirAtravers` (murs et toit transparents quand ils cachent l'intérieur) ; `remplir(f)` pour la retenue ; `creerCompresseur`, `etatCompresseur`, `animerCompresseur` (ventilateur, manomètre 0–12 bar, voyant) ; `creerTranchee3D` (trace en surface + conduite bleue / conduite d'air blanche / câble jaune enterrés), `creerIconeEtat` / `textureIcone` (goutte, éclair et, pour une perche, souffle d'air au-dessus d'un regard).
5. `EFFETS` : ciel, étoiles, lune, lumières (puis particules de neige, brouillard, tas).
6. `INTERFACE` : messages, barre du bas, panneaux.
7. `JEU` : scène, boucle, caméra, commandes.

### Modes spéciaux

- `index.html?test` : lance `testsSimulation()` et affiche OK / ERREUR à l'écran (et dans la console).
- `index.html?modeles` : vitrine des modèles 3D (bouton « Modèles 3D » en haut du terrain). Chaque modèle tourne seul ; les boutons jaunes testent ses mouvements : ventilateurs (modèle V8/V9/V10, support, état, direction, inclinaison, trappe), perches (6 m, 10 m, 10 m nouvelle génération), regard, salle de pompage (pompes, alarme ; murs transparents), compresseur d'air (marche / arrêt), dameuse, armoire.

On peut aussi vérifier que la simulation tourne sans Three.js en extrayant les sections 1 à 3 et en les lançant avec Node.

### Intégration DesDés

- Carte `.gnivo` dans `../../index.html`, raccourci dans `../../manifest.webmanifest`.
- `index.html` et `three.min.js` sont dans la liste `SHELL` de `../../sw.js` : **changer `VERSION`** dans `sw.js` à chaque mise à jour.

## Choix déjà faits (à confirmer ou ajuster par l'utilisateur)

- Terrain de démonstration : combe de 300 m × 500 m, 150 m de dénivelé (1 650 → 1 800 m), piste bleue « Les Clarines » de 40 m de large.
- Formule de pression : `P_regard = P_pompes − longueur/100 × 0,6 − dénivelé/10 × 1,2 − débit × 0,05`.
  Les coefficients du cahier des charges (0,6 et 1,2) sont compris **par 100 m de conduite** et **par 10 m de montée** (sinon 100 m de conduite feraient perdre 60 bar). Un regard plus bas que le pompage gagne de la pression.
- Zones de pression : < 22 bar arrêt, 22–30 faible, 30–50 correcte, **50–55 « haute »** (on produit normalement, mais à surveiller), > 55 surpression.
- Sur la piste, la neige est « damée » : le terrain y a moins de petites bosses (`altitude(t, x, z, pistes)`).
- Hors du domaine (zone non jouable), le terrain continue et monte en montagnes jusqu'à 1,6 km (décor), plus bas vers la vallée. La caméra monte d'elle-même si une montagne la gêne. Toucher hors du domaine affiche « en dehors du domaine skiable ».
- Replats (`terrain.replats`) : terrain aplani pour la salle de pompage, les gares du télésiège et la retenue, raccordé par un talus enneigé.
- Retenue des Clarines : à côté de la salle de pompage (x −112, z 146), lac de 32 m de rayon et 7 m de profondeur, digue, bâche sombre, clôture ; `eauRetenue()` donne la hauteur et la taille du lac selon le remplissage (le lac rétrécit en se vidant).
- Télésiège des Clarines : fixe la nuit (décor), 446 m, 8 pylônes, sièges 4 places enneigés, à droite de la piste.
- Regards **rectangulaires** (2,0 × 1,5 m, 1,9 m de profondeur), trappe à droite, pied du canon à gauche (`PIED_REGARD`).
- Départs électriques près des bâtiments : salle de pompage, gare aval et gare amont du télésiège (`DEPARTS_COMBE`).
- Pompes à **52 bar** (et non 60) : environ 51 bar en bas de la piste, 33 bar tout en haut ; à 60 bar, les regards bas étaient en surpression.
- Budget du niveau 2 : **650 000 €** (à 750–900 €/m de tranchée, 150 000 € ne permettaient que 2 regards).
- Outil de construction : tranchées en **ligne droite** entre deux points ; on ne peut pas traverser la retenue. Après une validation, le départ devient le regard raccordé (on enchaîne le long de la piste). Toucher un endroit libre comme arrivée pose un nouveau regard au bout. Les canons sont orientés vers la piste la plus proche.
- Salle de pompage : 14 m × 9 m ; la retenue est derrière (aspiration le long du mur arrière), le départ vers les pistes sort à droite après la vanne principale. Manomètres gradués de 0 à 80 bar avec les zones de couleur.

## Coûts et gains de départ (dans `CONFIG`)

Tranchée eau seule 750 €/m · câble seul 550 €/m · commune eau + câble 900 €/m · regard 5 000 € + enneigeur (catalogue) · reprise d'un enneigeur remplacé : 50 % · gain 20 € par m³ de neige tombée sur la piste.

## Catalogue (validé par l'utilisateur, noms inventés inspirés des gammes du marché)

| Enneigeur | Prix | Eau (m³/h) | Pression mini / pleine | Neige à pleine production | Disponible |
|---|---|---|---|---|---|
| Ventilateur V8 | 10 000 € | 22 | 8 / 20 bar | 35 m³/h (420 m³/nuit) | dès le départ |
| Ventilateur V9 | 18 000 € | 36 | 8 / 22 bar | 55 m³/h (660/nuit) | après 5 000 m³ sur les pistes |
| Ventilateur V10 | 28 000 € | 54 | 8 / 24 bar | 80 m³/h (960/nuit) | après 15 000 m³ |
| Perche 6 m | 5 000 € | 11 | 18 / 28 bar | 15 m³/h (180/nuit) | niveau 3 (air comprimé) |
| Perche 10 m | 7 000 € | 13 | 18 / 28 bar | 18 m³/h (216/nuit) | niveau 3 |
| Perche 10 m nouvelle génération | 10 000 € | 13 | 14 / 22 bar, moins d'air | 18 m³/h | niveau 3, après 10 000 m³ |

`neige` du catalogue est en **m³ de neige par heure** (une nuit = 12 h), indépendant de la durée d'une nuit en jeu.

Perches (`PERCHE` dans config.js) : petit support vertical de 1,50 m, perche inclinée de 30° depuis la verticale, tête de buses qui projette **vers l'avant dans un éventail de 30° au plus** (jamais tout autour).

Supports des ventilateurs : trépied au sol (posé à côté du regard, relié par un flexible), tour (+4 000 €), tour haute +3 m (+7 000 €). Plus haut = plus de portée, mais plus de dérive au vent.

## Poste de travail

- `reseau.pompage = { mode: 'auto' | 'manuel', marche: [p1, p2, p3], ouverture: 0 à 1 }` ; un canon arrêté au poste a `arret: true` (il reste arrêté les nuits suivantes jusqu'à « Mettre en marche »).
- `CONFIG.pompage` : 3 pompes de 180 m³/h. Courbe de pompe : 62 bar sans débit, 52 bar au débit nominal, la pression chute au-delà (`pressionPompes`). Vanne : perte = débit (m³/h) × 0,05 × (1/ouverture² − 1) (`perteVanne`).
- Mode **auto** : juste assez de pompes, et la vanne se règle seule pour ne pas dépasser 52 bar (régulation). Mode **manuel** : pompes et vanne à la main ; trop de pompes pour peu de canons = surpression.
- **Coup de bélier** (`CONFIG.belier`, mode manuel, eau qui circule) : vanne ouverte ou fermée de plus de 30 % en moins d'1 s ; première pompe démarrée (ou dernière arrêtée) vanne ouverte à plus de 30 %. Compté dans `reseau.coups` ; 5 000 € de réparation dans les niveaux avec budget. Le poste a un **curseur** pour la vanne (et −10 / +10 %).
- Zone verte de la pression de départ : 38 à 54 bar (affichée au poste).

## Niveaux, menu et sauvegarde (étape 5)

- **Niveau 1 · La salle de pompage** : réseau déjà construit (`reseauFixe` : 6 V10 sur tour, raccordés), pas d'outils de construction (`construction: false`), mode manuel imposé. Chaque nuit démarre pompes arrêtées, vanne fermée ; le **programme** du chef d'équipe ouvre/ferme des canons (`programme` : t = 0, 36, 72, 135 s). Objectif : 6 000 m³ produits en 3 nuits au plus, 2 coups de bélier au plus (au 3e, la conduite casse : niveau raté). Une pompe ne suffit pas à pleine charge (324 m³/h), deux oui ; avec peu de canons ouverts, il faut fermer un peu la vanne.
- **Niveau 2 · Construire le réseau** : comme avant (objectif 30 000 m³ sur la piste).
- **Menu** (bouton « Menu », et à l'ouverture sans `?niveau=`) : cartes des niveaux (réussi, partie en cours, Jouer / Reprendre / Recommencer), les 4 niveaux, liens Modèles 3D et Vérifications. Choisir un autre niveau recharge la page avec `index.html?niveau=<id>` (`&nouvelle` pour repartir de zéro).
- **Sauvegarde** (`localStorage`, try/catch) : `nivo-partie-<id>` (le réseau complet, version 1), enregistrée après chaque action et chaque nuit (pas avant la première action) ; `nivo-progression` (`niveaux[id].reussi`, `dernier`). L'accueil DesDés lit ces clés pour afficher la partie en cours.
- `CONFIG.progression.toutOuvert = true` pendant la mise au point (tous les niveaux jouables) ; à `false`, un niveau s'ouvre quand le précédent est réussi.


## Affichage et réglages (retouches demandées après l'étape 6)

- Fiche d'un canon : **à gauche** sur un écran large (paysage, 700 px et plus), **volet qui monte du bas** sur téléphone (on le ferme avec × ou en le glissant vers le bas). À l'ouverture, la vue se centre sur le canon et l'endroit où tombe sa neige, dans la partie de l'écran que la fiche laisse libre (`decalerVue` : `camera.setViewOffset`).
- Fiche d'un canon : **curseurs** pour la direction (−180 à 180°, pas de 5°) et l'inclinaison (0 à 35°) ; le canon tourne en direct, la nuit est recalculée. Jauge de pression.
- **Jauges de pression** (`jaugePression`, `zonesPression` dans interface.js) : bande 0 → 80 bar, rouge = pas de neige ou surpression, orange = production réduite ou pression haute, vert = bonne pression, trait blanc = pression actuelle (prévue canons fermés le jour). Une au départ de la salle de pompage (zone verte 38–54 bar), une par canon.
- Poste de travail : blocs à gauche, **liste des canons dans une colonne à droite** (en dessous sur téléphone) avec un résumé « bonne pression / réduite ou haute / hors limites ». Boutons **Lancer la nuit** et vitesse dans le bloc de la nuit (le bouton de la barre du bas reste).
- Couleurs d'état des canons : **vert = en marche** (même production réduite), **rouge = à l'arrêt**, **jaune = en défaut** (pression, air). Petit point de couleur au-dessus de chaque enneigeur (`creerPointEtat`), même code pour le voyant 3D et les voyants du poste. La bulle eau / électricité / air est **sous** l'enneigeur.
- Noms des bâtiments (`creerEtiquette(nom, couleur, carre)`) : de loin (plus de `CONFIG.graphismes.distanceEtiquettes` = 170 m), un **petit carré** de couleur : bleu = salle de pompage, jaune = départ électrique, blanc = compresseur ; de près, le nom (`majEtiquettes`).
- Dameuse : voir « Grand domaine, garage, dameuses et remontées » plus bas.

## Pannes et réparations (niveau 4, étape 7)

- **Niveau 4 · Les pannes et les réparations** : réseau déjà construit (`reseauFixe` avec `liaisons` : chaînes par réseau) — 6 V10 sur tour aux Clarines (R1–R6, eau depuis la salle, câble depuis `elec1`), 4 perches de 10 m aux Gentianes (R7–R10, eau depuis R5, câble depuis le départ des Gentianes `elec4`, air depuis le compresseur par R3 et R5). Budget 120 000 € (réparations, canons en plus). Objectif : **18 000 m³ sur les pistes en 6 nuits** (sans panne, environ 23 000 m³ avec l'orientation de départ).
- `CONFIG.pannes` : 1 à 3 pannes par nuit, entre 12 et 135 s (`planifierPannes` tire les instants et les dés, toujours les mêmes pour une même nuit). **Ce qui casse est choisi au moment de la panne, parmi ce qui fonctionne** (demande de l'utilisateur, `ciblesPannes(niveau, res, regime)`) : canon qui produit, pompe en marche (une seule pompe en défaut à la fois), conduite où l'eau va vers un canon qui produit, départ électrique qui alimente un canon qui produit. Si rien ne tourne, pas de panne. Jamais deux fois sur la même chose :
  | Panne | Effet | Réparation |
  |---|---|---|
  | Fuite sur une conduite | 30 m³/h perdus (retenue), −10 bar pour les regards en aval | 6 000 €, 30 s ; conduite **isolée** pendant les travaux (plus d'eau en aval) |
  | Moteur de ventilateur grillé | ce canon s'arrête | 2 500 €, 20 s |
  | Buse gelée (perche) | production × 0,4 | 300 €, 10 s |
  | Disjoncteur déclenché | le départ électrique ne fournit plus rien | « Réarmer », gratuit, 4 s |
  | Pompe en défaut thermique | une pompe de moins | 4 000 €, 40 s |
- Simulation : `res.pannes` (`{ id, type, cible, etat: 'active' | 'reparation', fin }`), `effetsPannes` (utilisé par `regimeNuit`), `evenementsPannes`, `reparerPanne` (payée tout de suite ; la nuit l'équipe met `duree` s, le jour c'est immédiat), `avancerPannes`, `libellePanne`, `positionPanne`. À la fin de la nuit, les réparations en cours se terminent ; les pannes non réparées restent. Remplacer un enneigeur supprime sa panne.
- Jeu : message rouge quand une panne arrive ; triangle jaune clignotant au-dessus (clé bleue pendant la réparation) ; gerbe d'eau et flaque de glace sur une fuite ; voyant jaune « DÉFAUT » pour une pompe ; canon en panne en jaune. **Liste des pannes dans le coin en haut à droite** (demande de l'utilisateur ; `afficherPannesCoin`, `#pannesCoin`) avec Réparer / Réarmer et Voir ; repliée en badge « ⚠ n pannes » sur un écran de moins de 1 100 px (les messages passent dessous sur téléphone). Les pannes restent dans les alarmes du poste ; ligne de panne dans la fiche, total des réparations au bilan.

## Modifier l'installation, objectifs et compteurs (demandes de l'utilisateur)

- **Démonter** (outil « Démonter », ou bouton dans la fiche) : un regard et son enneigeur, ou un départ électrique ajouté ; les tranchées qui y arrivent sont retirées. On récupère `CONFIG.couts.revente` (50 %) du matériel et `repriseTranchee` (25 %) des tranchées ; le devis prévient quels regards perdront l'eau, le courant ou l'air (`devisDemontage`, `demonter`).
- **Retirer une conduite ou un câble** : outil « Démonter » sur une tranchée → un bouton par réseau présent (25 % rendus) ; une tranchée vide disparaît (`devisRetrait`, `retirerReseau`).
- **Déplacer un regard** (bouton « Déplacer » de la fiche, puis toucher le nouvel endroit) : les tranchées suivent ; on paie `CONFIG.couts.deplacement` (3 000 €) plus les mètres de tranchée gagnés, rien n'est rendu si elles raccourcissent (`devisDeplacement`, `deplacerRegard`).
- **Nouveau départ électrique** (outil « + Départ élec ») : une armoire où l'on veut dans le domaine, `CONFIG.couts.departElec` (25 000 €) ; nœud `elecP<n>` avec `ajoute: true` (`devisDepart`, `ajouterDepartElec`).
- Tout cela passe par l'historique : **Annuler** remet en place et reprend l'argent (types `demontage`, `retrait`, `deplacement`, `depart`). Les propositions du jeu ont une fonction `faire` appelée par « Valider ».
- **Objectifs** dans le coin en haut à gauche (`afficherObjectifs`, `listeObjectifs`) : poser un regard, raccorder un canon (et une perche à l'air s'il y a un compresseur), lancer une nuit, objectif de neige (barre), objectif financier en carrière (barre), coups de bélier au niveau 1. Replié en badge sous 1 100 px de large. Pas d'objectifs dans le bac à sable.
- **Compteurs** (budget, nuit, neige, vent, retenue) dans un **bandeau sous le titre**, repliable (bouton ▴ / « Compteurs ▾ », choix gardé dans `nivo-compteurs-replies`). La hauteur du haut de l'écran est suivie (`suivreHauteurHaut`, variable CSS `--h-haut`) pour placer messages, coins et fiche juste en dessous.
- Pour plus tard (dit par l'utilisateur) : terrain, remontées, damage, clients et satisfaction. Pour l'instant, on reste sur la neige de culture.

## Carrière (validée par l'utilisateur : station continue, 4 niveaux = tutoriels)

- Menu en trois parties : **Carrière** (une carte « La station de la Combe »), **Tutoriels** (les 4 niveaux de `LEVELS`), **Bac à sable**.
- `CARRIERE` (niveaux.js) : budget de départ 150 000 €, matériel de départ (1 pompe, V8, trépied, départ élec de la salle, piste bleue), puis **20 étapes** (`etapes`) : nom, résumé, objectif `{ m3, recette, nuits }` (m³ sur les pistes ET recettes nettes de l'étape = neige vendue − électricité − eau, en un nombre de nuits), `debloque` (pompes, enneigeurs, supports, departs, pistes, compresseur, remplissageMax) et ce qui change au début de l'étape (`prime`, `pannes`, `frequencePannes`, `ventFort`, `retenueDebut`, `prixEau`).
  Saison 1 (étapes 1–7) piste bleue : tour, 2e pompe, V9, tour haute, 3e pompe, V10, puis l'eau chère. Saison 2 (8–10) piste rouge, compresseur, perches. Saison 3 (11–15) les pannes une à une. Saison 4 (16–20) ouverture anticipée, vents forts, sécheresse, mauvaise série, saison complète (8 nuits).
- `niveauCarriere(etape)` fabrique le « niveau » d'une étape (même forme que `LEVELS`, `id: 'carriere'`, `carriere: true`) avec le matériel débloqué (`materielCarriere`) ; `trouverNiveau(id)` (démarrage) reprend l'étape sauvegardée. Sauvegarde : `nivo-partie-carriere` (réseau + `reseau.carriere = { etape, debutNeige, debutRecettes, debutNuit, depart }`).
- Simulation : `commencerEtape` (prime, retenue de départ, copie du réseau pour recommencer), `etendreReseau` (nouveaux départs électriques, compresseur), `recommencerEtape`, `avancementEtape` (neige, recettes, nuits de l'étape), `resultatNiveau` type `carriere`. `res.recettes` cumule le gain net de chaque nuit (`finNuit`). Pompes installées (`niveau.pompes`), enneigeurs (`niveau.enneigeurs`) et supports (`supportDisponible`) limités ; `niveau.ventFort` (≥ 20 km/h), `niveau.prixEau`.
- Jeu : sous-titre et nuit « 2/4 » de l'étape ; au poste, recettes de l'étape et pompes « pas encore installées » ; bilan : « Étape réussie ! » avec ce qui est débloqué et **Étape suivante**, ou « Étape ratée » et **Recommencer l'étape** ; « Tout effacer » recommence l'étape. Le poste se ferme en fin de nuit pour que le bilan soit visible.
- Équilibrage vérifié avec un joueur simulé simple (lignes fixes de canons, sans réorienter) : il réussit 12 étapes sur 20 et frôle les autres ; un vrai joueur qui oriente ses canons doit y arriver. Tous les chiffres sont dans `CARRIERE`.

## Retenue payante et bac à sable

- **Remplissage payant** (`CONFIG.retenue`) : chaque jour, la retenue reçoit le volume commandé au poste de travail (Arrêt, 1 500, 3 000 ou 4 500 m³ ; 3 000 au départ), sans dépasser la place libre ni le budget, à **0,50 €/m³** (`remplirRetenue`, appelée par `finNuit` ; `res.retenue.remplissage`). Le coût apparaît au bilan et le gain affiché est net (neige − électricité − eau).
- **Bac à sable** (`LEVELS` id `bac`, `bac: true`, numéro « ∞ ») : les deux pistes, le compresseur, tout débloqué (`disponible`), pas d'objectif (`objectif.type = 'libre'`, pas de dameuse). Toujours ouvert dans le menu ; jamais proposé comme « niveau suivant ».
- Bouton **Options** (⚙ sur téléphone, seulement dans le bac à sable) : panneau `afficherOptions` ; tout est dans `res.options` (`optionsBac()`) :
  argent illimité (budget 1e9 affiché « Illimité ») ou 100 k€ / 300 k€ / 1 M€ (le budget est remis à ce montant) ; vent au hasard ou imposé (force, direction ; `ventPrevu`) ; pannes oui / non, fréquence rare / normale / forte (`CONFIG.pannes.frequences`) et types cochés un par un ; remplissage de la retenue payant ou gratuit ; électricité payante ou gratuite ; remplir / vider la retenue. Les changements s'appliquent tout de suite, même la nuit.

## Grand domaine, garage, dameuses et remontées (choix validés par l'utilisateur)

- **Grand domaine** (`TERRAIN_DOMAINE`, niveaux.js) pour la carrière et le bac à sable ; les tutoriels gardent la petite combe (`TERRAIN_COMBE`). 620 m de large au lieu de 300 : `terrain.versants` multiplie la pente sur les côtés (gauche × 0,5 : pistes vertes et bleues ; droite × 1,65 : rouges et noires), le milieu ne change presque pas (`altitudeNaturelle`). Bosses en plus sur les côtés, sapins en proportion.
- **Couleur des pistes selon la pente** : `penteMaxi` (pente la plus forte sur 30 m le long du tracé) et `couleurPente` avec `CONFIG.couleursPistes` (verte ≤ 25 %, bleue ≤ 42 %, rouge ≤ 55 %, noire au-delà). Les Clarines (41 %) sortent bleues, les Gentianes (46 %) rouges. Pendant le tracé, le panneau montre la couleur et la pente.
- **La neige se paie damée** : la nuit, la neige tombée sur une piste s'ajoute au tas (`tas.aDamer`) mais ne compte pas encore. À la fin de la nuit, `damerNeige` étale les tas (les plus gros d'abord) jusqu'à la capacité de la dameuse ; seule cette neige compte pour `neigePiste` (objectifs, déblocages) et rapporte 20 €/m³. Le reste attend le lendemain. Bilan : neige tombée, damée, encore à damer.
- **Garage des dameuses** (`GARAGE_COMBE`, en bas à droite de la piste bleue, sur un replat ; `creerGarage` : hangar, deux portes sectionnelles dont une s'ouvre, toit à deux pans enneigé). On part avec une **DM 400** (3 500 m³ par jour) ; la **DM 600** (7 000 m³ par jour) coûte 480 000 €, l'ancienne reprise 25 % (`DAMEUSES` dans config.js, `devisDameuse`, `changerDameuse`, annulable). Toucher le garage ouvre sa fiche ; bloc « Dameuse et remontées » au poste.
- **Dameuse 3D** (`creerDameuse(modele)`, inspirée des grandes dameuses à lame avant et fraise arrière) : chenilles à crampons, cabine panoramique, lame 12 positions à ailes, fraise sous capot rouge et peigne (finisseur), rampe de phares, gyrophare, feux arrière ; deux tailles. Le faisceau des phares part du véhicule vers l'avant (il était à l'envers). Le matin, elle **sort du garage**, fait une tournée des pistes qui ont des tas (deux passes par piste), les tas s'étalent à son passage, puis elle **rentre en marche arrière** et la porte se ferme (`commencerTournee`, `avancerTournee`, `garer`, `CONFIG.dameuse.vitesse` 30 m/s). La nuit, elle reste au garage.
- **Remontées** : toucher un télésiège ouvre sa fiche (longueur, puissance, coût par jour) avec « Mettre en marche / Arrêter » ; aussi au poste. En marche, les sièges défilent (`creerTelesiege` → `userData.animer`) et il consomme `CONFIG.remontees.kwParMetre` × longueur pendant `heuresJour` h, payé avec l'électricité de la nuit (`kwhRemonteesJour`). Pas encore de recettes (les clients viendront plus tard). `reseau.remonteesEnMarche`.

## Mode Exploitation (choix validés par l'utilisateur : saisons enchaînées, neige qui fait venir les clients, personnel par métier, skieurs animés)

- `LEVELS` id `exploitation` (`exploitation: true`, numéro « ❄ », groupe « Exploitation » du menu) : **station des Deux Vallons** (voir plus bas), trois pistes, un télésiège et un téléski (en marche au départ), compresseur, garage, 1,5 M€, tout le matériel disponible, quelques pannes la nuit (`frequencePannes: 'rare'`). Tracé de pistes, de télésièges et de téléskis, commerces. `versionPartie: 2` : les parties de l'ancienne station (version 1) ne se reprennent pas (nouvelle partie).
- **Un jour** = la nuit (production) → le matin (bilan : neige produite, neige naturelle, damage, gazole, enneigement de chaque piste) → **« Ouvrir la station »** → la journée de ski (**5 minutes** de jeu, 9 h → 17 h, vitesse ×1 / ×3 / ×10) → bilan de la journée → le soir (construire, Administration) → nuit suivante. `reseau.exploitation.phase` : `soir`, `matin`, `jour` ; le bouton « Lancer la nuit » devient « Ouvrir la station » le matin. **20 jours par saison** ; en fin de saison : bilan (satisfaction, clients, résultat), la neige fond, la retenue se remplit, la saison suivante a plus de clients et plus exigeants (`idealSaison` : 60 cm + 5 par saison).
- **La neige ne se vend plus** (`finNuit` : gain 0) : la neige damée épaissit la piste où elle est tombée (`res.enneigement[nom]` en cm = m³ ÷ surface × 100, `surfacePiste`). 20 cm de neige naturelle au départ, chute de neige naturelle certaines nuits (`neigeNaturelle`), usure chaque jour d'ouverture (1,5 cm + 1 cm pour 1 000 skieurs). Une piste ouvre à **30 cm** si son départ est à moins de 230 m de l'arrivée d'une remontée en service (`pistesOuvertes`, `remonteesDePiste`, `extremitesPiste`).
- **Dameuse** : il faut un conducteur (un 2e : +60 % de travail) et du **gazole** (`res.carburant.stock`, cuve 6 000 L, 1,60 €/L, DM 400 : 180 L par journée complète, DM 600 : 260 L) ; elle dame aussi la surface des pistes ouvrables (`DAMEUSES.surface` : 60 000 / 120 000 m² par jour) → qualité du damage.
- **Journée** (`debutJournee`, `avancerJournee`, `finJournee`) : clients = base 1 200 × croissance de saison × calendrier (affluence des 20 jours) × attrait (nombre de pistes, enneigement) × prix ((45 / prix)^1,3) × réputation (`clientsAttendus`). Attente aux remontées selon clients × 8 montées ÷ débit des remontées qui tournent (1 800 pers./h par télésiège, 900 par téléski). Remontées en service : en marche, avec leurs agents (2 par télésiège, 1 par téléski ; `remonteesEnService`). **Pannes de remontée** pendant la journée (12 % par remontée et par jour, `CONFIG.pannes.types.remontee`, 3 500 €, 40 s) : il s'arrête, l'attente explose ; réparation depuis le coin des pannes.
- **Satisfaction** (0 à 100 %) = 25 % enneigement + 15 % damage + 15 % choix de pistes (nombre et couleurs) + 20 % attente + 15 % prix + 5 % sécurité + 5 % accueil (moitié caissiers, moitié commerces : 3 commerces hors hôtel pour le maximum). Sécurité = 40 % pisteurs par piste ouverte + 60 % blessés secourus à temps. Satisfaction de la saison = moyenne pondérée par les clients (les jours fermés la font baisser) ; la réputation suit la satisfaction et fait venir les clients.
- **Argent** : forfaits (clients × prix) + **commerces** (recettes − charges) + **secours sur piste** − salaires chaque jour (les anciennes « dépenses des skieurs » à 14 € par client sont remplacées par les commerces) ; la nuit : électricité (pompes, compresseur, remontées) et eau ; gazole acheté à l'Administration.
- **Administration** (bouton, `afficherAdmin`) : prix du forfait (20 à 80 €, estimation des clients), personnel par métier (`METIERS` : nivoculteurs 12 canons chacun, conducteurs, agents des remontées, pisteurs, techniciens qui accélèrent les réparations, caissiers 500 clients chacun ; effectif conseillé `besoinsPersonnel`), gazole, saison en cours et saisons passées, détail de la dernière journée.
- **3D** : journée claire (`ambiance` : ciel, brouillard et lumières vers le jour), skieurs animés (`creerSkieurs`, jusqu'à 160, file d'attente en bas du télésiège → montée → piste desservie → retour), sièges arrêtés si le télésiège est en panne. Compteurs : « Saison · jour » et « Satisfaction ». Objectifs : satisfaction de la saison, pistes ouvrables, enneigement moyen, gazole, personnel.
- **Secours sur piste** (demande de l'utilisateur, `CONFIG.exploitation.secours`) : chaque journée, des skieurs se blessent (`planifierSecours`, toujours les mêmes pour une même journée). Les pistes faciles attirent plus de monde (`part` : verte 1,5, bleue 1,2, rouge 0,8, noire 0,5 ; `repartitionClients`) et les débutants s'y blessent plus (`taux` : 8, 5, 3, 2,5 blessés pour 1 000 skieurs), mais un secours y est moins bien payé (`prix` : 220, 320, 480, 650 €, payés par l'assurance du blessé). Chaque pisteur fait **un secours à la fois** (`duree` 20 à 35 s de jeu selon la couleur ; `avancerSecours`) ; sans pisteur libre, le blessé attend (au-delà de `attenteMax` = 30 s, la sécurité baisse) et, à la fermeture, il part en hélicoptère sans être facturé (`bilanSecours`). En 3D (`creerSecours`) : blessé allongé, skis plantés en croix au-dessus, croix rouge qui clignote ; puis le pisteur et sa barquette orange. Lignes au bilan de la journée et bloc « Secours sur piste » à l'Administration (tarifs, blessés de la saison). Effectif conseillé des pisteurs : une par piste + 1.
- Tout est réglable dans `CONFIG.exploitation` et `METIERS` (config.js).

## Écran allégé (demande de l'utilisateur : « éviter que l'écran soit trop chargé »)

- **Barre du bas** : une rangée courte — **Construire ▾**, **Gestion ▾**, **Affichage ▾**, ↶ (annuler), **Lancer la nuit** / Ouvrir la station, vitesse. Chaque menu ouvre un **tiroir** au-dessus de la barre (`ouvrirTiroir`, `#tiroir`, `.groupe-tiroir[data-groupe]`), un seul à la fois, refermé dès qu'on choisit quelque chose ou qu'on touche la 3D :
  Construire = Réseau de neige (+ Regard, Eau, Électricité, Air, + Départ élec, Démonter), Pistes et remontées (Tracer une piste, Poser un télésiège ; titre caché dans les tutoriels), Tout effacer ; Gestion = Poste de travail, Administration ; Affichage = Vue sous-sol, Infos canons, Recentrer la vue, Options du bac à sable.
- **Outil en main** rappelé au-dessus de la barre (« Outil : Eau ✕ », `majPuceOutil`) ; ✕ range l'outil.
- Haut de l'écran : DesDés, titre, Menu (Recentrer et Options sont passés dans le menu Affichage ; la vitrine garde son bouton Recentrer `#recentrerVue`).
- **Objectifs repliés d'office** en badge « 🎯 Objectifs 2 / 5 » (le choix est gardé dans `nivo-objectifs-ouverts`) ; 2 messages à la fois au plus sur un écran de moins de 700 px (3 au-delà).
- Les ids des boutons et `data-outil` n'ont pas changé ; les tests navigateur ouvrent le tiroir avant de toucher un bouton.

## Station des Deux Vallons, téléskis et commerces (mode Exploitation, demandes de l'utilisateur)

- **Terrain** (`TERRAIN_STATION`, niveaux.js ; `altitudeStation` dans simulation.js) : un **front de neige** presque plat en bas (z > 150, 3 % de pente) pour les gares, la salle de pompage, la retenue, le garage et les commerces ; au-dessus, **deux vallons** qui y retombent, séparés par une **crête** toujours plus haute qu'eux (`station.crete` 38 m, qui naît au-dessus du front de neige). Chaque vallon a un profil de pentes par tronçons (`profilVallon`) : à gauche le **vallon doux** (15 % en bas pour les débutants, un ressaut à 52 %, puis 28 %), à droite le **vallon raide** (24 %, 44 %, un **mur à 72 %**, puis 40 %). Relief plus chaotique en montant (`station.chaos`, bosses). Pas de sapins sur le front de neige.
- **Installations** : pistes « Les Marmottes » (verte, 23 %, bas du vallon doux), « Le Vallon » (bleue, 39 %), « Le Couloir » (noire, 71 %) ; **Télésiège des Deux Vallons** sur la crête (front de neige → sommet, dessert le Vallon et le Couloir) ; **Téléski des Marmottes** (dessert la verte) ; retenue, salle de pompage et compresseur à gauche du front de neige, garage à droite ; 5 départs électriques (`DEPARTS_STATION`). Les couleurs viennent de la pente mesurée (vérifié par les tests).
- **Téléskis** (`TYPES_REMONTEES` dans config.js, `typeRemontee(ts)`, `ts.type = 'teleski'`) : 900 €/m (télésiège 2 500), 900 skieurs/h (1 800), **1 agent** (2), 0,12 kW/m (0,35), 80 à 450 m, **50 % de pente moyenne au plus** (on se fait tirer sur la neige ; sinon « Prenez un télésiège »). Outil « Poser une remontée » : choix Télésiège / Téléski dans le panneau. 3D `creerTeleski` : gare motrice (portique jaune, poulie horizontale, moteur bleu, cabane, couloir de départ), gare de retour avec contrepoids, pylônes en T, perches à assiette qui montent dépliées et redescendent repliées ; les skieurs montent tirés sur la neige, en file de deux. `creerRemontee(ts)` choisit le modèle. Vitrine : « Téléski ».
- **Commerces** (`COMMERCES` dans config.js) : un de chaque au plus, achetés avec le budget (choix de l'utilisateur : pas de limite de place), posés sur le front de neige (`validerCommerce` : plat, pas sur une piste, une ligne ou une file d'attente, un bâtiment, un regard ; `ajouterCommerce`, `vendreCommerce` à 50 %). **Débloqués au fil de la saison** (`commerceDisponible`) :
  | Commerce | Prix | Charges / jour | Dès | Recettes |
  |---|---|---|---|---|
  | Location de skis | 120 000 € | 450 € | jour 1 | 40 % des débutants (skieurs des vertes et bleues) × 22 € |
  | Restaurant | 180 000 € | 900 € | jour 1 | 40 % des skieurs × 24 € |
  | École de ski | 90 000 € | 600 € | jour 4 | 15 % des débutants × 55 € ; +6 % de skieurs, mais × 1,25 de blessés sur les pistes faciles |
  | Bar après-ski | 70 000 € | 350 € | jour 7 | 25 % × 11 € |
  | Magasin de sport | 150 000 € | 500 € | jour 10 | 7 % × 75 € |
  | Garderie des neiges | 60 000 € | 300 € | jour 13 | 4 % × 35 € ; +4 % de skieurs |
  | Hôtel | 600 000 € | 1 500 € | saison 2 | 80 chambres × 150 €, remplies selon la réputation (moitié moins station fermée) ; +12 % de skieurs |
  Les paniers sont multipliés par 0,6 + 0,4 × satisfaction. Les charges sont payées même station fermée (`recettesCommerces`, bilan de la journée, `ex.jours[].commerces`).
- Jeu : outil **« Ouvrir un commerce »** (menu Construire, Exploitation seulement) avec la liste des commerces (les verrouillés indiquent « dès le jour 7 »), devis, puis chalet en 3D (`creerCommerce` : soubassement de pierre, chalet en bois, toit enneigé, fenêtres éclairées, enseigne de couleur ; râteliers de skis, terrasse et parasols, drapeaux de l'école, transats du bar, vitrine du magasin, bonhomme de neige de la garderie, hôtel de 3 étages à balcons). Toucher un chalet : sa fiche (recettes de la veille, Vendre). Administration : bloc « Commerces du front de neige » (Construire, ouvert, dès le jour…). Objectif « Commerces sur le front de neige ». Vitrine : « Commerces » (un bouton change de commerce).
- Personnel de départ : 3 agents (télésiège + téléski) et 3 pisteurs.

## Tracer des pistes et poser des télésièges (carrière, exploitation et bac à sable)

- **Terrassement** : une piste tracée (`terrasse: true`) corrige le dévers du terrain sur sa largeur, raccordé par un talus de 10 m (`CONFIG.terrassement`, dans `altitude(t, x, z, pistes)`, `projectionPiste`).
- **Porte de départ** en haut de chaque piste (`creerPortePiste` : deux mâts et une banderole avec le nom), de la couleur de la piste, c'est-à-dire de sa difficulté la plus haute ; elle apparaît aussi pendant le tracé.
- Bouton **« Masquer infos canons »** (menu Affichage) : cache les bulles et les points d'état au-dessus des canons (choix gardé dans `nivo-infos-canons`).

- Outils **Piste** et **Remontée** dans la barre (carrière et bac à sable, cachés dans les tutoriels). Piste : on touche des points, on choisit la largeur (20, 30, 40 m) ; la couleur vient de la pente ; puis « Terminer la piste ». Remontée : gare de départ en bas, puis gare d'arrivée en haut, puis « Construire le télésiège ». Aperçu en couleur pendant le tracé (`dessinerTrace`, panneau `#choixTrace`).
- Simulation : `validerPiste` (dans le domaine, au moins `CONFIG.bac.pisteMin` = 80 m, pas sur la retenue ni la salle de pompage), `validerRemontee` (120 à 600 m, arrivée plus haute d'au moins 15 m, pas au-dessus de la retenue ni de la salle), `ajouterPisteBac`, `ajouterRemonteeBac` (dans le bac à sable, payants seulement si l'argent n'est pas illimité : `CONFIG.bac.prixPiste` 250 €/m, `prixRemontee` 2 500 €/m). Enregistrés dans `reseau.pistesBac` et `reseau.remonteesBac`.
- `amenager(niveau, reseau)` (niveaux.js, ancien `amenagerBac`), appelé par demarrage.js pour la carrière et le bac à sable **avant** de construire la 3D : ajoute les pistes (neige damée, jalons, sapins écartés, et la neige tombée dessus compte), les télésièges et les replats de leurs gares. Après chaque tracé ou suppression, la partie est enregistrée et la page rechargée (`rechargerBac`, message affiché au retour via `reseau.messageApres`).
- Options du bac à sable : section « Pistes et remontées » avec la liste et « Supprimer ». Les télésièges sont du décor (ils ne tournent pas la nuit).

## Air comprimé et perches (niveau 3, étape 6)

- **Niveau 3 · Les perches et l'air comprimé** : deuxième piste, rouge et étroite, « Les Gentianes » (`PISTE_GENTIANES`), départ électrique en plus près d'elle, budget 700 000 €, objectif 20 000 m³ sur les pistes. Le compresseur (`COMPRESSEUR_COMBE`) est à côté de la salle de pompage ; la conduite d'air part de sa sortie.
- Une perche a besoin de **trois réseaux** : eau, électricité et air. Outil « Air » (bouton caché sans compresseur) ; tranchée d'air seule 650 €/m, ou 200 €/m dans une tranchée déjà creusée (`CONFIG.couts.trancheeAir`, `ajout.air`).
- `CONFIG.air` : réservoir à 8 bar nominal, compresseur de 600 Nm³/h (75 kW). Perche 6 m : 60 Nm³/h, 10 m : 70, 10 m nouvelle génération : 30 (`CATALOGUE[…].air`). Perte dans la conduite d'air : 0,3 bar par 100 m.
- Le réservoir part de 0 bar à chaque nuit et monte vers 8 bar quand le compresseur tourne (`montee`), moins si la demande dépasse sa capacité ; il redescend à l'arrêt (`fuite`). Production d'une perche : nulle sous 4 bar d'air, réduite de 4 à 6 bar, pleine au-dessus (`facteurAir`), et toujours limitée aussi par la pression d'eau. Une perche sans assez d'air reste fermée (« En attente d'air », pas d'alarme de pression d'eau).
- Compresseur : en **auto**, il démarre dès qu'une perche prête attend de l'air ; en **manuel** (même bouton que les pompes), on le démarre / l'arrête au poste (`commanderCompresseur`). Pendant la nuit, le régime est recalculé quand la pression du réservoir change (4 fois par seconde au plus).
- **Électricité** (`CONFIG.electricite.prixKwh` = 0,18 €) : pompes 160 kW chacune, compresseur 75 kW ; le coût de la nuit est retiré du gain au bilan (tous les niveaux) et affiché au poste.

## Production, vent, nuits (étape 4)

- Production : 35 % à la pression minimale, 100 % à la pression pleine ; surpression > 55 bar = canon en sécurité.
- Pression pendant la nuit : formule du cahier des charges avec le débit total des canons ouverts (l/s × 3,6 = m³/h). Tant qu'un canon manque de pression, on ferme le plus défavorisé et on recalcule (`regimeNuit`).
- Vent tiré au sort par nuit (0 à 35 km/h, direction), annoncé la veille (flèche dans la barre, manche à air près de la salle). Point de chute = direction × portée (modèle, support, inclinaison) + dérive du vent (hauteur du jet / vitesse de chute × vent × 0,5). Seule la part de la zone enneigée qui tombe sur la piste compte et rapporte.
- Une nuit = **180 s** (3 min) de jeu = 12 h (1 s de jeu = 240 s réelles), affichée de 18 h à 6 h ; bouton de vitesse ×1 → ×3 → ×10 (`CONFIG.nuit.vitesses`) ; la retenue (11 260 m³ pleine) se vide au débit réel et regagne 3 000 m³ par jour ; vide = pompes à sec, tout s'arrête (alarme).
- Les tas de neige restent d'une nuit à l'autre. À la fin de la nuit : bilan, argent ajouté au budget, nouveaux enneigeurs débloqués. On ne peut plus annuler ce qui a été construit avant une nuit.
- Objectif du niveau 2 : 30 000 m³ sur la piste.

## Plan et avancement

- [x] **Étape 0 — Base du projet** : page avec Three.js, sections en place, nuit (ciel, étoiles, lune), terrain low-poly avec piste damée, jalons, sapins, rochers, montagnes au loin, caméra orbite (tourner, zoomer, déplacer), toucher = altitude + sur/hors piste, barre du bas, messages colorés, mode `?test` (18 vérifications).
- [x] Retouches de l'étape 0 : zone non jouable habillée (montagnes posées sur le terrain, plus de vide), télésiège fixe, emplacement de la retenue.
- [x] **Étape 1 — Modèles 3D** : canon ventilateur (tube creux, hélice arrière derrière sa grille, moteur, couronne de 12 buses et nucléateurs, fourche orientable, voyant gris/vert/orange/rouge) sur son pied ; regard triangulaire enterré (trappe qui s'ouvre, conduite, vanne à volant, coffret électrique) ; salle de pompage (3 pompes multicellulaires, moteurs bleus à ailettes et ventilateur qui tourne, brides boulonnées, vannes à volant rouge, voyants, manomètres à aiguille, collecteurs d'aspiration et de refoulement, vanne principale, armoires, pupitre avec écran, gyrophares, toit amovible) ; armoire « Départ élec » avec étiquette. Vitrine `?modeles`. Sur le terrain : salle de pompage, retenue, départs électriques, télésiège.
- [x] Retouches : murs et toit de la salle de pompage transparents quand ils cachent l'intérieur ; regards rectangulaires ; départs électriques près des bâtiments.
- [x] **Étape 3 — Construction** (faite avant l'étape 2, à la demande) : outils + Regard, Eau, Électricité ; devis (longueur, prix au mètre, tranchée commune, pression prévue, ce qui manque, budget après) ; Valider / Annuler ; icônes goutte/éclair ; vue sous-sol ; Annuler (remboursé) ; Tout effacer. 39 vérifications en mode test.
- [x] **Étape 4 — Production, vent et catalogue** (+ découpage en fichiers) : bouton « Lancer la nuit », jets de neige et brouillard, tas, bilan, accélérer ×3 ; vent et manche à air ; fiche d'un canon (état, pression, % sur la piste, direction, inclinaison, remplacement avec reprise, anneau du point de chute) ; choix de l'enneigeur à la pose ; ventilateurs V8/V9/V10 sur trépied/tour/tour haute ; perches 6 m / 10 m / 10 m NG (vitrine ; jouables au niveau 3) ; retenue qui se vide. 55 vérifications.
- [x] Retouches : perches sur support vertical de 1,50 m, jet en éventail de 30° vers l'avant ; aucun texte ne dépasse de sa capsule (360 → 1 280 px).
- [x] **Poste de travail** : bouton « Poste de travail », toucher l'écran du pupitre en 3D ou la salle de pompage (sans outil). Écran de supervision : pompes (auto / manuel, 50 l/s chacune, surcharge = chute de pression), vanne principale (−10 / +10 %, perte quand elle est mi-fermée, fermée = plus d'eau), départ (bar, l/s demandés / disponibles), nuit en cours, vent, retenue, objectif, alarmes, liste des canons (état, pression, production, % piste, Arrêter / Mettre en marche, Voir). Les commandes recalculent la nuit en cours tout de suite. Rafraîchi 4 fois par seconde la nuit **sans recréer les boutons** (`mettreAJour`), pour ne perdre aucun appui. 61 vérifications.
- [x] **Étape 2 — Niveau 1** : salle de pompage jouable (programme du chef d'équipe, pompes et vanne à la main, courbe de pompe, zone verte, coup de bélier, rendement, réussite / échec).
- [x] **Étape 5 — Menus et niveaux** : menu des niveaux, sauvegarde de la partie et de la progression, reprise, recommencer, statut sur l'accueil DesDés. Débits passés en m³/h. 74 vérifications.
- [x] **Étape 6 — Perches, air comprimé, compresseur** (niveau 3) : outil « Air », compresseur sur le replat de la salle de pompage, perches jouables, réservoir d'air, bloc « Air comprimé » au poste, électricité facturée. 84 vérifications.
- [x] **Station des Deux Vallons, téléskis, commerces** : nouveau terrain de l'Exploitation (front de neige plat, vallon doux, vallon raide avec un mur), téléskis à perches, 7 commerces débloqués au fil de la saison (chalets en 3D). 173 vérifications.
- [x] **Secours, durées, écran allégé** : secours sur piste (blessés selon la couleur, pisteurs, facturation), nuits de 3 min et journées de 5 min (vitesse ×1 / ×3 / ×10, heure affichée), barre du bas en trois menus. 154 vérifications.
- [x] **Exploitation** : mode station de ski (journées de ski, skieurs, satisfaction, saisons, administration : forfait, personnel, gazole ; pannes des télésièges) ; terrassement et portes des pistes ; infos des canons masquables. 149 vérifications.
- [x] **Grand domaine** : zone élargie (versants doux et raide), couleur des pistes selon la pente, tracé en carrière, garage et dameuses (neige payée au damage), télésièges activables. 136 vérifications.
- [x] **Étape 7 — Pannes et réparations** (niveau 4) : fuites, moteurs, buses gelées, disjoncteurs, pompes ; repères en 3D, bloc « Pannes » au poste, réparation par l'équipe. 97 vérifications.

### Idées à garder en tête

- Météo plus complète (température humide, redoux) qui module la production.
- Tranchées avec points intermédiaires (détours) si l'utilisateur le demande.
