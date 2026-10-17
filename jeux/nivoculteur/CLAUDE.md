# Nivoculteur — jeu de neige de culture (version 2D)

Jeu de gestion sur le métier de nivoculteur (technicien de production de neige de culture), **en 2D, vu de dessus, carte à plat**.
Il fait partie de la plate-forme DesDés (carte `.gnivo` sur l'accueil `../../index.html`), mais s'ouvre aussi seul en double-cliquant sur `index.html`.

L'utilisateur est nivoculteur de métier, pas développeur : le jeu doit être crédible techniquement mais simple à jouer.
Expliquer les choix simplement, sans jargon non expliqué, et **demander avant toute décision importante**.
Avancer étape par étape : proposer un plan court, attendre la validation, puis coder ; à la fin de chaque étape, dire comment tester et mettre ce fichier à jour.

## Vision (refonte demandée par l'utilisateur)

La version 3D (Three.js, carrière, tutoriels, exploitation de station, tracé de pistes, remontées, dameuses, commerces) a été **remplacée** par une version 2D plus simple, « comme pour les dameuses, mais pour les canons à neige ».
Choix validés : remplacer la 3D ; **réseau complet** à construire (tranchées, regards, canons) ; **plusieurs nuits** par partie ; la nuit vivante : **température humide, vent qui tourne, pannes, salle des machines** ; une **vue d'ensemble des canons** comme une carte pour les démarrer et les arrêter facilement.

Boucle : un **domaine tiré au sort** (taille au choix) avec un objectif (m³ sur les pistes en N nuits) et un budget → **le jour** on construit → **la nuit** on produit (froid, vent, pression) → **le matin** le bilan (la neige sur piste est payée) → nuit suivante → **étoiles** à la fin.

## Règles techniques

- `index.html` contient le HTML et le CSS ; le JavaScript est découpé en fichiers dans `js/`, chargés dans l'ordre par des balises `<script>` classiques (avec `?v=` mis à jour par `outils/version.sh`). Pas de npm, pas de modules ES : le jeu doit s'ouvrir en double-cliquant (`file://`).
- Dessin en **canvas 2D** ; aucune image externe.
- Commandes : **un doigt = déplacer la carte**, deux doigts = zoomer (molette à la souris), **toucher court = action**.
- Page adaptée au téléphone (portrait d'abord) et à l'ordinateur. Chaque texte reste dans sa capsule (vérifier à 360, 390, 430, 768 et 1 280 px).
- Sauvegarde dans `localStorage` (try/catch), clés préfixées `nivo-` : `nivo-partie` (le réseau complet, `version: 2`, avec `taille` et `graine` du domaine), `nivo-records` (étoiles et meilleur % par taille). L'accueil DesDés lit ces deux clés.
- **Toute l'interface est en français.** **Débits en m³/h**, pressions en bar, températures en °C humides.
- Unité : 1 m. x de gauche à droite, y du haut du domaine (sommet) vers le bas (front de neige). Le haut de la carte est le nord. Une direction `dir` (radians) : 0 = vers le bas de la carte, vecteur (sin dir, cos dir).

### Fichiers (chargés dans cet ordre)

| Fichier | Contenu |
|---|---|
| `js/config.js` | `CONFIG` (tous les chiffres réglables), `CATALOGUE` (V8, V9, V10), `SUPPORTS` (trépied, tour, tour haute) |
| `js/domaine.js` | outils (`alea`, `borne`, `lisse`, `distanceSegment`), `creerDomaine(taille, graine)` (relief, pistes, forêt, salle, retenue, départs), `pisteSous`, `directionVersPiste` |
| `js/simulation.js` | logique pure : réseau, devis, météo de la nuit, pression, production, tas, bilan, `testsSimulation()` |
| `js/carte.js` | dessin de la carte (image du terrain préparée une fois, puis réseau, canons, jets, tas, nuit) et caméra |
| `js/jeu.js` | écrans, outils, fiche d'un canon, vue des canons, salle des machines, nuit, bilan, menu, sauvegarde, boucle |

Tester la simulation sans navigateur : concaténer `config.js`, `domaine.js` et `simulation.js` puis appeler `testsSimulation()` avec Node. Dans le navigateur : `index.html?test` (33 vérifications).

## Les pistes (une piste par partie, `CONFIG.domaines`) — demande de l'utilisateur

« Pas le budget pour faire plusieurs pistes en 5 jours » : comme dans la Dameuse, on choisit **une piste** à enneiger, plus ou moins grande. Noms des pistes de **Luchon-Superbagnères** (couleurs à confirmer par l'utilisateur, sauf les Marmottes bleue, le Gouron et le Bois des Coqs noirs, trouvés en ligne).

| Piste | Couleur | Longueur × largeur | Dénivelé | Budget | Objectif |
|---|---|---|---|---|---|
| Le Renard | verte | 330 × 30 m | 55–70 m | 200 k€ | 4 900 m³ en 4 nuits |
| Les Violettes | verte | 420 × 34 m | 75–95 m | 250 k€ | 6 400 m³ en 4 nuits |
| Le Lac | bleue | 500 × 34 m | 120–140 m | 300 k€ | 10 500 m³ en 5 nuits |
| Les Marmottes | bleue | 680 × 38 m | 170–200 m | 400 k€ | 14 000 m³ en 5 nuits |
| Hount Estrete | rouge | 520 × 32 m | 170–190 m | 330 k€ | 11 500 m³ en 5 nuits |
| Lafforgue | rouge | 620 × 34 m | 200–230 m | 380 k€ | 13 000 m³ en 5 nuits |
| Le Gouron | noire | 480 × 30 m | 200–230 m | 330 k€ | 11 000 m³ en 5 nuits |
| Le Bois des Coqs | noire | 600 × 32 m | 250–280 m | 400 k€ | 15 000 m³ en 6 nuits |

- `creerDomaine(id, graine)` : la carte fait la largeur de la piste + 230 m ; la piste serpente du haut vers le front de neige (95 m presque plats en bas, salle des machines et retenue) ; la forme change à chaque partie (graine), pas les dimensions. 1 départ électrique (2 au-delà de 450 m), forêt autour. Bas du domaine vers 1 440 m.
- **Tranchées moins chères** (le rendement ne suffisait pas) : eau 380 €/m, câble 250 €/m, commune 450 €/m ; dans une tranchée existante : eau 180, câble 70 €/m.
- Équilibrage vérifié avec un joueur simulé (V8 sur trépied tous les 35 m de part et d'autre de la piste, réinvestit, ne réoriente pas) : 95 à 135 % de l'objectif selon la météo (environ 120 % en moyenne) ; en réorientant au vent et en passant aux V9 / V10 et aux tours, les 3 étoiles (150 %) sont jouables.
- Records par piste dans `nivo-records` ; une ancienne partie (petit / moyen / grand domaine) ne se reprend pas.

## Écran (allégé à la demande de l'utilisateur : « trop d'infos, les mettre dans un menu »)

- **Haut** : ← DesDés, nom du domaine, ☰ Menu ; 4 compteurs : Budget, Neige sur les pistes (barre), Nuit (ou l'heure la nuit), **Météo ▾** (température et vent ; touché : la prévision détaillée, la température en haut, la retenue).
- **Bas** : une seule rangée — 🔧 Construire (ouvre un tiroir avec les outils et ↶ Annuler), 🗺 Canons, 🏭 Salle, 🌙 Nuit (×1 / ×3 / ×10 et la barre de la nuit pendant la nuit). L'outil en main est rappelé dans une puce bleue (avec ✕ pour le ranger). Un seul message à la fois sur téléphone, juste au-dessus des boutons.
- **☰ Menu** : Météo et infos, Voir toute la carte, Comment jouer, Domaines (changer de partie).
- **Carte** : glisser un doigt (avec élan au lâcher), pincer à deux doigts (zoom autour des doigts, et le milieu des doigts entraîne la carte), molette ; boutons ＋ − ⌖ à droite. Un toucher compte comme une action s'il bouge de moins de 12 px.

## Construction (le jour)

- Coûts (`CONFIG.couts`) : tranchée eau seule 750 €/m, câble seul 550 €/m, **commune eau + câble 900 €/m**, dans une tranchée déjà creusée : eau 350, câble 150 €/m ; regard 5 000 € + enneigeur ; reprise d'un enneigeur remplacé 50 % ; démontage : 50 % du regard et de l'enneigeur, 25 % des tranchées.
- Outils (tiroir 🔧 Construire) : **Eau + câble** (le plus courant), **Eau**, **Câble**, **+ Regard**, **Démonter**, **↶** (annule la dernière action du jour, l'argent revient ; l'historique est vidé au lancement de la nuit).
  On touche un point de départ (salle, départ ⚡ pour le câble, regard), puis un regard ou un endroit libre (nouveau regard, avec choix de l'enneigeur et du support dans le devis) ; après validation, le départ devient le nouveau regard (on enchaîne). Tranchées en ligne droite, pas à travers la retenue ; regards à 12 m les uns des autres au moins.
- Un canon a besoin de l'**eau** (depuis la salle) et de l'**électricité** (salle ou départ électrique). Un « ! » jaune signale un regard incomplet.
- Toucher un canon (sans outil) ouvre sa **fiche** (panneau du bas) : état et raison, pression (prévue le jour) avec jauge, production, part de neige sur la piste, altitude (le jour) ou température sur place (la nuit), **mode** (Auto / Marche / Arrêt), **orientation** (curseur −180 à 180°, bouton « Vers la piste »), changement d'enneigeur et de support (le jour), Démonter. La zone où tombe sa neige est dessinée (verte, jaune ou rouge selon la part sur la piste).

## Catalogue

| Enneigeur | Prix | Eau (m³/h) | Pression mini / pleine | Neige à pleine production | Portée | Débloqué |
|---|---|---|---|---|---|---|
| Ventilateur V8 | 10 000 € | 22 | 8 / 20 bar | 35 m³/h | 22 m | dès le départ |
| Ventilateur V9 | 18 000 € | 36 | 8 / 22 bar | 55 m³/h | 27 m | 5 000 m³ sur les pistes |
| Ventilateur V10 | 28 000 € | 54 | 8 / 24 bar | 80 m³/h | 32 m | 15 000 m³ |

Supports : trépied (portée × 1), tour +4 000 € (× 1,12), tour haute +7 000 € (× 1,25) ; plus haut = plus de dérive au vent.

## La nuit

- **180 s de jeu = 18 h → 6 h** (12 h), vitesse ×1 / ×3 / ×10.
- **Température humide** (`CONFIG.temperature`, `meteoNuit`, `temperature`) : tirée au sort pour chaque nuit (toujours la même pour une même nuit) ; de −4 à 0 °C à 18 h, minimum de −13 à −5 °C vers 4 h, puis remonte un peu ; 20 % des nuits ont un **redoux** (+3 à +6 °C pendant environ 1 h 30). **0,6 °C de moins par 100 m de montée.** Production : 0 au-dessus de −2 °C, 50 % à −4 °C, 100 % à −7 °C et plus froid (`facteurTemperature`). Prévision annoncée la veille ; courbe à la salle des machines.
- **Vent** (`CONFIG.vent`) : force et direction au départ, puis 1 à 3 sautes (jusqu'à 70° et ±11 km/h), annoncées par un message. Point de chute = direction × portée (modèle, support) + dérive (force × hauteur du jet × 0,5). Seule la part qui tombe sur une piste rapporte (19 points testés dans la zone).
- **Modes** : auto (démarre sous −2 °C, s'arrête au-dessus), marche (tourne même au chaud : consomme de l'eau, fait de l'eau, compté « eau gaspillée » au bilan), arrêt.
- **Pression** : `P = P_départ − longueur/100 × 0,6 − montée/10 × 1,2 − débit total × 0,05`. Pompes automatiques (3 × 180 m³/h, courbe 62 bar sans débit → 52 bar au nominal, départ plafonné à 52 bar). Production 35 % à la pression mini, 100 % à la pleine ; au-dessus de 55 bar, mise en sécurité. Tant qu'un canon ouvert manque de pression, on ferme le plus défavorisé (`regime`).
- **Retenue** : se vide au débit réel, se remplit le jour du volume choisi (0, 1 500, 3 000, 4 500 m³, 0,50 €/m³) ; vide = tout s'arrête.
- **Électricité** : 160 kW par pompe en marche, 0,18 €/kWh.
- Couleurs : **vert** en marche, **rouge** à l'arrêt, **jaune** en défaut (pression, eau/électricité manquante, trop chaud en marche forcée).
- Tas de neige : regroupés là où tombe la neige (`deposer`), dessinés en blanc ; ils restent d'une nuit à l'autre.
- **Bilan** du matin : neige produite, sur les pistes (par piste), perdue hors piste, eau gaspillée, neige vendue (20 €/m³), électricité, eau remontée, résultat. Déblocages annoncés.

## Vue des canons (demande de l'utilisateur)

Bouton 🗺 **Canons** : un plan du domaine (pistes, retenue, salle, tranchées) avec **une vignette par canon** placée près de son canon (écartées automatiquement pour ne pas se chevaucher, reliées par un trait) : nom, mode (AUTO / MARCHE / ARRÊT), pression, % sur la piste, production et température la nuit. Toucher une vignette : Auto / Marche / Arrêt / Voir (centre la carte et ouvre la fiche). En haut : **Tout en auto / Tout démarrer / Tout arrêter** et un résumé (en marche, arrêtés, en défaut, production, débit, pression de départ). Mis à jour 4 fois par seconde sans recréer les boutons.

## Salle des machines

Bouton 🏭 (ou toucher la salle) : pompes (automatiques pour l'instant), pression de départ (jauge, zone verte 38–54 bar), débit demandé et capacité, retenue et remplissage, courbe de la température de la nuit (lignes −2, −4, −7 °C, curseur de l'heure), vent et sautes prévues, neige et électricité de la nuit.

## Fin de partie

Après la dernière nuit : étoiles à 100, 125 et 150 % de l'objectif (`CONFIG.etoiles`), budget restant, record par taille ; « Nouveau domaine ».

## Plan et avancement

- [x] **Étape 1** : carte 2D, domaines au hasard, construction complète (eau, câble, regards, ventilateurs), nuits avec température humide, vent qui tourne, pression (pompes auto), tas, bilan, plusieurs nuits, étoiles, vue des canons, salle des machines (lecture), sauvegarde, carte d'accueil ; 3D supprimée.
- [ ] **Étape 2** : salle des machines complète (pompes et vanne à la main, coups de bélier, compresseur, air comprimé et perches).
- [ ] **Étape 3** : pannes à réparer la nuit (fuites, moteurs, disjoncteurs, pompes, buses gelées), réglages après les essais de l'utilisateur.

Chiffres repris de l'ancienne version pour l'étape 2 : vanne (perte = débit × 0,05 × (1/ouverture² − 1)), coup de bélier (vanne ouverte ou fermée de plus de 30 % en moins d'1 s, ou 1re pompe démarrée vanne ouverte à plus de 30 % ; 5 000 €), compresseur 600 Nm³/h, 75 kW, réservoir 8 bar, perches 6 m / 10 m / 10 m NG (11–13 m³/h d'eau, 30–70 Nm³/h d'air, 18/28 bar ou 14/22 bar, 15–18 m³/h de neige), tranchée d'air 650 €/m (200 dans une tranchée existante), production d'une perche nulle sous 4 bar d'air, pleine à 6 bar. Pannes : fuite (6 000 €, 30 s, −10 bar en aval, 30 m³/h perdus), moteur (2 500 €, 20 s), buse gelée (300 €, 10 s, × 0,4), disjoncteur (réarmer, 4 s), pompe (4 000 €, 40 s).
