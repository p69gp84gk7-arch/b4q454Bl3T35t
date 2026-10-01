# Nivoculteur — jeu de neige de culture

Jeu 3D de gestion et de construction sur le métier de nivoculteur (technicien de production de neige de culture).
Il fait partie de la plate-forme DesDés (carte sur l'accueil `../../index.html`), mais s'ouvre aussi seul en double-cliquant sur `index.html`.

L'utilisateur est nivoculteur de métier, pas développeur : le jeu doit être crédible techniquement mais simple à jouer.
Expliquer les choix simplement, sans jargon non expliqué, et **demander avant toute décision importante**.
Avancer étape par étape : proposer un plan court, attendre la validation, puis coder ; à la fin de chaque étape, dire comment tester et mettre ce fichier à jour.

## Vision

Enneiger les pistes d'une station avant la date d'ouverture, puis tenir la saison, en construisant et en faisant fonctionner un réseau de neige de culture, avec un budget limité (esprit « jeu de construction de ponts »).

Boucle : **construire** le jour (regards, canons, conduites d'eau, câbles) → **produire** la nuit (pression, eau, tas de neige) → **gagner** (la neige tombée sur la piste rapporte) → **agrandir / réparer**.

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

- **Niveau 1 · La salle de pompage** : réseau déjà construit (`reseauFixe` : 6 V10 sur tour, raccordés), pas d'outils de construction (`construction: false`), mode manuel imposé. Chaque nuit démarre pompes arrêtées, vanne fermée ; le **programme** du chef d'équipe ouvre/ferme des canons (`programme` : t = 0, 12, 24, 45 s). Objectif : 6 000 m³ produits en 3 nuits au plus, 2 coups de bélier au plus (au 3e, la conduite casse : niveau raté). Une pompe ne suffit pas à pleine charge (324 m³/h), deux oui ; avec peu de canons ouverts, il faut fermer un peu la vanne.
- **Niveau 2 · Construire le réseau** : comme avant (objectif 30 000 m³ sur la piste).
- **Menu** (bouton « Menu », et à l'ouverture sans `?niveau=`) : cartes des niveaux (réussi, partie en cours, Jouer / Reprendre / Recommencer), les 4 niveaux, liens Modèles 3D et Vérifications. Choisir un autre niveau recharge la page avec `index.html?niveau=<id>` (`&nouvelle` pour repartir de zéro).
- **Sauvegarde** (`localStorage`, try/catch) : `nivo-partie-<id>` (le réseau complet, version 1), enregistrée après chaque action et chaque nuit (pas avant la première action) ; `nivo-progression` (`niveaux[id].reussi`, `dernier`). L'accueil DesDés lit ces clés pour afficher la partie en cours.
- `CONFIG.progression.toutOuvert = true` pendant la mise au point (tous les niveaux jouables) ; à `false`, un niveau s'ouvre quand le précédent est réussi.


## Affichage et réglages (retouches demandées après l'étape 6)

- Fiche d'un canon : **à gauche** sur un écran large (paysage, 700 px et plus), **volet qui monte du bas** sur téléphone (on le ferme avec × ou en le glissant vers le bas). À l'ouverture, la vue se centre sur le canon et l'endroit où tombe sa neige, dans la partie de l'écran que la fiche laisse libre (`decalerVue` : `camera.setViewOffset`).
- Fiche d'un canon : **curseurs** pour la direction (−180 à 180°, pas de 5°) et l'inclinaison (0 à 35°) ; le canon tourne en direct, la nuit est recalculée. Jauge de pression.
- **Jauges de pression** (`jaugePression`, `zonesPression` dans interface.js) : bande 0 → 80 bar, rouge = pas de neige ou surpression, orange = production réduite ou pression haute, vert = bonne pression, trait blanc = pression actuelle (prévue canons fermés le jour). Une au départ de la salle de pompage (zone verte 38–54 bar), une par canon.
- Poste de travail : blocs à gauche, **liste des canons dans une colonne à droite** (en dessous sur téléphone) avec un résumé « bonne pression / réduite ou haute / hors limites ». Boutons **Lancer la nuit** et Accélérer dans le bloc de la nuit (le bouton de la barre du bas reste).
- Couleurs d'état des canons : **vert = en marche** (même production réduite), **rouge = à l'arrêt**, **jaune = en défaut** (pression, air). Petit point de couleur au-dessus de chaque enneigeur (`creerPointEtat`), même code pour le voyant 3D et les voyants du poste. La bulle eau / électricité / air est **sous** l'enneigeur.
- Noms des bâtiments (`creerEtiquette(nom, couleur, carre)`) : de loin (plus de `CONFIG.graphismes.distanceEtiquettes` = 170 m), un **petit carré** de couleur : bleu = salle de pompage, jaune = départ électrique, blanc = compresseur ; de près, le nom (`majEtiquettes`).
- **Dameuse** (`creerDameuse`) : quand l'objectif du niveau est atteint, une dameuse par piste fait des allers-retours (deux passes décalées), phares et gyrophare allumés ; les tas de neige sur la piste s'étalent à son passage (`tas.dame`). `CONFIG.dameuse.vitesse`.

## Pannes et réparations (niveau 4, étape 7)

- **Niveau 4 · Les pannes et les réparations** : réseau déjà construit (`reseauFixe` avec `liaisons` : chaînes par réseau) — 6 V10 sur tour aux Clarines (R1–R6, eau depuis la salle, câble depuis `elec1`), 4 perches de 10 m aux Gentianes (R7–R10, eau depuis R5, câble depuis le départ des Gentianes `elec4`, air depuis le compresseur par R3 et R5). Budget 120 000 € (réparations, canons en plus). Objectif : **18 000 m³ sur les pistes en 6 nuits** (sans panne, environ 23 000 m³ avec l'orientation de départ).
- `CONFIG.pannes` : 1 à 3 pannes par nuit, entre 4 et 45 s, tirées au sort (`planifierPannes`, toujours les mêmes pour une même nuit), jamais deux fois sur la même chose :
  | Panne | Effet | Réparation |
  |---|---|---|
  | Fuite sur une conduite | 30 m³/h perdus (retenue), −10 bar pour les regards en aval | 6 000 €, 15 s ; conduite **isolée** pendant les travaux (plus d'eau en aval) |
  | Moteur de ventilateur grillé | ce canon s'arrête | 2 500 €, 10 s |
  | Buse gelée (perche) | production × 0,4 | 300 €, 5 s |
  | Disjoncteur déclenché | le départ électrique ne fournit plus rien | « Réarmer », gratuit, 2 s |
  | Pompe en défaut thermique | une pompe de moins | 4 000 €, 20 s |
- Simulation : `res.pannes` (`{ id, type, cible, etat: 'active' | 'reparation', fin }`), `effetsPannes` (utilisé par `regimeNuit`), `evenementsPannes`, `reparerPanne` (payée tout de suite ; la nuit l'équipe met `duree` s, le jour c'est immédiat), `avancerPannes`, `libellePanne`, `positionPanne`. À la fin de la nuit, les réparations en cours se terminent ; les pannes non réparées restent. Remplacer un enneigeur supprime sa panne.
- Jeu : message rouge quand une panne arrive ; triangle jaune clignotant au-dessus (clé bleue pendant la réparation) ; gerbe d'eau et flaque de glace sur une fuite ; voyant jaune « DÉFAUT » pour une pompe ; canon en panne en jaune. Bloc **Pannes** au poste (Réparer / Réarmer, Voir), ligne de panne dans la fiche, total des réparations au bilan.

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
- Une nuit = **60 s** de jeu = 12 h (1 s de jeu = 720 s réelles) ; la retenue (11 260 m³ pleine) se vide au débit réel et regagne 3 000 m³ par jour ; vide = pompes à sec, tout s'arrête (alarme).
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
- [x] **Étape 7 — Pannes et réparations** (niveau 4) : fuites, moteurs, buses gelées, disjoncteurs, pompes ; repères en 3D, bloc « Pannes » au poste, réparation par l'équipe. 97 vérifications.

### Idées à garder en tête

- Météo plus complète (température humide, redoux) qui module la production.
- Tranchées avec points intermédiaires (détours) si l'utilisateur le demande.
